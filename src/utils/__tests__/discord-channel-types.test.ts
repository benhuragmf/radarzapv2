import {
  filterDiscordChannelsForMonitor,
  isDiscordTextMonitorType,
  discordChannelTypeLabel,
} from '../discord-channel-types.util';

describe('discord-channel-types.util', () => {
  const channels = [
    { type: 0, name: 'geral' },
    { type: 5, name: 'anuncios' },
    { type: 10, name: 'thread-news' },
    { type: 11, name: 'thread-pub' },
    { type: 12, name: 'thread-priv' },
    { type: 15, name: 'forum' },
    { type: 2, name: 'voz' },
    { type: 13, name: 'palco' },
    { type: 4, name: 'categoria' },
  ];

  it('identifica tipos de texto monitoráveis', () => {
    expect(isDiscordTextMonitorType(0)).toBe(true);
    expect(isDiscordTextMonitorType(15)).toBe(true);
    expect(isDiscordTextMonitorType(2)).toBe(false);
  });

  it('filtra canais texto incluindo threads e fórum', () => {
    const text = filterDiscordChannelsForMonitor(channels, 'text');
    expect(text.map(c => c.type).sort((a, b) => a - b)).toEqual([0, 5, 10, 11, 12, 15]);
  });

  it('filtra canais de voz', () => {
    const voice = filterDiscordChannelsForMonitor(channels, 'voice');
    expect(voice.map(c => c.type)).toEqual([2, 13]);
  });

  it('retorna vazio para monitor guild', () => {
    expect(filterDiscordChannelsForMonitor(channels, 'guild')).toHaveLength(0);
  });

  it('rotula tipos conhecidos', () => {
    expect(discordChannelTypeLabel(15)).toBe('Fórum');
    expect(discordChannelTypeLabel(99)).toBe('Tipo 99');
  });
});
