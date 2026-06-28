import type { WebChatConversationStatus, WebChatQueueStatus } from '../../types/webchat';
import type { InboxChannel } from '../../types/inbox';
import { resolveVisitorNameFromIntake } from '@/utils/webchat-prechat-fields.util';

export const WEBCHAT_INBOX_ID_PREFIX = 'wc:';

export type InboxWebChatListRow = {
  _id: string;
  channel: 'webchat_site';
  contactName: string;
  contactIdentifier: string;
  destinationId?: string;
  visitorPhone?: string;
  contactReason?: string;
  visitorIntake?: Record<string, string>;
  status: string;
  departmentName?: string;
  departmentId?: string;
  departmentMenuKey?: string;
  departmentBadgeLabel?: string;
  departmentClientVisible?: boolean;
  departmentInternalRankLabel?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  suggestedUserId?: string;
  suggestedUserName?: string;
  suggestedUserOnline?: boolean;
  suggestedAt?: string;
  suggestedUserBusy?: boolean;
  pullTimeoutSeconds?: number;
  queueElapsedSec?: number;
  queueUrgency?: number;
  queueEnteredAt?: string;
  handleTimeSec?: number;
  acceptedAt?: string;
  triageWaitSince?: string;
  triageElapsedSec?: number;
  triageUrgency?: number;
  triageInactivityTotalMin?: number;
  encQuickReplyAllowed?: boolean;
  encOkQuickReplyAllowed?: boolean;
  inactivityWarnedAt?: string;
  gracefulClosePromptAt?: string;
  gracefulCloseAckAt?: string;
  closeGateSource?: 'inactivity' | 'graceful';
  lastOutboundAt?: string;
  createdAt?: string;
  lastMessageAt: string;
  lastMessagePreview?: string;
  unreadCount?: number;
  widgetName?: string;
  pageUrl?: string;
  ticketRef?: string;
  /** Bridge WhatsApp ativo (atendente responde pelo celular) */
  whatsappBridgeActive?: boolean;
  whatsappFallbackEnabled?: boolean;
  whatsappFallbackPhase?: 'panel' | 'wa_assumir' | 'no_agent';
  whatsappFallbackRemainingSec?: number;
  whatsappFallbackTimeoutSec?: number;
  whatsappFallbackAcceptTimeoutSec?: number;
  whatsappFallbackNoAgentTimeoutSec?: number;
  whatsappFallbackWaAlertSent?: boolean;
  whatsappFallbackPriorityStartedAt?: string;
  whatsappFallbackWaNotifiedAt?: string;
  priorityForMe?: boolean;
  canAccept?: boolean;
  canPull?: boolean;
};

export function isWebChatInboxId(id: string): boolean {
  return id.startsWith(WEBCHAT_INBOX_ID_PREFIX);
}

export function webChatInboxIdToMongo(id: string): string {
  return id.startsWith(WEBCHAT_INBOX_ID_PREFIX) ? id.slice(WEBCHAT_INBOX_ID_PREFIX.length) : id;
}

export function toWebChatInboxId(conversationId: string): string {
  return `${WEBCHAT_INBOX_ID_PREFIX}${conversationId}`;
}

export function mapWebChatToInboxStatus(
  status: WebChatConversationStatus,
  queueStatus?: WebChatQueueStatus,
): string {
  if (status === 'closed') return 'closed';
  if (queueStatus === 'waiting_human') return 'waiting_queue';
  if (queueStatus === 'with_agent') return 'in_progress';
  return 'bot_triage';
}

export function inboxStatusToWebChatFilter(status?: string): {
  conversationStatus?: 'open' | 'closed';
  queueStatus?: WebChatQueueStatus;
} {
  if (!status) return {};
  if (status === 'closed' || status === 'resolved') return { conversationStatus: 'closed' };
  if (status === 'waiting_queue') return { conversationStatus: 'open', queueStatus: 'waiting_human' };
  if (status === 'in_progress') return { conversationStatus: 'open', queueStatus: 'with_agent' };
  if (status === 'bot_triage') return { conversationStatus: 'open', queueStatus: 'bot' };
  return { conversationStatus: 'open' };
}

export function visitorDisplayName(
  visitorName?: string,
  visitorEmail?: string,
  visitorPhone?: string,
  visitorIntake?: Record<string, string>,
): { contactName: string; contactIdentifier: string } {
  const resolved =
    resolveVisitorNameFromIntake(visitorName, visitorIntake, null) ||
    visitorName?.trim() ||
    undefined;
  const name =
    resolved ||
    visitorEmail?.trim() ||
    visitorPhone?.trim() ||
    'Visitante do site';
  const identifier =
    visitorEmail?.trim() ||
    visitorPhone?.trim() ||
    'chat do site';
  return { contactName: name, contactIdentifier: identifier };
}

export function asInboxChannel(channel?: string): InboxChannel | 'webchat_site' {
  if (channel === 'webchat_site') return 'webchat_site';
  if (channel === 'whatsapp_cloud') return 'whatsapp_cloud';
  return 'whatsapp_qr';
}
