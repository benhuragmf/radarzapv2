import {
  canCustomerReplyToTicket,
  isClosedTicketStatus,
  isOpenTicketStatus,
  isPendingTicketStatus,
  mapTicketToProductStatus,
  normalizePersistedTicketStatus,
} from '@/types/ticket-status.util';

describe('ticket-status.util', () => {
  it('normaliza status persistidos conhecidos', () => {
    expect(normalizePersistedTicketStatus('open')).toBe('open');
    expect(normalizePersistedTicketStatus('in_progress')).toBe('in_progress');
    expect(normalizePersistedTicketStatus('client_replied')).toBe('client_replied');
    expect(normalizePersistedTicketStatus('closed')).toBe('closed');
    expect(normalizePersistedTicketStatus('resolved')).toBeNull();
  });

  it('mapeia client_replied para pending_team', () => {
    expect(
      mapTicketToProductStatus({
        status: 'client_replied',
        unreadClientReply: true,
      }),
    ).toBe('pending_team');
  });

  it('mapeia ticket fechado com janela expirada para expired', () => {
    const past = new Date('2020-01-01T00:00:00Z');
    expect(
      mapTicketToProductStatus(
        {
          status: 'closed',
          clientReplyExpiresAt: past,
        },
        new Date('2026-01-01T00:00:00Z'),
      ),
    ).toBe('expired');
  });

  it('classifica status abertos e fechados', () => {
    expect(isOpenTicketStatus('open')).toBe(true);
    expect(isOpenTicketStatus('in_progress')).toBe(true);
    expect(isClosedTicketStatus('closed')).toBe(true);
    expect(isClosedTicketStatus('open')).toBe(false);
  });

  it('detecta pendências operacionais', () => {
    expect(
      isPendingTicketStatus({
        status: 'client_replied',
        unreadClientReply: true,
      }),
    ).toBe(true);
    expect(isPendingTicketStatus({ status: 'open' })).toBe(false);
  });

  it('permite resposta do cliente em ticket ativo', () => {
    expect(canCustomerReplyToTicket({ status: 'in_progress' })).toBe(true);
  });

  it('bloqueia resposta quando pausado', () => {
    expect(
      canCustomerReplyToTicket({
        status: 'in_progress',
        clientReplyPaused: true,
      }),
    ).toBe(false);
  });

  it('permite resposta em ticket fechado dentro da janela de 12h', () => {
    const now = new Date('2026-06-24T12:00:00Z');
    const closedAt = new Date('2026-06-24T10:00:00Z');
    const expires = new Date('2026-06-24T22:00:00Z');
    expect(
      canCustomerReplyToTicket(
        {
          status: 'closed',
          closedAt,
          lastTeamMessageAt: closedAt,
          clientReplyExpiresAt: expires,
        },
        now,
      ),
    ).toBe(true);
  });

  it('bloqueia resposta em ticket fechado fora da janela', () => {
    const now = new Date('2026-06-25T12:00:00Z');
    const closedAt = new Date('2026-06-23T10:00:00Z');
    const expires = new Date('2026-06-23T22:00:00Z');
    expect(
      canCustomerReplyToTicket(
        {
          status: 'closed',
          closedAt,
          lastTeamMessageAt: closedAt,
          clientReplyExpiresAt: expires,
        },
        now,
      ),
    ).toBe(false);
  });
});
