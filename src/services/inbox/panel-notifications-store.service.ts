import { RedisManager } from '@/cache/RedisManager';
import type { PanelEventPayload } from '@/types/panel-events';

const MAX_EVENTS = 80;
const LIST_TTL_SEC = 60 * 60 * 24 * 14;

function listKey(orgId: string): string {
  return `panel:notif:${orgId}`;
}

function readKey(orgId: string, userId: string): string {
  return `panel:notif:read:${orgId}:${userId}`;
}

export function isPanelEventVisibleToUser(
  ev: PanelEventPayload,
  userId: string,
  hasBillingView: boolean,
): boolean {
  if (ev.targetUserId && ev.targetUserId !== userId) return false;
  if (ev.ownerOnly && !hasBillingView) return false;
  return true;
}

export async function persistPanelEvent(orgId: string, event: PanelEventPayload): Promise<void> {
  try {
    const redis = RedisManager.getInstance().getClient();
    const key = listKey(orgId);
    await redis.lpush(key, JSON.stringify(event));
    await redis.ltrim(key, 0, MAX_EVENTS - 1);
    await redis.expire(key, LIST_TTL_SEC);
  } catch {
    /* Redis opcional */
  }
}

export async function listPanelEventsForUser(
  orgId: string,
  userId: string,
  hasBillingView: boolean,
  limit = 50,
): Promise<Array<PanelEventPayload & { read: boolean }>> {
  try {
    const redis = RedisManager.getInstance().getClient();
    const raw = await redis.lrange(listKey(orgId), 0, limit - 1);
    const readSet = new Set(await redis.smembers(readKey(orgId, userId)));
    const events: Array<PanelEventPayload & { read: boolean }> = [];

    for (const row of raw) {
      try {
        const ev = JSON.parse(row) as PanelEventPayload;
        if (!isPanelEventVisibleToUser(ev, userId, hasBillingView)) continue;
        events.push({ ...ev, read: readSet.has(ev.id) });
      } catch {
        /* ignorar entrada inválida */
      }
    }
    return events;
  } catch {
    return [];
  }
}

export async function markPanelEventRead(
  orgId: string,
  userId: string,
  eventId: string,
): Promise<void> {
  const redis = RedisManager.getInstance().getClient();
  const key = readKey(orgId, userId);
  await redis.sadd(key, eventId);
  await redis.expire(key, LIST_TTL_SEC);
}

export async function markAllPanelEventsRead(
  orgId: string,
  userId: string,
  eventIds: string[],
): Promise<void> {
  if (eventIds.length === 0) return;
  const redis = RedisManager.getInstance().getClient();
  const key = readKey(orgId, userId);
  await redis.sadd(key, ...eventIds);
  await redis.expire(key, LIST_TTL_SEC);
}
