import { isAgentAvailableForQueue } from '@/services/inbox/inbox-agent-presence';
import {
  DEFAULT_WHATSAPP_FALLBACK_ACCEPT_TIMEOUT_SECONDS,
  DEFAULT_WHATSAPP_FALLBACK_NO_AGENT_TIMEOUT_SECONDS,
} from '@/types/inbox-settings';

export type FallbackWaitMode = 'with_priority_agent' | 'no_agent_available';
export type FallbackCountdownPhase = 'panel' | 'wa_assumir' | 'no_agent';

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
  whatsappFallbackWaNotifiedAt?: Date | null;
  whatsappFallbackWaNotifiedUserId?: string | null;
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

/** Após alerta WA ao atendente atual — aguarda !assumir antes de rotacionar. */
export function getFallbackWaAssumirWaitStart(
  conversation: FallbackTimingConversation,
): Date | null {
  return (
    conversation.whatsappFallbackWaNotifiedAt ??
    conversation.suggestedAt ??
    conversation.whatsappFallbackPriorityStartedAt ??
    null
  );
}

export function isFallbackWaAssumirTimeoutElapsed(
  clientId: string | { toString(): string },
  conversation: FallbackTimingConversation,
  settings: FallbackTimingSettings,
  nowMs = Date.now(),
): boolean {
  const waNotified = conversation.whatsappFallbackWaNotifiedUserId?.trim();
  const suggested = conversation.suggestedUserId?.trim();
  if (!waNotified || !suggested || waNotified !== suggested) return false;

  const start = getFallbackWaAssumirWaitStart(conversation);
  if (!start) return false;

  const mode = resolveFallbackWaitMode(clientId, conversation);
  const timeoutSec = resolveFallbackAcceptTimeoutSeconds(settings, mode);
  return nowMs - start.getTime() >= timeoutSec * 1000;
}

export type FallbackCountdownState = {
  enabled: true;
  phase: FallbackCountdownPhase;
  elapsedSec: number;
  timeoutSec: number;
  remainingSec: number;
  waAlertSent: boolean;
};

/** Estado do countdown de fallback para UI do Inbox. */
export function getFallbackCountdownState(
  clientId: string | { toString(): string },
  conversation: FallbackTimingConversation,
  settings: FallbackTimingSettings,
  whatsappFallbackEnabled: boolean,
  nowMs = Date.now(),
): FallbackCountdownState | null {
  if (!whatsappFallbackEnabled) return null;

  const mode = resolveFallbackWaitMode(clientId, conversation);
  const waNotified = conversation.whatsappFallbackWaNotifiedUserId?.trim();
  const suggested = conversation.suggestedUserId?.trim();
  const waAlertSent = Boolean(waNotified && suggested && waNotified === suggested);

  if (waAlertSent) {
    const start = getFallbackWaAssumirWaitStart(conversation);
    if (!start) return null;
    const timeoutSec = resolveFallbackAcceptTimeoutSeconds(settings, mode);
    const elapsedSec = Math.max(0, Math.floor((nowMs - start.getTime()) / 1000));
    const remainingSec = Math.max(0, timeoutSec - elapsedSec);
    return {
      enabled: true,
      phase: 'wa_assumir',
      elapsedSec,
      timeoutSec,
      remainingSec,
      waAlertSent: true,
    };
  }

  if (mode === 'with_priority_agent') {
    const start = getFallbackAcceptWaitStart(conversation, mode);
    if (!start) return null;
    const timeoutSec = resolveFallbackAcceptTimeoutSeconds(settings, mode);
    const elapsedSec = Math.max(0, Math.floor((nowMs - start.getTime()) / 1000));
    const remainingSec = Math.max(0, timeoutSec - elapsedSec);
    return {
      enabled: true,
      phase: 'panel',
      elapsedSec,
      timeoutSec,
      remainingSec,
      waAlertSent: false,
    };
  }

  const start = getFallbackAcceptWaitStart(conversation, mode);
  if (!start) return null;
  const timeoutSec = resolveFallbackAcceptTimeoutSeconds(settings, mode);
  if (timeoutSec <= 0) {
    return {
      enabled: true,
      phase: 'no_agent',
      elapsedSec: Math.max(0, Math.floor((nowMs - start.getTime()) / 1000)),
      timeoutSec: 0,
      remainingSec: 0,
      waAlertSent: false,
    };
  }
  const elapsedSec = Math.max(0, Math.floor((nowMs - start.getTime()) / 1000));
  const remainingSec = Math.max(0, timeoutSec - elapsedSec);
  return {
    enabled: true,
    phase: 'no_agent',
    elapsedSec,
    timeoutSec,
    remainingSec,
    waAlertSent: false,
  };
}

export function shouldRetryFallbackAfterCooldown(
  alertSentAt: Date | undefined | null,
  cooldownMs: number,
  nowMs = Date.now(),
): boolean {
  if (!alertSentAt) return true;
  return nowMs - alertSentAt.getTime() >= cooldownMs;
}
