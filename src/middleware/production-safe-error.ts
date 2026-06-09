import { Request, Response, NextFunction } from 'express';
import { config } from '@/config/environment';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('ErrorHandler');

/** Evita vazar stack/mensagens internas em produção. */
export function productionSafeError(
  err: Error & { status?: number; statusCode?: number; type?: string },
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = err.status ?? err.statusCode ?? 500;
  const isProd = config.NODE_ENV === 'production';

  if (status >= 500) {
    logger.error('Unhandled API error', {
      path: req.path,
      method: req.method,
      message: err.message,
      type: err.type,
    });
  }

  res.status(status).json({
    error: isProd && status >= 500 ? 'Internal server error' : err.message || 'Error',
    code: (err as { code?: string }).code ?? (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
  });
}
