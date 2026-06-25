import type { AiMode } from './ai-assistant';
import type { AttendanceMode } from './attendance-mode';
import { effectiveWebChatPremiumAi } from './attendance-mode';

/** Tamanho máximo de mensagem do visitante na API pública. */
export const WEBCHAT_VISITOR_MESSAGE_MAX = 4000;

/** Mensagem oficial de fila (TOP 11 / TOP 07). */
export const WEBCHAT_QUEUE_WAITING_VISITOR_MESSAGE =
  'Você está na fila de atendimento. Assim que um atendente estiver disponível, ele continuará por aqui.';

export function isWebChatWidgetActive(widget: { active?: boolean }): boolean {
  return widget.active !== false;
}

export function sanitizeWebChatVisitorMessage(
  raw: unknown,
  max = WEBCHAT_VISITOR_MESSAGE_MAX,
): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, max);
}

export function assertWebChatVisitorMessage(raw: unknown): string {
  const text = sanitizeWebChatVisitorMessage(raw);
  if (!text) throw new Error('Mensagem vazia');
  return text;
}

/** Assinatura para detectar mudanças visuais/comportamentais no refresh do widget. */
export function buildWebChatAppearanceConfigSignature(cfg: {
  theme?: string;
  chatLayout?: string;
  primaryColor?: string;
  title?: string;
  subtitle?: string;
  position?: string;
  prechatMode?: string;
  previewTemplateId?: string;
  greeting?: string;
  prechatFields?: unknown[];
  proactiveGreetingEnabled?: boolean;
  proactiveGreetingMessage?: string;
  ticketLookupEnabled?: boolean;
  faqInChatEnabled?: boolean;
  faqCatalogAvailable?: boolean;
  outsideHoursMessage?: string;
  businessHoursEnabled?: boolean;
}): string {
  return [
    cfg.theme || 'light',
    cfg.chatLayout || 'classic',
    cfg.primaryColor || '',
    cfg.title || '',
    cfg.subtitle || '',
    cfg.position || '',
    cfg.prechatMode || 'steps',
    cfg.previewTemplateId || '',
    cfg.greeting || '',
    JSON.stringify(cfg.prechatFields ?? []),
    cfg.proactiveGreetingEnabled ? '1' : '0',
    cfg.proactiveGreetingMessage || '',
    cfg.ticketLookupEnabled === false ? '0' : '1',
    cfg.faqInChatEnabled === false ? '0' : '1',
    cfg.faqCatalogAvailable ? '1' : '0',
    cfg.businessHoursEnabled ? '1' : '0',
    cfg.outsideHoursMessage || '',
  ].join('|');
}

export function shouldShowWebChatFaq(config: {
  faqInChatEnabled?: boolean;
  faqCatalogAvailable?: boolean;
}): boolean {
  return config.faqInChatEnabled !== false && Boolean(config.faqCatalogAvailable);
}

export function shouldShowWebChatTicketLookup(config: { ticketLookupEnabled?: boolean }): boolean {
  return config.ticketLookupEnabled !== false;
}

export interface WebChatPremiumAiGateInput {
  widgetAutoReplyUseAi: boolean;
  aiSettings: {
    mode: AiMode;
    enabled?: boolean;
    attendanceMode?: AttendanceMode | null;
  };
  /** Resultado de `WebChatAiService.getAvailability().available` */
  premiumAvailability?: boolean;
  /** Carteira/crédito — quando `false`, não roda LLM */
  hasCredits?: boolean;
}

/** Gate IA Premium no widget (modo global + toggle widget + disponibilidade + créditos). */
export function canWebChatRunPremiumAi(input: WebChatPremiumAiGateInput): boolean {
  if (!effectiveWebChatPremiumAi(input.widgetAutoReplyUseAi, input.aiSettings)) return false;
  if (input.premiumAvailability === false) return false;
  if (input.hasCredits === false) return false;
  return true;
}

/** IA Premium tentou rodar mas não retornou resposta → escalar para humano. */
export function shouldEscalateWebChatOnPremiumAiFailure(
  attemptedPremium: boolean,
  gotReply: boolean,
): boolean {
  return attemptedPremium && !gotReply;
}

export function resolveWebChatEscalationSystemMessage(opts: {
  reason?: string;
  departmentName?: string;
}): string {
  const reason = opts.reason?.trim();
  if (reason) return reason;
  if (opts.departmentName) {
    return `Encaminhamos você para o setor ${opts.departmentName}. ${WEBCHAT_QUEUE_WAITING_VISITOR_MESSAGE}`;
  }
  return WEBCHAT_QUEUE_WAITING_VISITOR_MESSAGE;
}

/** Config pública não deve expor IDs internos da organização. */
export function publicWebChatConfigOmitsInternalIds(config: Record<string, unknown>): boolean {
  const forbidden = ['clientId', 'organizationId', '_id', 'widgetId', 'conversationId'];
  return !forbidden.some(k => k in config);
}
