import crypto from 'crypto';
import { isWebChatOriginAllowed } from '@/services/webchat/webchat-token.util';

export function generateLeadFormPublicKey(): string {
  return `lfm_${crypto.randomBytes(16).toString('hex')}`;
}

export function assertLeadFormOrigin(
  allowedDomains: string[],
  origin?: string | null,
  referer?: string | null,
): void {
  if (!isWebChatOriginAllowed(allowedDomains, origin, referer)) {
    throw new Error('Origem não autorizada para este formulário');
  }
}

export function sanitizeLeadText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maxLen);
}
