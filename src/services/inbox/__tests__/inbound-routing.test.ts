import { InboxConversationStatus } from '@/types/inbox';
import { INBOX_MENU_CONTEXT_TTL_MS } from '@/types/inbox-menu-context';
import {
  evaluateTicketInboundRouting,
  parseTicketGraceExpiredChoice,
  wantsNewInboundService,
} from '@/services/inbox/inbound-routing';

const now = new Date('2026-06-09T14:00:00.000Z');
const recentMenuAt = new Date(now.getTime() - 5 * 60 * 1000);

function baseInput(overrides: Partial<Parameters<typeof evaluateTicketInboundRouting>[0]> = {}) {
  return {
    trimmed: 'oi',
    ticketStatus: 'closed' as const,
    ticketInboundMode: undefined,
    clientReplyPaused: false,
    clientReplyExpiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
    clientReplyGraceUntil: undefined,
    teamHasMessagedClient: true,
    lastMenuContext: undefined,
    lastMenuSentAt: undefined,
    conversationStatus: undefined,
    inboxMenuChoice: null,
    now,
    ...overrides,
  };
}

describe('inbound-routing', () => {
  it('IA desativada: oi libera inbox (novo atendimento)', () => {
    expect(
      evaluateTicketInboundRouting(baseInput({ trimmed: 'oi' })),
    ).toBe('release_inbox');
  });

  it('IA desativada: 1 com menu inbox recente vai para inbox', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: '1',
          inboxMenuChoice: '1',
          lastMenuContext: 'inbox_triage',
          lastMenuSentAt: recentMenuAt,
        }),
      ),
    ).toBe('release_inbox');
  });

  it('menu ticket recente: 1 vai para ticket', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: '1',
          inboxMenuChoice: '1',
          lastMenuContext: 'ticket_followup',
          lastMenuSentAt: recentMenuAt,
        }),
      ),
    ).toBe('capture');
  });

  it('menu inbox ativo (histórico): 1 e 2 ignoram menu ticket', () => {
    for (const digit of ['1', '2'] as const) {
      expect(
        evaluateTicketInboundRouting(
          baseInput({
            trimmed: digit,
            inboxMenuChoice: digit,
            lastMenuContext: 'ticket_followup',
            lastMenuSentAt: recentMenuAt,
            inboxTriageActive: true,
          }),
        ),
      ).toBe('release_inbox');
    }
  });

  it('menu inbox ativo (histórico): 2 ignora menu grace expirado', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: '2',
          inboxMenuChoice: '2',
          lastMenuContext: 'ticket_grace_expired',
          lastMenuSentAt: recentMenuAt,
          clientReplyPaused: true,
          inboxTriageActive: true,
        }),
      ),
    ).toBe('release_inbox');
  });

  it('menu ticket recente: 2 novo atendimento libera inbox', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: '2',
          inboxMenuChoice: '2',
          lastMenuContext: 'ticket_followup',
          lastMenuSentAt: recentMenuAt,
        }),
      ),
    ).toBe('release_inbox');
  });

  it('ticket fechado após 12h libera inbox', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: 'complemento',
          clientReplyExpiresAt: new Date(now.getTime() - 1000),
        }),
      ),
    ).toBe('release_inbox');
  });

  it('ticket fechado dentro de 12h captura complemento', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: 'segue o comprovante',
          ticketInboundMode: 'ticket',
        }),
      ),
    ).toBe('capture');
  });

  it('conversa em bot_triage sempre libera inbox', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: '1',
          inboxMenuChoice: '1',
          conversationStatus: InboxConversationStatus.BOT_TRIAGE,
        }),
      ),
    ).toBe('release_inbox');
  });

  it('novo atendimento libera ticket', () => {
    expect(wantsNewInboundService('novo atendimento')).toBe(true);
    expect(
      evaluateTicketInboundRouting(baseInput({ trimmed: 'novo atendimento' })),
    ).toBe('release_inbox');
  });

  it('ticketInboundMode new_service libera inbox', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({ trimmed: '1', ticketInboundMode: 'new_service' }),
      ),
    ).toBe('release_inbox');
  });

  it('cliente pausado após grace defer para menu', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: 'mais info',
          clientReplyPaused: true,
        }),
      ),
    ).toBe('defer_inbox');
  });

  it('menu grace expirado: 1 novo atendimento', () => {
    expect(parseTicketGraceExpiredChoice('1')).toBe('new_service');
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: '1',
          clientReplyPaused: true,
          lastMenuContext: 'ticket_grace_expired',
          lastMenuSentAt: recentMenuAt,
        }),
      ),
    ).toBe('release_inbox');
  });

  it('menu inbox expirado não força release só pelo número', () => {
    const expiredMenuAt = new Date(now.getTime() - INBOX_MENU_CONTEXT_TTL_MS - 1000);
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: '1',
          inboxMenuChoice: '1',
          lastMenuContext: 'inbox_triage',
          lastMenuSentAt: expiredMenuAt,
          ticketInboundMode: 'ticket',
        }),
      ),
    ).toBe('capture');
  });

  it('ticket aberto com escolha de setor libera inbox', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: '3',
          ticketStatus: 'open',
          inboxMenuChoice: '3',
          teamHasMessagedClient: true,
        }),
      ),
    ).toBe('release_inbox');
  });
});
