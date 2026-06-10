/** Status enriquecido para painel — derivado de status + campos de janela. */
export type InboxTicketDisplayStatus =
  | 'open'
  | 'in_progress'
  | 'client_replied'
  | 'closed'
  | 'waiting_team'
  | 'waiting_client'
  | 'paused'
  | 'expired';

export const INBOX_TICKET_DISPLAY_LABEL: Record<InboxTicketDisplayStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  client_replied: 'Cliente respondeu',
  closed: 'Fechado',
  waiting_team: 'Aguardando equipe',
  waiting_client: 'Aguardando cliente',
  paused: 'Pausado',
  expired: 'Janela encerrada',
};

export interface TicketDisplayInput {
  status: string;
  clientReplyPaused?: boolean;
  clientReplyExpiresAt?: Date | string | null;
  teamHasMessagedClient?: boolean;
  unreadClientReply?: boolean;
  lastTeamMessageAt?: Date | string | null;
  clientReplyGraceUntil?: Date | string | null;
}

export function resolveTicketDisplayStatus(
  ticket: TicketDisplayInput,
  now = new Date(),
): InboxTicketDisplayStatus {
  const expires = ticket.clientReplyExpiresAt ? new Date(ticket.clientReplyExpiresAt) : null;
  if (ticket.status === 'closed') {
    if (expires && now > expires) return 'expired';
    return 'closed';
  }
  if (ticket.clientReplyPaused) return 'paused';
  if (ticket.unreadClientReply || ticket.status === 'client_replied') return 'waiting_team';
  if (ticket.teamHasMessagedClient && ticket.lastTeamMessageAt) {
    const grace = ticket.clientReplyGraceUntil ? new Date(ticket.clientReplyGraceUntil) : null;
    if (!grace || now <= grace) return 'waiting_client';
  }
  if (ticket.status === 'in_progress') return 'in_progress';
  if (ticket.status === 'open') return 'open';
  return ticket.status as InboxTicketDisplayStatus;
}

export function serializeTicketDisplayFields(ticket: TicketDisplayInput & {
  teamSlaDueAt?: Date | string | null;
  teamSlaBreachedAt?: Date | string | null;
  lastStatusChangeAt?: Date | string | null;
  lastTeamMessageAt?: Date | string | null;
}) {
  const displayStatus = resolveTicketDisplayStatus(ticket);
  const teamSlaDueAt = ticket.teamSlaDueAt ? new Date(ticket.teamSlaDueAt) : null;
  const teamSlaBreached = Boolean(ticket.teamSlaBreachedAt);
  const teamSlaOverdue =
    teamSlaDueAt !== null &&
    !teamSlaBreached &&
    Date.now() > teamSlaDueAt.getTime() &&
    displayStatus === 'waiting_team';

  return {
    displayStatus,
    displayStatusLabel: INBOX_TICKET_DISPLAY_LABEL[displayStatus],
    teamSlaDueAt: ticket.teamSlaDueAt ?? undefined,
    teamSlaBreachedAt: ticket.teamSlaBreachedAt ?? undefined,
    teamSlaOverdue,
    lastStatusChangeAt: ticket.lastStatusChangeAt ?? undefined,
    lastTeamMessageAt: ticket.lastTeamMessageAt ?? undefined,
  };
}
