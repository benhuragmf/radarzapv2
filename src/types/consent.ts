/** Status de consentimento LGPD/opt-in por contato WhatsApp */
export enum ConsentStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REFUSED_FIRST = 'REFUSED_FIRST',
  REFUSED_SECOND = 'REFUSED_SECOND',
  REFUSED_THREE = 'REFUSED_THREE',
  MANUALLY_BLOCKED = 'MANUALLY_BLOCKED',
}

export const MAX_PENDING_OUTBOUND = 3;

export const CONSENT_ACCEPT_KEYWORDS = [
  '1', 'aceito', 'aceita', 'sim', 'quero', 'ok', 'autorizo', 'confirmo', 'concordo',
];

/** Recusa na fase inicial (PENDING) — resposta 1/2 ou texto equivalente */
export const CONSENT_PENDING_REFUSE_KEYWORDS = [
  '2', 'não', 'nao', 'não quero', 'nao quero', 'recusar', 'recuso', 'recusa',
];

/** Cancelar inscrição depois de já ter aceito */
export const CONSENT_OPT_OUT_KEYWORDS = [
  'sair', 'parar', 'cancelar', 'remover', 'stop', 'unsubscribe',
];

export type ConsentReply = 'accept' | 'refuse' | null;

export function parseConsentReply(text: string): ConsentReply {
  const raw = text.trim();
  if (raw === CONSENT_BUTTON_ACCEPT_ID || raw.includes('aceito')) return 'accept';
  if (raw === CONSENT_BUTTON_REFUSE_ID || raw.includes('recuso')) return 'refuse';

  const norm = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!norm) return null;
  if (CONSENT_ACCEPT_KEYWORDS.some(k => norm === k || norm.startsWith(`${k} `))) return 'accept';
  if (CONSENT_PENDING_REFUSE_KEYWORDS.some(k => norm === k || norm.startsWith(`${k} `))) {
    return 'refuse';
  }
  return null;
}

function normalizeReplyText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Primeiro passo: usuário pediu para sair (ainda não cancela) */
export function parseOptOutRequest(text: string): boolean {
  const norm = normalizeReplyText(text);
  if (!norm) return false;
  return CONSENT_OPT_OUT_KEYWORDS.some(k => norm === k || norm.startsWith(`${k} `));
}

/** @deprecated use parseOptOutRequest */
export function parseOptOutReply(text: string): boolean {
  return parseOptOutRequest(text);
}

export const CONSENT_OPT_OUT_CONFIRM_KEYWORDS = [
  'sair', 'sim', 'confirmo', 'confirmar', 'cancelar', 'ok', 'quero sair', 'nao quero', 'não quero',
];

/** Voltar a receber — só após cancelamento confirmado (status recusado) */
export const CONSENT_RESUBSCRIBE_KEYWORDS = ['entrar', 'aceitar', 'aceito', 'aceita'];

/** Desistir do cancelamento enquanto aguarda confirmação (permanece inscrito) */
export const CONSENT_OPT_OUT_ABORT_KEYWORDS = ['não', 'nao', 'continuar', 'manter', 'voltar'];

export function parseOptOutConfirm(text: string): boolean {
  const norm = normalizeReplyText(text);
  if (!norm) return false;
  return CONSENT_OPT_OUT_CONFIRM_KEYWORDS.some(k => norm === k || norm.startsWith(`${k} `));
}

export function parseResubscribeReply(text: string): boolean {
  const norm = normalizeReplyText(text);
  if (!norm) return false;
  return CONSENT_RESUBSCRIBE_KEYWORDS.some(k => norm === k || norm.startsWith(`${k} `));
}

export function parseOptOutAbort(text: string): boolean {
  const norm = normalizeReplyText(text);
  if (!norm) return false;
  return CONSENT_OPT_OUT_ABORT_KEYWORDS.some(k => norm === k || norm.startsWith(`${k} `));
}

