/** Espelho dos limites do backend — uso no painel. */

export const WHATSAPP_LIMITS = {
  MIN_DELAY_BETWEEN_MS: 3000,
  RISK_MIN_DELAY_BETWEEN_MS: 1000,
  MAX_MESSAGE_LENGTH: 4096,
  MAX_CAMPAIGN_TITLE_LENGTH: 120,
  MAX_MESSAGES_PER_MINUTE: 20,
  MAX_DESTINATIONS_PER_CAMPAIGN: 500,
  SAFE_BATCH_SIZE: 20,
  SAFE_BATCH_COOLDOWN_MS: 60_000,
} as const;

export const ALLOWED_SAFE_CAMPAIGN_DELAYS_MS = [3000, 5000, 10000, 30000] as const;
export const ALLOWED_RISK_CAMPAIGN_DELAYS_MS = [1000, 2000, 3000, 5000] as const;

export type BillingLimits = {
  messagesPerDay: number;
  groupsMax: number;
  templatesMax: number;
};

export type BillingUsage = { messagesUsed: number; lastReset?: string };

export function isUnlimited(value: number): boolean {
  return value === -1;
}

export function remainingDailyMessages(
  usage: BillingUsage,
  limits: Pick<BillingLimits, 'messagesPerDay'>,
): number {
  if (isUnlimited(limits.messagesPerDay)) return Number.POSITIVE_INFINITY;
  return Math.max(0, limits.messagesPerDay - usage.messagesUsed);
}

export function formatPlanLimit(value: number, unit = ''): string {
  if (isUnlimited(value)) return 'Ilimitado';
  return `${value}${unit}`;
}

export function normalizeDelayMs(ms: number, acceptWhatsAppRisk: boolean): number {
  const min = acceptWhatsAppRisk
    ? WHATSAPP_LIMITS.RISK_MIN_DELAY_BETWEEN_MS
    : WHATSAPP_LIMITS.MIN_DELAY_BETWEEN_MS;
  return Math.max(min, ms);
}

export function effectiveSafeBatchSize(isWhatsAppBusiness = false): number {
  return isWhatsAppBusiness
    ? WHATSAPP_LIMITS.SAFE_BATCH_SIZE * 2
    : WHATSAPP_LIMITS.SAFE_BATCH_SIZE;
}

export function estimateCampaignDurationMs(
  destinationCount: number,
  delayBetweenMs: number,
  acceptWhatsAppRisk = false,
  isWhatsAppBusiness = false,
): number {
  if (destinationCount <= 1) return 0;
  const delay = normalizeDelayMs(delayBetweenMs, acceptWhatsAppRisk);

  if (acceptWhatsAppRisk) {
    return (destinationCount - 1) * delay;
  }

  const batchSize = effectiveSafeBatchSize(isWhatsAppBusiness);
  const { SAFE_BATCH_COOLDOWN_MS } = WHATSAPP_LIMITS;
  let total = 0;
  let remaining = destinationCount;

  while (remaining > 0) {
    const batch = Math.min(batchSize, remaining);
    if (batch > 1) total += (batch - 1) * delay;
    remaining -= batch;
    if (remaining > 0) total += SAFE_BATCH_COOLDOWN_MS;
  }

  return total;
}

export function estimateBatchCount(
  destinationCount: number,
  acceptWhatsAppRisk: boolean,
  isWhatsAppBusiness = false,
): number {
  if (acceptWhatsAppRisk || destinationCount <= 1) return 1;
  return Math.ceil(destinationCount / effectiveSafeBatchSize(isWhatsAppBusiness));
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return 'instantâneo';
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `~${sec}s`;
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  if (min < 60) return rest > 0 ? `~${min} min ${rest}s` : `~${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `~${h}h ${m}min` : `~${h}h`;
}

export function exceedsPlanQuota(
  selectedCount: number,
  limits: BillingLimits,
  usage: BillingUsage,
): boolean {
  if (isUnlimited(limits.messagesPerDay)) return false;
  return selectedCount > remainingDailyMessages(usage, limits);
}
