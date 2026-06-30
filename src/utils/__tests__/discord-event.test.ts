import { buildDiscordEventWhatsAppVariables } from '../discord-event';
import type { DiscordEventPayload } from '@/types/discord-monitor';

function baseEvent(overrides: Partial<DiscordEventPayload> = {}): DiscordEventPayload {
  return {
    eventId: 'evt-1',
    trigger: 'message_edit',
    guildId: 'g1',
    guildName: 'Servidor Teste',
    clientId: 'c1',
    channelId: 'ch1',
    channelName: 'geral',
    userId: 'u1',
    userName: 'João',
    userTag: 'joao#0001',
    timestamp: '2026-06-30T12:00:00.000Z',
    ...overrides,
  };
}

describe('discord-event', () => {
  it('formata mensagem editada', () => {
    const { variables } = buildDiscordEventWhatsAppVariables(
      baseEvent({
        messagePreview: 'Texto novo',
        previousContent: 'Texto antigo',
      }),
    );
    expect(variables.corpo).toContain('João');
    expect(variables.corpo).toContain('Texto novo');
    expect(variables.conteudo_anterior).toBe('Texto antigo');
    expect(variables.titulo).toContain('Servidor Teste');
  });

  it('formata reação com emoji', () => {
    const { variables } = buildDiscordEventWhatsAppVariables(
      baseEvent({
        trigger: 'message_reaction',
        emoji: '🔥',
        messagePreview: 'Mensagem alvo',
      }),
    );
    expect(variables.emoji).toBe('🔥');
    expect(variables.corpo).toContain('Mensagem alvo');
  });
});
