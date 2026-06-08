/** Ciclo de vida do ticket — independente da conversa WhatsApp */
export type InboxTicketStatus = 'open' | 'in_progress' | 'client_replied' | 'closed';

export const INBOX_TICKET_STATUS_LABEL: Record<InboxTicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  client_replied: 'Cliente respondeu',
  closed: 'Fechado',
};

/** Status em que o ticket ainda aceita ações da equipe (não fechado) */
export function ticketIsActive(status: string): boolean {
  return status === 'open' || status === 'in_progress' || status === 'client_replied';
}

/** Cliente pediu para parar de responder neste ticket (≠ opt-out LGPD) */
export const TICKET_CLIENT_EXIT_KEYWORD = 'sair';

export function parseTicketClientExit(text: string): boolean {
  const norm = text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return norm === TICKET_CLIENT_EXIT_KEYWORD;
}

/** Rodapé ao enviar atualização / snapshot ao cliente */
export const TICKET_CLIENT_REPLY_FOOTER =
  'Qualquer dúvida, responda por aqui que anexo no chamado.';

/** Resposta automática quando o cliente escreve no ticket (inicia janela de 30 min) */
export const TICKET_CLIENT_REPLY_GRACE_PROMPT =
  'Ok! Se tiver mais alguma informação, me envie em no máximo 30 minutos que insiro no chamado.';

export const TICKET_CLIENT_REPLY_GRACE_MINUTES = 30;

export const TICKET_CLIENT_REPLY_GRACE_MS = TICKET_CLIENT_REPLY_GRACE_MINUTES * 60 * 1000;

export const TICKET_CLIENT_EXIT_ACK =
  'Entendido! Você não precisa responder mais neste chamado. Quando nossa equipe enviar uma nova atualização, você poderá responder de novo.';

export const TICKET_CLOSE_REPLY_HINT =
  'Se tiver qualquer dúvida, pode responder este chamado em até 24 horas.\nEnvie *sair* se já estiver resolvido.';

/** Horas que o cliente pode responder após finalizar o ticket */
export const TICKET_POST_CLOSE_REPLY_HOURS = 24;
