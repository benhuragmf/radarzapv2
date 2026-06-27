/** Espelho dos limites do backend — uso no painel. */

export const WHATSAPP_LIMITS = {
  MIN_DELAY_BETWEEN_MS: 30_000,
  RISK_MIN_DELAY_BETWEEN_MS: 3_000,
  MAX_MESSAGE_LENGTH: 4096,
  MAX_CAMPAIGN_TITLE_LENGTH: 120,
  MAX_MESSAGES_PER_MINUTE: 20,
  MAX_DESTINATIONS_PER_CAMPAIGN: 500,
  SAFE_BATCH_SIZE: 20,
  SAFE_BATCH_COOLDOWN_MS: 60_000,
} as const;

export interface CampaignDelaysUiConfig {
  protectedTiers: Array<{
    id: string
    label: string
    baseSec: number
    jitterMinSec: number
    jitterMaxSec: number
    enabled: boolean
  }>
  protectedDefaultTierId: string
  riskDelaysSec: number[]
  riskMinSec: number
}

export const DEFAULT_CAMPAIGN_DELAYS_UI: CampaignDelaysUiConfig = {
  protectedTiers: [
    { id: 'minimum', label: 'Mínimo', baseSec: 30, jitterMinSec: 30, jitterMaxSec: 39, enabled: true },
    { id: 'normal', label: 'Normal', baseSec: 40, jitterMinSec: 40, jitterMaxSec: 59, enabled: true },
    { id: 'optimal', label: 'Ótimo', baseSec: 60, jitterMinSec: 60, jitterMaxSec: 80, enabled: true },
  ],
  protectedDefaultTierId: 'normal',
  riskDelaysSec: [3, 10, 20],
  riskMinSec: 3,
}

export const ALLOWED_SAFE_CAMPAIGN_DELAYS_MS = [30_000, 40_000, 60_000] as const;
export const ALLOWED_RISK_CAMPAIGN_DELAYS_MS = [3_000, 10_000, 20_000] as const;
export const CAMPAIGN_SAFE_DEFAULT_DELAY_MS = 40_000;
export const CAMPAIGN_RISK_DEFAULT_DELAY_MS = 3_000;

function enabledTiers(config: CampaignDelaysUiConfig) {
  return config.protectedTiers.filter(t => t.enabled)
}

function protectedMs(config: CampaignDelaysUiConfig) {
  return enabledTiers(config).map(t => t.baseSec * 1000)
}

function riskMs(config: CampaignDelaysUiConfig) {
  return [...config.riskDelaysSec].map(s => s * 1000).sort((a, b) => a - b)
}

function defaultProtectedMs(config: CampaignDelaysUiConfig) {
  const tier =
    config.protectedTiers.find(t => t.id === config.protectedDefaultTierId && t.enabled) ??
    enabledTiers(config)[0]
  return (tier?.baseSec ?? 40) * 1000
}

function findTier(config: CampaignDelaysUiConfig, ms: number) {
  return enabledTiers(config).find(t => t.baseSec * 1000 === ms)
}

export function snapCampaignDelayMs(
  ms: number,
  acceptRisk: boolean,
  config: CampaignDelaysUiConfig = DEFAULT_CAMPAIGN_DELAYS_UI,
): number {
  const allowed = acceptRisk ? riskMs(config) : protectedMs(config)
  const fallback = acceptRisk ? riskMs(config)[0] ?? 3000 : defaultProtectedMs(config)
  if (!allowed.length) return fallback
  if (allowed.includes(ms)) return ms
  const sorted = [...allowed].sort((a, b) => a - b)
  return sorted.find(v => v >= ms) ?? sorted[sorted.length - 1]!
}

