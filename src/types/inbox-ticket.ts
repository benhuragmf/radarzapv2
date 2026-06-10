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

/** Confirmação curta do cliente durante janela de complemento do ticket. */
export function isTicketClientAcknowledgment(text: string): boolean {
  const norm = normalizeTicketText(text);
  if (!norm || norm.length > 120) return false;
  if (parseTicketClientExit(norm) || parseTicketFinalize(norm)) return false;
  return /\b(ok|obrigad|valeu|positivo|certo|entendido|aguardo|perfeito|combinado|blz|beleza)\b/.test(
    norm,
  );
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

/** Após expirar os 30 min de complemento — não aceita mais mensagens no ticket fechado */
export const TICKET_CLIENT_GRACE_EXPIRED_ACK =
  'O prazo de 30 minutos para enviar complementos encerrou. Suas informações já foram registradas no chamado.';

export const TICKET_CLOSE_REPLY_HINT =
  'Se tiver qualquer dúvida, pode responder este chamado em até 12 horas.\nEnvie *sair* se já estiver resolvido.';

/** Horas que o cliente pode responder após fechamento ou último envio da equipe */
export const TICKET_POST_CLOSE_REPLY_HOURS = 12;

/** Após este tempo da janela de 12h, cliente pausado vê menu: chamado vs novo atendimento */
export const TICKET_FOLLOW_UP_MENU_AFTER_HOURS = 2;

export const TICKET_FOLLOW_UP_MENU_AFTER_MS =
  TICKET_FOLLOW_UP_MENU_AFTER_HOURS * 60 * 60 * 1000;

export type TicketInboundMode = 'awaiting_follow_up' | 'ticket' | 'new_service';

export type TicketFollowUpChoice = 'ticket' | 'new_service';

function normalizeTicketText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function buildTicketFollowUpMenu(ticketRef: string): string {
  return (
    `Olá! Você ainda pode falar sobre o chamado *${ticketRef}*.\n\n` +
    `*1* — Inserir informação, consultar *status* ou *finalizar* este chamado\n` +
    `*2* — Iniciar um *novo atendimento*\n\n` +
    `Responda com o número.`
  );
}

export const TICKET_FOLLOW_UP_TICKET_READY =
  'Certo! Envie a informação, digite *status* para ver o andamento ou *finalizar* / *sair* para encerrar neste chamado.';

export function normalizeTicketMenuKeyword(text: string): string {
  return normalizeTicketText(text);
}

export function parseTicketFollowUpChoice(text: string): TicketFollowUpChoice | null {
  const norm = normalizeTicketText(text);
  if (!norm) return null;
  if (norm === '2' || norm === 'novo' || norm === 'novo atendimento' || norm.startsWith('novo ')) {
    return 'new_service';
  }
  if (
    norm === '1' ||
    norm === 'inserir' ||
    norm === 'status' ||
    norm === 'finalizar' ||
    norm === 'chamado' ||
    norm === 'ticket'
  ) {
    return 'ticket';
  }
  return null;
}

export function parseTicketStatusRequest(text: string): boolean {
  const norm = normalizeTicketText(text);
  if (!norm) return false;
  if (norm === 'status' || norm === 'andamento' || norm === 'situacao') return true;

  const asksAboutStatus =
    /\b(qual|quais|como|saber|ver|consultar|informar|me diga|me fale|gostaria|queria|preciso saber|quero saber)\b/.test(
      norm,
    ) ||
    /\b(est[aá]|esta|estao|estão|ta|t[aá])\b/.test(norm) ||
    /\b(dele|dela|disso)\b/.test(norm);

  if (/\b(status|andamento|situacao|situação)\b/.test(norm) && asksAboutStatus) {
    return true;
  }

  if (/\b(como (est[aá]|ta)|qual (o )?andamento)\b/.test(norm)) return true;
  if (/\bsaber (o )?(status|andamento|situacao)\b/.test(norm)) return true;
  if (/\b(status|andamento) (do|da|dele|dela|desse|deste) (ticket|chamado|tk)\b/.test(norm)) {
    return true;
  }

  return false;
}

export function parseTicketFinalize(text: string): boolean {
  const norm = normalizeTicketText(text);
  return norm === 'finalizar' || norm === 'finaliza' || norm === 'encerrar';
}

/** Cliente recusou ticket/chamado e quer atendimento normal. */
export function wantsRejectTicket(text: string): boolean {
  const norm = normalizeTicketText(text);
  if (!norm) return false;
  const rejectPhrases = [
    'nao quero ticket',
    'nao quero chamado',
    'sem ticket',
    'sem chamado',
    'nao quero tk',
    'cancelar ticket',
    'cancelar chamado',
  ];
  return rejectPhrases.some(p => norm === p || norm.includes(p));
}

/** Cumprimento genérico — indica novo atendimento, não complemento de ticket */
export function isNewServiceGreeting(text: string): boolean {
  const norm = normalizeTicketText(text);
  if (!norm) return false;
  const greetings = [
    'oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi', 'opa', 'eai', 'e ai',
    'novo atendimento', 'quero atendimento', 'preciso de ajuda', 'atendimento',
    'pode me ajudar', 'voce pode me ajudar', 'me ajuda', 'ajuda',
  ];
  return greetings.some(g => norm === g || norm.startsWith(`${g} `) || norm.includes(g));
}
