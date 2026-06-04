/** Resposta de GET /discord/nav-alerts — ids = navConfig DISCORD_NAV link ids */
export type NavAlertSeverity = 'error' | 'warn'

export interface NavAlertItem {
  severity: NavAlertSeverity
  count: number
  summary: string
  code: string
}

export type NavAlertsResponse = {
  items: Record<string, NavAlertItem>
}

export const DISCORD_NAV_ALERT_IDS = {
  RULES: 'auto-rules',
  LOGS: 'watch-logs',
  QUEUE: 'watch-queue',
} as const
