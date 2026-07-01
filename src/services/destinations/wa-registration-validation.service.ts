import mongoose from 'mongoose';
import { Destination } from '@/models/Destination';
import type { IDestination } from '@/models/Destination';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import type { WaRegistrationStatus } from '@/types/wa-registration';
import {
  WA_REGISTRATION_BACKGROUND_BATCH,
  WA_REGISTRATION_MANUAL_BATCH_MAX,
  WA_REGISTRATION_INTERVAL_MS,
  WA_REGISTRATION_PACE_HINT,
  estimateWaValidationHoursRemaining,
  formatWaValidationEta,
} from '@/types/wa-registration';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('WaRegistrationValidation');

export interface WaRegistrationSyncResult {
  verified: number;
  notOnWhatsApp: number;
  failed: number;
  skipped: number;
}

export interface WaRegistrationStats {
  pending: number;
  verified: number;
  not_on_whatsapp: number;
  check_failed: number;
  totalContacts: number;
  queueSize: number;
  estimatedHoursRemaining: number;
  estimatedCompletionLabel: string;
  paceHint: string;
  contactsPerHour: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Bloqueia envio outbound até o número ser checado no WhatsApp. */
export function assertWaRegistrationSendAllowed(dest: IDestination): string | null {
  if (dest.type === 'group') return null;
  const st = (dest.waRegistrationStatus ?? 'pending') as WaRegistrationStatus;
  if (st === 'verified') return null;
  if (st === 'not_on_whatsapp') {
    return 'Este número não está cadastrado no WhatsApp. Remova da lista ou corrija o telefone.';
  }
  if (st === 'check_failed') {
    return `Falha ao validar este número no WhatsApp. Reconecte a sessão ou use Revalidar em Contatos. ${WA_REGISTRATION_PACE_HINT}`;
  }
  const eta = formatWaValidationEta(
    estimateWaValidationHoursRemaining(1),
  );
  return `Este número ainda aguarda validação no WhatsApp (próxima checagem ${eta}). ${WA_REGISTRATION_PACE_HINT}`;
}

export function clampWaRegistrationManualLimit(limit?: number): number {
  const n = limit ?? WA_REGISTRATION_MANUAL_BATCH_MAX;
  return Math.min(Math.max(n, 1), WA_REGISTRATION_MANUAL_BATCH_MAX);
}

/** Contato criado por mensagem inbound no WhatsApp — já comprovado pelo canal. */
export function markWaRegistrationVerifiedInbound(dest: IDestination, resolvedJid?: string): void {
  if (dest.type !== 'contact') return;
  dest.waRegistrationStatus = 'verified';
  dest.waCheckedAt = new Date();
  if (resolvedJid) dest.waResolvedJid = resolvedJid;
  if (!dest.phoneQuality || dest.phoneQuality === 'attention') {
    dest.phoneQuality = 'verified';
  }
}

export function markWaRegistrationPending(dest: IDestination): void {
  if (dest.type !== 'contact') return;
  dest.waRegistrationStatus = 'pending';
  dest.waCheckedAt = undefined;
  dest.waResolvedJid = undefined;
}

function buildPendingQuery(
  clientOid: mongoose.Types.ObjectId,
  options: { destinationIds?: string[] },
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    clientId: clientOid,
    type: 'contact',
    isActive: true,
  };

  if (options.destinationIds?.length) {
    return {
      ...base,
      _id: { $in: options.destinationIds.map(id => new mongoose.Types.ObjectId(id)) },
    };
  }

  return {
    ...base,
    $or: [
      { waRegistrationStatus: { $exists: false } },
      { waRegistrationStatus: null },
      { waRegistrationStatus: 'pending' },
      { waRegistrationStatus: 'check_failed' },
    ],
  };
}

async function applyCheckResult(
  destId: mongoose.Types.ObjectId,
  result: { exists: boolean; jid?: string },
  waConnected: boolean,
): Promise<'verified' | 'not_on_whatsapp' | 'check_failed'> {
  const now = new Date();
  if (!waConnected) {
    await Destination.updateOne(
      { _id: destId },
      { waRegistrationStatus: 'check_failed', waCheckedAt: now },
    );
    return 'check_failed';
  }

  if (result.exists) {
    await Destination.updateOne(
      { _id: destId },
      {
        waRegistrationStatus: 'verified',
        waCheckedAt: now,
        ...(result.jid ? { waResolvedJid: result.jid } : {}),
        phoneQuality: 'verified',
      },
    );
    return 'verified';
  }

  await Destination.updateOne(
    { _id: destId },
    {
      waRegistrationStatus: 'not_on_whatsapp',
      waCheckedAt: now,
      $unset: { waResolvedJid: '' },
      phoneQuality: 'no_whatsapp',
    },
  );
  return 'not_on_whatsapp';
}

/**
 * Valida lote de contatos via onWhatsApp (rate-limit entre chamadas).
 */
