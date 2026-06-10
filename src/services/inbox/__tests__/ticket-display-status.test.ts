import {
  resolveTicketDisplayStatus,
  INBOX_TICKET_DISPLAY_LABEL,
} from '../ticket-display-status';
import {
  applyTeamSlaOnClientReply,
  clearTeamSlaOnTeamReply,
  computeTeamSlaDueAt,
  isTeamSlaBreached,
} from '../ticket-team-sla';

describe('ticket-display-status', () => {
  it('resolve waiting_team quando cliente respondeu', () => {
    expect(
      resolveTicketDisplayStatus({ status: 'client_replied', unreadClientReply: true }),
    ).toBe('waiting_team');
    expect(INBOX_TICKET_DISPLAY_LABEL.waiting_team).toBe('Aguardando equipe');
  });

  it('resolve paused quando clientReplyPaused', () => {
    expect(resolveTicketDisplayStatus({ status: 'in_progress', clientReplyPaused: true })).toBe(
      'paused',
    );
  });

  it('resolve expired quando janela encerrada', () => {
    const past = new Date(Date.now() - 60_000);
    expect(
      resolveTicketDisplayStatus({ status: 'closed', clientReplyExpiresAt: past }),
    ).toBe('expired');
  });

  it('resolve waiting_client após envio da equipe', () => {
    expect(
      resolveTicketDisplayStatus({
        status: 'in_progress',
        teamHasMessagedClient: true,
        lastTeamMessageAt: new Date(),
      }),
    ).toBe('waiting_client');
  });
});

describe('ticket-team-sla', () => {
  it('aplica e limpa SLA da equipe', () => {
    const ticket: { teamSlaDueAt?: Date; teamSlaBreachedAt?: Date } = {};
    applyTeamSlaOnClientReply(ticket, 24);
    expect(ticket.teamSlaDueAt).toBeInstanceOf(Date);
    clearTeamSlaOnTeamReply(ticket);
    expect(ticket.teamSlaDueAt).toBeUndefined();
  });

  it('detecta SLA estourado', () => {
    const due = new Date(Date.now() - 60_000);
    expect(isTeamSlaBreached({ teamSlaDueAt: due })).toBe(true);
  });
});
