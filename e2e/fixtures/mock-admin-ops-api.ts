import type { Page } from '@playwright/test';
import { MOCK_AUTH_USER } from './mock-panel-api';
import type { AdminOpsSummary } from '../../src/types/admin-ops-summary';
import type { AdminOpsOrganizationsPage } from '../../src/types/admin-ops-organizations';
import type { AdminOpsSecurityEventsPage } from '../../src/types/admin-ops-security-events';

export const ADMIN_OPS_CAPABILITIES = [
  'dashboard:global',
  'system:plans:manage',
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
    nodeVersion: 'v24.14.0',
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

export const MOCK_ADMIN_OPS_ORGANIZATIONS: AdminOpsOrganizationsPage = {
  generatedAt: new Date().toISOString(),
  page: 1,
  limit: 25,
  total: 2,
  totalPages: 1,
  items: [
    {
      id: 'org-trial-1',
      name: 'Empresa Trial Demo',
      plan: 'starter',
      billingStatus: 'trialing',
      planExpiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdAt: '2026-01-15T12:00:00.000Z',
      stripeModeHint: 'test',
      waConnected: true,
      membersCount: 3,
    },
    {
      id: 'org-free-2',
      name: 'Empresa Free Demo',
      plan: 'free',
      billingStatus: 'free',
      planExpiresAt: null,
      createdAt: '2026-02-01T12:00:00.000Z',
      stripeModeHint: 'test',
      waConnected: false,
      membersCount: 1,
    },
  ],
};

export const MOCK_ADMIN_OPS_ORGS_MALICIOUS: AdminOpsOrganizationsPage = {
  ...MOCK_ADMIN_OPS_ORGANIZATIONS,
  items: [
    {
      ...MOCK_ADMIN_OPS_ORGANIZATIONS.items[0],
      name: 'Evil sk_test_leak whsec_abc sessionData stripeSubscriptionId',
    },
  ],
};

export const MOCK_ADMIN_OPS_SECURITY_EVENTS: AdminOpsSecurityEventsPage = {
  generatedAt: new Date().toISOString(),
  page: 1,
  limit: 25,
  total: 2,
  totalPages: 1,
  window: {
    from: new Date(Date.now() - 86400000).toISOString(),
    to: new Date().toISOString(),
  },
  items: [
    {
      id: 'att:1',
      source: 'billing',
      level: 'critical',
      kind: 'billing.invoice.failed',
      title: 'Fatura falhou',
      message: 'Organização sem pagamento',
      organizationId: 'org-trial-1',
      organizationName: 'Empresa Trial Demo',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sys:2',
      source: 'system',
      level: 'warning',
      kind: 'system.warn',
      title: 'WebhookDispatcher',
      message: 'Entrega webhook falhou',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
};

export const MOCK_ADMIN_OPS_SECURITY_MALICIOUS: AdminOpsSecurityEventsPage = {
  ...MOCK_ADMIN_OPS_SECURITY_EVENTS,
  items: [
    {
      id: 'evil:1',
      source: 'system',
      level: 'critical',
      kind: 'evil.leak',
      title: 'STRIPE_SECRET_KEY sk_test_leak',
      message: 'sessionData whsec_abc Authorization Cookie publicAccessToken',
      organizationName: 'Evil org sk_live_abc',
      createdAt: new Date().toISOString(),
    },
  ],
  total: 1,
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

  await page.route('**/api/admin/ops/organizations**', route => {
    if (opts?.fail) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"fail"}' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ADMIN_OPS_ORGANIZATIONS),
    });
  });

  await page.route('**/api/admin/ops/security-events**', route => {
    if (opts?.fail) {
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"fail"}' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ADMIN_OPS_SECURITY_EVENTS),
    });
  });

  await page.route('**/api/admin/monitoring**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        health: { mongodb: true, redis: true },
        stats: { waiting: 3, active: 1, failed: 0 },
        timestamp: new Date().toISOString(),
      }),
    }),
  );

  await page.route('**/api/admin/servers-summary**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        whatsappSessions: 9,
        connectedSessions: 6,
        discordGuilds: 2,
        activeChannels: 5,
      }),
    }),
  );

  await page.route('**/api/users**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'user-1',
          discordUserId: '123',
          email: 'demo@example.com',
          displayName: 'Demo User',
          organizationName: 'Empresa Trial Demo',
          plan: 'starter',
        },
      ]),
    }),
  );

  const blueprintPayload = {
    agentName: 'RadarZap',
    identity: 'E2E',
    soul: '',
    agents: '',
    tools: '',
    memoryGuide: '',
    skillsGuide: '',
    knowledgeGuide: '',
    finalRules: '',
    greetingKnown: '',
    greetingUnknown: '',
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  await page.route('**/api/admin/ai-blueprint**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(blueprintPayload),
    }),
  );

  await page.route('**/api/admin/ai-platform/credentials**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        provider: 'openai',
        llmModel: 'gpt-4o-mini',
        hasOpenAiKey: true,
        hasGeminiKey: false,
        openAiKeyMasked: 'sk-…xxxx',
        geminiKeyMasked: null,
        activeKeySource: 'env',
        envFallbackAvailable: true,
        modelCatalog: [],
        modelCatalogs: { openai: [], gemini: [] },
        version: 1,
        updatedAt: new Date().toISOString(),
      }),
    }),
  );
}
