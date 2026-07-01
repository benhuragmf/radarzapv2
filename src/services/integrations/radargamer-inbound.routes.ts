import { Router, Request, Response } from 'express';
import {
  RadarGamerInboundError,
  RadarGamerInboundService,
  type RadarGamerInboundRequest,
} from './radargamer-inbound.service';

export function createRadarGamerInboundRouter(
  service = RadarGamerInboundService.getInstance(),
): Router {
  const router = Router();

  router.post('/messages', async (req: Request, res: Response) => {
    try {
      const result = await service.acceptMessage(req.body as RadarGamerInboundRequest, {
        authorization: req.get('authorization'),
        apiKey: req.get('x-api-key'),
        idempotencyKey: req.get('idempotency-key'),
        source: req.get('x-source'),
        requestId: req.get('x-request-id'),
      });
      res.status(202).json(result);
    } catch (error) {
      if (error instanceof RadarGamerInboundError) {
        const rateLimit = error.details?.rateLimit;
        if (rateLimit && typeof rateLimit === 'object') {
          const resetAt = (rateLimit as { resetAt?: unknown }).resetAt;
          if (typeof resetAt === 'string') {
            res.setHeader('X-RateLimit-Reset', resetAt);
          }
        }
        res.status(error.status).json({
          accepted: false,
          error: error.message,
          code: error.code,
          ...(error.details ? { details: error.details } : {}),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(500).json({
        accepted: false,
        error: 'Internal server error',
        code: 'RADARGAMER_INTEGRATION_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}

