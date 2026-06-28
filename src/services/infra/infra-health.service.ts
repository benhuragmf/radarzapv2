import { DatabaseManager } from '@/database/DatabaseManager';
import { RedisManager } from '@/cache/RedisManager';
import { QueueManager } from '@/cache/QueueManager';
import { config } from '@/config/environment';
import { getInfraRuntimeState } from './infra-runtime-state';

export interface InfraDependencyHealth {
  ok: boolean;
  latencyMs: number;
}

export interface InfraHealthSnapshot {
  healthy: boolean;
  degraded: boolean;
  degradedReasons: string[];
  uptime: number;
  version: string;
  nodeEnv: string;
  checkedAt: string;
  dependencies: {
    mongodb: InfraDependencyHealth;
    redis: InfraDependencyHealth;
    queues: InfraDependencyHealth;
  };
}

/** Resposta mínima para liveness público (AH-R07) — sem latências nem nodeEnv. */
export interface PublicLivenessHealth {
  healthy: boolean;
  degraded?: boolean;
  uptime: number;
  version: string;
  checkedAt: string;
}

export function toPublicLivenessHealth(snapshot: InfraHealthSnapshot): PublicLivenessHealth {
  const pub: PublicLivenessHealth = {
    healthy: snapshot.healthy,
    uptime: snapshot.uptime,
    version: snapshot.version,
    checkedAt: snapshot.checkedAt,
  };
  if (snapshot.degraded) pub.degraded = true;
  return pub;
}

async function timedCheck(check: () => Promise<boolean>): Promise<InfraDependencyHealth> {
  const start = Date.now();
  try {
    const ok = await check();
    return { ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

/** Snapshot de infra para GET /api/services/health (AH-S04). */
export async function buildInfraHealthSnapshot(): Promise<InfraHealthSnapshot> {
  const [mongodb, redis, queues] = await Promise.all([
    timedCheck(() => DatabaseManager.getInstance().healthCheck()),
    timedCheck(() => RedisManager.getInstance().healthCheck()),
    timedCheck(async () => {
      const result = await QueueManager.getInstance().healthCheck();
      return result.healthy;
    }),
  ]);

  const healthy = mongodb.ok && redis.ok;
  const runtime = getInfraRuntimeState();

  return {
    healthy,
    degraded: runtime.degraded || (!redis.ok && runtime.mongodbReady),
    degradedReasons: runtime.degradedReasons,
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? '0.0.0',
    nodeEnv: config.NODE_ENV,
    checkedAt: new Date().toISOString(),
    dependencies: { mongodb, redis, queues },
  };
}