export async function syncWaRegistrationForClient(
  clientId: string,
  options: {
    limit?: number;
    destinationIds?: string[];
    /** Ignora teto manual (só uso interno pontual — ex.: 1 contato novo). */
    allowFastSingle?: boolean;
  } = {},
): Promise<WaRegistrationSyncResult> {
  const requested = options.limit ?? WA_REGISTRATION_BACKGROUND_BATCH;
  const limit =
    options.allowFastSingle === true && requested <= 1
      ? 1
      : clampWaRegistrationManualLimit(requested);
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const wa = WhatsAppService.getInstance();
  const waConnected = wa.isClientConnected(clientId);

  const query = buildPendingQuery(clientOid, options);
  const dests = await Destination.find(query).sort({ updatedAt: 1 }).limit(limit).lean();

  let verified = 0;
  let notOnWhatsApp = 0;
  let failed = 0;
  let skipped = 0;

  if (dests.length === 0) {
    return { verified, notOnWhatsApp, failed, skipped };
  }

  logger.info(`Validando números WhatsApp: client=${clientId} fila=${dests.length}`, {
    connected: waConnected,
  });

  for (const d of dests) {
    if (d.waRegistrationStatus === 'verified' || d.waRegistrationStatus === 'not_on_whatsapp') {
      if (options.destinationIds?.length) {
        skipped++;
      }
      continue;
    }

    try {
      const check = waConnected
        ? await wa.checkContactOnWhatsApp(clientId, d.identifier)
        : { exists: false };
      const outcome = await applyCheckResult(d._id as mongoose.Types.ObjectId, check, waConnected);
      if (outcome === 'verified') verified++;
      else if (outcome === 'not_on_whatsapp') notOnWhatsApp++;
      else failed++;
    } catch (err) {
      failed++;
      await Destination.updateOne(
        { _id: d._id },
        { waRegistrationStatus: 'check_failed', waCheckedAt: new Date() },
      );
      logger.warn(`Falha ao validar ${d.identifier}: ${(err as Error).message}`);
    }

    if (waConnected && limit > 1) await sleep(WA_REGISTRATION_INTERVAL_MS / 4);
  }

  logger.info(
    `Validação WhatsApp: verificados=${verified} sem_wa=${notOnWhatsApp} falhas=${failed} ignorados=${skipped}`,
    { clientId },
  );

  return { verified, notOnWhatsApp, failed, skipped };
}

/** Marca contatos para nova checagem (cliente solicitou revalidação). */
export async function requestWaRevalidation(
  clientId: string,
  options: {
    destinationIds?: string[];
    includeNotOnWhatsApp?: boolean;
    includeCheckFailed?: boolean;
  } = {},
): Promise<{ queued: number }> {
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const filter: Record<string, unknown> = {
    clientId: clientOid,
    type: 'contact',
    isActive: true,
  };

  if (options.destinationIds?.length) {
    filter._id = { $in: options.destinationIds.map(id => new mongoose.Types.ObjectId(id)) };
  } else {
    const statuses: WaRegistrationStatus[] = ['not_on_whatsapp'];
    if (options.includeCheckFailed !== false) statuses.push('check_failed');
    if (options.includeNotOnWhatsApp === false) {
      statuses.splice(0, statuses.length, 'check_failed');
    }
    filter.waRegistrationStatus = { $in: statuses };
  }

  const result = await Destination.updateMany(filter, {
    $set: { waRegistrationStatus: 'pending' },
    $unset: { waCheckedAt: '', waResolvedJid: '' },
  });

  const queued = result.modifiedCount ?? 0;
  logger.info('Revalidação WhatsApp solicitada', { clientId, queued });
  return { queued };
}

export async function getWaRegistrationStats(clientId: string): Promise<WaRegistrationStats> {
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const base = { clientId: clientOid, type: 'contact' as const, isActive: true };

  const [pending, verified, notOnWa, checkFailed, totalContacts] = await Promise.all([
    Destination.countDocuments({
      ...base,
      $or: [
        { waRegistrationStatus: 'pending' },
        { waRegistrationStatus: { $exists: false } },
        { waRegistrationStatus: null },
      ],
    }),
    Destination.countDocuments({ ...base, waRegistrationStatus: 'verified' }),
    Destination.countDocuments({ ...base, waRegistrationStatus: 'not_on_whatsapp' }),
    Destination.countDocuments({ ...base, waRegistrationStatus: 'check_failed' }),
    Destination.countDocuments(base),
  ]);

  const queueSize = pending + checkFailed;
  const estimatedHoursRemaining = estimateWaValidationHoursRemaining(queueSize);
  const contactsPerHour =
    Math.round((3_600_000 / WA_REGISTRATION_INTERVAL_MS) * 10) / 10;

  return {
    pending,
    verified,
    not_on_whatsapp: notOnWa,
    check_failed: checkFailed,
    totalContacts,
    queueSize,
    estimatedHoursRemaining,
    estimatedCompletionLabel: formatWaValidationEta(estimatedHoursRemaining),
    paceHint: WA_REGISTRATION_PACE_HINT,
    contactsPerHour,
  };
}

export function matchesWaRegistrationFilter(
  status: WaRegistrationStatus | string | undefined | null,
  filter: import('@/types/wa-registration').WaRegistrationFilterKey,
): boolean {
  const st = status ?? 'pending';
  if (filter === 'needs_check') {
    return st === 'pending' || st === 'check_failed' || !status;
  }
  return st === filter;
}
