import crypto from 'crypto';

export function generateWebChatPublicKey(): string {
  return `wck_${crypto.randomBytes(16).toString('hex')}`;
}

export function generateWebChatVisitorToken(): string {
  return `wcv_${crypto.randomBytes(24).toString('hex')}`;
}

export function hashWebChatVisitorToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function hostFromUrl(value?: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Valida origem do embed — lista vazia permite qualquer host. */
export function isWebChatOriginAllowed(
  allowedDomains: string[],
  origin?: string | null,
  referer?: string | null,
): boolean {
  if (!allowedDomains.length) return true;
  const host = hostFromUrl(origin) ?? hostFromUrl(referer);
  if (!host) return false;

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
