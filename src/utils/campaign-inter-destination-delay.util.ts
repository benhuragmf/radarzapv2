/** Intervalos entre destinos em campanhas — modo protegido e risco. */

import {
  DEFAULT_CAMPAIGN_DELAYS,
  type CampaignDelaysConfig,
  type CampaignProtectedTier,
} from '@/types/whatsapp-send-policy';

export type { CampaignDelaysConfig, CampaignProtectedTier };

export const CAMPAIGN_SAFE_DELAY_MS = DEFAULT_CAMPAIGN_DELAYS.protectedTiers.map(
  t => t.baseSec * 1000,
) as readonly number[];

export const CAMPAIGN_RISK_DELAY_MS = DEFAULT_CAMPAIGN_DELAYS.riskDelaysSec.map(
  s => s * 1000,
) as readonly number[];

function clampSec(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function normalizeTier(
  raw: Partial<CampaignProtectedTier> | undefined,
  fallback: CampaignProtectedTier,
): CampaignProtectedTier {
  const jitterMinSec = clampSec(raw?.jitterMinSec, 5, 600, fallback.jitterMinSec);
  let jitterMaxSec = clampSec(raw?.jitterMaxSec, jitterMinSec, 900, fallback.jitterMaxSec);
  if (jitterMaxSec < jitterMinSec) jitterMaxSec = jitterMinSec;
  const baseSec = clampSec(raw?.baseSec, 5, 600, fallback.baseSec);
  return {
    id: fallback.id,
    label: String(raw?.label ?? fallback.label).trim() || fallback.label,
    baseSec,
    jitterMinSec,
    jitterMaxSec,
    enabled: raw?.enabled !== false,
  };
}

/** Normaliza config vinda do admin/DB com defaults seguros. */
export function normalizeCampaignDelaysConfig(
  raw?: Partial<CampaignDelaysConfig> | null,
): CampaignDelaysConfig {
  const defaults = DEFAULT_CAMPAIGN_DELAYS;
  const byId = new Map(
    (raw?.protectedTiers ?? []).map(t => [t.id, t] as const),
  );
  const protectedTiers = defaults.protectedTiers.map(fb =>
    normalizeTier(byId.get(fb.id), fb),
  );

  const riskMinSec = clampSec(raw?.riskMinSec, 1, 29, defaults.riskMinSec);
  const riskRaw = Array.isArray(raw?.riskDelaysSec) ? raw!.riskDelaysSec : defaults.riskDelaysSec;
  const riskDelaysSec = [0, 1, 2].map(i => {
    const fb = defaults.riskDelaysSec[i] ?? riskMinSec;
    return clampSec(riskRaw[i], riskMinSec, 29, fb);
  });

  const defaultId = raw?.protectedDefaultTierId;
  const protectedDefaultTierId =
    protectedTiers.find(t => t.id === defaultId && t.enabled)?.id ??
    protectedTiers.find(t => t.enabled)?.id ??
    'normal';

  return {
    protectedTiers,
    protectedDefaultTierId,
    riskDelaysSec,
    riskMinSec,
  };
}

export function getEnabledProtectedTiers(config: CampaignDelaysConfig): CampaignProtectedTier[] {
  return config.protectedTiers.filter(t => t.enabled);
}

export function protectedDelayOptionsMs(config: CampaignDelaysConfig): number[] {
  return getEnabledProtectedTiers(config).map(t => t.baseSec * 1000);
}

export function riskDelayOptionsMs(config: CampaignDelaysConfig): number[] {
  return [...config.riskDelaysSec].map(s => s * 1000).sort((a, b) => a - b);
}

export function defaultProtectedDelayMs(config: CampaignDelaysConfig): number {
  const tier =
    config.protectedTiers.find(t => t.id === config.protectedDefaultTierId && t.enabled) ??
    getEnabledProtectedTiers(config)[0];
  return (tier?.baseSec ?? 40) * 1000;
}

export function defaultRiskDelayMs(config: CampaignDelaysConfig): number {
  return (config.riskDelaysSec[0] ?? config.riskMinSec) * 1000;
}

function findProtectedTier(
  config: CampaignDelaysConfig,
  baseMs: number,
): CampaignProtectedTier | undefined {
  const baseSec = Math.round(baseMs / 1000);
  return getEnabledProtectedTiers(config).find(t => t.baseSec * 1000 === baseMs || t.baseSec === baseSec);
}

export function snapCampaignDelayMs(
  ms: number | undefined,
  acceptRisk: boolean,
  config: CampaignDelaysConfig = DEFAULT_CAMPAIGN_DELAYS,
): number {
  const allowed = acceptRisk ? riskDelayOptionsMs(config) : protectedDelayOptionsMs(config);
  const fallback = acceptRisk
    ? defaultRiskDelayMs(config)
    : defaultProtectedDelayMs(config);
  if (!allowed.length) return fallback;
  const n = Number(ms);
  if (!Number.isFinite(n)) return fallback;
  if (allowed.includes(n)) return n;
  const sorted = [...allowed].sort((a, b) => a - b);
  return sorted.find(v => v >= n) ?? sorted[sorted.length - 1]!;
}

export function computeJitteredCampaignDelayMs(
  baseMs: number,
  acceptRisk: boolean,
  config: CampaignDelaysConfig = DEFAULT_CAMPAIGN_DELAYS,
): number {
  const base = snapCampaignDelayMs(baseMs, acceptRisk, config);
  if (acceptRisk) return base;
  const tier = findProtectedTier(config, base);
  if (!tier) return base;
  const min = tier.jitterMinSec * 1000;
  const max = tier.jitterMaxSec * 1000;
  const span = max - min;
  return min + Math.floor(Math.random() * (span + 1));
}

export function averageCampaignDelayMs(
  baseMs: number,
  acceptRisk: boolean,
  config: CampaignDelaysConfig = DEFAULT_CAMPAIGN_DELAYS,
): number {
  const base = snapCampaignDelayMs(baseMs, acceptRisk, config);
  if (acceptRisk) return base;
  const tier = findProtectedTier(config, base);
  if (!tier) return base;
  return ((tier.jitterMinSec + tier.jitterMaxSec) / 2) * 1000;
}

export function campaignDelayOptionLabel(
  ms: number,
  acceptRisk: boolean,
  config: CampaignDelaysConfig = DEFAULT_CAMPAIGN_DELAYS,
): string {
  if (acceptRisk) {
    const sec = ms / 1000;
    if (sec === config.riskMinSec) return `${sec} segundos (mínimo)`;
    return `${sec} segundos`;
  }
  const tier = findProtectedTier(config, ms);
  if (!tier) return `${ms / 1000} segundos`;
  return `${tier.label} — ${tier.jitterMinSec}–${tier.jitterMaxSec}s entre envios`;
}

export function campaignDelayJitterHint(
  ms: number,
  config: CampaignDelaysConfig = DEFAULT_CAMPAIGN_DELAYS,
): string | null {
  const tier = findProtectedTier(config, ms);
  if (!tier) return null;
  return `Cada envio aguarda ${tier.jitterMinSec}–${tier.jitterMaxSec}s (aleatório, não fixo em ${tier.baseSec}s).`;
}

export const CAMPAIGN_SAFE_DEFAULT_DELAY_MS = defaultProtectedDelayMs(DEFAULT_CAMPAIGN_DELAYS);
export const CAMPAIGN_RISK_DEFAULT_DELAY_MS = defaultRiskDelayMs(DEFAULT_CAMPAIGN_DELAYS);
