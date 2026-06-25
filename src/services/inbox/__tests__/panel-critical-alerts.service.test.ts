import { PanelCriticalAlertsService } from '@/services/inbox/panel-critical-alerts.service';

const emitPanelEvent = jest.fn();
const getUsageSnapshot = jest.fn();
const isAiActive = jest.fn();

jest.mock('@/services/inbox/PanelNotifications', () => ({
  emitPanelEvent: (...args: unknown[]) => emitPanelEvent(...args),
}));

jest.mock('@/models/InboxSettings', () => ({
  InboxSettings: {
    findOne: jest.fn(),
  },
}));

jest.mock('@/models/AiSettings', () => ({
  AiSettings: {
    findOne: jest.fn(),
  },
}));

jest.mock('@/services/ai/AiUsageMeterService', () => ({
  AiUsageMeterService: {
    getInstance: () => ({ getUsageSnapshot }),
  },
}));

jest.mock('@/services/ai/AiSettingsService', () => ({
  AiSettingsService: {
    getInstance: () => ({ isAiActive }),
  },
}));

jest.mock('@/types/ai-wallet', () => {
  const actual = jest.requireActual('@/types/ai-wallet');
  return {
    ...actual,
    recordAiCreditAttendanceEvent: jest.fn().mockResolvedValue(undefined),
  };
});

const { InboxSettings } = jest.requireMock('@/models/InboxSettings');
const { AiSettings } = jest.requireMock('@/models/AiSettings');

const CLIENT_OID = '6a18bdc5ee126fd553a2c56b';

function freshService(): PanelCriticalAlertsService {
  (PanelCriticalAlertsService as unknown as { instance?: PanelCriticalAlertsService }).instance =
    undefined;
  return PanelCriticalAlertsService.getInstance();
}

describe('PanelCriticalAlertsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    freshService();
  });

  it('emits messages quota exceeded billing event', () => {
    const svc = freshService();
    svc.notifyMessagesQuotaExceeded(CLIENT_OID, 100, 100);

    expect(emitPanelEvent).toHaveBeenCalledTimes(1);
    const payload = emitPanelEvent.mock.calls[0][1] as { type: string; href: string };
    expect(payload.type).toBe('billing:messages_quota_exceeded');
    expect(payload.href).toBe('/plans');
  });

  it('deduplicates repeated alerts within cooldown', () => {
    const svc = freshService();
    svc.notifyAiQuotaExceeded(CLIENT_OID, 'Limite diário');
    svc.notifyAiQuotaExceeded(CLIENT_OID, 'Limite diário');

    expect(emitPanelEvent).toHaveBeenCalledTimes(1);
  });

  it('scanMessagesQuota skips unlimited plans', () => {
    const svc = freshService();
    svc.scanMessagesQuota({
      _id: CLIENT_OID,
      limits: { messagesPerDay: -1 },
      usage: { messagesUsed: 999 },
    });
    expect(emitPanelEvent).not.toHaveBeenCalled();
  });

  it('scanCriticalConfig alerts when fallback enabled without phones', async () => {
    InboxSettings.findOne.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            whatsappFallbackEnabled: true,
            whatsappFallbackAlertPhones: [],
          }),
      }),
    });
    AiSettings.findOne.mockReturnValue({
      lean: () => Promise.resolve(null),
    });
    isAiActive.mockResolvedValue(false);

    const svc = freshService();
    await svc.scanCriticalConfig(CLIENT_OID);

    expect(emitPanelEvent).toHaveBeenCalledWith(
      CLIENT_OID,
      expect.objectContaining({
        type: 'system:critical_config',
        title: 'Fallback WhatsApp incompleto',
        href: '/platform/inbox/bot',
      }),
    );
  });

  it('scanAiQuota emits low quota warning at 90%', async () => {
    getUsageSnapshot.mockResolvedValue({
      allowed: true,
      dailyLimit: 100,
      dailyUsed: 92,
      monthlyLimit: 400,
      monthlyUsed: 50,
      wallet: {
        monthlyIncluded: 400,
        purchased: 0,
        totalAllowance: 400,
        usedThisMonth: 360,
        balance: 40,
        learningUsed: 25,
        learningLimit: 30,
        learningBalance: 5,
        depleted: false,
        learningDepleted: false,
        actionHint: null,
      },
    });

    const svc = freshService();
    await svc.scanAiQuota(CLIENT_OID);

    expect(emitPanelEvent).toHaveBeenCalledWith(
      CLIENT_OID,
      expect.objectContaining({
        type: 'ai:quota_low',
        title: 'Saldo de IA crítico',
      }),
    );
  });

  it('scanAiQuota emits exceeded when not allowed', async () => {
    getUsageSnapshot.mockResolvedValue({
      allowed: false,
      reason: 'Cota esgotada',
    });

    const svc = freshService();
    await svc.scanAiQuota(CLIENT_OID);

    expect(emitPanelEvent).toHaveBeenCalledWith(
      CLIENT_OID,
      expect.objectContaining({
        type: 'ai:quota_exceeded',
        body: 'Cota esgotada',
      }),
    );
  });

  it('scanCriticalConfig alerts IA company mode without API key when active', async () => {
    InboxSettings.findOne.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            whatsappFallbackEnabled: false,
            whatsappFallbackAlertPhones: [],
          }),
      }),
    });
    AiSettings.findOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          mode: 'company',
          encryptedApiKey: '',
        }),
    });
    isAiActive.mockResolvedValue(true);

    const svc = freshService();
    await svc.scanCriticalConfig(CLIENT_OID);

    expect(emitPanelEvent).toHaveBeenCalledWith(
      CLIENT_OID,
      expect.objectContaining({
        type: 'system:critical_config',
        title: 'IA sem chave configurada',
        href: '/platform/inbox/ia',
      }),
    );
  });
});
