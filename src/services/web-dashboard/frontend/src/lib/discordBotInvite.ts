/** Client ID público do Radar Chat — espelho do backend. */
export const DISCORD_BOT_CLIENT_ID = '1397251289838260244'

/** Fallback quando a API ainda não respondeu (dev sem VITE_*). */
export const DISCORD_BOT_INVITE_FALLBACK =
  `https://discord.com/oauth2/authorize?client_id=${DISCORD_BOT_CLIENT_ID}&scope=bot&permissions=85120`

export function discordBotInviteFromEnv(): string {
  const viteId = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined
  if (viteId?.trim()) {
    return `https://discord.com/oauth2/authorize?client_id=${viteId.trim()}&scope=bot&permissions=85120`
  }
  return DISCORD_BOT_INVITE_FALLBACK
}
