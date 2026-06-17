import mongoose from 'mongoose';
import { InboxConversation } from '@/models/InboxConversation';
import { WebChatConversation } from '@/models/WebChatConversation';
import { InboxConversationStatus } from '@/types/inbox';

export interface QueuePriorityState {
  elapsedSec: number;
  urgency: number;
  pullAllowedByTimeout: boolean;
}

export function getQueuePriorityState(
  suggestedAt: Date | string | undefined,
  timeoutSeconds: number,
): QueuePriorityState {
  if (!suggestedAt) {
    return { elapsedSec: 0, urgency: 0, pullAllowedByTimeout: true };
  }
  const elapsedSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(suggestedAt).getTime()) / 1000),
  );
  const safeTimeout = Math.max(30, timeoutSeconds);
  const urgency = Math.min(1, elapsedSec / safeTimeout);
  return {
    elapsedSec,
    urgency,
    pullAllowedByTimeout: urgency >= 1,
  };
}

export async function isSuggestedUserBusy(
  clientId: string,
  suggestedUserId: string,
  excludeConversationId?: string,
): Promise<boolean> {
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const filter: Record<string, unknown> = {
    clientId: clientOid,
    assignedUserId: new mongoose.Types.ObjectId(suggestedUserId),
    status: InboxConversationStatus.IN_PROGRESS,
  };
  if (excludeConversationId) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeConversationId) };
  }
  const count = await InboxConversation.countDocuments(filter);
  return count > 0;
}

/** Atendente com conversa ativa no Inbox ou no chat do site. */
export async function isAgentBusyWithClients(
  clientId: string,
  userId: string,
  exclude?: { inboxConversationId?: string; webChatConversationId?: string },
): Promise<boolean> {
  const inboxBusy = await isSuggestedUserBusy(
    clientId,
    userId,
    exclude?.inboxConversationId,
  );
  if (inboxBusy) return true;

  const clientOid = new mongoose.Types.ObjectId(clientId);
  const wcFilter: Record<string, unknown> = {
    clientId: clientOid,
    assignedUserId: userId,
    queueStatus: 'with_agent',
    status: 'open',
  };
  if (exclude?.webChatConversationId) {
    wcFilter._id = { $ne: new mongoose.Types.ObjectId(exclude.webChatConversationId) };
  }
  const wcCount = await WebChatConversation.countDocuments(wcFilter);
  return wcCount > 0;
}

export function formatElapsedTimer(elapsedSec: number): string {
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
