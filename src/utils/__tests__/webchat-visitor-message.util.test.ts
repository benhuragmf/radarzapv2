import {
  isVisitorHiddenSystemMessage,
  isVisitorVisibleWebChatMessage,
} from '@/utils/webchat-visitor-message.util';

describe('webchat-visitor-message.util', () => {
  it('oculta mensagens direction internal do visitante', () => {
    expect(
      isVisitorVisibleWebChatMessage({
        direction: 'internal',
        body: 'Me ajude @supervisor',
      }),
    ).toBe(false);
  });

  it('mantém inbound/outbound visíveis', () => {
    expect(isVisitorVisibleWebChatMessage({ direction: 'inbound', body: 'oi' })).toBe(true);
    expect(isVisitorVisibleWebChatMessage({ direction: 'outbound', body: 'como posso ajudar?' })).toBe(
      true,
    );
  });

  it('oculta system messages internas da equipe', () => {
    expect(
      isVisitorVisibleWebChatMessage({
        direction: 'system',
        body: '📋 Dados do visitante\nNome: Ana',
      }),
    ).toBe(false);
    expect(
      isVisitorHiddenSystemMessage({
        direction: 'system',
        body: 'Prioridade para João — aguardando aceite no painel.',
      }),
    ).toBe(true);
  });
});
