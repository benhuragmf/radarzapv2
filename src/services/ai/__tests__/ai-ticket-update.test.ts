import {
  isTicketRefOnlyMessage,
  looksLikeTicketSupplement,
  normalizeTicketRef,
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
