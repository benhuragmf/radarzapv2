import {
  hostFromUrl,
  isLocalDevHost,
  isPlatformEmbedHost,
} from '@/services/webchat/webchat-token.util';

/** Prévia no painel / widget.html — só origens da plataforma (não sites de clientes). */
export function isEmbedPreviewPanelOrigin(
  origin?: string | null,
  referer?: string | null,
): boolean {
  const host = hostFromUrl(origin) ?? hostFromUrl(referer);
  if (!host) {
    return process.env.NODE_ENV !== 'production';
  }
  if (isPlatformEmbedHost(host)) return true;
  if (process.env.NODE_ENV !== 'production' && isLocalDevHost(host)) return true;
  return false;
}
