import {
  closedTicketTeamAnchor,
  isClosedTicketReplyWindowActive,
} from '../ticket-reply-window.util';

const now = new Date('2026-06-15T21:00:00.000Z');

describe('ticket-reply-window.util', () => {
  it('usa lastTeamMessageAt como âncora', () => {
    const anchor = closedTicketTeamAnchor({
      lastTeamMessageAt: new Date('2026-06-15T20:00:00.000Z'),
      closedAt: new Date('2026-06-08T17:00:00.000Z'),
    });
    expect(anchor?.toISOString()).toBe('2026-06-15T20:00:00.000Z');
  });

  it('janela válida com envio recente da equipe', () => {
    expect(
      isClosedTicketReplyWindowActive(
        {
          status: 'closed',
          clientReplyExpiresAt: new Date('2026-06-16T09:00:00.000Z'),
          lastTeamMessageAt: new Date('2026-06-15T20:00:00.000Z'),
        },
        now,
      ),
    ).toBe(true);
  });

  it('rejeita ticket antigo com clientReplyExpiresAt inflado pelo inbox', () => {
    expect(
      isClosedTicketReplyWindowActive(
        {
          status: 'closed',
          clientReplyExpiresAt: new Date('2026-06-16T09:00:00.000Z'),
          lastTeamMessageAt: new Date('2026-06-08T17:40:00.000Z'),
          closedAt: new Date('2026-06-08T19:54:00.000Z'),
        },
        now,
      ),
    ).toBe(false);
  });

  it('rejeita quando clientReplyExpiresAt já passou', () => {
    expect(
      isClosedTicketReplyWindowActive(
        {
          status: 'closed',
          clientReplyExpiresAt: new Date('2026-06-14T12:00:00.000Z'),
          lastTeamMessageAt: new Date('2026-06-14T10:00:00.000Z'),
        },
        now,
      ),
    ).toBe(false);
  });
});
