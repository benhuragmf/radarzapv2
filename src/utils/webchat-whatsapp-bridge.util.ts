import { normalizeCommandTicketRef } from '@/utils/whatsapp-agent-command.util';

/** Formata mensagem do visitante para encaminhar ao WhatsApp do atendente. */
export function formatVisitorBridgeMessage(input: {
  ticketRef?: string;
  visitorName: string;
  body: string;
  mediaLabel?: string;
}): string {
  const tag = input.ticketRef ? `Site · ${input.ticketRef}` : 'Site';
  const name = input.visitorName.trim() || 'Visitante';
  const content = input.mediaLabel ?? input.body.trim();
  return `*[${tag}] ${name}*\n${content}`;
}

/**
 * Permite rotear resposta quando há vários bridges ativos:
 * `TK-ABC123 sua resposta aqui`
 */
export function parseBridgeReplyRouting(text: string): {
  ticketRef?: string;
  body: string;
} {
  const trimmed = text.trim();
  const prefixed = trimmed.match(/^(TK-[A-Z0-9]{4,12})\s+([\s\S]+)$/i);
  if (prefixed) {
    return {
      ticketRef: normalizeCommandTicketRef(prefixed[1]),
      body: prefixed[2].trim(),
    };
  }
  return { body: trimmed };
}

export function isWhatsappBridgeActive(conversation: {
  whatsappBridgeActive?: boolean;
}): boolean {
  return Boolean(conversation.whatsappBridgeActive);
}
