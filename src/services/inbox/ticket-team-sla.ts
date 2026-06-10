/** SLA interno: prazo para a equipe responder após mensagem do cliente no ticket. */
export const DEFAULT_TICKET_TEAM_RESPONSE_HOURS = 24;

export interface TicketTeamSlaFields {
  teamSlaDueAt?: Date;
  teamSlaBreachedAt?: Date;
  teamSlaNotifiedAt?: Date;
}

export function computeTeamSlaDueAt(from: Date, hours: number): Date {
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

export function applyTeamSlaOnClientReply(ticket: TicketTeamSlaFields, hours: number): void {
  if (hours <= 0) return;
  ticket.teamSlaDueAt = computeTeamSlaDueAt(new Date(), hours);
  ticket.teamSlaBreachedAt = undefined;
  ticket.teamSlaNotifiedAt = undefined;
}

export function clearTeamSlaOnTeamReply(ticket: TicketTeamSlaFields): void {
  ticket.teamSlaDueAt = undefined;
  ticket.teamSlaBreachedAt = undefined;
  ticket.teamSlaNotifiedAt = undefined;
}

export function isTeamSlaBreached(
  ticket: TicketTeamSlaFields,
  now = Date.now(),
): boolean {
  if (ticket.teamSlaBreachedAt) return true;
  if (!ticket.teamSlaDueAt) return false;
  return now > new Date(ticket.teamSlaDueAt).getTime();
}
