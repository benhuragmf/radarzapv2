const WINDOW_MS = 60 * 1000;
const MAX_PER_VISITOR = 40;
const MAX_PER_IP = 80;

type Bucket = { count: number; windowStart: number };

const visitorBuckets = new Map<string, Bucket>();
const ipBuckets = new Map<string, Bucket>();

function touchBucket(map: Map<string, Bucket>, key: string, max: number): boolean {
  const now = Date.now();
  const bucket = map.get(key);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    map.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

/** Retorna true se excedeu o limite. */
export function isWebChatMessageReceiptRateLimited(
  visitorToken: string | undefined,
  ip: string | undefined,
): boolean {
  const ipKey = ip?.trim() || 'unknown';
  if (touchBucket(ipBuckets, ipKey, MAX_PER_IP)) return true;
  if (visitorToken?.trim()) {
    if (touchBucket(visitorBuckets, visitorToken.trim(), MAX_PER_VISITOR)) return true;
  }
  return false;
}

/** Testes — limpa buckets in-memory. */
export function resetWebChatMessageReceiptRateLimits(): void {
  visitorBuckets.clear();
  ipBuckets.clear();
}
