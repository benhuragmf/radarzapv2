import { Router } from 'express';
import mongoose from 'mongoose';
import type { QueueManager } from '@/cache/QueueManager';
import { MessageQueue } from '@/models';
import {
  requireCapability,
  requireAnyCapability,
  Cap,
  type DashboardRequest,
} from '@/auth/rbac';
import { can } from '@/auth/rbac/can';
import {
  jobBelongsToClient,
  sanitizeFailedJob,
} from '../queue-job-tenant.util';

const TENANT_QUEUE_NAME = 'tenant-campaigns';

async function buildTenantQueueStats(clientId: string) {
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const rows = await MessageQueue.aggregate([
    { $match: { clientId: clientOid } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const byStatus = Object.fromEntries(
    rows.map((s: { _id: string; count: number }) => [s._id, s.count]),
  );
  const pending = byStatus.pending ?? 0;
  const processing = byStatus.processing ?? 0;
  return [
    {
      name: TENANT_QUEUE_NAME,
      waiting: pending + processing,
      active: processing,
      completed: byStatus.sent ?? 0,
      failed: byStatus.failed ?? 0,
      delayed: pending,
    },
  ];
}

/** Rotas BullMQ — extraídas de DashboardService (fase 6 modularização). */
export function registerDashboardQueueRoutes(
  r: Router,
  queueManager: QueueManager,
): void {
  r.get('/queue', requireAnyCapability(Cap.QUEUE_VIEW, Cap.PLATFORM_REPORTS_VIEW, Cap.QUEUE_GLOBAL), async (req, res) => {
    try {
      const auth = (req as DashboardRequest).auth!;
      const isGlobal = can(auth, Cap.QUEUE_GLOBAL);

      if (!isGlobal) {
        res.json(await buildTenantQueueStats(auth.clientId));
        return;
      }

      const stats = await queueManager.getQueueStats();
      const result = Object.entries(stats).map(([name, s]: [string, Record<string, number>]) => ({
        name,
        waiting: s.waiting ?? 0,
        active: s.active ?? 0,
        completed: s.completed ?? 0,
        failed: s.failed ?? 0,
        delayed: s.delayed ?? 0,
      }));
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  r.get('/queue/tenant-campaigns', requireCapability(Cap.QUEUE_VIEW), async (req, res) => {
    try {
      const auth = (req as DashboardRequest).auth!;
      const clientOid = new mongoose.Types.ObjectId(auth.clientId);
      const status = (req.query.status as string) || undefined;
      const source = (req.query.source as string) || undefined;

      const query: Record<string, unknown> = {
        clientId: clientOid,
        'content.template': { $in: ['manual-send', 'platform-send'] },
      };
      if (status) query.status = status;
      if (source === 'automation') {
        query['content.variables.source'] = 'automation';
      } else if (source === 'manual') {
        query['content.variables.source'] = { $ne: 'automation' };
      }

      const items = await MessageQueue.find(query)
        .sort({ scheduledFor: 1 })
        .limit(50)
        .lean();

      const stats = await MessageQueue.aggregate([
        { $match: { clientId: clientOid, 'content.template': { $in: ['manual-send', 'platform-send'] } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);
      const byStatus = Object.fromEntries(stats.map((s: { _id: string; count: number }) => [s._id, s.count]));

      res.json({
        stats: {
          pending: byStatus.pending ?? 0,
          processing: byStatus.processing ?? 0,
          sent: byStatus.sent ?? 0,
          failed: byStatus.failed ?? 0,
        },
        items: items.map(m => ({
          _id: m._id,
          title: (m.content?.variables as { title?: string })?.title ?? 'Envio',
          status: m.status,
          scheduledFor: m.scheduledFor,
          destinations: m.destinations?.length ?? 0,
          sentCount: (m.content?.variables as { sentCount?: number })?.sentCount ?? 0,
          lastError: m.lastError,
          source: (m.content?.variables as { source?: string })?.source ?? 'manual',
          automationRuleId: (m.content?.variables as { automationRuleId?: string })?.automationRuleId,
        })),
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  r.get('/queue/failed', requireAnyCapability(Cap.QUEUE_VIEW, Cap.QUEUE_GLOBAL), async (req, res) => {
    try {
      const auth = (req as DashboardRequest).auth!;
      const isGlobal = can(auth, Cap.QUEUE_GLOBAL);
      const queueNames = queueManager.getQueueNames();
      const items: ReturnType<typeof sanitizeFailedJob>[] = [];
      const limit = 50;

      for (const queueName of queueNames) {
        const jobs = await queueManager.getFailedJobs(queueName, 0, 49);
        for (const job of jobs) {
          if (!isGlobal && !jobBelongsToClient(job.data, auth.clientId)) continue;
          items.push(
            sanitizeFailedJob(job, queueName, { includeClientId: isGlobal }),
          );
          if (items.length >= limit) break;
        }
        if (items.length >= limit) break;
      }

      items.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
      res.json(items.slice(0, limit));
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  r.post('/queue/:id/retry', requireCapability(Cap.QUEUE_RETRY), async (req, res) => {
    try {
      const auth = (req as DashboardRequest).auth!;
      const isGlobal = can(auth, Cap.QUEUE_GLOBAL);
      const queue = String((req.body as { queue?: string })?.queue ?? '').trim();
      if (!queue) {
        res.status(400).json({ error: 'Campo queue é obrigatório' });
        return;
      }

      if (!isGlobal) {
        const jobs = await queueManager.getFailedJobs(queue, 0, 200);
        const job = jobs.find(j => String(j.id) === String(req.params.id));
        if (!job) {
          res.status(404).json({ error: 'Job não encontrado' });
          return;
        }
        if (!jobBelongsToClient(job.data, auth.clientId)) {
          res.status(403).json({ error: 'Sem permissão para reprocessar este job' });
          return;
        }
      }

      await queueManager.retryJob(queue, req.params.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });
}
