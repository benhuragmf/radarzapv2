export type InboxWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface InboxDaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

export type InboxWeeklySchedule = Record<InboxWeekday, InboxDaySchedule>;

export const INBOX_WEEKDAYS: InboxWeekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DEFAULT_INBOX_WEEKLY_SCHEDULE: InboxWeeklySchedule = {
  monday: { enabled: true, start: '09:00', end: '18:00' },
  tuesday: { enabled: true, start: '09:00', end: '18:00' },
  wednesday: { enabled: true, start: '09:00', end: '18:00' },
  thursday: { enabled: true, start: '09:00', end: '18:00' },
  friday: { enabled: true, start: '09:00', end: '18:00' },
  saturday: { enabled: false, start: '09:00', end: '13:00' },
  sunday: { enabled: false, start: '09:00', end: '13:00' },
};

export const DEFAULT_INBOX_BOT_TEXTS = {
  welcomeWithCompany: 'Olá! Bem-vindo ao atendimento *{company}*.',
  welcomeGeneric: 'Olá! Bem-vindo ao nosso atendimento.',
  menuIntro: 'Escolha o setor:',
  menuFooter: '_Responda com o número ou o nome do setor._',
  queueMessage:
    'Você foi direcionado para *{department}*.\n{waiting}',
  waitingMessage: 'Um atendente responderá em breve. Enquanto isso, pode descrever sua solicitação.',
  outsideHoursMessage:
    'Nosso horário de atendimento é de segunda a sexta, das 9h às 18h. Deixe sua mensagem que retornaremos no próximo horário útil.',
  invalidMenuHint: 'Opção inválida. Responda com {options} ou o nome do setor.',
  resolvedMessage: 'Atendimento finalizado. Se precisar de algo, envie uma nova mensagem.',
  transferMessage: 'Sua conversa foi transferida para *{department}*. Aguarde um atendente.',
} as const;

/** Defaults para SLA de inatividade e fila do Inbox. */
export const DEFAULT_INBOX_SLA = {
  inactivityAutoCloseEnabled: true,
  /** Minutos sem resposta do cliente após mensagem do atendente (0 = desligado). */
  inactivityCloseMinutes: 15,
  /** Aviso automático com template `/aus` antes do encerramento (0 = desligado). */
  inactivityWarningMinutes: 10,
  /** Alerta de supervisor quando conversa na fila excede este tempo (0 = desligado). */
  queueSlaAlertMinutes: 30,
  /** Horas para equipe responder após mensagem do cliente no ticket (0 = desligado). */
  ticketTeamResponseHours: 24,
} as const;

export const DEFAULT_AGENT_PRESENCE_TIMEOUT_SECONDS = 90;

export const DEFAULT_WHATSAPP_FALLBACK_VISITOR_MESSAGE =
  'No momento não temos atendentes online no painel, mas podemos continuar seu atendimento pelo WhatsApp. Um atendente autorizado poderá assumir sua conversa em breve.';
