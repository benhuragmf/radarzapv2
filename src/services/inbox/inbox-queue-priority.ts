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

/** Tempo na fila — prioridade usa suggestedAt; fila aberta usa queueEnteredAt. */
export function getQueueWaitState(
  queueEnteredAt: Date | string | undefined,
  suggestedAt: Date | string | undefined,
  timeoutSeconds: number,
): QueuePriorityState {
  if (suggestedAt) return getQueuePriorityState(suggestedAt, timeoutSeconds);
  if (!queueEnteredAt) return { elapsedSec: 0, urgency: 0, pullAllowedByTimeout: true };
  const elapsedSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(queueEnteredAt).getTime()) / 1000),
  );
  const safeTimeout = Math.max(120, timeoutSeconds * 2);
  return {
    elapsedSec,
    urgency: Math.min(1, elapsedSec / safeTimeout),
    pullAllowedByTimeout: true,
  };
}

export function elapsedSecSince(at: Date | string | undefined): number {
  if (!at) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(at).getTime()) / 1000));
}

export async function isSuggestedUserBusy(
  clientId: string,
  suggestedUserId: string,
  excludeConversationId?: string,
): Promise<boolean> {
  const count = await countAgentActiveChats(clientId, suggestedUserId, {
    inboxConversationId: excludeConversationId,
  });
  return count > 0;
}

/** Conta atendimentos ativos: Inbox in_progress + WebChat with_agent + bridge WA aberto. */
export async function countAgentActiveChats(
  clientId: string,
  userId: string,
  exclude?: { inboxConversationId?: string; webChatConversationId?: string },
): Promise<number> {
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const userOid = userId;

  const inboxFilter: Record<string, unknown> = {
    clientId: clientOid,
    assignedUserId: new mongoose.Types.ObjectId(userOid),
    status: InboxConversationStatus.IN_PROGRESS,
  };
  if (exclude?.inboxConversationId) {
    inboxFilter._id = { $ne: new mongoose.Types.ObjectId(exclude.inboxConversationId) };
  }
  const inboxCount = await InboxConversation.countDocuments(inboxFilter);

  const wcFilter: Record<string, unknown> = {
    clientId: clientOid,
    assignedUserId: userOid,
    queueStatus: 'with_agent',
    status: 'open',
  };
  if (exclude?.webChatConversationId) {
    wcFilter._id = { $ne: new mongoose.Types.ObjectId(exclude.webChatConversationId) };
  }
  const wcCount = await WebChatConversation.countDocuments(wcFilter);

  const bridgeFilter: Record<string, unknown> = {
    clientId: clientOid,
    whatsappBridgeActive: true,
    whatsappBridgeAgentUserId: userOid,
    status: 'open',
  };
  if (exclude?.webChatConversationId) {
    bridgeFilter._id = { $ne: new mongoose.Types.ObjectId(exclude.webChatConversationId) };
  }
  const bridgeCount = await WebChatConversation.countDocuments(bridgeFilter);

  return inboxCount + Math.max(wcCount, bridgeCount);
}

/** Atendente com conversa ativa no Inbox ou no chat do site (incl. bridge WA). */
export async function isAgentBusyWithClients(
  clientId: string,
  userId: string,
  exclude?: { inboxConversationId?: string; webChatConversationId?: string },
): Promise<boolean> {
  const count = await countAgentActiveChats(clientId, userId, exclude);
  return count > 0;
}

export async function isAgentAtCapacity(
  clientId: string,
  userId: string,
  maxConcurrent: number,
  exclude?: { inboxConversationId?: string; webChatConversationId?: string },
): Promise<boolean> {
  const limit = Math.max(1, maxConcurrent);
  const count = await countAgentActiveChats(clientId, userId, exclude);
  return count >= limit;
}

/** Posição na fila do setor (1 = primeiro). */
export async function getQueuePositionForConversation(
  clientId: string,
  departmentId: mongoose.Types.ObjectId | string,
  queueEnteredAt: Date,
  excludeConversationId?: string,
): Promise<number> {
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const deptOid =
    typeof departmentId === 'string'
      ? new mongoose.Types.ObjectId(departmentId)
      : departmentId;

  const filter: Record<string, unknown> = {
    clientId: clientOid,
    departmentId: deptOid,
    status: InboxConversationStatus.WAITING_QUEUE,
    queueEnteredAt: { $lt: queueEnteredAt },
  };
  if (excludeConversationId) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeConversationId) };
  }

  const ahead = await InboxConversation.countDocuments(filter);
  return ahead + 1;
}

export function formatElapsedTimer(elapsedSec: number): string {
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
