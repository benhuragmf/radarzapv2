import type { InboxTicketStatus } from '@/types/inbox-ticket';
import { ticketIsActive } from '@/types/inbox-ticket';
import {
  isClosedTicketReplyWindowActive,
} from '@/services/inbox/ticket-reply-window.util';
export { TICKET_REPLY_WINDOW_MS } from '@/services/inbox/ticket-reply-window.util';
import { resolveTicketDisplayStatus } from '@/services/inbox/ticket-display-status';

/** Estados de produto (referência TOP 08) — não persistidos diretamente. */
export type ProductTicketStatus =
  | 'open'
  | 'pending_team'
  | 'pending_customer'
  | 'in_progress'
  | 'waiting_internal'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'expired'
  | 'archived';

const PERSISTED_STATUSES: ReadonlySet<string> = new Set([
  'open',
  'in_progress',
  'client_replied',
  'closed',
]);

/** Normaliza status persistido; valores desconhecidos retornam null. */
export function normalizePersistedTicketStatus(status: string): InboxTicketStatus | null {
  if (PERSISTED_STATUSES.has(status)) return status as InboxTicketStatus;
  return null;
}

/**
 * Mapeia status persistido + campos derivados para estado de produto.
 * `reopened` não é persistido — use meta de auditoria ou histórico.
 */
export function mapTicketToProductStatus(
  ticket: {
    status: string;
    clientReplyPaused?: boolean;
    clientReplyExpiresAt?: Date | string | null;
    teamHasMessagedClient?: boolean;
    unreadClientReply?: boolean;
    lastTeamMessageAt?: Date | string | null;
    clientReplyGraceUntil?: Date | string | null;
  },
  now = new Date(),
): ProductTicketStatus {
  const display = resolveTicketDisplayStatus(ticket, now);
  switch (display) {
    case 'waiting_team':
      return 'pending_team';
    case 'waiting_client':
      return 'pending_customer';
    case 'paused':
      return 'waiting_internal';
    case 'expired':
      return 'expired';
    case 'closed':
      return 'closed';
    case 'in_progress':
      return 'in_progress';
    case 'open':
      return 'open';
    case 'client_replied':
      return 'pending_team';
    default:
      return ticket.status === 'closed' ? 'closed' : 'open';
  }
}

export function isOpenTicketStatus(status: string): boolean {
  return status === 'open' || status === 'in_progress' || status === 'client_replied';
}

export function isPendingTicketStatus(
  ticket: Parameters<typeof resolveTicketDisplayStatus>[0],
  now = new Date(),
): boolean {
  const product = mapTicketToProductStatus(ticket, now);
  return (
    product === 'pending_team' ||
    product === 'pending_customer' ||
    product === 'waiting_internal'
  );
}

export function isClosedTicketStatus(status: string): boolean {
  return status === 'closed';
}

/** Cliente pode enviar mensagem ao ticket (ativo ou janela pós-fechamento). */
export function canCustomerReplyToTicket(
  ticket: {
    status: string;
    clientReplyExpiresAt?: Date | string | null;
    lastTeamMessageAt?: Date | string | null;
    closedAt?: Date | string | null;
    clientReplyPaused?: boolean;
  },
  now = new Date(),
): boolean {
  if (ticket.clientReplyPaused) return false;
  if (ticketIsActive(ticket.status)) return true;
  if (ticket.status === 'closed') {
    return isClosedTicketReplyWindowActive(ticket, now);
  }
  return false;
}
