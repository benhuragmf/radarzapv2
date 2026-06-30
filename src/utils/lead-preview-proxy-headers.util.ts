import type { Response } from 'express';
import { applyPublicEmbedAssetHeaders } from '@/services/webchat/webchat-embed-http.util';

/** CSP para HTML proxied do site do cliente com slot do formulário. */
export function applyLeadPreviewProxyHeaders(res: Response, siteOrigin: string): void {
  applyPublicEmbedAssetHeaders(res);
  let origin = siteOrigin;
  try {
    origin = new URL(siteOrigin).origin;
  } catch {
    origin = '';
  }

  const styleSrc = ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'];
  const fontSrc = ["'self'", 'data:', 'https://fonts.gstatic.com'];
  if (origin) {
    styleSrc.push(origin);
    fontSrc.push(origin);
  }

  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'none'",
      "script-src 'self'",
      `style-src ${styleSrc.join(' ')}`,
      `font-src ${fontSrc.join(' ')}`,
      "img-src 'self' data: https: blob:",
      "connect-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "form-action 'self'",
    ].join('; '),
  );
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
}
