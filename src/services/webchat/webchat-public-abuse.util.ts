import { RedisManager } from '@/cache/RedisManager';

const SESSION_WINDOW_MS = 15 * 60 * 1000;
const MAX_SESSIONS_PER_IP = 12;

type Bucket = { count: number; windowStart: number };

const sessionBuckets = new Map<string, Bucket>();

function sessionBucketKey(publicKey: string, ip: string): string {
  return `${publicKey}:${ip || 'unknown'}`;
}

function redisSessionKey(publicKey: string, ip: string): string {
  return `radarchat:webchat:session:ip:${sessionBucketKey(publicKey, ip)}`;
}

export class WebChatAbuseBlockedError extends Error {
  constructor(message = 'Não foi possível iniciar a conversa. Tente novamente em alguns minutos.') {
    super(message);
    this.name = 'WebChatAbuseBlockedError';
  }
}

/** Campo oculto preenchido por bots — visitante legítimo envia vazio. */
export function isWebChatHoneypotTriggered(body: Record<string, unknown> | undefined): boolean {
  if (!body) return false;
  const hp = body._radarchat_hp ?? body.companyUrl ?? body.company_url ?? body.website;
  return typeof hp === 'string' && hp.trim().length > 0;
}

async function redisSessionCount(key: string): Promise<number | null> {
  const redis = RedisManager.getInstance();
  if (!redis.isConnected()) return null;
  const raw = await redis.get(key);
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

async function redisRecordSession(key: string, windowMs: number): Promise<number> {
  const redis = RedisManager.getInstance();
  const ttlSec = Math.ceil(windowMs / 1000);
  return redis.increment(key, ttlSec);
}

export async function assertWebChatPublicSessionAllowed(
  publicKey: string,
  ip: string | undefined,
): Promise<void> {
  const trimmedKey = publicKey.trim();
  if (!trimmedKey) throw new WebChatAbuseBlockedError();

  const redisKey = redisSessionKey(trimmedKey, ip ?? '');
  const redisCount = await redisSessionCount(redisKey);
  if (redisCount !== null) {
    if (redisCount >= MAX_SESSIONS_PER_IP) {
      throw new WebChatAbuseBlockedError();
    }
    await redisRecordSession(redisKey, SESSION_WINDOW_MS);
    return;
  }

  const key = sessionBucketKey(trimmedKey, ip ?? '');
  const now = Date.now();
  const existing = sessionBuckets.get(key);
  if (!existing || now - existing.windowStart > SESSION_WINDOW_MS) {
    sessionBuckets.set(key, { count: 1, windowStart: now });
    return;
  }
  if (existing.count >= MAX_SESSIONS_PER_IP) {
    throw new WebChatAbuseBlockedError();
  }
  existing.count += 1;
}

/** Testes — limpa buckets in-memory. */
export function resetWebChatPublicAbuseLimits(): void {
  sessionBuckets.clear();
}
