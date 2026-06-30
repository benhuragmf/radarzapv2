/** Estados de produto da bridge WebChat ↔ WhatsApp (TOP 13). */
export type BridgeProductStatus =
  | 'disabled'
  | 'available'
  | 'pending'
  | 'active'
  | 'paused'
  | 'closed'
  | 'failed';

const BRIDGE_FORWARD_PREFIX = /^\*\[(Site(?: · TK-[A-Z0-9]{4,12})?)\]/i;

/** Janela curta para não reencaminhar a mesma mensagem do visitante ao WA. */
export const BRIDGE_FORWARD_DEDUP_MS = 8_000;

const recentBridgeForwards = new Map<string, number>();

/** Deriva status de produto a partir da conversa WebChat + config. */
export function normalizeBridgeProductStatus(input: {
  whatsappBridgeActive?: boolean;
  conversationStatus?: string;
  queueStatus?: string;
  fallbackEnabled?: boolean;
}): BridgeProductStatus {
  if (input.whatsappBridgeActive) return 'active';
  if (input.conversationStatus === 'closed') return 'closed';
  if (input.queueStatus === 'waiting_human' && input.fallbackEnabled) return 'pending';
  if (input.fallbackEnabled) return 'available';
  return 'disabled';
}

export function buildBridgeIdempotencyKey(
  clientId: string,
  conversationId: string,
  body: string,
): string {
  const normalized = body.trim().replace(/\s+/g, ' ').slice(0, 240);
  return `${clientId}:${conversationId}:${normalized}`;
}

/**
 * Registra encaminhamento; retorna false se duplicata recente (anti-loop / retry).
 * Uso em testes: passar `store` customizado opcional via parâmetros internos não expostos —
 * função pura auxiliar abaixo para testes sem estado global.
 */
export function shouldForwardBridgeMessage(
  key: string,
  nowMs: number = Date.now(),
  dedupMs: number = BRIDGE_FORWARD_DEDUP_MS,
): boolean {
  const last = recentBridgeForwards.get(key);
  if (last != null && nowMs - last < dedupMs) return false;
  recentBridgeForwards.set(key, nowMs);
  if (recentBridgeForwards.size > 5000) {
    const cutoff = nowMs - dedupMs * 2;
    for (const [k, t] of recentBridgeForwards) {
      if (t < cutoff) recentBridgeForwards.delete(k);
    }
  }
  return true;
}

/** Versão pura para testes unitários (sem Map global). */
export function isDuplicateBridgeForward(
  key: string,
  lastForwardedAtMs: number | undefined,
  nowMs: number,
  dedupMs: number = BRIDGE_FORWARD_DEDUP_MS,
): boolean {
  if (lastForwardedAtMs == null) return false;
  return nowMs - lastForwardedAtMs < dedupMs;
}

/** Texto no formato encaminhado visitante → WA; não deve voltar como resposta do atendente. */
export function isBridgeForwardedVisitorFormat(text: string): boolean {
  return BRIDGE_FORWARD_PREFIX.test(text.trim());
}

/** Risco de loop: eco do encaminhamento ou mensagem de alerta de sistema. */
export function isBridgeLoopRisk(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (isBridgeForwardedVisitorFormat(t)) return true;
  if (/^Novo chamado no Radar Chat/i.test(t)) return true;
  if (/^Para assumir atendimento:/i.test(t)) return true;
  return false;
}

/** Cross-tenant: conversa/widget e sessão WA devem ser da mesma organização. */
export function assertBridgeClientMatch(expectedClientId: string, actualClientId: string): void {
  if (String(expectedClientId) !== String(actualClientId)) {
    throw new Error('Bridge WebChat não pertence a esta organização');
  }
}

/** Alertas bridge não devem expor tokens/IDs internos sensíveis. */
export function isBridgeAlertBodySafe(body: string): boolean {
  const lower = body.toLowerCase();
  if (/\bwck_[a-z0-9]+\b/i.test(body)) return false;
  if (lower.includes('clientid')) return false;
  if (/\bwidget[_-]?key\b/i.test(body)) return false;
  if (/\bpublic[_-]?key\b/i.test(body)) return false;
  return true;
}

export function shouldProcessBridgeAgentReply(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('!')) return false;
  if (isBridgeLoopRisk(trimmed)) return false;
  return true;
}