/** @deprecated use parseResubscribeReply */
export function parseOptOutResume(text: string): boolean {
  return parseResubscribeReply(text);
}

/** Aceite/recusa por texto só na fase inicial */
export function canReplyToConsentPrompt(status: ConsentStatus): boolean {
  return status === ConsentStatus.PENDING;
}

export function nextRefusalStatus(current: ConsentStatus): ConsentStatus {
  switch (current) {
    case ConsentStatus.PENDING:
    case ConsentStatus.ACCEPTED:
      return ConsentStatus.REFUSED_FIRST;
    case ConsentStatus.REFUSED_FIRST:
      return ConsentStatus.REFUSED_SECOND;
    case ConsentStatus.REFUSED_SECOND:
      return ConsentStatus.REFUSED_THREE;
    default:
      return current;
  }
}

export function canSendToContact(status: ConsentStatus): boolean {
  return status === ConsentStatus.ACCEPTED;
}

export function canSendPendingAttempt(status: ConsentStatus, outboundCount: number): boolean {
  if (status !== ConsentStatus.PENDING) return false;
  return outboundCount < MAX_PENDING_OUTBOUND;
}

export function isBlockedStatus(status: ConsentStatus): boolean {
  return (
    status === ConsentStatus.REFUSED_THREE ||
    status === ConsentStatus.MANUALLY_BLOCKED ||
    status === ConsentStatus.REFUSED_FIRST ||
    status === ConsentStatus.REFUSED_SECOND
  );
}

export function ownerCanResetStatus(status: ConsentStatus): boolean {
  return (
    status === ConsentStatus.REFUSED_FIRST ||
    status === ConsentStatus.REFUSED_SECOND
  );
}

export const CONSENT_REQUEST_MESSAGE = `📋 *RadarZap — consentimento*

Responda nesta conversa:

✅ *Aceitar:* digite *1*, ou escreva aceito, sim, quero, ok ou autorizo
❌ *Recusar:* digite *2*, ou escreva não, recuso ou recusar

Sua escolha será registrada conforme a LGPD.`;

/** IDs de botões (se o cliente suportar resposta por botão) */
export const CONSENT_BUTTON_ACCEPT_ID = 'radarzap_consent_aceito';
export const CONSENT_BUTTON_REFUSE_ID = 'radarzap_consent_recuso';

export const CONSENT_ACCEPTED_REPLY =
  '✅ Consentimento registrado. Você passará a receber mensagens desta empresa. Para parar de receber, envie "sair" em qualquer momento.';
export const CONSENT_REFUSED_REPLY =
  '❌ Entendido. Você não receberá mais mensagens desta empresa por este canal.';
export const CONSENT_OPT_OUT_CONFIRM_PROMPT = `⚠️ Tem certeza que *não* quer mais receber mensagens desta empresa?

Para *confirmar* o cancelamento: responda *sair* ou *sim*.
Para *desistir* do cancelamento: responda *não* ou *continuar*.`;

export const CONSENT_OPT_OUT_REPLY =
  '❌ Cancelamento confirmado. Você não receberá mais mensagens desta empresa. Para voltar a receber, envie *entrar* ou *aceitar*.';

export const CONSENT_OPT_OUT_CANCELLED_REPLY =
  '✅ Você continuará recebendo mensagens desta empresa.';

export const CONSENT_RESUBSCRIBE_REPLY =
  '✅ Você voltou a receber mensagens desta empresa. Para parar de novo, envie "sair" em qualquer momento.';

export const CONSENT_OPT_OUT_PENDING_HINT =
  'Para confirmar que não quer mais mensagens, responda *sair* ou *sim*. Para desistir do cancelamento, responda *não* ou *continuar*.';

export type ConsentActionOrigin =
  | 'whatsapp-inbound'
  | 'dashboard-send'
  | 'campaign'
  | 'owner-reset'
  | 'owner-approve-renewal'
  | 'admin-request-renewal'
  | 'system-block';
