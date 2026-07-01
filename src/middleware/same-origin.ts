import { Request, Response, NextFunction } from 'express';
import { config } from '@/config/environment';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function normalizedAllowedFrontendUrl(): string | undefined {
  return config.DASHBOARD.FRONTEND_URL?.replace(/\/$/, '');
}

function refererMatchesAllowed(refererRaw: string | undefined, allowed: string): boolean {
  const referer = refererRaw?.replace(/\/$/, '');
  if (!referer || !allowed) return false;
  return referer === allowed || referer.startsWith(`${allowed}/`);
}

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

  const allowed = normalizedAllowedFrontendUrl();
  const origin = req.get('origin')?.replace(/\/$/, '');
  if (origin && allowed && origin !== allowed) {
    res.status(403).json({ error: 'Origin not allowed', code: 'FORBIDDEN_ORIGIN' });
    return;
  }

  if (!origin) {
    const secFetchSite = req.get('sec-fetch-site')?.toLowerCase();
    if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') {
      next();
      return;
    }
    if (refererMatchesAllowed(req.get('referer'), allowed ?? '')) {
      next();
      return;
    }
    res.status(403).json({ error: 'Origin required', code: 'MISSING_ORIGIN' });
    return;
  }

  next();
}
