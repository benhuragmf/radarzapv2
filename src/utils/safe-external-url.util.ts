const BLOCKED_PROTOCOL_RE = /^(javascript|data|file|blob|vbscript):/i;

function isPrivateOrLocalHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h === '127.0.0.1' || h === '0.0.0.0') {
    return true;
  }
  if (h === '::1' || h === '[::1]') return true;

  const parts = h.split('.').map(Number);
  if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
  }
  return false;
}

/**
 * Normaliza URL externa segura (http/https) para exibição em iframe de prévia.
 * Bloqueia protocolos perigosos, credenciais embutidas e hosts internos (SSRF).
 */
export function resolveSafeExternalHttpsUrl(
  raw?: string | null,
  options?: { allowHttpInDev?: boolean },
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.length > 200) return null;
  if (BLOCKED_PROTOCOL_RE.test(trimmed)) return null;

  let url: URL;
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (url.username || url.password) return null;

  const proto = url.protocol.toLowerCase();
  const allowHttp =
    options?.allowHttpInDev === true && process.env.NODE_ENV !== 'production';
  if (proto !== 'https:' && !(allowHttp && proto === 'http:')) return null;

  const host = url.hostname.toLowerCase();
  if (!host || host.includes('@')) return null;
  if (isPrivateOrLocalHost(host)) return null;

  url.hash = '';
  return url.toString();
}
