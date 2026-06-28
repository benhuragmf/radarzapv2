import type { Page } from '@playwright/test';
import { MOCK_AUTH_USER } from './mock-panel-api';
import type { AdminOpsSummary } from '../../src/types/admin-ops-summary';

export const ADMIN_OPS_CAPABILITIES = [
  'dashboard:global',
  'logs:global',
  'system:users:view',
  'system:servers:view',
  'queue:global',
  'system:payments:view',
  'system:settings:manage',
];

export const MOCK_ADMIN_OPS_USER = {
  ...MOCK_AUTH_USER,
  isInternalStaff: true,
  systemRole: 'SYSTEM_ADMIN',
  primaryRole: 'SYSTEM_ADMIN',
  capabilities: ADMIN_OPS_CAPABILITIES,
};

export const MOCK_ADMIN_OPS_SUMMARY: AdminOpsSummary = {
  generatedAt: new Date().toISOString(),
  system: {
    version: '2.12.38',
    nodeEnv: 'test',
    uptimeSeconds: 86400,
    nodeVersion: 'v20.11.0',
    memoryMb: { rss: 256, heapUsed: 128, heapTotal: 200, external: 4 },
    cpu: { load1: 0.42, load5: 0.35, load15: 0.3, cpuCount: 8 },
  },
  services: {
    mongo: { status: 'ok', latencyMs: 12 },
    redis: { status: 'ok', latencyMs: 3 },
    queues: { status: 'ok', waiting: 5, active: 1, failed: 0, delayed: 0, paused: 0 },
  },
  tenants: {
    totalOrganizations: 12,
    freeOrganizations: 4,
    starterOrganizations: 3,
    proOrganizations: 4,
    enterpriseOrganizations: 1,
    paidOrganizations: 7,
    expiredOrganizations: 1,
    pastDueOrganizations: 0,
    trialingOrganizations: 2,
  },
  operations: {
    whatsapp: { connected: 6, disconnected: 2, expired: 1, totalSessions: 9 },
    webchat: {
      activeWidgets: 5,
      totalWidgets: 6,
      activeConversations: 3,
      queuedConversations: 1,
      bridgeActive: 0,
    },
    inbox: { openConversations: 8, waitingQueue: 2, inProgress: 4, resolvedToday: 11 },
    tickets: { open: 3, inProgress: 2, clientReplied: 1, closedThisMonth: 15 },
    leads: { leadsToday: 4, leadsThisMonth: 42, activeForms: 3, totalForms: 5 },
  },
  ai: {
    creditsConsumedThisMonth: 1200,
    organizationsWithLowCredits: 1,
    organizationsWithoutCredits: 0,
    premiumCallsThisMonth: 80,
    basicLlmCallsThisMonth: 120,
  },
  billing: {
    stripeMode: 'test',
    pendingOrders: 1,
    paidOrdersThisMonth: 6,
    failedInvoicesThisMonth: 0,
    pastDueOrganizations: 0,
  },
  security: {
    errorsLast24h: 0,
    invalidTicketLookupsLast24h: 2,
    formBlocksLast24h: 0,
    billingLimitBlocksLast24h: 0,
    webhookFailuresLast24h: 0,
  },
  alerts: [
    {
      level: 'info',
      kind: 'release.qa_manual_pending',
      title: 'QA manual pendente',
      message: 'Produção ainda não declarada pronta: QA manual A–J pendente.',
      source: 'release',
    },
  ],
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

/** Payload malicioso — API real nunca deve retornar; usado para assert de não-render. */
export const MOCK_ADMIN_OPS_SUMMARY_MALICIOUS: AdminOpsSummary = {
  ...MOCK_ADMIN_OPS_SUMMARY,
  alerts: [
    {
      level: 'critical',
      kind: 'evil',
      title: 'STRIPE_SECRET_KEY=sk_test_leak',
      message: 'sessionData whsec_abc Authorization Cookie publicAccessToken',
      source: 'hack',
    },
  ],
};

export async function setupAdminDashboardMocks(
  page: Page,
  opts?: { summary?: AdminOpsSummary; fail?: boolean },
): Promise<void> {
  const summary = opts?.summary ?? MOCK_ADMIN_OPS_SUMMARY;

  await page.route('**/auth/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ADMIN_OPS_USER),
    }),
  );

  await page.route('**/api/admin/ops/summary**', route => {
    if (opts?.fail) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"fail"}' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(summary),
    });
  });
}
