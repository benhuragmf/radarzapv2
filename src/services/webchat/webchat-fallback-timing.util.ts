import { isAgentAvailableForQueue } from '@/services/inbox/inbox-agent-presence';
import {
  DEFAULT_WHATSAPP_FALLBACK_ACCEPT_TIMEOUT_SECONDS,
  DEFAULT_WHATSAPP_FALLBACK_NO_AGENT_TIMEOUT_SECONDS,
} from '@/types/inbox-settings';

export type FallbackWaitMode = 'with_priority_agent' | 'no_agent_available';

export interface FallbackTimingSettings {
  whatsappFallbackAcceptTimeoutSeconds?: number;
  whatsappFallbackNoAgentTimeoutSeconds?: number;
}

export interface FallbackTimingConversation {
  clientId?: string | { toString(): string };
  suggestedUserId?: string | null;
  suggestedAt?: Date | null;
  queueEnteredAt?: Date | null;
  whatsappFallbackPriorityStartedAt?: Date | null;
}

function clampSec(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Com indicado online → prazo maior; fila aberta / sem online → prazo curto ou imediato. */
export function resolveFallbackWaitMode(
  clientId: string | { toString(): string },
  conversation: FallbackTimingConversation,
): FallbackWaitMode {
  const cid = String(clientId);
  const suggestedId = conversation.suggestedUserId?.trim();
  if (!suggestedId) return 'no_agent_available';
  if (cid && !isAgentAvailableForQueue(cid, suggestedId)) {
    return 'no_agent_available';
  }
  return 'with_priority_agent';
}

export function resolveFallbackAcceptTimeoutSeconds(
  settings: FallbackTimingSettings,
  mode: FallbackWaitMode,
): number {
  if (mode === 'with_priority_agent') {
    return clampSec(
      30,
      900,
      Number(settings.whatsappFallbackAcceptTimeoutSeconds) ||
        DEFAULT_WHATSAPP_FALLBACK_ACCEPT_TIMEOUT_SECONDS,
    );
  }
  return clampSec(
    0,
    120,
    Number(settings.whatsappFallbackNoAgentTimeoutSeconds) ??
      DEFAULT_WHATSAPP_FALLBACK_NO_AGENT_TIMEOUT_SECONDS,
  );
}

/** Início do cronômetro — prioridade não reinicia ao trocar indicado. */
export function getFallbackAcceptWaitStart(
  conversation: FallbackTimingConversation,
  mode: FallbackWaitMode,
): Date | null {
  if (mode === 'with_priority_agent') {
    return (
      conversation.whatsappFallbackPriorityStartedAt ??
      conversation.suggestedAt ??
      conversation.queueEnteredAt ??
      null
    );
  }
  return conversation.queueEnteredAt ?? null;
}

export function isFallbackAcceptTimeoutElapsed(
  clientId: string | { toString(): string },
  conversation: FallbackTimingConversation,
  settings: FallbackTimingSettings,
  nowMs = Date.now(),
): boolean {
  const mode = resolveFallbackWaitMode(clientId, conversation);
  const timeoutSec = resolveFallbackAcceptTimeoutSeconds(settings, mode);
  if (mode === 'no_agent_available' && timeoutSec <= 0) return true;
  const start = getFallbackAcceptWaitStart(conversation, mode);
  if (!start) return false;
  return nowMs - start.getTime() >= timeoutSec * 1000;
}

export function shouldRetryFallbackAfterCooldown(
  alertSentAt: Date | undefined | null,
  cooldownMs: number,
  nowMs = Date.now(),
): boolean {
  if (!alertSentAt) return true;
  return nowMs - alertSentAt.getTime() >= cooldownMs;
}
