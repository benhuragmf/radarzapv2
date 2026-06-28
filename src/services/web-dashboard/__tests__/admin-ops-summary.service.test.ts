import {
  classifyOrganizationMetrics,
  buildAdminOpsSummary,
} from '@/services/web-dashboard/admin-ops-summary.service';

jest.mock('@/database/DatabaseManager', () => ({
  DatabaseManager: {
    getInstance: () => ({
      isConnected: () => true,
      healthCheck: async () => true,
    }),
  },
}));

jest.mock('@/cache/RedisManager', () => ({
  RedisManager: {
    getInstance: () => ({
      isConnected: () => false,
      healthCheck: async () => false,
      get: async () => null,
      setWithTTL: async () => true,
    }),
  },
}));

jest.mock('@/cache/QueueManager', () => ({
  QueueManager: {
    getInstance: () => ({
      getQueueStats: async () => ({
        notifications: { waiting: 1, active: 0, failed: 2, delayed: 0, paused: 0 },
      }),
    }),
  },
}));

jest.mock('@/models/Organization', () => ({
  Organization: {
    find: jest.fn(() => ({
      select: jest.fn(() => ({
        lean: jest.fn(),
      })),
    })),
  },
}));

jest.mock('@/models/WhatsAppSession', () => ({
  WhatsAppSession: { countDocuments: jest.fn() },
}));
jest.mock('@/models/WebChatWidget', () => ({
  WebChatWidget: { countDocuments: jest.fn() },
}));
jest.mock('@/models/WebChatConversation', () => ({
  WebChatConversation: { countDocuments: jest.fn() },
}));
jest.mock('@/models/LeadForm', () => ({
  LeadForm: { countDocuments: jest.fn() },
}));
jest.mock('@/models/LeadCapture', () => ({
  LeadCapture: { countDocuments: jest.fn() },
}));
jest.mock('@/models/InboxConversation', () => ({
  InboxConversation: { countDocuments: jest.fn() },
}));
jest.mock('@/models/InboxTicket', () => ({
  InboxTicket: { countDocuments: jest.fn() },
}));
jest.mock('@/models/AiUsage', () => ({
  AiUsage: { aggregate: jest.fn() },
}));
jest.mock('@/models/BillingOrder', () => ({
  BillingOrder: { countDocuments: jest.fn() },
}));
jest.mock('@/models/AttendanceEvent', () => ({
  AttendanceEvent: { countDocuments: jest.fn(), aggregate: jest.fn() },
}));
jest.mock('@/models/SystemLog', () => ({
  SystemLog: { countDocuments: jest.fn() },
}));

const { Organization } = jest.requireMock('@/models/Organization');
const { WhatsAppSession } = jest.requireMock('@/models/WhatsAppSession');
const { AiUsage } = jest.requireMock('@/models/AiUsage');
const { AttendanceEvent } = jest.requireMock('@/models/AttendanceEvent');

const FORBIDDEN = [
  'STRIPE_SECRET_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'SESSION_ENCRYPTION_KEY',
  'sessionData',
  'sk_live_',
  'sk_test_',
  'publicAccessToken',
  'authorization',
];

describe('classifyOrganizationMetrics', () => {
  it('conta planos e status billing', () => {
    const metrics = classifyOrganizationMetrics([
      { plan: 'free' },
      { plan: 'starter', planExpiresAt: new Date(Date.now() + 86400000) },
      { plan: 'pro', stripeSubscriptionStatus: 'past_due' },
      { plan: 'starter', stripeSubscriptionStatus: 'trialing' },
      { plan: 'pro', planExpiresAt: new Date(Date.now() - 86400000) },
    ]);

    expect(metrics.totalOrganizations).toBe(5);
    expect(metrics.freeOrganizations).toBe(1);
    expect(metrics.starterOrganizations).toBe(2);
    expect(metrics.proOrganizations).toBe(2);
    expect(metrics.pastDueOrganizations).toBe(1);
    expect(metrics.trialingOrganizations).toBe(1);
    expect(metrics.paidOrganizations).toBeGreaterThanOrEqual(2);
  });
});

describe('buildAdminOpsSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Organization.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { plan: 'free' },
          { plan: 'starter', planExpiresAt: new Date(Date.now() + 86400000) },
        ]),
      }),
    });
    WhatsAppSession.countDocuments.mockImplementation(async (query?: Record<string, unknown>) => {
      if (query && 'status' in query && query.status === 'active') return 3;
      if (query && 'status' in query && query.status === 'inactive') return 1;
      return 0;
    });
    AiUsage.aggregate.mockResolvedValue([{ credits: 42, premium: 5, basic: 2 }]);
    AttendanceEvent.aggregate.mockResolvedValue([]);
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('retorna blocos obrigatórios do contrato', async () => {
    const summary = await buildAdminOpsSummary();

    expect(summary.generatedAt).toBeTruthy();
    expect(summary.system.version).toBeTruthy();
    expect(summary.services.mongo.status).toBe('ok');
    expect(summary.services.queues.failed).toBe(2);
    expect(summary.tenants.totalOrganizations).toBe(2);
    expect(summary.operations.whatsapp.connected).toBe(3);
    expect(summary.ai.creditsConsumedThisMonth).toBe(42);
    expect(summary.billing.stripeMode).toBe('off');
    expect(summary.security).toBeDefined();
    expect(Array.isArray(summary.alerts)).toBe(true);
    expect(summary.links.monitoring).toBe('/admin/monitoring');
  });

  it('não inclui segredos ou campos sensíveis na serialização', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_should_not_leak';
    const json = JSON.stringify(await buildAdminOpsSummary());
    for (const token of FORBIDDEN) {
      expect(json.toLowerCase()).not.toContain(token.toLowerCase());
    }
    expect(json).not.toContain('sk_test_should_not_leak');
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('propaga failed de filas para alertas', async () => {
    const summary = await buildAdminOpsSummary();
    expect(summary.alerts.some(a => a.kind === 'queues.failed')).toBe(true);
  });
});
