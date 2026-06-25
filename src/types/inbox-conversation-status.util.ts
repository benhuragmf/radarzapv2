import { InboxConversationStatus } from './inbox';

/** Estados de produto (referência TOP 07) — mapeamento documental, sem rename persistido. */
export type ProductConversationStatus =
  | 'new'
  | 'waiting_queue'
  | 'bot_triage'
  | 'with_agent'
  | 'pending_customer'
  | 'pending_agent'
  | 'transferred'
  | 'resolved'
  | 'closed'
  | 'archived';

export function normalizeConversationStatus(
  value: unknown,
): InboxConversationStatus | null {
  if (typeof value !== 'string') return null;
  const values = Object.values(InboxConversationStatus) as string[];
  return values.includes(value) ? (value as InboxConversationStatus) : null;
}

export function isTriageConversationStatus(status: InboxConversationStatus): boolean {
  return status === InboxConversationStatus.BOT_TRIAGE;
}

export function isQueueConversationStatus(status: InboxConversationStatus): boolean {
  return status === InboxConversationStatus.WAITING_QUEUE;
}

export function isAssignedConversationStatus(status: InboxConversationStatus): boolean {
  return status === InboxConversationStatus.IN_PROGRESS;
}

export function isClosedConversationStatus(status: InboxConversationStatus): boolean {
  return (
    status === InboxConversationStatus.RESOLVED ||
    status === InboxConversationStatus.CLOSED
  );
}

export function isOpenConversationStatus(status: InboxConversationStatus): boolean {
  return !isClosedConversationStatus(status);
}

/** Mapeia status persistido → conceito de produto. */
export function mapProductConversationStatus(
  status: InboxConversationStatus,
  opts?: {
    assignedUserId?: string | null;
    lastInboundAt?: Date | null;
    lastOutboundAt?: Date | null;
  },
): ProductConversationStatus {
  switch (status) {
    case InboxConversationStatus.BOT_TRIAGE:
      return 'bot_triage';
    case InboxConversationStatus.WAITING_QUEUE:
      return 'waiting_queue';
    case InboxConversationStatus.IN_PROGRESS:
      if (opts?.lastInboundAt && opts?.lastOutboundAt) {
        if (opts.lastInboundAt > opts.lastOutboundAt) return 'pending_agent';
        return 'pending_customer';
      }
      return 'with_agent';
    case InboxConversationStatus.TRANSFERRED:
      return 'transferred';
    case InboxConversationStatus.RESOLVED:
      return 'resolved';
    case InboxConversationStatus.CLOSED:
      return 'closed';
    default:
      return 'new';
  }
}
