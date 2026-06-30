import os from 'os';
import pkg from '../../../package.json';
import { config } from '@/config/environment';
import { stripeSecretKeyStatus } from '@/config/billing-env';
import { DatabaseManager } from '@/database/DatabaseManager';
import { RedisManager } from '@/cache/RedisManager';
import { QueueManager } from '@/cache/QueueManager';
import { Organization } from '@/models/Organization';
import { WhatsAppSession } from '@/models/WhatsAppSession';
import { WebChatWidget } from '@/models/WebChatWidget';
import { WebChatConversation } from '@/models/WebChatConversation';
import { LeadForm } from '@/models/LeadForm';
import { LeadCapture } from '@/models/LeadCapture';
import { InboxConversation } from '@/models/InboxConversation';
import { InboxTicket } from '@/models/InboxTicket';
import { AiUsage } from '@/models/AiUsage';
import { BillingOrder } from '@/models/BillingOrder';
import { AttendanceEvent } from '@/models/AttendanceEvent';
import { SystemLog } from '@/models/SystemLog';
import { InboxConversationStatus } from '@/types/inbox';
import {
  normalizeBillingStatus,
  isPaidPlanCurrentlyActive,
  type BillingProductStatus,
} from '@/services/billing/billing-state.util';
import type { OrgPlanId } from '@/services/billing/plan-config';
import type {
  AdminOpsOrgBillingInput,
  AdminOpsServiceStatus,
  AdminOpsSummary,
  AdminOpsTenantMetrics,
} from '@/types/admin-ops-summary';
import { buildAdminOpsAlerts } from './admin-ops-alerts.util';

const CACHE_KEY = 'radarchat:admin:ops:summary:v1';
const CACHE_TTL_SECONDS = 30;
const MONGO_DEGRADED_MS = 500;
const REDIS_DEGRADED_MS = 300;

function roundMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

