import mongoose from 'mongoose';
import { Destination } from '@/models/Destination';
import { ConsentHistory } from '@/models/ConsentHistory';
import { AttendanceEvent } from '@/models/AttendanceEvent';
import { ConsentStatus } from '@/types/consent';
import { recordAttendanceEvent } from '@/services/attendance/attendance-audit.service';
import { writeAuditLog } from '@/models/AuditLog';

function maskPhoneIdentifier(identifier: string): string {
  const digits = identifier.replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
}

export type LgpdPortalEventKind =
  | 'lgpd.export_requested'
  | 'lgpd.delete_requested'
  | 'lgpd.anonymized';

const LGPD_EVENT_KINDS: LgpdPortalEventKind[] = [
  'lgpd.export_requested',
  'lgpd.delete_requested',
  'lgpd.anonymized',
];

export function normalizeLgpdPhoneQuery(raw: string): string {
  return raw.replace(/\D/g, '');
}

export async function lookupLgpdDestinationsByPhone(
  clientId: string,
  phoneRaw: string,
): Promise<
  Array<{
    id: string;
    name: string;
    identifierMasked: string;
    consentStatus: string;
    isActive: boolean;
  }>
> {
  const digits = normalizeLgpdPhoneQuery(phoneRaw);
  if (digits.length < 8) {
    throw new Error('Informe um telefone válido (mín. 8 dígitos).');
  }

  const clientOid = new mongoose.Types.ObjectId(clientId);
  const suffix = digits.slice(-11);

  const rows = await Destination.find({
    clientId: clientOid,
    type: 'contact',
    identifier: { $regex: `${suffix}$` },
  })
    .select('name identifier consentStatus isActive')
    .limit(10)
    .lean();

  return rows.map(d => ({
    id: String(d._id),
    name: d.name,
    identifierMasked: maskPhoneIdentifier(d.identifier),
    consentStatus: d.consentStatus ?? ConsentStatus.PENDING,
    isActive: d.isActive !== false,
  }));
}

async function findContactForLgpd(clientId: string, destinationId: string) {
  const dest = await Destination.findOne({
    _id: new mongoose.Types.ObjectId(destinationId),
    clientId: new mongoose.Types.ObjectId(clientId),
    type: 'contact',
  });
  if (!dest) throw new Error('Contato não encontrado');
  return dest;
}

/** Pacote JSON titular — sem mídia binária. */
export async function buildTitularExportPackage(
  clientId: string,
  destinationId: string,
  actorUserId: string,
): Promise<Record<string, unknown>> {
  const dest = await findContactForLgpd(clientId, destinationId);
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const destOid = dest._id;

  const history = await ConsentHistory.find({
    clientId: clientOid,
    destinationId: destOid,
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  await recordAttendanceEvent({
    clientId,
    kind: 'lgpd.export_requested',
    actorUserId,
    meta: {
      destinationId,
      identifierMasked: maskPhoneIdentifier(dest.identifier),
    },
  });

  await writeAuditLog({
    action: 'lgpd.export',
    actorUserId,
    details: {
      clientId,
      destinationId,
      identifierMasked: maskPhoneIdentifier(dest.identifier),
    },
  });

  return {
    schema: 'radarzap-lgpd-export-v1',
    exportedAt: new Date().toISOString(),
    destination: {
      id: String(dest._id),
      name: dest.name,
      identifier: dest.identifier,
      email: dest.email ?? null,
      consentStatus: dest.consentStatus,
      consent: {
        granted: dest.consent?.granted ?? false,
        grantedAt: dest.consent?.grantedAt ?? null,
        source: dest.consent?.source ?? null,
      },
      tags: dest.tags ?? [],
      notes: dest.notes ?? null,
      organization: dest.organization ?? null,
      birthday: dest.birthday ?? null,
      contactKind: dest.contactKind ?? null,
      commercialStatus: dest.commercialStatus ?? null,
      createdAt: dest.createdAt,
      isActive: dest.isActive,
    },
    consentHistory: history.map(h => ({
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      origin: h.origin,
      createdAt: h.createdAt,
      requestedByUserId: h.requestedByUserId ?? null,
    })),
  };
}

/** Anonimiza contato titular — irreversível no painel. */
export async function anonymizeTitularContact(input: {
  clientId: string;
  destinationId: string;
  actorUserId: string;
  reason?: string;
}): Promise<{ ok: true; destinationId: string }> {
  const dest = await findContactForLgpd(input.clientId, input.destinationId);

  if (String(dest.identifier).startsWith('anon:')) {
    throw new Error('Contato já anonimizado.');
  }

  const previousIdentifier = dest.identifier;

  await recordAttendanceEvent({
    clientId: input.clientId,
    kind: 'lgpd.delete_requested',
    actorUserId: input.actorUserId,
    meta: {
      destinationId: input.destinationId,
      identifierMasked: maskPhoneIdentifier(previousIdentifier),
      reason: input.reason?.trim().slice(0, 240) || 'titular_request',
    },
  });

  dest.name = 'Titular anonimizado';
  dest.email = undefined;
  dest.notes = undefined;
  dest.birthday = undefined;
  dest.secondaryPhone = undefined;
  dest.organization = undefined;
  dest.tags = [];
  dest.profilePictureData = undefined;
  dest.profilePictureMime = undefined;
  dest.profilePictureUpdatedAt = undefined;
  dest.pendingOutboundDeliveries = [];
  dest.pendingOutboundCount = 0;
  dest.isActive = false;
  dest.consent.granted = false;
  dest.consentStatus = ConsentStatus.MANUALLY_BLOCKED;
  dest.identifier = `anon:${String(dest._id)}`;
  await dest.save();

  await recordAttendanceEvent({
    clientId: input.clientId,
    kind: 'lgpd.anonymized',
    actorUserId: input.actorUserId,
    meta: {
      destinationId: input.destinationId,
      previousIdentifierMasked: maskPhoneIdentifier(previousIdentifier),
    },
  });

  await writeAuditLog({
    action: 'lgpd.anonymize',
    actorUserId: input.actorUserId,
    details: {
      clientId: input.clientId,
      destinationId: input.destinationId,
      previousIdentifierMasked: maskPhoneIdentifier(previousIdentifier),
      reason: input.reason?.trim().slice(0, 240) || 'titular_request',
    },
  });

  return { ok: true, destinationId: input.destinationId };
}

export async function listRecentLgpdPortalEvents(clientId: string, limit = 30) {
  const rows = await AttendanceEvent.find({
    clientId: new mongoose.Types.ObjectId(clientId),
    kind: { $in: LGPD_EVENT_KINDS },
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .lean();

  return rows.map(r => ({
    id: String(r._id),
    kind: r.kind,
    createdAt: r.createdAt,
    actorUserId: r.actorUserId ? String(r.actorUserId) : null,
    meta: r.meta ?? {},
  }));
}
