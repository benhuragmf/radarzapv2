/** Filas BullMQ usadas na automação Discord → WhatsApp */
export const DISCORD_QUEUE_NAMES = new Set([
  'message-processing',
  'discord-notifications',
])

/** Serviços de log relevantes para a aba Discord */
export const DISCORD_LOG_SERVICES = [
  'DiscordBotService',
  'QueueProcessorService',
  'WhatsAppService',
  'RulesEngine',
]

/** Etapas do pipeline (metadata.stage nos logs) */
export const PIPELINE_STAGES = [
  'capture',
  'skip',
  'queue',
  'render',
  'send',
  'send_ok',
  'send_fail',
] as const

export function isDiscordPath(pathname: string): boolean {
  return pathname.startsWith('/discord')
}
