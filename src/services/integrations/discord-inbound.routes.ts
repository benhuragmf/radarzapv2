import { Router, Request, Response } from 'express';
import {
  DiscordInboundError,
  DiscordInboundService,
} from './discord-inbound.service';

export function createDiscordInboundRouter(
  service = DiscordInboundService.getInstance(),
): Router {
  const router = Router();

  const handle = async (req: Request, res: Response, fn: () => Promise<unknown>) => {
    try {
      const result = await fn();
      res.status(202).json(result);
    } catch (error) {
      if (error instanceof DiscordInboundError) {
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
        code: 'DISCORD_INBOUND_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  };

  router.post('/messages', (req, res) =>
    handle(req, res, () =>
      service.acceptMessage(req.body, {
        apiKey: req.get('x-api-key'),
        idempotencyKey: req.get('idempotency-key'),
        requestId: req.get('x-request-id'),
      }),
    ),
  );

  router.post('/events', (req, res) =>
    handle(req, res, () =>
      service.acceptEvent(req.body, {
        apiKey: req.get('x-api-key'),
        idempotencyKey: req.get('idempotency-key'),
        requestId: req.get('x-request-id'),
      }),
    ),
  );

  return router;
}
