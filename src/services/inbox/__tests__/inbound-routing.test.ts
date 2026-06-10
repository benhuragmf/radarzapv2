import { InboxConversationStatus } from '@/types/inbox';
import { INBOX_MENU_CONTEXT_TTL_MS } from '@/types/inbox-menu-context';
import {
  evaluateTicketInboundRouting,
  isInboxServiceCompeting,
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

  it('cliente pausado na janela de 12h libera inbox sem capturar no ticket', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: 'mais info',
          clientReplyPaused: true,
        }),
      ),
    ).toBe('defer_inbox');
  });

  it('ticket aberto pausado após positivo libera inbox para texto solto', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: 'quero saber do frete',
          ticketStatus: 'client_replied',
          clientReplyPaused: true,
          clientReplyExpiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
        }),
      ),
    ).toBe('defer_inbox');
  });

  it('não quero ticket libera inbox', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({ trimmed: 'não quero ticket' }),
      ),
    ).toBe('release_inbox');
    expect(wantsNewInboundService('não quero ticket')).toBe(true);
  });

  it('você pode me ajudar libera inbox', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({ trimmed: 'você pode me ajudar?' }),
      ),
    ).toBe('release_inbox');
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

  it('ticket aberto captura positivo/obrigado mesmo com bot_triage', () => {
    for (const msg of [
      'Positivo',
      'Ok muito obrigado estarei no aguardo',
    ]) {
      expect(
        evaluateTicketInboundRouting(
          baseInput({
            trimmed: msg,
            ticketStatus: 'in_progress',
            conversationStatus: InboxConversationStatus.BOT_TRIAGE,
            inboxTriageActive: true,
            clientReplyGraceUntil: new Date(now.getTime() + 20 * 60 * 1000),
          }),
        ),
      ).toBe('capture');
    }
  });

  it('ticket aberto com escolha de setor libera inbox', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: '3',
          ticketStatus: 'open',
          inboxMenuChoice: '3',
          teamHasMessagedClient: true,
          inboxTriageActive: true,
        }),
      ),
    ).toBe('release_inbox');
  });

  it('ok durante IA/bot_triage não captura ticket antigo sem grace', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: 'ok',
          ticketStatus: 'client_replied',
          teamHasMessagedClient: true,
          conversationStatus: InboxConversationStatus.BOT_TRIAGE,
          aiTriageActive: true,
        }),
      ),
    ).toBe('release_inbox');
  });

  it('ok na fila humana não captura ticket antigo', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: 'ok',
          ticketStatus: 'closed',
          clientReplyPaused: true,
          conversationStatus: InboxConversationStatus.WAITING_QUEUE,
          aiTriageActive: true,
        }),
      ),
    ).toBe('release_inbox');
  });

  it('ok após atualização da equipe captura com ticketInboundMode ticket', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: 'ok',
          ticketStatus: 'in_progress',
          ticketInboundMode: 'ticket',
          clientReplyExpiresAt: new Date(now.getTime() + 10 * 60 * 60 * 1000),
          conversationStatus: InboxConversationStatus.BOT_TRIAGE,
          aiTriageActive: true,
        }),
      ),
    ).toBe('capture');
  });

  it('isInboxServiceCompeting detecta IA/bot ativos', () => {
    expect(
      isInboxServiceCompeting(
        baseInput({
          aiTriageActive: true,
          conversationStatus: InboxConversationStatus.BOT_TRIAGE,
        }),
      ),
    ).toBe(true);
    expect(
      isInboxServiceCompeting(
        baseInput({
          ticketInboundMode: 'ticket',
          aiTriageActive: true,
        }),
      ),
    ).toBe(true);
  });

  it('ticket pausado: ok não captura pelo ack solto', () => {
    expect(
      evaluateTicketInboundRouting(
        baseInput({
          trimmed: 'ok',
          clientReplyPaused: true,
        }),
      ),
    ).toBe('defer_inbox');
  });
});