function startOfDay(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(now = new Date()): Date {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function resolveStripeMode(): AdminOpsSummary['billing']['stripeMode'] {
  const status = stripeSecretKeyStatus();
  if (status === 'test') return 'test';
  if (status === 'live') return 'live';
  if (status === 'missing' || status === 'empty' || status === 'placeholder') return 'off';
  return 'unknown';
}

/** Classifica organizações — exportado para testes unitários. */
export function classifyOrganizationMetrics(
  orgs: AdminOpsOrgBillingInput[],
): AdminOpsTenantMetrics {
  const metrics: AdminOpsTenantMetrics = {
    totalOrganizations: orgs.length,
    freeOrganizations: 0,
    starterOrganizations: 0,
    proOrganizations: 0,
    enterpriseOrganizations: 0,
    paidOrganizations: 0,
    expiredOrganizations: 0,
    pastDueOrganizations: 0,
    trialingOrganizations: 0,
  };

  for (const org of orgs) {
    const plan = org.plan as OrgPlanId;
    if (plan === 'free') metrics.freeOrganizations += 1;
    else if (plan === 'starter') metrics.starterOrganizations += 1;
    else if (plan === 'pro') metrics.proOrganizations += 1;
    else if (plan === 'enterprise') metrics.enterpriseOrganizations += 1;

    const billingStatus: BillingProductStatus = normalizeBillingStatus({
      plan,
      planExpiresAt: org.planExpiresAt,
      stripeSubscriptionStatus: org.stripeSubscriptionStatus,
    });

    if (billingStatus === 'past_due') metrics.pastDueOrganizations += 1;
    if (billingStatus === 'trialing') metrics.trialingOrganizations += 1;
    if (billingStatus === 'canceled' || billingStatus === 'unpaid') {
      metrics.expiredOrganizations += 1;
    }

    if (
      plan !== 'free' &&
      (billingStatus === 'active' ||
        billingStatus === 'trialing' ||
        billingStatus === 'past_due' ||
        billingStatus === 'manual') &&
      isPaidPlanCurrentlyActive(plan, org.planExpiresAt)
    ) {
      metrics.paidOrganizations += 1;
    }
  }

  return metrics;
}

async function pingMongo(): Promise<{ status: AdminOpsServiceStatus; latencyMs?: number }> {
  const db = DatabaseManager.getInstance();
  if (!db.isConnected()) {
    return { status: 'down' };
  }
  const started = Date.now();
  try {
    const ok = await db.healthCheck();
    const latencyMs = Date.now() - started;
    if (!ok) return { status: 'down', latencyMs };
    return {
      status: latencyMs > MONGO_DEGRADED_MS ? 'degraded' : 'ok',
      latencyMs,
    };
  } catch {
    return { status: 'down', latencyMs: Date.now() - started };
  }
}

function isRedisConfigured(): boolean {
  return Boolean(config.REDIS?.URL?.trim());
}

async function pingRedis(): Promise<{ status: AdminOpsServiceStatus; latencyMs?: number }> {
  if (!isRedisConfigured()) {
    return { status: 'not_configured' };
  }
  const redis = RedisManager.getInstance();
  if (!redis.isConnected()) {
    return { status: 'down' };
  }
  const started = Date.now();
  try {
    const ok = await redis.healthCheck();
    const latencyMs = Date.now() - started;
    if (!ok) return { status: 'down', latencyMs };
    return {
      status: latencyMs > REDIS_DEGRADED_MS ? 'degraded' : 'ok',
      latencyMs,
    };
  } catch {
    return { status: 'down', latencyMs: Date.now() - started };
  }
}

async function getQueueMetrics(): Promise<AdminOpsSummary['services']['queues']> {
  try {
    const raw = await QueueManager.getInstance().getQueueStats();
    let waiting = 0;
    let active = 0;
    let failed = 0;
    let delayed = 0;
    let paused = 0;

    for (const entry of Object.values(raw as Record<string, Record<string, number>>)) {
      waiting += entry.waiting ?? 0;
      active += entry.active ?? 0;
      failed += entry.failed ?? 0;
      delayed += entry.delayed ?? 0;
      paused += entry.paused ?? 0;
    }

    const status: AdminOpsServiceStatus =
      failed > 0 ? 'degraded' : Object.keys(raw).length === 0 ? 'not_configured' : 'ok';

    return { status, waiting, active, failed, delayed, paused };
  } catch {
    return {
      status: 'down',
      waiting: 0,
      active: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    };
  }
}

async function countAttendanceEventsSince(
  kinds: string[],
  since: Date,
): Promise<number> {
  return AttendanceEvent.countDocuments({
    kind: { $in: kinds },
    createdAt: { $gte: since },
  });
}

async function countDistinctOrgsForEvent(
  kind: string,
  since: Date,
): Promise<number> {
  const rows = await AttendanceEvent.aggregate<{ n: number }>([
    { $match: { kind, createdAt: { $gte: since } } },
    { $group: { _id: '$clientId' } },
    { $count: 'n' },
  ]);
  return rows[0]?.n ?? 0;
}

export async function buildAdminOpsSummary(): Promise<AdminOpsSummary> {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const mem = process.memoryUsage();
  const load = os.loadavg();

  const [
    mongoHealth,
    redisHealth,
    queueMetrics,
    orgDocs,
    waConnected,
    waDisconnected,
    waExpired,
    webchatWidgetsTotal,
    webchatWidgetsActive,
    webchatConvOpen,
    webchatConvQueued,
    webchatBridgeActive,
    leadFormsTotal,
    leadFormsActive,
    leadsToday,
    leadsMonth,
    inboxOpen,
    inboxWaiting,
    inboxProgress,
    inboxResolvedToday,
    ticketsOpen,
    ticketsProgress,
    ticketsClientReplied,
    ticketsClosedMonth,
    aiAgg,
    billingPending,
    billingPaidMonth,
    billingFailedInvoices,
    errors24h,
    ticketLookupFailed,
    formBlocked,
    billingLimitBlocked,
    lowCreditOrgs,
    exhaustedCreditOrgs,
  ] = await Promise.all([
    pingMongo(),
    pingRedis(),
    getQueueMetrics(),
    Organization.find({})
      .select('plan planExpiresAt stripeSubscriptionStatus')
      .lean(),
    WhatsAppSession.countDocuments({ status: 'active' }),
    WhatsAppSession.countDocuments({ status: 'inactive' }),
    WhatsAppSession.countDocuments({ status: 'expired' }),
    WebChatWidget.countDocuments({}),
    WebChatWidget.countDocuments({ active: true }),
    WebChatConversation.countDocuments({ status: 'open' }),
    WebChatConversation.countDocuments({ status: 'open', queueStatus: 'waiting_human' }),
    WebChatConversation.countDocuments({ status: 'open', whatsappBridgeActive: true }),
    LeadForm.countDocuments({}),
    LeadForm.countDocuments({ active: true }),
    LeadCapture.countDocuments({ createdAt: { $gte: dayStart } }),
    LeadCapture.countDocuments({ createdAt: { $gte: monthStart } }),
    InboxConversation.countDocuments({
      status: {
        $in: [
          InboxConversationStatus.BOT_TRIAGE,
          InboxConversationStatus.WAITING_QUEUE,
          InboxConversationStatus.IN_PROGRESS,
          InboxConversationStatus.TRANSFERRED,
        ],
      },
    }),
    InboxConversation.countDocuments({ status: InboxConversationStatus.WAITING_QUEUE }),
    InboxConversation.countDocuments({ status: InboxConversationStatus.IN_PROGRESS }),
    InboxConversation.countDocuments({
      status: { $in: [InboxConversationStatus.RESOLVED, InboxConversationStatus.CLOSED] },
      resolvedAt: { $gte: dayStart },
    }),
    InboxTicket.countDocuments({ status: 'open' }),
    InboxTicket.countDocuments({ status: 'in_progress' }),
    InboxTicket.countDocuments({ status: 'client_replied' }),
    InboxTicket.countDocuments({
      status: 'closed',
      updatedAt: { $gte: monthStart },
    }),
    AiUsage.aggregate<{
      credits: number;
      premium: number;
      basic: number;
    }>([
      { $match: { createdAt: { $gte: monthStart } } },
      {
        $group: {
          _id: null,
          credits: { $sum: { $ifNull: ['$creditWeight', 0] } },
          premium: {
            $sum: {
              $cond: [{ $eq: ['$usageKind', 'premium_assistant'] }, 1, 0],
            },
          },
          basic: {
            $sum: {
              $cond: [{ $eq: ['$usageKind', 'basic_triage'] }, 1, 0],
            },
          },
        },
      },
    ]),
    BillingOrder.countDocuments({ status: 'pending' }),
    BillingOrder.countDocuments({ status: 'paid', paidAt: { $gte: monthStart } }),
    AttendanceEvent.countDocuments({
      kind: 'billing.invoice.failed',
      createdAt: { $gte: monthStart },
    }),
    SystemLog.countDocuments({ level: 'error', timestamp: { $gte: since24h } }),
    countAttendanceEventsSince(['ticket.public_lookup_failed'], since24h),
    countAttendanceEventsSince(['form.blocked'], since24h),
    countAttendanceEventsSince(['billing.limit.blocked'], since24h),
    countDistinctOrgsForEvent('ai.credits.low_balance', since24h),
    countDistinctOrgsForEvent('ai.credits.exhausted', monthStart),
  ]);

  const tenants = classifyOrganizationMetrics(
    orgDocs.map(o => ({
      plan: o.plan,
      planExpiresAt: o.planExpiresAt,
      stripeSubscriptionStatus: o.stripeSubscriptionStatus,
    })),
  );

  const aiRow = aiAgg[0];

  const partial: AdminOpsSummary = {
    generatedAt: now.toISOString(),
    system: {
      version: pkg.version ?? '0.0.0',
      nodeEnv: config.NODE_ENV,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memoryMb: {
        rss: roundMb(mem.rss),
        heapUsed: roundMb(mem.heapUsed),
        heapTotal: roundMb(mem.heapTotal),
        external: roundMb(mem.external),
      },
      cpu: {
        load1: load[0],
        load5: load[1],
        load15: load[2],
        cpuCount: os.cpus().length,
      },
    },
    services: {
      mongo: mongoHealth,
      redis: redisHealth,
      queues: queueMetrics,
    },
    tenants,
    operations: {
      whatsapp: {
        connected: waConnected,
        disconnected: waDisconnected,
        expired: waExpired,
        totalSessions: waConnected + waDisconnected + waExpired,
      },
      webchat: {
        activeWidgets: webchatWidgetsActive,
        totalWidgets: webchatWidgetsTotal,
        activeConversations: webchatConvOpen,
        queuedConversations: webchatConvQueued,
        bridgeActive: webchatBridgeActive,
      },
      inbox: {
        openConversations: inboxOpen,
        waitingQueue: inboxWaiting,
        inProgress: inboxProgress,
        resolvedToday: inboxResolvedToday,
      },
      tickets: {
        open: ticketsOpen,
        inProgress: ticketsProgress,
        clientReplied: ticketsClientReplied,
        closedThisMonth: ticketsClosedMonth,
      },
      leads: {
        leadsToday,
        leadsThisMonth: leadsMonth,
        activeForms: leadFormsActive,
        totalForms: leadFormsTotal,
      },
    },
    ai: {
      creditsConsumedThisMonth: aiRow?.credits ?? 0,
      organizationsWithLowCredits: lowCreditOrgs,
      organizationsWithoutCredits: exhaustedCreditOrgs,
      premiumCallsThisMonth: aiRow?.premium ?? 0,
      basicLlmCallsThisMonth: aiRow?.basic ?? 0,
    },
    billing: {
      stripeMode: resolveStripeMode(),
      pendingOrders: billingPending,
      paidOrdersThisMonth: billingPaidMonth,
      failedInvoicesThisMonth: billingFailedInvoices,
      pastDueOrganizations: tenants.pastDueOrganizations,
    },
    security: {
      errorsLast24h: errors24h,
      invalidTicketLookupsLast24h: ticketLookupFailed,
      formBlocksLast24h: formBlocked,
      billingLimitBlocksLast24h: billingLimitBlocked,
      webhookFailuresLast24h: 0,
    },
    alerts: [],
    links: {
      monitoring: '/admin/monitoring',
      clients: '/admin/clients',
      payments: '/admin/payments',
      servers: '/admin/servers',
      errors: '/admin/errors',
      queue: '/admin/queue',
      aiPlatform: '/admin/ai-platform',
    },
  };

  partial.alerts = buildAdminOpsAlerts(partial);
  return partial;
}

/** Summary com cache Redis opcional (TTL 30s). */
export async function getAdminOpsSummary(opts?: { refresh?: boolean }): Promise<AdminOpsSummary> {
  if (!opts?.refresh) {
    try {
      const redis = RedisManager.getInstance();
      if (redis.isConnected()) {
        const cached = await redis.get(CACHE_KEY);
        if (cached) {
          return JSON.parse(cached) as AdminOpsSummary;
        }
      }
    } catch {
      // cache miss — recalcular
    }
  }

  const summary = await buildAdminOpsSummary();

  try {
    const redis = RedisManager.getInstance();
    if (redis.isConnected()) {
      await redis.setWithTTL(CACHE_KEY, JSON.stringify(summary), CACHE_TTL_SECONDS);
    }
  } catch {
    // ignora falha de cache
  }

  return summary;
}

/** Invalida cache Redis do summary ops (após mutações admin). */
export async function invalidateAdminOpsSummaryCache(): Promise<void> {
  try {
    const redis = RedisManager.getInstance();
    if (redis.isConnected()) {
      await redis.del(CACHE_KEY);
    }
  } catch {
    // não falha mutação por indisponibilidade de cache
  }
}
