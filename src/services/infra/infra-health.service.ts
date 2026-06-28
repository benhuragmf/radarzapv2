import { DatabaseManager } from '@/database/DatabaseManager';
import { RedisManager } from '@/cache/RedisManager';
import { QueueManager } from '@/cache/QueueManager';
import { config } from '@/config/environment';

export interface InfraDependencyHealth {
  ok: boolean;
  latencyMs: number;
}

export interface InfraHealthSnapshot {
  healthy: boolean;
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
  uptime: number;
  version: string;
  checkedAt: string;
}

export function toPublicLivenessHealth(snapshot: InfraHealthSnapshot): PublicLivenessHealth {
  return {
    healthy: snapshot.healthy,
    uptime: snapshot.uptime,
    version: snapshot.version,
    checkedAt: snapshot.checkedAt,
  };
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

  return {
    healthy,
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? '0.0.0',
    nodeEnv: config.NODE_ENV,
    checkedAt: new Date().toISOString(),
    dependencies: { mongodb, redis, queues },
  };
}
