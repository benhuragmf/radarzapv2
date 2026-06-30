import {
  buildExtractedFromInbound,
  normalizeInboundDiscordMessage,
  normalizeInboundDiscordEvent,
} from '../discord-inbound-payload.util';

describe('discord-inbound-payload.util', () => {
  it('normaliza mensagem inbound mínima', () => {
    const out = normalizeInboundDiscordMessage({
      messageId: '1234567890123456789',
      guildId: '9876543210987654321',
      channelId: '1111111111111111111',
      authorId: '2222222222222222222',
      text: 'Olá promo https://twitch.tv/foo',
    });
    expect(out.hasLink).toBe(true);
    expect(out.searchText).toContain('promo');
  });

  it('rejeita snowflake inválido', () => {
    expect(() =>
      normalizeInboundDiscordMessage({
        messageId: 'x',
        guildId: '1',
        channelId: '1111111111111111111',
        authorId: '2222222222222222222',
      }),
    ).toThrow(/guildId/);
  });

  it('buildExtractedFromInbound preenche ExtractedMessage', () => {
    const normalized = normalizeInboundDiscordMessage({
      messageId: '1234567890123456789',
      guildId: '9876543210987654321',
      channelId: '1111111111111111111',
      authorId: '2222222222222222222',
      text: 'teste',
    });
    const extracted = buildExtractedFromInbound(normalized);
    expect(extracted.messageId).toBe(normalized.messageId);
    expect(extracted.hash).toHaveLength(64);
  });

  it('normaliza evento voice_join', () => {
    const out = normalizeInboundDiscordEvent({
      trigger: 'voice_join',
      guildId: '9876543210987654321',
      channelId: '1111111111111111111',
      userId: '2222222222222222222',
      userName: 'João',
    });
    expect(out.trigger).toBe('voice_join');
  });

  it('rejeita trigger message em eventos', () => {
    expect(() =>
      normalizeInboundDiscordEvent({
        trigger: 'message',
        guildId: '9876543210987654321',
        channelId: '1111111111111111111',
        userId: '2222222222222222222',
      }),
    ).toThrow(/trigger/);
  });
});
