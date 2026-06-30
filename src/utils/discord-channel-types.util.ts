/** Tipos de canal Discord (API v10) relevantes ao monitoramento. */
export const DISCORD_TEXT_CHANNEL_TYPES = [0, 5, 10, 11, 12, 15] as const;
/** 0 texto · 5 anúncio · 10 thread news · 11 thread pública · 12 thread privada · 15 fórum */
export const DISCORD_VOICE_CHANNEL_TYPES = [2, 13] as const;

export const DISCORD_CHANNEL_TYPE_LABELS: Record<number, string> = {
  0: 'Texto',
  5: 'Anúncio',
  2: 'Voz',
  13: 'Palco',
  10: 'Thread',
  11: 'Thread',
  12: 'Thread privada',
  15: 'Fórum',
};

export function discordChannelTypeLabel(type: number): string {
  return DISCORD_CHANNEL_TYPE_LABELS[type] ?? `Tipo ${type}`;
}

export function isDiscordTextMonitorType(type: number): boolean {
  return (DISCORD_TEXT_CHANNEL_TYPES as readonly number[]).includes(type);
}

export function isDiscordVoiceMonitorType(type: number): boolean {
  return (DISCORD_VOICE_CHANNEL_TYPES as readonly number[]).includes(type);
}

export function filterDiscordChannelsForMonitor<T extends { type: number }>(
  channels: T[],
  monitorFilter: 'text' | 'voice' | 'guild',
): T[] {
  if (monitorFilter === 'voice') {
    return channels.filter(c => isDiscordVoiceMonitorType(c.type));
  }
  if (monitorFilter === 'guild') {
    return [];
  }
  return channels.filter(c => isDiscordTextMonitorType(c.type));
}
