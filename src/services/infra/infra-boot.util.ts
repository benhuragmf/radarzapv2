import Redis from 'ioredis';
import { config } from '@/config/environment';

const DEFAULT_REDIS_PROBE_MS = 4_000;

/** Boot degradado: Redis opcional (dev ou INFRA_DEGRADED_BOOT=true). Prod exige Redis. */
export function isDegradedBootAllowed(): boolean {
  if (config.INFRA.DEGRADED_BOOT) return true;
  return config.NODE_ENV === 'development';
}

/** Ping rápido — evita loop longo de reconnect do RedisManager no boot degradado. */
export async function probeRedisReachable(
  timeoutMs: number = DEFAULT_REDIS_PROBE_MS,
): Promise<boolean> {
  const client = new Redis(config.REDIS.URL, {
    password: config.REDIS.PASSWORD,
    connectTimeout: timeoutMs,
    commandTimeout: timeoutMs,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableReadyCheck: false,
    retryStrategy: () => null,
  });

  try {
    await client.connect();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  } finally {
    try {
      client.disconnect();
    } catch {
      // ignore
    }
  }
}
