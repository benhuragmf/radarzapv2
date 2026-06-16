import { TICKET_POST_CLOSE_REPLY_HOURS } from '@/types/inbox-ticket';

export const TICKET_REPLY_WINDOW_MS = TICKET_POST_CLOSE_REPLY_HOURS * 60 * 60 * 1000;

type TicketWindowFields = {
  status: string;
  clientReplyExpiresAt?: Date | string | null;
  lastTeamMessageAt?: Date | string | null;
  closedAt?: Date | string | null;
};

/** Último envio da equipe ao cliente neste ticket (âncora da janela de 12 h). */
export function closedTicketTeamAnchor(
  ticket: Pick<TicketWindowFields, 'lastTeamMessageAt' | 'closedAt'>,
): Date | null {
  const raw = ticket.lastTeamMessageAt ?? ticket.closedAt;
  if (!raw) return null;
  return new Date(raw);
}

/**
 * Ticket fechado: janela válida só se `clientReplyExpiresAt` no futuro **e**
 * último envio da equipe via Ticket dentro das 12 h (ignora `clientReplyExpiresAt`
 * estendido erroneamente por inbox antes da 2.8.9).
 */
export function isClosedTicketReplyWindowActive(
  ticket: TicketWindowFields,
  now: Date = new Date(),
): boolean {
  if (ticket.status !== 'closed') return false;
  if (!ticket.clientReplyExpiresAt) return false;
  const expires = new Date(ticket.clientReplyExpiresAt);
  if (now >= expires) return false;
  const anchor = closedTicketTeamAnchor(ticket);
  if (!anchor) return false;
  return now.getTime() - anchor.getTime() <= TICKET_REPLY_WINDOW_MS;
}

/** Filtro Mongo para tickets fechados elegíveis a resposta do cliente. */
export function closedTicketReplyWindowMongoFilter(now: Date = new Date()) {
  const windowStart = new Date(now.getTime() - TICKET_REPLY_WINDOW_MS);
  return {
    status: 'closed' as const,
    clientReplyExpiresAt: { $gt: now },
    $or: [
      { lastTeamMessageAt: { $gt: windowStart } },
      { lastTeamMessageAt: null, closedAt: { $gt: windowStart } },
      { lastTeamMessageAt: { $exists: false }, closedAt: { $gt: windowStart } },
    ],
  };
}
