/** Filas BullMQ usadas na automação Discord → WhatsApp */
export const DISCORD_QUEUE_NAMES = new Set([
  'message-processing',
  'discord-notifications',
])

/** Serviços de log relevantes para a aba Discord */
export const DISCORD_LOG_SERVICES = [
  'QueueProcessorService',
  'DiscordBotService',
  'RulesEngine',
]

export function isDiscordPath(pathname: string): boolean {
  return pathname.startsWith('/discord')
}
