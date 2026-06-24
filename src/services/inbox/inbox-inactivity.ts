/** Regras puras para SLA de inatividade do cliente no Inbox. */

export interface InactivityConversationTimestamps {
  lastInboundAt?: Date | null;
  lastOutboundAt?: Date | null;
  inactivityWarnedAt?: Date | null;
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
  closeMinutes: number,
  enabled: boolean,
  nowMs = Date.now(),
): boolean {
  if (!enabled || closeMinutes <= 0 || conv.lastOutboundAt) return false;
  const elapsed = minutesSinceDate(conv.createdAt, nowMs);
  return elapsed !== null && elapsed >= closeMinutes;
}

export function shouldSendTriageStallWarning(
  conv: InactivityConversationTimestamps & { createdAt?: Date | null },
  warningMinutes: number,
  closeMinutes: number,
  nowMs = Date.now(),
): boolean {
  if (warningMinutes <= 0 || closeMinutes <= 0 || warningMinutes >= closeMinutes) return false;
  if (conv.lastOutboundAt) return false;
  const elapsed = minutesSinceDate(conv.createdAt, nowMs);
  if (elapsed === null || elapsed < warningMinutes || elapsed >= closeMinutes) return false;
  if (
    conv.inactivityWarnedAt &&
    conv.createdAt &&
    conv.inactivityWarnedAt.getTime() >= conv.createdAt.getTime()
  ) {
    return false;
  }
  return true;
}

export function triageWaitElapsedSec(
  waitSince: Date | string | undefined | null,
  nowMs = Date.now(),
): number {
  if (!waitSince) return 0;
  return Math.max(0, Math.floor((nowMs - new Date(waitSince).getTime()) / 1000));
}

export function triageWaitUrgency(elapsedSec: number, closeMinutes: number): number {
  const timeoutSec = Math.max(60, (closeMinutes > 0 ? closeMinutes : 15) * 60);
  return Math.min(1, elapsedSec / timeoutSec);
}

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
