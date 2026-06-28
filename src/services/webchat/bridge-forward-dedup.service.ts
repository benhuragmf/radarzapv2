import { createHash } from 'crypto';
import { RedisManager } from '@/cache/RedisManager';
import {
  BRIDGE_FORWARD_DEDUP_MS,
  shouldForwardBridgeMessage,
} from '@/utils/webchat-bridge.util';

const REDIS_KEY_PREFIX = 'rz:bridge:fwd:';

function bridgeForwardRedisKey(dedupeKey: string): string {
  const hash = createHash('sha256').update(dedupeKey).digest('hex').slice(0, 32);
  return `${REDIS_KEY_PREFIX}${hash}`;
}

function dedupTtlSeconds(): number {
  return Math.max(1, Math.ceil(BRIDGE_FORWARD_DEDUP_MS / 1000));
}

/**
 * Reserva slot de encaminhamento bridge (anti-loop / retry).
 * Redis SET NX quando disponível (multi-réplica); fallback in-process (VPS única).
 */
export async function acquireBridgeForwardDedup(
  dedupeKey: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  try {
    const redis = RedisManager.getInstance();
    if (redis.isConnected()) {
      const acquired = await redis.setIfNotExists(
        bridgeForwardRedisKey(dedupeKey),
        String(nowMs),
        dedupTtlSeconds(),
      );
      if (!acquired) return false;
      // Espelho local evita duplicata imediata na mesma instância antes do TTL Redis expirar.
      shouldForwardBridgeMessage(dedupeKey, nowMs);
      return true;
    }
  } catch {
    // fallback in-memory
  }
  return shouldForwardBridgeMessage(dedupeKey, nowMs);
}
