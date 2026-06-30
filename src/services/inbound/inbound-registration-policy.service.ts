import { loadInboxSettings } from '@/constants/inbox-triage';
import {
  hasCommercialLeadIntent,
} from '@/services/leads/lead-commercial-intent.util';
import {
  type InboundRegistrationPolicy,
  normalizeInboundRegistrationPolicy,
} from '@/types/inbound-registration-policy';

export async function loadInboundRegistrationPolicy(
  clientId: string,
): Promise<InboundRegistrationPolicy> {
  const settings = await loadInboxSettings(clientId);
  return normalizeInboundRegistrationPolicy(settings.inboundRegistrationPolicy);
}

export interface InboundLeadCaptureContext {
  channel: 'whatsapp' | 'webchat';
  isNewContact: boolean;
  isNewConversation: boolean;
  hadExistingContact: boolean;
  message?: string;
  policy: InboundRegistrationPolicy;
}

/**
 * Decide se um LeadCapture automático deve ser criado,
 * respeitando política do dono + intenção comercial (modo both).
 */
export function shouldAutoCaptureLead(ctx: InboundLeadCaptureContext): boolean {
  const isReturn =
    !ctx.isNewContact &&
    (ctx.isNewConversation || (ctx.channel === 'webchat' && ctx.hadExistingContact));

  const mode = ctx.channel === 'whatsapp' ? ctx.policy.whatsapp : ctx.policy.webchat;

  if (isReturn) {
    if (ctx.policy.returnCustomer === 'conversation_only') return false;
    if (ctx.policy.returnCustomer === 'existing_contact') return false;
    return ctx.isNewConversation;
  }

  const wantsLead = mode === 'lead' || mode === 'both';
  if (!wantsLead) return false;

  // Intenção comercial em conversa já aberta (contato existente)
  if (!ctx.isNewContact && !ctx.isNewConversation) {
    return hasCommercialLeadIntent(ctx.message ?? '');
  }

  if (mode === 'lead') {
    return ctx.isNewContact || ctx.isNewConversation;
  }

  // both — mantém filtro de intenção comercial no primeiro contato
  if (ctx.isNewContact && !hasCommercialLeadIntent(ctx.message ?? '')) return false;
  if (ctx.channel === 'webchat' && !ctx.hadExistingContact && !ctx.isNewContact) {
    if (!hasCommercialLeadIntent(ctx.message ?? '')) return false;
  }
  return true;
}
