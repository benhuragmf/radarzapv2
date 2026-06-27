import { inactivityCloseAfterWarningMinutes } from '@/types/inbox-quick-replies';
import type { CloseGateSource } from './inbox-graceful-close.util';

/** Regras puras para SLA de inatividade do cliente no Inbox. */

export interface InactivityConversationTimestamps {
  lastInboundAt?: Date | null;
  lastOutboundAt?: Date | null;
  inactivityWarnedAt?: Date | null;
  gracefulClosePromptAt?: Date | null;
  gracefulCloseAckAt?: Date | null;
  closeGateSource?: CloseGateSource | null;
}

export function isWaitingForClientReply(conv: InactivityConversationTimestamps): boolean {
  if (!conv.lastOutboundAt) return false;
  if (!conv.lastInboundAt) return true;
  return conv.lastInboundAt.getTime() < conv.lastOutboundAt.getTime();
}

export function minutesSinceLastOutbound(
  lastOutboundAt: Date | undefined | null,
  nowMs = Date.now(),
): number | null {
  if (!lastOutboundAt) return null;
  return (nowMs - lastOutboundAt.getTime()) / 60_000;
}

export function shouldSendInactivityWarning(
  conv: InactivityConversationTimestamps,
  warningMinutes: number,
  closeMinutes: number,
  nowMs = Date.now(),
): boolean {
  if (warningMinutes <= 0 || closeMinutes <= 0 || warningMinutes >= closeMinutes) return false;
  if (!isWaitingForClientReply(conv)) return false;
  const elapsed = minutesSinceLastOutbound(conv.lastOutboundAt, nowMs);
  if (elapsed === null || elapsed < warningMinutes || elapsed >= closeMinutes) return false;
  if (
    conv.inactivityWarnedAt &&
    conv.lastOutboundAt &&
    conv.inactivityWarnedAt.getTime() >= conv.lastOutboundAt.getTime()
  ) {
    return false;
  }
  return true;
}

export function shouldAutoCloseForInactivity(
  conv: InactivityConversationTimestamps,
  closeMinutes: number,
  enabled: boolean,
  nowMs = Date.now(),
): boolean {
  if (!enabled || closeMinutes <= 0) return false;
  if (!isWaitingForClientReply(conv)) return false;
  const elapsed = minutesSinceLastOutbound(conv.lastOutboundAt, nowMs);
  return elapsed !== null && elapsed >= closeMinutes;
}

export function minutesSinceDate(
  at: Date | undefined | null,
  nowMs = Date.now(),
): number | null {
  if (!at) return null;
  return (nowMs - at.getTime()) / 60_000;
}

/** Triagem sem resposta do bot ainda — encerra pelo tempo total na fila do bot. */
export function shouldAutoCloseTriageStalled(
  conv: InactivityConversationTimestamps & { createdAt?: Date | null },
  warningMinutes: number,
  enabled: boolean,
  nowMs = Date.now(),
): boolean {
  if (!enabled || warningMinutes <= 0 || conv.lastOutboundAt) return false;
  const elapsed = minutesSinceDate(conv.createdAt, nowMs);
  return elapsed !== null && elapsed >= warningMinutes + 1;
}

export function shouldSendTriageStallWarning(
  conv: InactivityConversationTimestamps & { createdAt?: Date | null },
  warningMinutes: number,
  enabled: boolean,
  nowMs = Date.now(),
): boolean {
  if (!enabled || warningMinutes <= 0) return false;
  if (conv.lastOutboundAt) return false;
  const elapsed = minutesSinceDate(conv.createdAt, nowMs);
  if (elapsed === null || elapsed < warningMinutes) return false;
  if (
    conv.inactivityWarnedAt &&
    conv.createdAt &&
    conv.inactivityWarnedAt.getTime() >= conv.createdAt.getTime()
  ) {
    return false;
  }
  return true;
}

export interface TriageInactivityConfig {
  enabled: boolean;
  warningMinutes: number;
  closeAfterWarningMinutes: number;
}

/** Aviso na triagem: cliente não respondeu à pergunta do bot no prazo. */
export function shouldSendTriageInactivityWarning(
  conv: InactivityConversationTimestamps,
  config: TriageInactivityConfig,
  nowMs = Date.now(),
): boolean {
  if (!config.enabled || config.warningMinutes <= 0) return false;
  if (!isWaitingForClientReply(conv)) return false;
  if (
    conv.inactivityWarnedAt &&
    conv.lastOutboundAt &&
    conv.inactivityWarnedAt.getTime() >= conv.lastOutboundAt.getTime()
  ) {
    return false;
  }
  const elapsed = minutesSinceLastOutbound(conv.lastOutboundAt, nowMs);
  return elapsed !== null && elapsed >= config.warningMinutes;
}

/** Encerra triagem após o aviso e tempo adicional sem resposta. */
export function shouldCloseTriageInactivity(
  conv: InactivityConversationTimestamps,
  config: TriageInactivityConfig,
  nowMs = Date.now(),
): boolean {
  if (!config.enabled || config.closeAfterWarningMinutes <= 0) return false;
  if (!conv.inactivityWarnedAt) return false;
  if (!isWaitingForClientReply(conv)) return false;
  const elapsedSinceWarn = minutesSinceDate(conv.inactivityWarnedAt, nowMs);
  return elapsedSinceWarn !== null && elapsedSinceWarn >= config.closeAfterWarningMinutes;
}

