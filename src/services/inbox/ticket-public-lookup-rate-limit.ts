const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

type Bucket = { failures: number; windowStart: number };

const buckets = new Map<string, Bucket>();

function bucketKey(clientId: string, ip: string): string {
  return `${clientId}:${ip || 'unknown'}`;
}

export function isTicketLookupRateLimited(clientId: string, ip: string | undefined): boolean {
  const key = bucketKey(clientId, ip ?? '');
  const bucket = buckets.get(key);
  if (!bucket) return false;
  if (Date.now() - bucket.windowStart > WINDOW_MS) {
    buckets.delete(key);
    return false;
  }
  return bucket.failures >= MAX_FAILURES;
}

export function recordTicketLookupFailure(clientId: string, ip: string | undefined): void {
  const key = bucketKey(clientId, ip ?? '');
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart > WINDOW_MS) {
    buckets.set(key, { failures: 1, windowStart: now });
    return;
  }
  existing.failures += 1;
}

export function clearTicketLookupFailures(clientId: string, ip: string | undefined): void {
  buckets.delete(bucketKey(clientId, ip ?? ''));
}

/** Testes — limpa estado in-memory. */
export function resetTicketLookupRateLimits(): void {
  buckets.clear();
}

const RESEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_RESENDS_PER_IP = 5;
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

const resendIpBuckets = new Map<string, Bucket>();
const resendTicketCooldown = new Map<string, number>();

function resendTicketKey(clientId: string, ticketRef: string, phone: string): string {
  return `${clientId}:${ticketRef}:${phone.replace(/\D/g, '').slice(-11)}`;
}

export function isTicketTokenResendRateLimited(clientId: string, ip: string | undefined): boolean {
  const key = bucketKey(clientId, ip ?? '');
  const bucket = resendIpBuckets.get(key);
  if (!bucket) return false;
  if (Date.now() - bucket.windowStart > RESEND_WINDOW_MS) {
    resendIpBuckets.delete(key);
    return false;
  }
  return bucket.failures >= MAX_RESENDS_PER_IP;
}

export function recordTicketTokenResendAttempt(clientId: string, ip: string | undefined): void {
  const key = bucketKey(clientId, ip ?? '');
  const now = Date.now();
  const existing = resendIpBuckets.get(key);
  if (!existing || now - existing.windowStart > RESEND_WINDOW_MS) {
    resendIpBuckets.set(key, { failures: 1, windowStart: now });
    return;
  }
  existing.failures += 1;
}

export function isTicketTokenResendOnCooldown(
  clientId: string,
  ticketRef: string,
  phone: string,
): boolean {
  const key = resendTicketKey(clientId, ticketRef, phone);
  const until = resendTicketCooldown.get(key);
  if (!until) return false;
  if (Date.now() > until) {
    resendTicketCooldown.delete(key);
    return false;
  }
  return true;
}

export function markTicketTokenResendSent(clientId: string, ticketRef: string, phone: string): void {
  resendTicketCooldown.set(
    resendTicketKey(clientId, ticketRef, phone),
    Date.now() + RESEND_COOLDOWN_MS,
  );
}

export function resetTicketTokenResendLimits(): void {
  resendIpBuckets.clear();
  resendTicketCooldown.clear();
}
