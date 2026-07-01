import { buildOperationalBlocks } from '@/services/platform/operational-blocks.service';

const findOrg = jest.fn();
const findAiSettings = jest.fn();
const findInboxSettings = jest.fn();
const webChatCount = jest.fn();
const leadFormCount = jest.fn();
const getUsageSnapshot = jest.fn();
const getSessionDetails = jest.fn();
const hasKey = jest.fn();

jest.mock('@/models/Organization', () => ({
  Organization: { findById: (...args: unknown[]) => findOrg(...args) },
}));

jest.mock('@/models/AiSettings', () => ({
  AiSettings: { findOne: (...args: unknown[]) => findAiSettings(...args) },
}));

jest.mock('@/models/InboxSettings', () => ({
  InboxSettings: { findOne: (...args: unknown[]) => findInboxSettings(...args) },
}));

jest.mock('@/models/WebChatWidget', () => ({
  WebChatWidget: { countDocuments: (...args: unknown[]) => webChatCount(...args) },
}));

jest.mock('@/models/LeadForm', () => ({
  LeadForm: { countDocuments: (...args: unknown[]) => leadFormCount(...args) },
}));

jest.mock('@/services/ai/AiUsageMeterService', () => ({
  AiUsageMeterService: {
    getInstance: () => ({ getUsageSnapshot }),
  },
}));

jest.mock('@/services/ai/AiCredentialVaultService', () => ({
  AiCredentialVaultService: {
    getInstance: () => ({ hasKey }),
  },
}));

jest.mock('@/services/whatsapp/WhatsAppService', () => ({
  WhatsAppService: {
    getInstance: () => ({ getSessionDetails }),
  },
}));

jest.mock('@/config/environment', () => ({
  isProduction: () => false,
}));

const CLIENT_ID = '6a18bdc5ee126fd553a2c56b';

function chainLean(value: unknown) {
  return {
    select: () => ({
      lean: () => Promise.resolve(value),
    }),
  };
}

describe('buildOperationalBlocks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findOrg.mockReturnValue(chainLean(null));
    findAiSettings.mockReturnValue(chainLean(null));
    findInboxSettings.mockReturnValue(chainLean(null));
    webChatCount.mockResolvedValue(0);
    leadFormCount.mockResolvedValue(0);
    getUsageSnapshot.mockResolvedValue({ allowed: true });
    getSessionDetails.mockResolvedValue({ status: 'connected' });
    hasKey.mockReturnValue(false);
  });

  it('returns empty snapshot when nothing blocks', async () => {
    const snap = await buildOperationalBlocks(CLIENT_ID);
    expect(snap.hasBlocks).toBe(false);
    expect(snap.blocks).toEqual([]);
  });

  it('detects premium AI inactive on free plan without company key', async () => {
    findAiSettings.mockReturnValue(
      chainLean({
        mode: 'disabled',
        enabled: false,
        attendanceMode: 'premium_assistant',
      }),
    );
    findOrg.mockReturnValue(
      chainLean({
        plan: 'free',
        limits: { messagesPerDay: 10 },
        usage: { messagesUsed: 0 },
      }),
    );

    const snap = await buildOperationalBlocks(CLIENT_ID);
    expect(snap.hasBlocks).toBe(true);
    expect(snap.blocks.some(b => b.id === 'ai:generative_inactive')).toBe(true);
    expect(snap.blocks.find(b => b.id === 'ai:generative_inactive')?.reason).toMatch(
      /chave própria|Plano free/i,
    );
  });

  it('detects WhatsApp disconnected', async () => {
    getSessionDetails.mockResolvedValue({ status: 'disconnected' });

    const snap = await buildOperationalBlocks(CLIENT_ID);
    expect(snap.blocks.some(b => b.id === 'whatsapp:disconnected')).toBe(true);
  });

  it('detects billing messages quota for owners', async () => {
    findOrg.mockReturnValue(
      chainLean({
        plan: 'free',
        limits: { messagesPerDay: 10 },
        usage: { messagesUsed: 10 },
      }),
    );

    const snap = await buildOperationalBlocks(CLIENT_ID, { canViewBilling: true });
    expect(snap.blocks.some(b => b.id === 'billing:messages_quota')).toBe(true);
  });

  it('hides billing blocks when canViewBilling is false', async () => {
    findOrg.mockReturnValue(
      chainLean({
        plan: 'free',
        limits: { messagesPerDay: 10 },
        usage: { messagesUsed: 10 },
      }),
    );

    const snap = await buildOperationalBlocks(CLIENT_ID, { canViewBilling: false });
    expect(snap.blocks.some(b => b.module === 'billing')).toBe(false);
  });

  it('detects AI quota blocked', async () => {
    findAiSettings.mockReturnValue(
      chainLean({
        mode: 'radarchat',
        enabled: true,
        attendanceMode: 'premium_assistant',
      }),
    );
    getUsageSnapshot.mockResolvedValue({
      allowed: false,
      reason: 'Limite diário de IA atingido',
    });

    const snap = await buildOperationalBlocks(CLIENT_ID);
    expect(snap.blocks.some(b => b.id === 'ai:quota_blocked')).toBe(true);
  });
});
