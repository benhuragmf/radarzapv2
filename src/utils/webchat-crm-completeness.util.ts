import { normalizeContactPhoneE164 } from '@/utils/contact-csv-import';
import type { CrmRegistrationStatus } from '@/types/inbound-registration-policy';

export type WebChatCrmIncompleteReason = 'missing_phone' | 'no_destination' | 'inbox_only' | 'pending_approval';

export type WebChatCrmCompleteness = {
  crmIncomplete: boolean;
  crmIncompleteReason?: WebChatCrmIncompleteReason;
  crmIncompleteHint: string;
};

export function resolveWebChatVisitorPhone(
  visitorPhone?: string | null,
  visitorIntake?: Record<string, string> | null,
): string {
  return visitorPhone?.trim() || visitorIntake?.phone?.trim() || '';
}

export function hasValidWebChatCrmPhone(phone: string): boolean {
  if (!phone.trim()) return false;
  return Boolean(normalizeContactPhoneE164(phone));
}

const HINTS: Record<WebChatCrmIncompleteReason, string> = {
  missing_phone:
    'Visitante sem WhatsApp/telefone válido. Use «Completar cadastro» para vincular ao CRM e à lista de Contatos.',
  no_destination:
    'Sem contato na base CRM. Informe o telefone com DDI para criar o cadastro (ex.: +5511999999999).',
  inbox_only:
    'Cadastro só no Inbox — não aparece em Contatos/campanhas até completar e aprovar o perfil.',
  pending_approval:
    'Cadastro pendente de aprovação na base de Contatos.',
};

/** Política explícita: visitante WebChat sem telefone E.164 válido = CRM incompleto. */
export function evaluateWebChatCrmCompleteness(opts: {
  visitorPhone?: string | null;
  visitorIntake?: Record<string, string> | null;
  destinationId?: string | null;
  crmRegistrationStatus?: CrmRegistrationStatus | string | null;
}): WebChatCrmCompleteness {
  const phone = resolveWebChatVisitorPhone(opts.visitorPhone, opts.visitorIntake);
  const hasPhone = hasValidWebChatCrmPhone(phone);

  if (!hasPhone) {
    return {
      crmIncomplete: true,
      crmIncompleteReason: 'missing_phone',
      crmIncompleteHint: HINTS.missing_phone,
    };
  }

  if (!opts.destinationId) {
    return {
      crmIncomplete: true,
      crmIncompleteReason: 'no_destination',
      crmIncompleteHint: HINTS.no_destination,
    };
  }

  const status = (opts.crmRegistrationStatus ?? 'approved') as CrmRegistrationStatus;
  if (status === 'pending') {
    return {
      crmIncomplete: true,
      crmIncompleteReason: 'pending_approval',
      crmIncompleteHint: HINTS.pending_approval,
    };
  }
  if (status === 'inbox_only') {
    return {
      crmIncomplete: true,
      crmIncompleteReason: 'inbox_only',
      crmIncompleteHint: HINTS.inbox_only,
    };
  }

  return { crmIncomplete: false, crmIncompleteHint: '' };
}
