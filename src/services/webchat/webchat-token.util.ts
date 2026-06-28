import crypto from 'crypto';
import { config } from '@/config/environment';

export function generateWebChatPublicKey(): string {
  return `wck_${crypto.randomBytes(16).toString('hex')}`;
}

export function generateWebChatVisitorToken(): string {
  return `wcv_${crypto.randomBytes(24).toString('hex')}`;
}

export function hashWebChatVisitorToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function hostFromUrl(value?: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isLocalDevHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
}

/** Política global quando allowedDomains está vazio (AH-D01 / AH-W02). */
export function isPublicEmbedOpenOriginPolicyEnabled(): boolean {
  return config.PUBLIC_EMBED.ALLOW_OPEN_ORIGIN;
}

/** Valida origem do embed — lista vazia obedece PUBLIC_EMBED_ALLOW_OPEN_ORIGIN. */
export function isWebChatOriginAllowed(
  allowedDomains: string[],
  origin?: string | null,
  referer?: string | null,
): boolean {
  if (!allowedDomains.length) {
    return isPublicEmbedOpenOriginPolicyEnabled();
  }

  const host = hostFromUrl(origin) ?? hostFromUrl(referer);
  if (!host) {
    // Embed same-origin (ex.: preview /leads/preview.html) pode omitir Origin e Referer.
    if (process.env.NODE_ENV !== 'production') return true;
    return false;
  }

  // Painel e previews locais (npm run dev + dashboard:frontend) não devem quebrar por allowedDomains.
  if (process.env.NODE_ENV !== 'production' && isLocalDevHost(host)) {
    return true;
  }

  return allowedDomains.some(raw => {
    const domain = raw.trim().toLowerCase();
    if (!domain) return false;
    if (domain.startsWith('*.')) {
      const base = domain.slice(2);
      return host === base || host.endsWith(`.${base}`);
    }
    return host === domain;
  });
}
