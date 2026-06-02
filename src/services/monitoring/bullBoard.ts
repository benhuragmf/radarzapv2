/**
 * Bull Board — dashboard visual para filas BullMQ
 * https://github.com/felixmosh/bull-board (MIT)
 */
import { Router } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { QueueManager } from '@/cache/QueueManager';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('BullBoard');

const BASE_PATH = '/api/admin/queues';

export function mountBullBoard(app: import('express').Express, authMiddleware: import('express').RequestHandler): void {
  try {
    const queueManager = QueueManager.getInstance();
    const names = queueManager.getQueueNames();

    if (names.length === 0) {
      logger.warn('No BullMQ queues registered — Bull Board skipped');
      return;
    }

    const adapters = names
      .map((name) => queueManager.getQueue(name))
      .filter((q): q is NonNullable<typeof q> => q !== null)
      .map((q) => new BullMQAdapter(q));

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(BASE_PATH);

    createBullBoard({
      queues: adapters,
      serverAdapter,
    });

    app.use(BASE_PATH, authMiddleware, serverAdapter.getRouter() as Router);
    logger.info(`Bull Board mounted at ${BASE_PATH} (${adapters.length} queues)`);
  } catch (error) {
    logger.warn(`Failed to mount Bull Board: ${(error as Error).message}`);
  }
}

export const BULL_BOARD_PATH = BASE_PATH;
