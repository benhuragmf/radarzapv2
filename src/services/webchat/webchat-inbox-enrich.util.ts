import { isAgentOnline } from '../inbox/inbox-agent-presence';
import {
  getQueuePriorityState,
  isAgentBusyWithClients,
} from '../inbox/inbox-queue-priority';
import type { InboxWebChatListRow } from './webchat-inbox-bridge';
import { webChatInboxIdToMongo } from './webchat-inbox-bridge';

type WebChatRowInput = InboxWebChatListRow & {
  suggestedUserId?: string;
  suggestedAt?: Date | string;
};

export async function enrichWebChatInboxRow(
  row: WebChatRowInput,
  userId: string,
  clientId: string,
  agentMap: Map<string, string>,
  pullTimeoutSeconds: number,
): Promise<InboxWebChatListRow> {
  const suggestedId = row.suggestedUserId;
  const assignedId = row.assignedUserId;
  const status = row.status;
  const mongoConvId = webChatInboxIdToMongo(row._id);

  let canAccept = false;
  let canPull = false;
  let priorityForMe = false;
  let suggestedUserBusy = false;
  let suggestedUserOnline = true;

  if (status === 'waiting_queue' && suggestedId) {
    priorityForMe = suggestedId === userId;
    canAccept = priorityForMe;
    suggestedUserOnline = isAgentOnline(clientId, suggestedId);
    if (!priorityForMe) {
      suggestedUserBusy = await isAgentBusyWithClients(clientId, suggestedId, {
        webChatConversationId: mongoConvId,
      });
      const { pullAllowedByTimeout } = getQueuePriorityState(row.suggestedAt, pullTimeoutSeconds);
      canPull = suggestedUserBusy || pullAllowedByTimeout || !suggestedUserOnline;
    }
  } else if (status === 'waiting_queue' && !assignedId) {
    canAccept = true;
    canPull = true;
  }

  const priority = getQueuePriorityState(row.suggestedAt, pullTimeoutSeconds);

  return {
    ...row,
    suggestedUserId: suggestedId,
    suggestedUserName: suggestedId ? agentMap.get(suggestedId) : undefined,
    suggestedUserOnline,
    assignedUserName: assignedId ? agentMap.get(assignedId) : row.assignedUserName,
    priorityForMe,
    canAccept,
    canPull,
    suggestedUserBusy,
    pullTimeoutSeconds,
    queueElapsedSec: suggestedId ? priority.elapsedSec : 0,
    queueUrgency: suggestedId ? priority.urgency : 0,
  };
}
