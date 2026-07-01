import { randomUUID } from 'crypto';
import os from 'os';
import { RedisManager } from '@/cache/RedisManager';
import type { AgentOperationalStatus, AgentStatusSource } from '@/types/agent-presence';

/** Canal pub/sub — réplicas do painel espelham presença operacional (STAB-03). */
export const PRESENCE_SYNC_CHANNEL = 'radarchat:inbox:presence:sync';

const instanceId =
  process.env.RADARCHAT_INSTANCE_ID?.trim() ||
  `${os.hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

let subscribed = false;

export type RemotePresenceEntry = {
  sockets: number;
  lastSeen: number;
  operationalStatus: AgentOperationalStatus;
  statusSource: AgentStatusSource;
  lastManualStatus: AgentOperationalStatus;
  route?: string;
  viewingConversationId?: string | null;
};

export type PresenceSyncPayload = {
  instanceId: string;
  clientId: string;
  userId: string;
  entry: RemotePresenceEntry;
};

type RemoteHandler = (payload: PresenceSyncPayload) => void;

let remoteHandler: RemoteHandler | null = null;

export function registerPresenceRemoteHandler(handler: RemoteHandler): void {
  remoteHandler = handler;
}

function liveRedisKey(clientId: string, userId: string): string {
  return `inbox:presence:live:${clientId}:${userId}`;
}

export async function ensurePresenceClusterSubscription(): Promise<void> {
  if (subscribed) return;
  const redis = RedisManager.getInstance();
  if (!redis.isConnected()) return;
  try {
    await redis.subscribe(PRESENCE_SYNC_CHANNEL, message => {
      try {
        const payload = JSON.parse(message) as PresenceSyncPayload;
        if (!payload?.clientId || !payload?.userId || !payload?.entry) return;
        if (payload.instanceId === instanceId) return;
        remoteHandler?.(payload);
      } catch {
        /* payload inválido */
      }
    });
    subscribed = true;
  } catch {
    /* Redis indisponível — presença local continua */
  }
}

/** Propaga snapshot para outras réplicas + TTL de recuperação tardia. */
export function broadcastAgentPresenceSync(
  clientId: string,
  userId: string,
  entry: RemotePresenceEntry,
  ttlMs: number,
): void {
  void ensurePresenceClusterSubscription();
  const redis = RedisManager.getInstance();
  if (!redis.isConnected()) return;

  const payload: PresenceSyncPayload = { instanceId, clientId, userId, entry };
  void redis.publish(PRESENCE_SYNC_CHANNEL, JSON.stringify(payload));

  const ttlSec = Math.max(30, Math.ceil(ttlMs / 1000) + 30);
  void redis.setWithTTL(liveRedisKey(clientId, userId), JSON.stringify(entry), ttlSec);
}

export async function removeAgentPresenceFromRedis(
  clientId: string,
  userId: string,
): Promise<void> {
  try {
    const redis = RedisManager.getInstance();
    if (!redis.isConnected()) return;
    await redis.deleteKey(liveRedisKey(clientId, userId));
  } catch {
    /* ignore */
  }
}

/** Testes — reinicia flag de subscribe. */
export function resetPresenceClusterSubscriptionState(): void {
  subscribed = false;
  remoteHandler = null;
}
