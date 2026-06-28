import { isAgentAvailableForQueue } from '../inbox/inbox-agent-presence';
import {
  getQueuePriorityState,
  getQueueWaitState,
  elapsedSecSince,
  isAgentBusyWithClients,
} from '../inbox/inbox-queue-priority';
import type { InboxWebChatListRow } from './webchat-inbox-bridge';
import { webChatInboxIdToMongo } from './webchat-inbox-bridge';
import { DEFAULT_INBOX_SLA, DEFAULT_INBOX_TRIAGE_INACTIVITY } from '../../types/inbox-settings';
import {
  isEncInactivityCloseQuickReplyAllowed,
  isEncOkCloseQuickReplyAllowed,
  triageWaitElapsedSec,
  triageWaitUrgency,
  triageInactivityTotalMinutes,
} from '../inbox/inbox-inactivity';

import { getFallbackCountdownState } from './webchat-fallback-timing.util';

type WebChatRowInput = InboxWebChatListRow & {
  suggestedUserId?: string;
  suggestedAt?: Date | string;
  queueEnteredAt?: Date | string;
  acceptedAt?: Date | string;
  whatsappFallbackPriorityStartedAt?: Date | string;
  whatsappFallbackWaNotifiedAt?: Date | string;
  whatsappFallbackWaNotifiedUserId?: string;
  createdAt?: string;
  lastInboundAt?: Date | string;
  lastOutboundAt?: Date | string;
  inactivityWarnedAt?: Date | string;
  gracefulClosePromptAt?: Date | string;
  gracefulCloseAckAt?: Date | string;
  closeGateSource?: 'inactivity' | 'graceful';
};

type InactivitySla = {
  inactivityCloseMinutes: number;
  inactivityWarningMinutes: number;
  gracefulCloseAfterPromptMinutes: number;
  closeQuickReplyGateEnabled?: boolean;
};

type FallbackEnrichSettings = {
  whatsappFallbackEnabled: boolean;
  whatsappFallbackAcceptTimeoutSeconds?: number;
  whatsappFallbackNoAgentTimeoutSeconds?: number;
};