export function averageCampaignDelayMs(
  baseMs: number,
  acceptRisk: boolean,
  config: CampaignDelaysUiConfig = DEFAULT_CAMPAIGN_DELAYS_UI,
): number {
  const base = snapCampaignDelayMs(baseMs, acceptRisk, config)
  if (acceptRisk) return base
  const tier = findTier(config, base)
  if (!tier) return base
  return ((tier.jitterMinSec + tier.jitterMaxSec) / 2) * 1000
}

export function campaignDelayOptionLabel(
  ms: number,
  acceptRisk: boolean,
  config: CampaignDelaysUiConfig = DEFAULT_CAMPAIGN_DELAYS_UI,
): string {
  if (acceptRisk) {
    const sec = ms / 1000
    if (sec === config.riskMinSec) return `${sec} segundos (mínimo)`
    return `${sec} segundos`
  }
  const tier = findTier(config, ms)
  if (!tier) return `${ms / 1000} segundos`
  return `${tier.label} — ${tier.jitterMinSec}–${tier.jitterMaxSec}s entre envios`
}

export function campaignDelayJitterHint(
  ms: number,
  config: CampaignDelaysUiConfig = DEFAULT_CAMPAIGN_DELAYS_UI,
): string | null {
  const tier = findTier(config, ms)
  if (!tier) return null
  return `Cada envio aguarda ${tier.jitterMinSec}–${tier.jitterMaxSec}s (aleatório, não fixo em ${tier.baseSec}s).`
}

export type BillingLimits = {
  messagesPerDay: number
  groupsMax: number
  templatesMax: number
}

export type BillingUsage = { messagesUsed: number; lastReset?: string }

export function isUnlimited(value: number): boolean {
  return value === -1
}

export function remainingDailyMessages(
  usage: BillingUsage,
  limits: Pick<BillingLimits, 'messagesPerDay'>,
): number {
  if (isUnlimited(limits.messagesPerDay)) return Number.POSITIVE_INFINITY
  return Math.max(0, limits.messagesPerDay - usage.messagesUsed)
}

export function formatPlanLimit(value: number, unit = ''): string {
  if (isUnlimited(value)) return 'Ilimitado'
  return `${value}${unit}`
}

export function normalizeDelayMs(
  ms: number,
  acceptWhatsAppRisk: boolean,
  config?: CampaignDelaysUiConfig,
): number {
  return snapCampaignDelayMs(ms, acceptWhatsAppRisk, config)
}

export function estimateCampaignDurationMs(
  destinationCount: number,
  delayBetweenMs: number,
  acceptWhatsAppRisk = false,
  marketingMaxPerMinute?: number | null,
  config: CampaignDelaysUiConfig = DEFAULT_CAMPAIGN_DELAYS_UI,
): number {
  if (destinationCount <= 1) return 0
  const base = snapCampaignDelayMs(delayBetweenMs, acceptWhatsAppRisk, config)
  const avgDelay = averageCampaignDelayMs(base, acceptWhatsAppRisk, config)
  let total = (destinationCount - 1) * avgDelay

  if (!acceptWhatsAppRisk && marketingMaxPerMinute && marketingMaxPerMinute > 0) {
    const rateFloor = ((destinationCount - 1) / marketingMaxPerMinute) * 60_000
    total = Math.max(total, rateFloor)
  }

  return total
}

export function estimateBatchCount(destinationCount: number, acceptWhatsAppRisk: boolean): number {
  if (acceptWhatsAppRisk || destinationCount <= 1) return 1
  return destinationCount
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return 'instantâneo'
  const sec = Math.ceil(ms / 1000)
  if (sec < 60) return `~${sec}s`
  const min = Math.floor(sec / 60)
  const rest = sec % 60
  if (min < 60) return rest > 0 ? `~${min} min ${rest}s` : `~${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `~${h}h ${m}min` : `~${h}h`
}

export function exceedsPlanQuota(
  selectedCount: number,
  limits: BillingLimits,
  usage: BillingUsage,
): boolean {
  if (isUnlimited(limits.messagesPerDay)) return false
  return selectedCount > remainingDailyMessages(usage, limits)
}
