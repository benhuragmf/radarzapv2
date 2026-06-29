import type { Response } from 'express';

/** Headers para assets embed (widget.js, form.js) em sites de clientes — evita CORP same-origin bloquear o script. */
export function applyPublicEmbedAssetHeaders(res: Response): void {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}
