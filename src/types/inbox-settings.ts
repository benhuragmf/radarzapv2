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
  queuePositionMessage:
    'Você está na posição *{position}* da fila. Nossos atendentes estão em atendimento — aguarde um momento, por favor.',
  queueAllBusyMessage:
    'Recebemos sua mensagem. No momento nossos atendentes estão ocupados, mas você já está na fila de atendimento. Assim que possível, alguém vai falar com você.',
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
  /** Aviso automático com resposta rápida de aviso antes do encerramento (0 = desligado). */
  inactivityWarningMinutes: 10,
  /** Texto enviado pelo sistema no aviso automático (atendimento humano). */
  inactivityWarningMessage: 'Você está aí?',
  /** Texto enviado pelo sistema ao encerrar por inatividade automática. */
  inactivityCloseMessage: 'Conversa encerrada por inatividade.',
  /** Minutos após /aus (atalho manual) para liberar /enc no Inbox. Independente do SLA automático. */
  inactivityCloseGateWaitMinutes: 5,
  /** Código da resposta rápida de aviso (ex.: aus → /aus). */
  inactivityWarningQuickCode: 'aus',
  /** Código da resposta rápida de encerramento (ex.: enc → /enc). */
  inactivityCloseQuickCode: 'enc',
  /** Código da pergunta final antes de encerrar (ex.: mais → /mais). */
  gracefulCloseQuickCode: 'mais',
  /** Minutos após /mais sem nova dúvida para liberar /enc. */
  gracefulCloseAfterPromptMinutes: 2,
  /** Detectar "não/obrigado" do cliente após /mais. */
  gracefulCloseDetectPhrases: true,
  /** Template de encerramento cordial (ex.: enc_ok). */
  inactivityCloseGracefulQuickCode: 'enc_ok',
  /** Exige /aus antes de liberar o atalho /enc (inatividade). */
  closeQuickReplyGateEnabled: true,
  /** Exige /mais antes de liberar o atalho /enc_ok (encerramento natural). */
  gracefulCloseQuickReplyGateEnabled: true,
  /** Alerta de supervisor quando conversa na fila excede este tempo (0 = desligado). */
  queueSlaAlertMinutes: 30,
  /** Horas para equipe responder após mensagem do cliente no ticket (0 = desligado). */
  ticketTeamResponseHours: 24,
} as const;

/** SLA de inatividade na triagem (bot aguardando resposta do cliente). */
export const DEFAULT_INBOX_TRIAGE_INACTIVITY = {
  /** Atendentes (não dono/admin) veem conversas em triagem antes da escolha do setor. */
  attendantTriageVisible: false,
  triageInactivityEnabled: true,
  /** Minutos após a pergunta do bot sem resposta para enviar o aviso. */
  triageWarningMinutes: 2,
  /** Minutos após o aviso para encerrar a conversa. */
  triageCloseAfterWarningMinutes: 1,
  triageWarningMessage: 'Você está aí?',
  triageCloseMessage: 'Conversa encerrada por inatividade.',
} as const;

export const DEFAULT_AGENT_PRESENCE_TIMEOUT_SECONDS = 90;

/** Minutos de inatividade no painel antes de marcar ausente (padrão 5 min). */
export const DEFAULT_PRESENCE_IDLE_TIMEOUT_SECONDS = 300;

export const DEFAULT_WHATSAPP_FALLBACK_VISITOR_MESSAGE =
  'No momento não temos atendentes online no painel, mas podemos continuar seu atendimento pelo WhatsApp. Um atendente autorizado poderá assumir sua conversa em breve.';

/** Segundos aguardando aceite quando há atendente indicado online (30–900). */
export const DEFAULT_WHATSAPP_FALLBACK_ACCEPT_TIMEOUT_SECONDS = 120;

/** Sem atendente online / fila aberta — 0 = alerta WA imediato na escalação. */
export const DEFAULT_WHATSAPP_FALLBACK_NO_AGENT_TIMEOUT_SECONDS = 0;

/** !pausar — retomada automática da IA no WhatsApp conectado (QR). */
export {
  DEFAULT_WHATSAPP_PAUSAR_AUTO_RESUME_HOURS,
  WHATSAPP_PAUSAR_AUTO_RESUME_HOURS_MIN,
  WHATSAPP_PAUSAR_AUTO_RESUME_HOURS_MAX,
} from '@/types/inbox-human-takeover';

/** Minutos máximos na fila WebChat antes de encerrar (0 = desligado). */
export const DEFAULT_WEBCHAT_QUEUE_MAX_WAIT_MINUTES = 45;

export const DEFAULT_WEBCHAT_QUEUE_MAX_WAIT_CLOSE_MESSAGE =
  'Ainda não conseguimos um atendente no chat. Encerramos esta conversa — você pode iniciar um novo chat ou falar conosco pelo WhatsApp quando preferir.';

/** Atendimentos simultâneos por atendente (Inbox + WebChat + bridge WA). */
export const DEFAULT_MAX_CONCURRENT_CHATS_PER_AGENT = 1;

/** Legado: se só existir closeQuickReplyGateEnabled, encerramento natural herda o mesmo valor. */
export function resolveGracefulCloseQuickReplyGateEnabled(settings: {
  gracefulCloseQuickReplyGateEnabled?: boolean;
  closeQuickReplyGateEnabled?: boolean;
}): boolean {
  if (settings.gracefulCloseQuickReplyGateEnabled !== undefined) {
    return settings.gracefulCloseQuickReplyGateEnabled !== false;
  }
  return settings.closeQuickReplyGateEnabled !== false;
}

export function resolveInactivityCloseQuickReplyGateEnabled(settings: {
  closeQuickReplyGateEnabled?: boolean;
}): boolean {
  return settings.closeQuickReplyGateEnabled !== false;
}

/** Minutos após /aus para liberar /enc (atalho manual). Legado: total − aviso do SLA automático. */
export function resolveInactivityCloseGateWaitMinutes(settings: {
  inactivityCloseGateWaitMinutes?: number;
  inactivityCloseMinutes?: number;
  inactivityWarningMinutes?: number;
}): number {
  if (settings.inactivityCloseGateWaitMinutes !== undefined) {
    return Math.max(0, Number(settings.inactivityCloseGateWaitMinutes) || 0);
  }
  const close = settings.inactivityCloseMinutes ?? DEFAULT_INBOX_SLA.inactivityCloseMinutes;
  const warn = settings.inactivityWarningMinutes ?? DEFAULT_INBOX_SLA.inactivityWarningMinutes;
  if (close <= 0) return 0;
  if (warn > 0 && warn < close) return close - warn;
  return close;
}
