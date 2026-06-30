/**
 * Campos legados de quando regra/destino ficavam no monitor de canal.
 * Hoje destinos e template vivem em `Rule.action` — estes campos não são mais usados no pipeline.
 */
export const DISCORD_CHANNEL_LEGACY_RULE_FIELDS = ['destinationIds', 'templateName'] as const;

export type DiscordChannelApiShape = Record<string, unknown>;

/** Remove campos legados antes de serializar na API. */
export function sanitizeDiscordChannelForApi<T extends DiscordChannelApiShape>(
  channel: T,
): Omit<T, 'destinationIds' | 'templateName'> {
  const out = { ...channel };
  for (const key of DISCORD_CHANNEL_LEGACY_RULE_FIELDS) {
    delete out[key];
  }
  return out as Omit<T, 'destinationIds' | 'templateName'>;
}

export function sanitizeDiscordChannelsForApi<T extends DiscordChannelApiShape>(
  channels: T[],
): Array<Omit<T, 'destinationIds' | 'templateName'>> {
  return channels.map(sanitizeDiscordChannelForApi);
}
