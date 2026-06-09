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