export async function enrichWebChatInboxRow(
  row: WebChatRowInput,
  userId: string,
  clientId: string,
  agentMap: Map<string, string>,
  pullTimeoutSeconds: number,
  triageInactivityTotalMin = triageInactivityTotalMinutes(
    DEFAULT_INBOX_TRIAGE_INACTIVITY.triageWarningMinutes,
    DEFAULT_INBOX_TRIAGE_INACTIVITY.triageCloseAfterWarningMinutes,
  ),
  inactivitySla?: InactivitySla,
  fallbackSettings?: FallbackEnrichSettings,
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
    priorityForMe = String(suggestedId) === String(userId);
    canAccept = priorityForMe;
    suggestedUserOnline = isAgentAvailableForQueue(clientId, String(suggestedId));
    if (!priorityForMe) {
      suggestedUserBusy = await isAgentBusyWithClients(clientId, String(suggestedId), {
        webChatConversationId: mongoConvId,
      });
      const { pullAllowedByTimeout } = getQueuePriorityState(row.suggestedAt, pullTimeoutSeconds);
      canPull = suggestedUserBusy || pullAllowedByTimeout || !suggestedUserOnline;
    }
  } else if (status === 'waiting_queue' && !assignedId) {
    canAccept = true;
    canPull = true;
  } else if (status === 'bot_triage' && !assignedId) {
    canAccept = true;
  }

  const priority = getQueuePriorityState(row.suggestedAt, pullTimeoutSeconds);
  const queueWait = getQueueWaitState(row.queueEnteredAt, row.suggestedAt, pullTimeoutSeconds);
  const handleTimeSec =
    status === 'in_progress'
      ? elapsedSecSince(row.acceptedAt ?? row.lastOutboundAt)
      : undefined;

  const triageWaitSince =
    status === 'bot_triage' && !assignedId ? row.createdAt : undefined;
  const triageElapsedSec = triageWaitSince
    ? triageWaitElapsedSec(triageWaitSince)
    : 0;
  const triageUrgency = triageWaitSince
    ? triageWaitUrgency(triageElapsedSec, triageInactivityTotalMin)
    : 0;

  const sla = inactivitySla ?? {
    inactivityCloseMinutes: DEFAULT_INBOX_SLA.inactivityCloseMinutes,
    inactivityWarningMinutes: DEFAULT_INBOX_SLA.inactivityWarningMinutes,
    gracefulCloseAfterPromptMinutes: DEFAULT_INBOX_SLA.gracefulCloseAfterPromptMinutes,
    closeQuickReplyGateEnabled: DEFAULT_INBOX_SLA.closeQuickReplyGateEnabled,
  };

  const encQuickReplyAllowed =
    status === 'in_progress'
      ? isEncInactivityCloseQuickReplyAllowed(
          {
            lastInboundAt: row.lastInboundAt ? new Date(row.lastInboundAt) : undefined,
            lastOutboundAt: row.lastOutboundAt ? new Date(row.lastOutboundAt) : undefined,
            inactivityWarnedAt: row.inactivityWarnedAt ? new Date(row.inactivityWarnedAt) : undefined,
            gracefulClosePromptAt: row.gracefulClosePromptAt
              ? new Date(row.gracefulClosePromptAt)
              : undefined,
            gracefulCloseAckAt: row.gracefulCloseAckAt
              ? new Date(row.gracefulCloseAckAt)
              : undefined,
            closeGateSource: row.closeGateSource,
          },
          {
            inactivityCloseMinutes: sla.inactivityCloseMinutes,
            inactivityWarningMinutes: sla.inactivityWarningMinutes,
          },
        )
      : false;

  const encOkQuickReplyAllowed =
    status === 'in_progress'
      ? isEncOkCloseQuickReplyAllowed(
          {
            lastInboundAt: row.lastInboundAt ? new Date(row.lastInboundAt) : undefined,
            lastOutboundAt: row.lastOutboundAt ? new Date(row.lastOutboundAt) : undefined,
            inactivityWarnedAt: row.inactivityWarnedAt ? new Date(row.inactivityWarnedAt) : undefined,
            gracefulClosePromptAt: row.gracefulClosePromptAt
              ? new Date(row.gracefulClosePromptAt)
              : undefined,
            gracefulCloseAckAt: row.gracefulCloseAckAt
              ? new Date(row.gracefulCloseAckAt)
              : undefined,
            closeGateSource: row.closeGateSource,
          },
          {
            gracefulCloseAfterPromptMinutes: sla.gracefulCloseAfterPromptMinutes,
          },
        )
      : false;

  const fallbackCountdown =
    status === 'waiting_queue' && fallbackSettings?.whatsappFallbackEnabled
      ? getFallbackCountdownState(
          clientId,
          {
            suggestedUserId: suggestedId,
            suggestedAt: row.suggestedAt ? new Date(row.suggestedAt) : undefined,
            queueEnteredAt: row.queueEnteredAt ? new Date(row.queueEnteredAt) : undefined,
            whatsappFallbackPriorityStartedAt: row.whatsappFallbackPriorityStartedAt
              ? new Date(row.whatsappFallbackPriorityStartedAt)
              : undefined,
            whatsappFallbackWaNotifiedAt: row.whatsappFallbackWaNotifiedAt
              ? new Date(row.whatsappFallbackWaNotifiedAt)
              : undefined,
            whatsappFallbackWaNotifiedUserId: row.whatsappFallbackWaNotifiedUserId,
          },
          fallbackSettings,
          true,
        )
      : null;

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
    queueEnteredAt: row.queueEnteredAt
      ? new Date(row.queueEnteredAt).toISOString()
      : undefined,
    queueElapsedSec: queueWait.elapsedSec,
    queueUrgency: suggestedId ? priority.urgency : queueWait.urgency,
    handleTimeSec,
    acceptedAt: row.acceptedAt ? new Date(row.acceptedAt).toISOString() : undefined,
    triageWaitSince,
    triageElapsedSec,
    triageUrgency,
    triageInactivityTotalMin,
    encQuickReplyAllowed,
    encOkQuickReplyAllowed,
    inactivityWarnedAt: row.inactivityWarnedAt
      ? new Date(row.inactivityWarnedAt).toISOString()
      : undefined,
    gracefulClosePromptAt: row.gracefulClosePromptAt
      ? new Date(row.gracefulClosePromptAt).toISOString()
      : undefined,
    gracefulCloseAckAt: row.gracefulCloseAckAt
      ? new Date(row.gracefulCloseAckAt).toISOString()
      : undefined,
    closeGateSource: row.closeGateSource,
    lastOutboundAt: row.lastOutboundAt
      ? new Date(row.lastOutboundAt).toISOString()
      : undefined,
    whatsappFallbackEnabled: fallbackSettings?.whatsappFallbackEnabled ?? false,
    whatsappFallbackPhase: fallbackCountdown?.phase,
    whatsappFallbackRemainingSec: fallbackCountdown?.remainingSec,
    whatsappFallbackTimeoutSec: fallbackCountdown?.timeoutSec,
    whatsappFallbackAcceptTimeoutSec:
      fallbackSettings?.whatsappFallbackAcceptTimeoutSeconds ?? 120,
    whatsappFallbackNoAgentTimeoutSec:
      fallbackSettings?.whatsappFallbackNoAgentTimeoutSeconds ?? 0,
    whatsappFallbackWaAlertSent: fallbackCountdown?.waAlertSent ?? false,
    whatsappFallbackPriorityStartedAt: row.whatsappFallbackPriorityStartedAt
      ? new Date(row.whatsappFallbackPriorityStartedAt).toISOString()
      : undefined,
    whatsappFallbackWaNotifiedAt: row.whatsappFallbackWaNotifiedAt
      ? new Date(row.whatsappFallbackWaNotifiedAt).toISOString()
      : undefined,
  };
}
