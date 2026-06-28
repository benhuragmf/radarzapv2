import { buildAdminOpsAlerts } from '@/services/web-dashboard/admin-ops-alerts.util';
import type { AdminOpsSummary } from '@/types/admin-ops-summary';

function baseSummary(overrides: Partial<AdminOpsSummary> = {}): AdminOpsSummary {
  const base: AdminOpsSummary = {
    generatedAt: '2026-06-27T12:00:00.000Z',
    system: {
      version: '2.12.37',
      nodeEnv: 'test',
      uptimeSeconds: 100,
      nodeVersion: 'v20.0.0',
      memoryMb: { rss: 1, heapUsed: 1, heapTotal: 2, external: 0 },
    },
    services: {
      mongo: { status: 'ok' },
      redis: { status: 'ok' },
      queues: { status: 'ok', waiting: 0, active: 0, failed: 0, delayed: 0, paused: 0 },
    },
    tenants: {
      totalOrganizations: 1,
      freeOrganizations: 1,
      starterOrganizations: 0,
      proOrganizations: 0,
      enterpriseOrganizations: 0,
      paidOrganizations: 0,
      expiredOrganizations: 0,
      pastDueOrganizations: 0,
      trialingOrganizations: 0,
    },
    operations: {
      whatsapp: { connected: 2, disconnected: 0, expired: 0, totalSessions: 2 },
      webchat: {
        activeWidgets: 1,
        totalWidgets: 1,
        activeConversations: 0,
        queuedConversations: 0,
        bridgeActive: 0,
      },
      inbox: { openConversations: 0, waitingQueue: 0, inProgress: 0, resolvedToday: 0 },
      tickets: { open: 0, inProgress: 0, clientReplied: 0, closedThisMonth: 0 },
      leads: { leadsToday: 0, leadsThisMonth: 0, activeForms: 0, totalForms: 0 },
    },
    ai: {
      creditsConsumedThisMonth: 0,
      premiumCallsThisMonth: 0,
      basicLlmCallsThisMonth: 0,
    },
    billing: {
      stripeMode: 'off',
      pendingOrders: 0,
      paidOrdersThisMonth: 0,
      failedInvoicesThisMonth: 0,
      pastDueOrganizations: 0,
    },
    security: {
      errorsLast24h: 0,
      invalidTicketLookupsLast24h: 0,
      formBlocksLast24h: 0,
      billingLimitBlocksLast24h: 0,
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
  return { ...base, ...overrides };
}

describe('buildAdminOpsAlerts', () => {
  it('gera alerta crítico quando Mongo está down', () => {
    const summary = baseSummary({
      services: {
        ...baseSummary().services,
        mongo: { status: 'down' },
      },
    });
    const alerts = buildAdminOpsAlerts(summary);
    expect(alerts.some(a => a.kind === 'mongo.down' && a.level === 'critical')).toBe(true);
  });

  it('gera alerta quando filas têm failed > 0', () => {
    const summary = baseSummary({
      services: {
        ...baseSummary().services,
        queues: { status: 'degraded', waiting: 0, active: 0, failed: 3, delayed: 0, paused: 0 },
      },
    });
    expect(buildAdminOpsAlerts(summary).some(a => a.kind === 'queues.failed')).toBe(true);
  });

  it('gera alerta past_due quando há organizações inadimplentes', () => {
    const summary = baseSummary({
      tenants: { ...baseSummary().tenants, pastDueOrganizations: 2 },
      billing: { ...baseSummary().billing, pastDueOrganizations: 2 },
    });
    expect(buildAdminOpsAlerts(summary).some(a => a.kind === 'billing.past_due')).toBe(true);
  });

  it('gera alerta Stripe off em production', () => {
    const summary = baseSummary({
      system: { ...baseSummary().system, nodeEnv: 'production' },
      billing: { ...baseSummary().billing, stripeMode: 'off' },
    });
    expect(buildAdminOpsAlerts(summary).some(a => a.kind === 'billing.stripe.off_production')).toBe(
      true,
    );
  });

  it('sempre inclui alerta documental QA manual TOP 20', () => {
    const alerts = buildAdminOpsAlerts(baseSummary());
    expect(alerts.some(a => a.kind === 'release.qa_manual_pending')).toBe(true);
  });
});
