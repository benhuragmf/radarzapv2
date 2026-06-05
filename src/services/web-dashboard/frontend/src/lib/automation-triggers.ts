export type TriggerType =
  | 'on_contact_birthday'
  | 'day_of_month'
  | 'interval_months'
  | 'calendar_day_of_month'
  | 'nth_business_day_of_month'
  | 'weekly'
  | 'once_at'

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  on_contact_birthday: 'No dia do aniversário do contato',
  day_of_month: 'Todo dia N — quem nasceu nesse dia (qualquer mês)',
  interval_months: 'No aniversário, a cada N meses',
  calendar_day_of_month: 'Todo dia N do mês (calendário)',
  nth_business_day_of_month: 'N-ésimo dia útil do mês (seg–sex)',
  weekly: 'Toda semana nos dias escolhidos',
  once_at: 'Uma vez em data e hora',
}

export const TRIGGER_HINTS: Record<TriggerType, string> = {
  on_contact_birthday:
    'Usa o campo birthday do contato. Ex.: nascido em 20/03 → envia todo dia 20 de março.',
  day_of_month:
    'Filtra contatos pelo dia do mês da data de nascimento. Ex.: dia 10 → todos que nasceram dia 10.',
  interval_months:
    'No aniversário, só envia se já passaram pelo menos N meses desde o último envio automático.',
  calendar_day_of_month:
    'Dia fixo do calendário, independente de aniversário. Ex.: dia 5 → todo dia 5 de cada mês.',
  nth_business_day_of_month:
    'Conta só segunda a sexta. O 5º dia útil não é o dia 5 do calendário — é o 5º dia seg–sex do mês.',
  weekly: 'Marque um ou mais dias. Dispara no horário configurado em cada dia marcado.',
  once_at: 'Envio único — não repete após executar.',
}

export const TRIGGER_GROUPS: { label: string; types: TriggerType[] }[] = [
  {
    label: 'Aniversário e contatos',
    types: ['on_contact_birthday', 'day_of_month', 'interval_months'],
  },
  {
    label: 'Calendário e rotinas',
    types: ['calendar_day_of_month', 'nth_business_day_of_month', 'weekly'],
  },
  {
    label: 'Pontual',
    types: ['once_at'],
  },
]

export const WEEKDAYS = [
  { v: 1, label: 'Seg', full: 'Segunda' },
  { v: 2, label: 'Ter', full: 'Terça' },
  { v: 3, label: 'Qua', full: 'Quarta' },
  { v: 4, label: 'Qui', full: 'Quinta' },
  { v: 5, label: 'Sex', full: 'Sexta' },
  { v: 6, label: 'Sáb', full: 'Sábado' },
  { v: 7, label: 'Dom', full: 'Domingo' },
] as const

export function formatWeekdays(weekdays: number[] | undefined, fallback?: number): string {
  const list = weekdays?.length ? weekdays : fallback ? [fallback] : []
  if (!list.length) return '—'
  const map = Object.fromEntries(WEEKDAYS.map(w => [w.v, w.full]))
  return list
    .slice()
    .sort((a, b) => a - b)
    .map(w => map[w] ?? String(w))
    .join(', ')
}

export function describeTrigger(rule: {
  triggerType: TriggerType
  dayOfMonth?: number
  intervalMonths?: number
  nthBusinessDay?: number
  weekday?: number
  weekdays?: number[]
  scheduledAt?: string
  sendTime?: string
}): string {
  const base = TRIGGER_LABELS[rule.triggerType]
  switch (rule.triggerType) {
    case 'day_of_month':
    case 'calendar_day_of_month':
      return `${base} · dia ${rule.dayOfMonth ?? '?'}`
    case 'interval_months':
      return `${base} · ${rule.intervalMonths ?? '?'} meses`
    case 'nth_business_day_of_month':
      return `${base} · ${rule.nthBusinessDay ?? '?'}º útil`
    case 'weekly':
      return `${base} · ${formatWeekdays(rule.weekdays, rule.weekday)}`
    case 'once_at':
      return rule.scheduledAt
        ? `${base} · ${new Date(rule.scheduledAt).toLocaleString('pt-BR')}`
        : base
    default:
      return rule.sendTime ? `${base} · ${rule.sendTime}` : base
  }
}
