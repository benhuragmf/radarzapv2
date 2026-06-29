import crypto from 'crypto';
import { config } from '@/config/environment';

/** Hosts da própria plataforma (painel, prévia widget.html) — sempre podem carregar o embed. */
function platformEmbedHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const raw of [config.DASHBOARD.FRONTEND_URL, config.CORS_ORIGIN]) {
    const host = hostFromUrl(raw);
    if (host) hosts.add(host);
  }
  return hosts;
}

export function isPlatformEmbedHost(host: string): boolean {
  return platformEmbedHosts().has(host.toLowerCase());
}

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

/**
 * Normaliza entrada do painel (hostname, URL com protocolo ou wildcard *.host).
 * Ex.: `https://radarchat.com.br/` → `radarchat.com.br`, `*.loja.com` preservado.
 */
export function normalizeAllowedDomainEntry(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.startsWith('*.')) {
    const rest = trimmed.slice(2).trim();
    const host =
      hostFromUrl(rest.includes('://') ? rest : `https://${rest}`) ??
      rest.split('/')[0]?.replace(/^\.+/, '') ??
      '';
    return host ? `*.${host}` : '';
  }
  if (trimmed.includes('://')) {
    return hostFromUrl(trimmed) ?? '';
  }
  return trimmed.split('/')[0]?.replace(/^\.+/, '') ?? '';
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

  if (isPlatformEmbedHost(host)) {
    return true;
  }

  // Painel e previews locais (npm run dev + dashboard:frontend) não devem quebrar por allowedDomains.
  if (process.env.NODE_ENV !== 'production' && isLocalDevHost(host)) {
    return true;
  }

  return allowedDomains.some(raw => {
    const domain = normalizeAllowedDomainEntry(raw);
    if (!domain) return false;
    if (domain.startsWith('*.')) {
      const base = domain.slice(2);
      return host === base || host.endsWith(`.${base}`);
    }
    return host === domain;
  });
}
