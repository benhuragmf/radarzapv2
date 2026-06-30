import {
  hostFromUrl,
  isLocalDevHost,
  isPlatformEmbedHost,
} from '@/services/webchat/webchat-token.util';

export type EmbedPreviewOriginHints = {
  /** Navegadores modernos enviam em iframes same-origin quando Referer foi suprimido. */
  secFetchSite?: string | null;
};

/** Prévia no painel / widget.html — só origens da plataforma (não sites de clientes). */
export function isEmbedPreviewPanelOrigin(
  origin?: string | null,
  referer?: string | null,
  hints?: EmbedPreviewOriginHints,
): boolean {
  const host = hostFromUrl(origin) ?? hostFromUrl(referer);
  if (!host) {
    if (hints?.secFetchSite === 'same-origin') return true;
    return process.env.NODE_ENV !== 'production';
  }
  if (isPlatformEmbedHost(host)) return true;
  if (process.env.NODE_ENV !== 'production' && isLocalDevHost(host)) return true;
  return false;
}

export function isEmbedPreviewPanelRequest(req: {
  headers: Record<string, string | string[] | undefined>;
}): boolean {
  const pick = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v)?.trim() || null;
  return isEmbedPreviewPanelOrigin(pick(req.headers.origin), pick(req.headers.referer), {
    secFetchSite: pick(req.headers['sec-fetch-site']),
  });
}
