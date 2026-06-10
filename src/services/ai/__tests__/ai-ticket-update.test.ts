import {
  buildAiTicketChoiceMenu,
  clientWantsTicketInteraction,
  isTicketClientDecline,
  isTicketRefOnlyMessage,
  isTicketUpdateContext,
  looksLikeTicketSupplement,
  normalizeTicketRef,
  parseAiTicketMenuChoice,
  parseTicketRefFromText,
} from '@/utils/ticket-ref';
import { AiTicketUpdateService } from '../AiTicketUpdateService';
import type { IAiConversationState } from '@/models/AiConversationState';
import type { AiStructuredReply } from '@/types/ai-assistant';

describe('ticket-ref utils', () => {
  it('extrai TK-XXXXXX do texto', () => {
    expect(parseTicketRefFromText('quero o ticket TK-88CHYX')).toBe('TK-88CHYX');
    expect(normalizeTicketRef('tk-88chyx')).toBe('TK-88CHYX');
  });

  it('detecta mensagem só com referência do ticket', () => {
    expect(isTicketRefOnlyMessage('TK-88CHYX')).toBe(true);
    expect(isTicketRefOnlyMessage('TK-88CHYX quero esse')).toBe(false);
  });

  it('detecta contexto de complemento de ticket', () => {
    expect(
      isTicketUpdateContext(
        { targetTicketRef: 'TK-5NP8CT' },
        'Avisar que o problema ainda nao foi resolvido',
      ),
    ).toBe(true);
    expect(
      isTicketUpdateContext(
        {},
        'Avisar que o problema ainda nao foi resolvido',
        'Quais informações você gostaria de adicionar ao ticket TK-5NP8CT?',
      ),
    ).toBe(true);
  });

  it('detecta intenção de interagir com ticket', () => {
    expect(clientWantsTicketInteraction('preciso inserir dados no ticket')).toBe(true);
    expect(clientWantsTicketInteraction('qual os ticket que estão no sistema')).toBe(true);
    expect(clientWantsTicketInteraction('TK-5NP8CT')).toBe(false);
  });

  it('monta menu numerado de tickets com status Fechado', () => {
    const menu = buildAiTicketChoiceMenu([
      { ref: 'TK-5NP8CT', status: 'closed' },
      { ref: 'TK-73GWPP', status: 'open', subject: 'Suporte' },
    ]);
    expect(menu).toContain('1 — *TK-5NP8CT*');
    expect(menu).toContain('[Fechado]');
    expect(menu).toContain('2 — *TK-73GWPP*');
    expect(menu).toContain('[Aberto]');
    expect(menu).toContain('Suporte');
  });

  it('detecta intenção sobre ticket fechado', () => {
    expect(clientWantsTicketInteraction('meu ticket fechado')).toBe(true);
    expect(clientWantsTicketInteraction('chamado encerrado')).toBe(true);
  });

  it('consulta de status não é complemento', () => {
    expect(looksLikeTicketSupplement('Gostaria de saber o status dele?')).toBe(false);
    expect(looksLikeTicketSupplement('não obrigado')).toBe(false);
    expect(looksLikeTicketSupplement('falar com atendente')).toBe(false);
    expect(looksLikeTicketSupplement('ok tudo certo pode finalizar')).toBe(false);
  });

  it('resolve escolha numerada do menu', () => {
    const choices = ['TK-5NP8CT', 'TK-73GWPP', 'TK-88CHYX'];
    expect(parseAiTicketMenuChoice('2', choices)).toBe('TK-73GWPP');
    expect(parseAiTicketMenuChoice('TK-88CHYX', choices)).toBe('TK-88CHYX');
    expect(parseAiTicketMenuChoice('9', choices)).toBeNull();
  });

  it('detecta complemento útil (telefone)', () => {
    expect(looksLikeTicketSupplement('8185-5858')).toBe(true);
    expect(looksLikeTicketSupplement('sim vou interagir no ticket')).toBe(false);
    expect(looksLikeTicketSupplement('TK-88CHYX')).toBe(false);
    expect(looksLikeTicketSupplement('ok')).toBe(false);
  });
});

describe('AiTicketUpdateService', () => {
  const svc = AiTicketUpdateService.getInstance();

  it('guarda targetTicketRef a partir do texto do cliente', () => {
    const state = {} as IAiConversationState;
    svc.applyTargetTicketRef(state, {}, 'TK-88CHYX');
    expect(state.targetTicketRef).toBe('TK-88CHYX');
  });

  it('resolve corpo para gravar quando há ticket e telefone', () => {
    const state = { targetTicketRef: 'TK-88CHYX' } as IAiConversationState;
    const structured = {} as AiStructuredReply;
    expect(svc.resolveAppendBody(structured, '8185-5858', state)).toBe('8185-5858');
  });

  it('usa ticketAppendBody quando IA confirma append', () => {
    const state = { targetTicketRef: 'TK-88CHYX' } as IAiConversationState;
    const structured = {
      shouldAppendToTicket: true,
      ticketAppendBody: 'Telefone: 8185-5858',
    } as AiStructuredReply;
    expect(svc.resolveAppendBody(structured, '8185-5858', state)).toBe('Telefone: 8185-5858');
  });

  it('não grava quando cliente recusa', () => {
    const state = { targetTicketRef: 'TK-88CHYX' } as IAiConversationState;
    const structured = { shouldAppendToTicket: true, ticketAppendBody: 'x' } as AiStructuredReply;
    expect(svc.resolveAppendBody(structured, 'não obrigado', state)).toBeNull();
  });

  it('não grava quando cliente pede atendente', () => {
    const state = { targetTicketRef: 'TK-88CHYX' } as IAiConversationState;
    const structured = {} as AiStructuredReply;
    expect(svc.resolveAppendBody(structured, 'falar com atendente', state)).toBeNull();
    expect(svc.resolveAppendBody(structured, 'atendente', state)).toBeNull();
  });

  it('não grava quando cliente encerra', () => {
    const state = { targetTicketRef: 'TK-88CHYX' } as IAiConversationState;
    const structured = {} as AiStructuredReply;
    expect(svc.resolveAppendBody(structured, 'ok tudo certo pode finalizar', state)).toBeNull();
  });

  it('não grava quando só escolhe ticket', () => {
    const state = { targetTicketRef: 'TK-88CHYX' } as IAiConversationState;
    const structured = {} as AiStructuredReply;
    expect(svc.resolveAppendBody(structured, 'TK-88CHYX', state)).toBeNull();
  });

  it('infere ticket da última mensagem da IA quando cliente só envia complemento', () => {
    const state = {} as IAiConversationState;
    svc.applyTargetTicketRef(
      state,
      {},
      'Avisar que o problema retornou',
      'Entendi, você deseja adicionar informações ao ticket TK-5NP8CT.',
    );
    expect(state.targetTicketRef).toBe('TK-5NP8CT');
  });

  it('persiste via InboxService quando ticket existe', async () => {
    const state = { targetTicketRef: 'TK-88CHYX' } as IAiConversationState;
    const inbox = {
      appendTicketClientReplyFromAi: jest.fn().mockResolvedValue(true),
    };
    const ok = await svc.tryPersist(
      'client1',
      '5511999999999',
      state,
      { shouldAppendToTicket: true, ticketAppendBody: '8185-5858' } as AiStructuredReply,
      '8185-5858',
      inbox as never,
    );
    expect(ok).toBe(true);
    expect(inbox.appendTicketClientReplyFromAi).toHaveBeenCalledWith(
      'client1',
      'TK-88CHYX',
      '8185-5858',
      '5511999999999',
    );
  });
});
