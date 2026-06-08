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
