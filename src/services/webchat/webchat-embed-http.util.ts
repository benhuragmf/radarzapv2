import type { Response } from 'express';

/** Headers para assets embed (widget.js, form.js) em sites de clientes — evita CORP same-origin bloquear o script. */
export function applyPublicEmbedAssetHeaders(res: Response): void {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

/**
 * Páginas de prévia (widget.html, leads/preview.html) podem iframe o site do cliente
 * como fundo opcional — sobrescreve helmet frame-src 'none' e X-Frame-Options DENY.
 */
export function applyEmbedPreviewPageHeaders(res: Response): void {
  applyPublicEmbedAssetHeaders(res);
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' ws: wss:",
      "frame-src 'self' https: http:",
      "object-src 'none'",
    ].join('; '),
  );
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
}
