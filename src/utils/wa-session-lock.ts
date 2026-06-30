import { RedisManager } from '@/cache/RedisManager';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('WaSessionLock');

const LOCK_PREFIX = 'radarchat:wa:socket-lock:';
const LOCK_TTL_SEC = 90;

export type WaSocketLock = {
  pid: number;
  clientId: string;
  startedAt: string;
};

function lockKey(clientId: string): string {
  return `${LOCK_PREFIX}${clientId}`;
}

function parseLock(raw: string | null): WaSocketLock | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as WaSocketLock;
    if (typeof data.pid === 'number' && data.clientId) return data;
  } catch {
    /* legacy */
  }
  return null;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code !== 'ESRCH';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Aguarda outro processo liberar o lock (hot-reload / dev:stop). */
export async function waitForWaSocketLock(clientId: string, maxMs = 20_000): Promise<void> {
  const redis = RedisManager.getInstance();
  const key = lockKey(clientId);
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    const raw = await redis.get(key);
    const lock = parseLock(raw);
    if (!lock || lock.pid === process.pid || !isPidAlive(lock.pid)) {
      return;
    }
    await sleep(250);
  }

  const raw = await redis.get(key);
  const lock = parseLock(raw);
  if (lock && lock.pid !== process.pid && isPidAlive(lock.pid)) {
    logger.warn('Timeout aguardando lock WA — outro processo ainda ativo', {
      clientId,
      otherPid: lock.pid,
      thisPid: process.pid,
    });
  }
}

/** Toma lock exclusivo da socket WA (uma instância Baileys por clientId na máquina). */
export async function acquireWaSocketLock(clientId: string): Promise<boolean> {
  const redis = RedisManager.getInstance();
  const key = lockKey(clientId);
  const payload: WaSocketLock = {
    pid: process.pid,
    clientId,
    startedAt: new Date().toISOString(),
  };

  const existingRaw = await redis.get(key);
  const existing = parseLock(existingRaw);
  if (existing && existing.pid !== process.pid && isPidAlive(existing.pid)) {
    return false;
  }

  if (existing && !isPidAlive(existing.pid)) {
    logger.warn('Lock WA órfão — substituindo', {
      clientId,
      stalePid: existing.pid,
      thisPid: process.pid,
    });
    await redis.deleteKey(key);
  }

  const acquired = await redis.setIfNotExists(key, JSON.stringify(payload), LOCK_TTL_SEC);
  if (acquired) return true;

  const again = parseLock(await redis.get(key));
  if (again?.pid === process.pid) {
    await renewWaSocketLock(clientId);
    return true;
  }
  return false;
}

export async function renewWaSocketLock(clientId: string): Promise<void> {
  const redis = RedisManager.getInstance();
  const raw = await redis.get(lockKey(clientId));
  const lock = parseLock(raw);
  if (!lock || lock.pid !== process.pid) return;

  await redis.setWithTTL(
    lockKey(clientId),
    JSON.stringify({ ...lock, startedAt: lock.startedAt ?? new Date().toISOString() }),
    LOCK_TTL_SEC,
  );
}

export async function releaseWaSocketLock(clientId: string): Promise<void> {
  try {
    const redis = RedisManager.getInstance();
    const raw = await redis.get(lockKey(clientId));
    const lock = parseLock(raw);
    if (!lock || lock.pid === process.pid) {
      await redis.deleteKey(lockKey(clientId));
    }
  } catch {
    /* ignore */
  }
}

/** dev:stop — remove todos os locks WA locais. */
export async function releaseAllWaSocketLocks(): Promise<number> {
  const redis = RedisManager.getInstance();
  const client = redis.getClient();
  let removed = 0;
  let cursor = '0';
  do {
    const [next, keys] = await client.scan(cursor, 'MATCH', `${LOCK_PREFIX}*`, 'COUNT', 100);
    cursor = next;
    if (keys.length > 0) {
      removed += await client.del(...keys);
    }
  } while (cursor !== '0');
  return removed;
}
