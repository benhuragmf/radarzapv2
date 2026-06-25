import type { LeadFormCustomField, LeadFormAppearance, LeadUtm } from '@/types/lead-form';
import { sanitizeLeadText } from '@/services/leads/lead-form-token.util';
import { normalizeContactPhoneE164 } from '@/utils/contact-csv-import';

export interface PublicLeadSubmitBody {
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  sourceUrl?: string;
  pageTitle?: string;
  customFields?: Record<string, unknown>;
  utm?: unknown;
  consent?: boolean;
  origin?: string;
  honeypot?: string;
}

export interface ParsedPublicLeadPayload {
  name: string;
  phoneE164: string;
  email: string;
  message: string;
  sourceUrl: string;
  pageTitle: string;
  utm?: LeadUtm;
}

export function assertPublicLeadHoneypot(honeypotEnabled: boolean, honeypot?: string): void {
  if (honeypotEnabled && honeypot) throw new Error('Envio rejeitado');
}

export function assertPublicLeadConsent(required: boolean, consent?: boolean): void {
  if (required && !consent) throw new Error('Aceite de consentimento é obrigatório');
}

export function parseLeadFormUtm(raw: unknown): LeadUtm | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const u = raw as Record<string, unknown>;
  const utm: LeadUtm = {
    source: sanitizeLeadText(u.source, 120) || undefined,
    medium: sanitizeLeadText(u.medium, 120) || undefined,
    campaign: sanitizeLeadText(u.campaign, 120) || undefined,
    term: sanitizeLeadText(u.term, 120) || undefined,
    content: sanitizeLeadText(u.content, 120) || undefined,
  };
  return Object.values(utm).some(Boolean) ? utm : undefined;
}

export function parseLeadFormCustomFieldValues(
  defs: LeadFormCustomField[],
  raw: Record<string, unknown> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of defs) {
    if (def.type === 'hidden') continue;
    const max = def.type === 'textarea' ? 2000 : 500;
    const val = sanitizeLeadText(raw?.[def.id], max);
    if (def.required && def.type !== 'checkbox' && !val) {
      throw new Error(`${def.label} é obrigatório`);
    }
    if (def.type === 'checkbox' && def.required && raw?.[def.id] !== true && raw?.[def.id] !== 'true') {
      throw new Error(`${def.label} é obrigatório`);
    }
    if (val || def.type === 'checkbox') {
      out[def.label] = def.type === 'checkbox' ? (raw?.[def.id] ? 'Sim' : 'Não') : val;
    }
  }
  return out;
}

export function validateAndParsePublicLeadPayload(
  body: PublicLeadSubmitBody,
  appearance: Pick<LeadFormAppearance, 'requireConsent' | 'requireEmail' | 'requireMessage' | 'honeypot'>,
): ParsedPublicLeadPayload {
  assertPublicLeadHoneypot(Boolean(appearance.honeypot), body.honeypot);
  assertPublicLeadConsent(Boolean(appearance.requireConsent), body.consent);

  const name = sanitizeLeadText(body.name, 120);
  const phoneRaw = sanitizeLeadText(body.phone, 32);
  const email = sanitizeLeadText(body.email, 160).toLowerCase();
  const message = sanitizeLeadText(body.message, 2000);
  const sourceUrl = sanitizeLeadText(body.sourceUrl, 500);
  const pageTitle = sanitizeLeadText(body.pageTitle, 200);

  if (!name) throw new Error('Nome é obrigatório');
  if (!phoneRaw && !email) throw new Error('Informe telefone ou e-mail');
  if (!phoneRaw && appearance.requireEmail && !email) {
    throw new Error('Telefone ou e-mail é obrigatório');
  }

  let phoneE164 = phoneRaw ? normalizeContactPhoneE164(phoneRaw) : '';
  if (phoneRaw && !phoneE164) throw new Error('Telefone inválido');
  if (!phoneE164 && email) phoneE164 = `email:${email}`;

  if (appearance.requireEmail && !email) throw new Error('E-mail é obrigatório');
  if (appearance.requireMessage && !message) throw new Error('Mensagem é obrigatória');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('E-mail inválido');
  }

  return {
    name,
    phoneE164,
    email,
    message,
    sourceUrl,
    pageTitle,
    utm: parseLeadFormUtm(body.utm),
  };
}

/** Resposta pública segura — sem IDs internos. */
export function buildPublicLeadSubmitResponse(opts: {
  successMessage: string;
  redirectUrl?: string;
}): { success: true; successMessage: string; redirectUrl?: string } {
  return {
    success: true,
    successMessage: opts.successMessage,
    redirectUrl: opts.redirectUrl || undefined,
  };
}
