/** Referência legível para chamados (WhatsApp e chat do site). */
export function generateInboxTicketRef(): string {
  return `TK-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}
