/**
 * Gatilhos de automação de mensagens (plataforma).
 * Envio pontual (once_at) também disponível em /platform/automacoes.
 */

export type PlatformAutomationTriggerType =
  | 'on_contact_birthday'
  | 'day_of_month'
  | 'interval_months'
  | 'calendar_day_of_month'
  | 'nth_business_day_of_month'
  | 'weekly'
  | 'once_at';

export type PlatformAutomationDestinationScope =
  | 'contacts'
  | 'whatsapp_groups'
  | 'both';

export type PlatformAutomationMessageMode = 'platform_template' | 'plain';

export const PLATFORM_AUTOMATION_TRIGGER_TYPES: PlatformAutomationTriggerType[] = [
  'on_contact_birthday',
  'day_of_month',
  'interval_months',
  'calendar_day_of_month',
  'nth_business_day_of_month',
  'weekly',
  'once_at',
];

export const TRIGGER_REQUIRES_BIRTHDAY = new Set<PlatformAutomationTriggerType>([
  'on_contact_birthday',
  'day_of_month',
  'interval_months',
]);

export const TRIGGER_LABELS: Record<PlatformAutomationTriggerType, string> = {
  on_contact_birthday: 'Aniversário do contato (dia mês+dia do birthday)',
  day_of_month: 'Contatos que nasceram no dia N (qualquer mês)',
  interval_months: 'Aniversário + reenvio a cada N meses',
  calendar_day_of_month: 'Dia fixo do calendário (todo mês, dia N)',
  nth_business_day_of_month: 'N-ésimo dia útil do mês (seg–sex)',
  weekly: 'Toda semana no dia da semana escolhido',
  once_at: 'Uma vez em data e hora específicas',
};

export const TRIGGER_HINTS: Record<PlatformAutomationTriggerType, string> = {
  on_contact_birthday: 'Ex.: contato com birthday 1992-03-20 recebe todo 20/03.',
  day_of_month: 'Ex.: todos nascidos no dia 10 recebem no dia 10 de cada mês.',
  interval_months: 'No aniversário, só se passaram ≥ N meses desde o último envio automático.',
  calendar_day_of_month: 'Ex.: dia 5 de todo mês → todos os contatos (com tags, se filtrar).',
  nth_business_day_of_month: 'Ex.: 5º dia útil → contatos VIP no 5º seg–sex do mês.',
  weekly: 'Ex.: toda segunda às 09:00 para a base filtrada.',
  once_at: 'Ex.: envio único em 15/06/2026 às 14:30 — não repete.',
};

export function isValidTriggerType(v: string): v is PlatformAutomationTriggerType {
  return (PLATFORM_AUTOMATION_TRIGGER_TYPES as string[]).includes(v);
}

export function validateAutomationPayload(body: {
  triggerType?: string;
  dayOfMonth?: number;
  intervalMonths?: number;
  nthBusinessDay?: number;
  weekday?: number;
  scheduledAt?: string;
  messageMode?: string;
  customMessage?: string;
  mensagemExtra?: string;
  destinationScope?: string;
}): string | null {
  const triggerType = body.triggerType ?? 'on_contact_birthday';
  if (!isValidTriggerType(triggerType)) {
    return 'triggerType inválido';
  }
  if (triggerType === 'once_at') {
    if (!body.scheduledAt || Number.isNaN(Date.parse(body.scheduledAt))) {
      return 'scheduledAt (data/hora) é obrigatório para envio único';
    }
  }
  if (body.messageMode === 'plain' && !body.customMessage?.trim() && !body.mensagemExtra?.trim()) {
    return 'Informe o texto da mensagem no modo manual';
  }
  if (
    body.destinationScope &&
    !['contacts', 'whatsapp_groups', 'both'].includes(body.destinationScope)
  ) {
    return 'destinationScope inválido';
  }
  if (triggerType === 'day_of_month' || triggerType === 'calendar_day_of_month') {
    if (!body.dayOfMonth || body.dayOfMonth < 1 || body.dayOfMonth > 31) {
      return 'dayOfMonth (1–31) é obrigatório para este gatilho';
    }
  }
  if (triggerType === 'interval_months') {
    if (!body.intervalMonths || body.intervalMonths < 1) {
      return 'intervalMonths é obrigatório (≥ 1)';
    }
  }
  if (triggerType === 'nth_business_day_of_month') {
    if (!body.nthBusinessDay || body.nthBusinessDay < 1 || body.nthBusinessDay > 23) {
      return 'nthBusinessDay (1–23) é obrigatório';
    }
  }
  if (triggerType === 'weekly') {
    if (!body.weekday || body.weekday < 1 || body.weekday > 7) {
      return 'weekday é obrigatório (1=segunda … 7=domingo)';
    }
  }
  return null;
}
