import { config } from './environment';

/** Limites técnicos do WhatsApp Web + política do RadarZap. */
export const WHATSAPP_LIMITS = {
  /** Intervalo mínimo seguro entre destinos (modo protegido). */
  MIN_DELAY_BETWEEN_MS: 3000,
  /** Intervalo mínimo se o usuário aceitar risco de banimento. */
  RISK_MIN_DELAY_BETWEEN_MS: 1000,
  MAX_MESSAGE_LENGTH: 4096,
  /** Legenda de imagem no WhatsApp (~1024); margem para não cortar link/rodapé. */
  MAX_IMAGE_CAPTION_LENGTH: 900,
  MAX_CAMPAIGN_TITLE_LENGTH: 120,
  MAX_MESSAGES_PER_MINUTE: config.WHATSAPP.RATE_LIMIT_MESSAGES_PER_MINUTE,
  /** Máximo de destinos por campanha (resto vai em fila). */
  MAX_DESTINATIONS_PER_CAMPAIGN: 500,
  /** Mensagens por ciclo no modo protegido (~1/min de pausa entre lotes). */
  SAFE_BATCH_SIZE: config.WHATSAPP.RATE_LIMIT_MESSAGES_PER_MINUTE,
  /** Pausa entre lotes no modo protegido (ms). */
  SAFE_BATCH_COOLDOWN_MS: 60_000,
} as const;

export type UsageSnapshot = { messagesUsed: number; lastReset?: Date | string };
export type PlanLimitsSnapshot = {
  messagesPerDay: number;
  groupsMax: number;
  templatesMax: number;
};

export function isUnlimited(value: number): boolean {
  return value === -1;
}

export function remainingDailyMessages(
  usage: UsageSnapshot,
  limits: Pick<PlanLimitsSnapshot, 'messagesPerDay'>,
): number {
  if (isUnlimited(limits.messagesPerDay)) return Number.POSITIVE_INFINITY;
  return Math.max(0, limits.messagesPerDay - usage.messagesUsed);
}

export function normalizeDelayBetweenMs(ms?: number, acceptWhatsAppRisk = false): number {
  const min = acceptWhatsAppRisk
    ? WHATSAPP_LIMITS.RISK_MIN_DELAY_BETWEEN_MS
    : WHATSAPP_LIMITS.MIN_DELAY_BETWEEN_MS;
  const n = Number(ms);
  if (!Number.isFinite(n) || n < min) return min;
  return n;
}

export function getDispatchBatchSize(acceptWhatsAppRisk: boolean, isWhatsAppBusiness = false): number {
  if (acceptWhatsAppRisk) return WHATSAPP_LIMITS.MAX_DESTINATIONS_PER_CAMPAIGN;
  const base = WHATSAPP_LIMITS.SAFE_BATCH_SIZE;
  return isWhatsAppBusiness ? base * 2 : base;
}

export function getEffectiveMessagesPerMinute(isWhatsAppBusiness = false): number {
  return isWhatsAppBusiness
    ? WHATSAPP_LIMITS.MAX_MESSAGES_PER_MINUTE * 2
    : WHATSAPP_LIMITS.MAX_MESSAGES_PER_MINUTE;
}

export function validateMessageText(text: string): { ok: true } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'A mensagem é obrigatória' };
  if (trimmed.length > WHATSAPP_LIMITS.MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `Mensagem excede ${WHATSAPP_LIMITS.MAX_MESSAGE_LENGTH} caracteres (limite do WhatsApp)`,
    };
  }
  return { ok: true };
}

export function validateCampaignTitle(title?: string): { ok: true } | { ok: false; error: string } {
  if (!title?.trim()) return { ok: true };
  if (title.trim().length > WHATSAPP_LIMITS.MAX_CAMPAIGN_TITLE_LENGTH) {
    return {
      ok: false,
      error: `Título interno: máximo ${WHATSAPP_LIMITS.MAX_CAMPAIGN_TITLE_LENGTH} caracteres`,
    };
  }
  return { ok: true };
}

/** Valida criação da campanha — não bloqueia por cota (fila entrega o restante). */
export function validateCampaignCreate(
  destinationCount: number,
): { ok: true } | { ok: false; error: string } {
  if (destinationCount < 1) {
    return { ok: false, error: 'Selecione ao menos um destino' };
  }
  if (destinationCount > WHATSAPP_LIMITS.MAX_DESTINATIONS_PER_CAMPAIGN) {
    return {
      ok: false,
      error: `Máximo de ${WHATSAPP_LIMITS.MAX_DESTINATIONS_PER_CAMPAIGN} destinos por campanha`,
    };
  }
  return { ok: true };
}

export function validateDestinationAdd(
  limits: Pick<PlanLimitsSnapshot, 'groupsMax'>,
  currentActiveCount: number,
): { ok: true } | { ok: false; error: string } {
  if (isUnlimited(limits.groupsMax)) return { ok: true };
  if (currentActiveCount >= limits.groupsMax) {
    return {
      ok: false,
      error: `Limite de destinos do plano atingido (${limits.groupsMax}). Faça upgrade em Planos.`,
    };
  }
  return { ok: true };
}

/** Estima duração total considerando lotes seguros do WhatsApp. */
export function estimateCampaignDurationMs(
  destinationCount: number,
  delayBetweenMs: number,
  acceptWhatsAppRisk = false,
): number {
  if (destinationCount <= 1) return 0;
  const delay = normalizeDelayBetweenMs(delayBetweenMs, acceptWhatsAppRisk);

  if (acceptWhatsAppRisk) {
    return (destinationCount - 1) * delay;
  }

  const batchSize = WHATSAPP_LIMITS.SAFE_BATCH_SIZE;
  const cooldown = WHATSAPP_LIMITS.SAFE_BATCH_COOLDOWN_MS;
  let total = 0;
  let remaining = destinationCount;

  while (remaining > 0) {
    const batch = Math.min(batchSize, remaining);
    if (batch > 1) total += (batch - 1) * delay;
    remaining -= batch;
    if (remaining > 0) total += cooldown;
  }

  return total;
}

export function estimateBatchCount(
  destinationCount: number,
  acceptWhatsAppRisk: boolean,
): number {
  if (acceptWhatsAppRisk || destinationCount <= 1) return 1;
  return Math.ceil(destinationCount / WHATSAPP_LIMITS.SAFE_BATCH_SIZE);
}

/** Próximo reset diário do plano (para pausar fila sem falhar). */
export function nextPlanResetDate(lastReset?: Date | string): Date {
  const base = lastReset ? new Date(lastReset) : new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  if (next.getTime() <= Date.now()) {
    next.setTime(Date.now() + 60 * 60 * 1000);
  }
  return next;
}

export const ALLOWED_SAFE_CAMPAIGN_DELAYS_MS = [3000, 5000, 10000, 30000] as const;
export const ALLOWED_RISK_CAMPAIGN_DELAYS_MS = [1000, 2000, 3000, 5000] as const;
