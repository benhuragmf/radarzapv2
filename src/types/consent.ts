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

export const CONSENT_REFUSE_KEYWORDS = [
  '2', 'sair', 'parar', 'cancelar', 'não', 'nao', 'não quero', 'nao quero', 'remover', 'stop',
  'recusar', 'recuso', 'recusa',
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
  if (CONSENT_REFUSE_KEYWORDS.some(k => norm === k || norm.startsWith(`${k} `))) return 'refuse';
  return null;
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

export const CONSENT_POLL_QUESTION =
  'Autoriza receber mensagens desta empresa via RadarZap? (LGPD)';

export const CONSENT_REQUEST_MESSAGE = `📋 *RadarZap — consentimento*

Toque na enquete abaixo *ou* responda nesta conversa:

✅ *Aceitar:* 1, aceito, sim, quero, ok ou autorizo
❌ *Recusar:* 2, sair, parar, cancelar, não ou remover

Sua escolha será registrada conforme a LGPD.`;

/** IDs de botões (se o cliente suportar resposta por botão) */
export const CONSENT_BUTTON_ACCEPT_ID = 'radarzap_consent_aceito';
export const CONSENT_BUTTON_REFUSE_ID = 'radarzap_consent_recuso';

export const CONSENT_ACCEPTED_REPLY = '✅ Consentimento registrado. Você passará a receber mensagens desta empresa.';
export const CONSENT_REFUSED_REPLY = '❌ Entendido. Você não receberá mais mensagens desta empresa por este canal.';

export type ConsentActionOrigin =
  | 'whatsapp-inbound'
  | 'dashboard-send'
  | 'campaign'
  | 'owner-reset'
  | 'owner-approve-renewal'
  | 'admin-request-renewal'
  | 'system-block';
