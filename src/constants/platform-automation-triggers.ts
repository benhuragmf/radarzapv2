/**
 * Gatilhos de automação de mensagens (plataforma).
 * Envio pontual (once_at) também disponível em /platform/automacoes.
 */

import { buildSendAtToday } from '@/utils/birthday-match';
import {
  isCalendarDayOfMonth,
  isNthBusinessDayOfMonth,
  weekdaysMatch,
} from '@/utils/automation-schedule';
import {
  validateFutureSchedule,
  validateFutureTimeToday,
} from '@/utils/schedule-time';

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
  on_contact_birthday: 'No dia do aniversário do contato',
  day_of_month: 'Todo dia N — quem nasceu nesse dia (qualquer mês)',
  interval_months: 'No aniversário, a cada N meses',
  calendar_day_of_month: 'Todo dia N do mês (calendário)',
  nth_business_day_of_month: 'N-ésimo dia útil do mês (seg–sex)',
  weekly: 'Toda semana nos dias escolhidos',
  once_at: 'Uma vez em data e hora',
};

export const TRIGGER_HINTS: Record<PlatformAutomationTriggerType, string> = {
  on_contact_birthday:
    'Usa o campo birthday do contato. Ex.: nascido em 20/03 → envia todo dia 20 de março.',
  day_of_month:
    'Filtra contatos pelo dia do mês da data de nascimento. Ex.: dia 10 → todos que nasceram dia 10.',
  interval_months:
    'No aniversário, só envia se já passaram pelo menos N meses desde o último envio automático.',
  calendar_day_of_month:
    'Dia fixo do calendário, independente de aniversário. Ex.: dia 5 → todo dia 5 de cada mês.',
  nth_business_day_of_month:
    'Conta só segunda a sexta. O 5º dia útil não é o dia 5 do calendário — é o 5º dia seg–sex do mês (ex.: se o mês começa numa quarta, o 1º útil é quarta).',
  weekly: 'Pode marcar vários dias (ex.: segunda e quinta). Dispara no horário configurado.',
  once_at: 'Envio único — não repete após executar.',
};

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
  7: 'Dom',
};

export function formatWeekdays(weekdays: number[] | undefined, fallbackWeekday?: number): string {
  const list =
    weekdays?.length ? weekdays : fallbackWeekday ? [fallbackWeekday] : [];
  if (!list.length) return '—';
  return list
    .slice()
    .sort((a, b) => a - b)
    .map(w => WEEKDAY_LABELS[w] ?? String(w))
    .join(', ');
}

export function isValidTriggerType(v: string): v is PlatformAutomationTriggerType {
  return (PLATFORM_AUTOMATION_TRIGGER_TYPES as string[]).includes(v);
}

/** Gatilho bate no calendário hoje (envio seria hoje). */
export function triggerMatchesCalendarToday(
  body: {
    triggerType?: string;
    dayOfMonth?: number;
    nthBusinessDay?: number;
    weekday?: number;
    weekdays?: number[];
  },
  refDate: Date = new Date(),
): boolean {
  const triggerType = body.triggerType ?? 'on_contact_birthday';
  switch (triggerType) {
    case 'once_at':
      return false;
    case 'calendar_day_of_month':
    case 'day_of_month':
      return isCalendarDayOfMonth(refDate, body.dayOfMonth ?? 0);
    case 'nth_business_day_of_month':
      return isNthBusinessDayOfMonth(refDate, body.nthBusinessDay ?? 0);
    case 'weekly': {
      const days =
        body.weekdays?.length
          ? body.weekdays
          : body.weekday
            ? [body.weekday]
            : [];
      return days.length > 0 && weekdaysMatch(refDate, days);
    }
    case 'on_contact_birthday':
    case 'interval_months':
      return true;
    default:
      return true;
  }
}

/** Bloqueia data/hora no passado (envio único ou horário diário quando o gatilho é hoje). */
export function validateAutomationScheduleTimes(
  body: {
    triggerType?: string;
    scheduledAt?: string;
    sendTime?: string;
    dayOfMonth?: number;
    nthBusinessDay?: number;
    weekday?: number;
    weekdays?: number[];
  },
  refDate: Date = new Date(),
): string | null {
  if (body.triggerType === 'once_at') {
    const check = validateFutureSchedule(body.scheduledAt, refDate);
    if (check.ok === false) return check.error;
    return null;
  }

  if (body.sendTime?.trim() && triggerMatchesCalendarToday(body, refDate)) {
    return validateFutureTimeToday(body.sendTime, refDate);
  }
  return null;
}

export function validateAutomationPayload(body: {
  triggerType?: string;
  dayOfMonth?: number;
  intervalMonths?: number;
  nthBusinessDay?: number;
  weekday?: number;
  weekdays?: number[];
  scheduledAt?: string;
  sendTime?: string;
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
  const scheduleErr = validateAutomationScheduleTimes(body);
  if (scheduleErr) return scheduleErr;
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
    const days =
      body.weekdays?.length
        ? body.weekdays
        : body.weekday
          ? [body.weekday]
          : [];
    if (!days.length) {
      return 'Selecione ao menos um dia da semana';
    }
    if (days.some(d => d < 1 || d > 7)) {
      return 'Dias da semana inválidos (1=segunda … 7=domingo)';
    }
  }
  return null;
}
