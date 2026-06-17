import {
  DEFAULT_AUTO_REPLY_MESSAGE,
  shouldSendWebChatAutoReply,
} from '../webchat-bot.util';

describe('webchat-bot.util', () => {
  it('envia auto-reply quando habilitado e sem resposta humana', () => {
    expect(
      shouldSendWebChatAutoReply({
        autoReplyEnabled: true,
        autoReplyMessage: DEFAULT_AUTO_REPLY_MESSAGE,
        hasHumanOutbound: false,
        hasBotOutbound: false,
      }),
    ).toBe(true);
  });

  it('nao envia se ja houve resposta humana', () => {
    expect(
      shouldSendWebChatAutoReply({
        autoReplyEnabled: true,
        autoReplyMessage: 'Oi',
        hasHumanOutbound: true,
        hasBotOutbound: false,
      }),
    ).toBe(false);
  });

  it('nao envia se bot ja respondeu (mensagem fixa)', () => {
    expect(
      shouldSendWebChatAutoReply({
        autoReplyEnabled: true,
        autoReplyMessage: 'Oi',
        hasHumanOutbound: false,
        hasBotOutbound: true,
      }),
    ).toBe(false);
  });

  it('continua com IA em triagem mesmo apos resposta do bot', () => {
    expect(
      shouldSendWebChatAutoReply({
        autoReplyEnabled: true,
        autoReplyUseAi: true,
        queueStatus: 'bot',
        hasHumanOutbound: false,
        hasBotOutbound: true,
      }),
    ).toBe(true);
  });

  it('nao envia IA quando conversa ja esta na fila humana', () => {
    expect(
      shouldSendWebChatAutoReply({
        autoReplyEnabled: true,
        autoReplyUseAi: true,
        queueStatus: 'waiting_human',
        hasHumanOutbound: false,
        hasBotOutbound: true,
      }),
    ).toBe(false);
  });

  it('nao envia se conversa ja tem agente atribuido', () => {
    expect(
      shouldSendWebChatAutoReply({
        autoReplyEnabled: true,
        autoReplyMessage: 'Oi',
        assignedUserId: 'user-1',
        hasHumanOutbound: false,
        hasBotOutbound: false,
      }),
    ).toBe(false);
  });
});
