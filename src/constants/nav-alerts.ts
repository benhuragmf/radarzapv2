/**
 * Padrão de notificação no menu (Sidebar) — RadarZap
 *
 * A API GET /discord/nav-alerts retorna `items` keyed por id do item em DISCORD_NAV (navConfig.ts).
 * A Sidebar exibe um ponto vermelho + tooltip quando há alerta para aquele id.
 *
 * Códigos internos (code):
 * - wa_not_in_group     — WhatsApp conectado não participa de grupo usado em regra ativa (estado atual)
 * - pipeline_errors     — erros genéricos recentes na aba Discord (logs)
 *
 * Para novos alertas: adicionar code aqui, popular em DiscordNavAlertsService e mapear ao nav id.
 */

export type NavAlertCode =
  | 'wa_not_in_group'
  | 'pipeline_errors';

export type NavAlertSeverity = 'error' | 'warn';

export interface NavAlertItem {
  severity: NavAlertSeverity;
  count: number;
  summary: string;
  code: NavAlertCode;
}

export type NavAlertsMap = Record<string, NavAlertItem>;

/** Ids de itens do menu Discord (navConfig DISCORD_NAV) que podem receber alertas */
export const DISCORD_NAV_ALERT_IDS = {
  RULES: 'auto-rules',
  LOGS: 'watch-logs',
  QUEUE: 'watch-queue',
} as const;

/** Serviços de log do pipeline Discord → WhatsApp (backend + painel) */
export const DISCORD_PIPELINE_LOG_SERVICES = [
  'DiscordBotService',
  'QueueProcessorService',
  'WhatsAppService',
  'RulesEngine',
] as const;
