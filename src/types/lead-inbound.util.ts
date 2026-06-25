import { hasCommercialLeadIntent } from '@/services/leads/lead-commercial-intent.util';

export interface WhatsAppLeadInboundContext {
  isNewContact: boolean;
  isNewConversation: boolean;
  message?: string;
}

export interface WebChatLeadInboundContext {
  hadExistingContact: boolean;
  isNewConversation: boolean;
  message?: string;
}

/**
 * TOP 09: WhatsApp genérico não cria lead; retorno (nova conversa) ou intenção comercial sim.
 */
export function shouldCreateLeadFromWhatsAppInbound(ctx: WhatsAppLeadInboundContext): boolean {
  if (!ctx.isNewContact && !ctx.isNewConversation) return false;
  if (ctx.isNewContact && !hasCommercialLeadIntent(ctx.message ?? '')) return false;
  return true;
}

/**
 * TOP 09: WebChat pré-chat genérico não cria lead; retorno ou intenção comercial no primeiro contato sim.
 */
export function shouldCreateLeadFromWebChatSession(ctx: WebChatLeadInboundContext): boolean {
  if (!ctx.isNewConversation) return false;
  if (!ctx.hadExistingContact && !hasCommercialLeadIntent(ctx.message ?? '')) return false;
  return true;
}
