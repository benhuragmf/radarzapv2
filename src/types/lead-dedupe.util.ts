import type { LeadCaptureOrigin, LeadCaptureStatus } from '@/types/lead-form';
import { normalizeContactPhoneE164 } from '@/utils/contact-csv-import';

/** Status em que o lead ainda está no funil comercial (não finalizado). */
export const OPEN_LEAD_STATUSES: LeadCaptureStatus[] = [
  'new',
  'in_review',
  'in_progress',
  'qualified',
];

export const CLOSED_LEAD_STATUSES: LeadCaptureStatus[] = ['converted', 'lost', 'spam'];

export function isOpenLeadStatus(status: string): boolean {
  return OPEN_LEAD_STATUSES.includes(status as LeadCaptureStatus);
}

export function isClosedLeadStatus(status: string): boolean {
  return CLOSED_LEAD_STATUSES.includes(status as LeadCaptureStatus);
}

/** Após fechamento, permite novo lead futuro para o mesmo contato. */
export function canCreateNewLeadAfterClosed(status: string): boolean {
  return isClosedLeadStatus(status);
}

export function normalizeLeadPhone(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  return normalizeContactPhoneE164(raw.trim()) || raw.trim();
}

export function normalizeLeadEmail(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const e = raw.trim().toLowerCase();
  if (!e.includes('@')) return null;
  return e;
}

export function phonesMatchForLeadDedupe(a?: string | null, b?: string | null): boolean {
  const na = normalizeLeadPhone(a);
  const nb = normalizeLeadPhone(b);
  if (!na || !nb) return false;
  return na === nb;
}

export function emailsMatchForLeadDedupe(a?: string | null, b?: string | null): boolean {
  const na = normalizeLeadEmail(a);
  const nb = normalizeLeadEmail(b);
  if (!na || !nb) return false;
  return na === nb;
}

const COMMERCIAL_ORIGINS: ReadonlySet<LeadCaptureOrigin> = new Set([
  'site',
  'widget',
  'wordpress',
  'api',
  'manual',
  'import',
  'campaign',
  'whatsapp',
  'webchat',
]);

export function isCommercialLeadSource(origin: LeadCaptureOrigin): boolean {
  return COMMERCIAL_ORIGINS.has(origin);
}
