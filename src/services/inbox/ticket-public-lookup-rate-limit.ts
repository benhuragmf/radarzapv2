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
