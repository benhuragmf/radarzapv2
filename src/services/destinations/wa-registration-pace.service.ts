import { getOrganizationPlanId } from '@/utils/branding-plan.util';

export type WaRegistrationPaceTier = 'slow' | 'medium' | 'fast';

export interface WaRegistrationPaceConfig {
  tier: WaRegistrationPaceTier;
  tierLabel: string;
  planId: string;
  /** Intervalo entre checagens em background (1+ contatos por ciclo). */
  cycleIntervalMs: number;
  backgroundBatch: number;
  manualBatchMax: number;
  /** Referência comercial: horas para ~1.000 contatos na fila. */
  referenceHoursPer1000: number;
  contactsPerHour: number;
  paceHint: string;
}

const HOUR_MS = 3_600_000;

function buildPace(
  tier: WaRegistrationPaceTier,
  tierLabel: string,
  referenceHoursPer1000: number,
  backgroundBatch: number,
  manualBatchMax: number,
): Omit<WaRegistrationPaceConfig, 'planId'> {
  const cycleIntervalMs = Math.ceil(
    (referenceHoursPer1000 * HOUR_MS) / (1000 / backgroundBatch),
  );
  const contactsPerHour = Math.round((1000 / referenceHoursPer1000) * 10) / 10;

  const hoursLabel =
    referenceHoursPer1000 >= 24
      ? `${referenceHoursPer1000} h`
      : referenceHoursPer1000 === 1
        ? '1 h'
        : `${referenceHoursPer1000} h`;

  return {
    tier,
    tierLabel,
    cycleIntervalMs,
    backgroundBatch,
    manualBatchMax,
    referenceHoursPer1000,
    contactsPerHour: Math.round((1000 / referenceHoursPer1000) * 10) / 10,
    paceHint: `Validação ${tierLabel.toLowerCase()} do seu plano (~1.000 números em até ${hoursLabel}). O envio só libera após cada checagem no WhatsApp.`,
  };
}

const SLOW = buildPace('slow', 'Lenta (Free)', 24, 1, 3);
const MEDIUM = buildPace('medium', 'Média (Pro)', 6, 2, 12);
const FAST = buildPace('fast', 'Rápida (Enterprise)', 1, 5, 30);

export function resolveWaRegistrationPaceFromPlanId(planId: string): WaRegistrationPaceConfig {
  const id = (planId ?? 'free').trim().toLowerCase() || 'free';

  let base: Omit<WaRegistrationPaceConfig, 'planId'>;
  if (id === 'enterprise') {
    base = FAST;
  } else if (id === 'pro' || id === 'starter') {
    base = MEDIUM;
  } else {
    // free, trial e desconhecidos
    base = SLOW;
  }

  return { ...base, planId: id };
}

export async function resolveWaRegistrationPaceForClient(
  clientId: string,
): Promise<WaRegistrationPaceConfig> {
  const planId = await getOrganizationPlanId(clientId);
  return resolveWaRegistrationPaceFromPlanId(planId);
}

export function estimateWaValidationHoursForPace(
  queueSize: number,
  pace: Pick<WaRegistrationPaceConfig, 'referenceHoursPer1000'>,
): number {
  if (queueSize <= 0) return 0;
  return Math.ceil((queueSize / 1000) * pace.referenceHoursPer1000 * 10) / 10;
}

export function clampWaRegistrationManualLimitForPace(
  limit: number | undefined,
  pace: Pick<WaRegistrationPaceConfig, 'manualBatchMax'>,
): number {
  const n = limit ?? pace.manualBatchMax;
  return Math.min(Math.max(n, 1), pace.manualBatchMax);
}
