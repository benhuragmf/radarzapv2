/** Permissões para monitoramento (canais, histórico, envio WA, audit log). */
export const DISCORD_BOT_INVITE_PERMISSIONS = Number(
  process.env.DISCORD_BOT_INVITE_PERMISSIONS ?? 85120,
);

/** Client ID público do Radar Chat (fallback se env ausente). */
export const DISCORD_BOT_CLIENT_ID_FALLBACK = '1397251289838260244';

export function buildDiscordBotInviteUrl(clientId: string): string {
  const id = clientId.trim() || DISCORD_BOT_CLIENT_ID_FALLBACK;
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', id);
  url.searchParams.set('scope', 'bot');
  url.searchParams.set('permissions', String(DISCORD_BOT_INVITE_PERMISSIONS));
  return url.toString();
}
