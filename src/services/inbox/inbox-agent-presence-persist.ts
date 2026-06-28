import type { AgentOperationalStatus, AgentStatusSource } from '@/types/agent-presence';
import { RedisManager } from '@/cache/RedisManager';

const TTL_SEC = 30 * 24 * 3600;

export type PersistedAgentPresence = {
  operationalStatus: AgentOperationalStatus;
  lastManualStatus: AgentOperationalStatus;
  statusSource: AgentStatusSource;
};

function redisKey(clientId: string, userId: string): string {
  return `inbox:presence:manual:${clientId}:${userId}`;
}

export async function persistAgentOperationalStatus(
  clientId: string,
  userId: string,
  payload: PersistedAgentPresence,
): Promise<void> {
  try {
    const redis = RedisManager.getInstance();
    await redis.setWithTTL(redisKey(clientId, userId), JSON.stringify(payload), TTL_SEC);
  } catch {
    /* Redis indisponível — presença in-memory continua */
  }
}

export async function loadPersistedAgentOperationalStatus(
  clientId: string,
  userId: string,
): Promise<PersistedAgentPresence | null> {
  try {
    const redis = RedisManager.getInstance();
    const raw = await redis.get(redisKey(clientId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAgentPresence;
    if (!parsed?.operationalStatus) return null;
    return parsed;
  } catch {
    return null;
  }
}
