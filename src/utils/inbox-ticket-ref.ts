import crypto from 'crypto';

/** Alfabeto sem 0/O/1/I/L — evita confusão ao digitar ou ler TK-… no painel/WhatsApp. */
const TICKET_REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Referência legível para chamados (WhatsApp e chat do site). */
export function generateInboxTicketRef(): string {
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += TICKET_REF_ALPHABET[bytes[i]! % TICKET_REF_ALPHABET.length]!;
  }
  return `TK-${suffix}`;
}
