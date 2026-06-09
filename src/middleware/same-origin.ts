import { Request, Response, NextFunction } from 'express';
import { config } from '@/config/environment';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Em produção, bloqueia mutações cross-origin no painel (cookie de sessão). */
export function requireDashboardOrigin(req: Request, res: Response, next: NextFunction): void {
  if (config.NODE_ENV !== 'production') {
    next();
    return;
  }
  if (!MUTATING.has(req.method)) {
    next();
    return;
  }
  // Webhooks inbound usam assinatura própria
  if (
    req.path.startsWith('/api/billing/webhook/') ||
    req.path.startsWith('/api/integrations/whatsapp/cloud/webhook')
  ) {
    next();
    return;
  }

  const allowed = config.DASHBOARD.FRONTEND_URL?.replace(/\/$/, '');
  const origin = req.get('origin')?.replace(/\/$/, '');
  if (origin && allowed && origin !== allowed) {
    res.status(403).json({ error: 'Origin not allowed', code: 'FORBIDDEN_ORIGIN' });
    return;
  }
  next();
}