export function triageInactivityTotalMinutes(
  warningMinutes: number,
  closeAfterWarningMinutes: number,
): number {
  const warn = warningMinutes > 0 ? warningMinutes : 0;
  const close = closeAfterWarningMinutes > 0 ? closeAfterWarningMinutes : 0;
  return Math.max(1, warn + close);
}

export function triageWaitElapsedSec(
  waitSince: Date | string | undefined | null,
  nowMs = Date.now(),
): number {
  if (!waitSince) return 0;
  return Math.max(0, Math.floor((nowMs - new Date(waitSince).getTime()) / 1000));
}

export function triageWaitUrgency(elapsedSec: number, totalMinutes: number): number {
  const timeoutSec = Math.max(60, (totalMinutes > 0 ? totalMinutes : 3) * 60);
  return Math.min(1, elapsedSec / timeoutSec);
}

function hasActiveInactivityWarning(conv: InactivityConversationTimestamps): boolean {
  if (!conv.inactivityWarnedAt || !conv.lastOutboundAt) return false;
  return conv.inactivityWarnedAt.getTime() >= conv.lastOutboundAt.getTime() - 2000;
}

/** Libera o atalho de encerramento após o aviso (/aus ou código configurado) + tempo do SLA. */
export function isInactivityCloseQuickReplyAllowed(
  conv: InactivityConversationTimestamps,
  settings: {
    inactivityCloseMinutes: number;
    inactivityWarningMinutes: number;
  },
  nowMs = Date.now(),
): boolean {
  if (!isWaitingForClientReply(conv)) return false;
  if (!hasActiveInactivityWarning(conv)) return false;

  const afterWarningMin = inactivityCloseAfterWarningMinutes(
    settings.inactivityCloseMinutes,
    settings.inactivityWarningMinutes,
  );
  if (afterWarningMin <= 0) return true;

  const elapsedSinceWarn = (nowMs - conv.inactivityWarnedAt!.getTime()) / 60_000;
  return elapsedSinceWarn >= afterWarningMin;
}

/** Libera /enc após pergunta final (/mais): timeout ou cliente disse não/obrigado. */
export function isGracefulCloseQuickReplyAllowed(
  conv: InactivityConversationTimestamps,
  settings: { gracefulCloseAfterPromptMinutes: number },
  nowMs = Date.now(),
): boolean {
  if (!conv.gracefulClosePromptAt || !conv.lastOutboundAt) return false;
  if (conv.gracefulClosePromptAt.getTime() < conv.lastOutboundAt.getTime() - 2000) return false;

  if (
    conv.gracefulCloseAckAt &&
    conv.gracefulCloseAckAt.getTime() >= conv.gracefulClosePromptAt.getTime()
  ) {
    return true;
  }

  if (!isWaitingForClientReply(conv)) return false;

  const afterMin = settings.gracefulCloseAfterPromptMinutes;
  if (afterMin <= 0) return false;
  const elapsed = minutesSinceDate(conv.gracefulClosePromptAt, nowMs);
  return elapsed !== null && elapsed >= afterMin;
}

/** Libera /enc (inatividade) — só após /aus + tempo do SLA. */
export function isEncInactivityCloseQuickReplyAllowed(
  conv: InactivityConversationTimestamps,
  settings: {
    inactivityCloseMinutes: number;
    inactivityWarningMinutes: number;
  },
  nowMs = Date.now(),
): boolean {
  return isInactivityCloseQuickReplyAllowed(conv, settings, nowMs);
}

/** Libera /enc_ok (encerramento natural) — só após /mais + ack ou tempo do SLA. */
export function isEncOkCloseQuickReplyAllowed(
  conv: InactivityConversationTimestamps,
  settings: { gracefulCloseAfterPromptMinutes: number },
  nowMs = Date.now(),
): boolean {
  return isGracefulCloseQuickReplyAllowed(conv, settings, nowMs);
}

/** @deprecated use isEncInactivityCloseQuickReplyAllowed ou isEncOkCloseQuickReplyAllowed */
export function isCloseQuickReplyAllowed(
  conv: InactivityConversationTimestamps,
  settings: {
    inactivityCloseMinutes: number;
    inactivityWarningMinutes: number;
    gracefulCloseAfterPromptMinutes: number;
    closeQuickReplyGateEnabled?: boolean;
  },
  nowMs = Date.now(),
): boolean {
  if (settings.closeQuickReplyGateEnabled === false) return true;
  return (
    isEncInactivityCloseQuickReplyAllowed(conv, settings, nowMs) ||
    isEncOkCloseQuickReplyAllowed(conv, settings, nowMs)
  );
}

/** @deprecated use isCloseQuickReplyAllowed */
export const isEncQuickReplyAllowed = isCloseQuickReplyAllowed;

export function shouldAlertQueueStall(
  queueEnteredAt: Date | undefined | null,
  alertMinutes: number,
  queueSlaNotifiedAt: Date | undefined | null,
  nowMs = Date.now(),
): boolean {
  if (alertMinutes <= 0 || !queueEnteredAt) return false;
  const elapsed = (nowMs - queueEnteredAt.getTime()) / 60_000;
  if (elapsed < alertMinutes) return false;
  if (queueSlaNotifiedAt && queueSlaNotifiedAt.getTime() >= queueEnteredAt.getTime()) {
    return false;
  }
  return true;
}
