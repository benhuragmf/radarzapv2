import mongoose from 'mongoose';
import { ApiKey } from '@/models/ApiKey';
import { DiscordChannel, Organization } from '@/models';
import { hashApiKey } from '@/utils/api-key';
import {
  DiscordInboundError,
  DiscordInboundService,
} from '@/services/integrations/discord-inbound.service';

jest.mock('@/models/ApiKey');
jest.mock('@/models', () => ({
  ApiKey: require('@/models/ApiKey').ApiKey,
  DiscordChannel: {
    findTextMonitorForMessage: jest.fn(),
    findVoiceMonitor: jest.fn(),
    findGuildMonitor: jest.fn(),
  },
  Organization: {
    findById: jest.fn(),
  },
}));

jest.mock('@/services/organization/OrganizationService', () => ({
  OrganizationService: {
    getInstance: () => ({
      getRelatedClientIds: jest.fn().mockResolvedValue([]),
    }),
  },
}));

jest.mock('@/services/discord/DiscordMonitorEventService', () => ({
  DiscordMonitorEventService: {
    getInstance: () => ({
      recordCaptured: jest.fn().mockResolvedValue(undefined),
      recordSkippedCooldown: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

const CLIENT_ID = new mongoose.Types.ObjectId();
const API_KEY_RAW = `rz_${'a'.repeat(48)}`;
const NOW = new Date('2026-06-30T12:00:00.000Z');

function monitorStub() {
  return {
    _id: new mongoose.Types.ObjectId(),
    clientId: CLIENT_ID,
    isActive: true,
    rulePriority: 'medium',
    filters: {
      allowBots: true,
      allowedBotIds: [],
      allowedUserIds: [],
      keywords: [],
      excludeKeywords: [],
    },
    matchesFilters: jest.fn(() => true),
    matchesMessageFilters: jest.fn(() => true),
  };
}

function buildDeps() {
  return {
    queueManager: { addJob: jest.fn().mockResolvedValue({ id: 'job-1' }) },
    redisManager: {
      isConnected: jest.fn(() => true),
      setIfNotExists: jest.fn().mockResolvedValue(true),
      increment: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(60),
    },
    env: {},
    now: () => NOW,
    randomUUID: () => 'corr-1',
  };
}

function messageBody() {
  return {
    messageId: '1234567890123456789',
    guildId: '9876543210987654321',
    channelId: '1111111111111111111',
    authorId: '2222222222222222222',
    text: 'promo live',
  };
}

describe('DiscordInboundService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    DiscordInboundService.resetForTests();
    (ApiKey.findOne as jest.Mock).mockResolvedValue({
      organizationId: CLIENT_ID,
      save: jest.fn().mockResolvedValue(undefined),
    });
    (Organization.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        discordSettings: { inboundEnabled: true },
      }),
    });
    (DiscordChannel.findTextMonitorForMessage as jest.Mock).mockResolvedValue(monitorStub());
  });

  it('rejeita sem API key', async () => {
    const svc = DiscordInboundService.getInstance(buildDeps());
    await expect(
      svc.acceptMessage(messageBody(), { idempotencyKey: 'idem-key-1' }),
    ).rejects.toMatchObject({ code: 'MISSING_API_KEY' });
  });

  it('rejeita inbound desativado', async () => {
    (Organization.findById as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({ discordSettings: { inboundEnabled: false } }),
    });
    const svc = DiscordInboundService.getInstance(buildDeps());
    await expect(
      svc.acceptMessage(messageBody(), {
        apiKey: API_KEY_RAW,
        idempotencyKey: 'idem-key-1',
      }),
    ).rejects.toMatchObject({ code: 'DISCORD_INBOUND_DISABLED' });
  });

  it('aceita mensagem e enfileira process-discord-message', async () => {
    const deps = buildDeps();
    const svc = DiscordInboundService.getInstance(deps);
    const result = await svc.acceptMessage(messageBody(), {
      apiKey: API_KEY_RAW,
      idempotencyKey: 'idem-key-1',
      requestId: 'req-1',
    });

    expect(result).toMatchObject({
      accepted: true,
      status: 'queued',
      correlationId: 'req-1',
    });
    expect(ApiKey.findOne).toHaveBeenCalledWith({
      keyHash: hashApiKey(API_KEY_RAW),
      active: true,
    });
    expect(deps.queueManager.addJob).toHaveBeenCalledWith(
      'message-processing',
      'process-discord-message',
      expect.objectContaining({
        messageId: '1234567890123456789',
        source: 'discord_inbound',
      }),
      expect.any(Object),
    );
  });

  it('retorna skipped quando filtro de palavra-chave falha', async () => {
    const monitor = monitorStub();
    monitor.matchesFilters.mockReturnValue(false);
    (DiscordChannel.findTextMonitorForMessage as jest.Mock).mockResolvedValue(monitor);

    const deps = buildDeps();
    const svc = DiscordInboundService.getInstance(deps);
    const result = await svc.acceptMessage(messageBody(), {
      apiKey: API_KEY_RAW,
      idempotencyKey: 'idem-key-2',
    });

    expect(result.status).toBe('skipped');
    expect(deps.queueManager.addJob).not.toHaveBeenCalled();
  });
});

describe('DiscordInboundError', () => {
  it('expõe status e code', () => {
    const err = new DiscordInboundError(400, 'TEST', 'msg');
    expect(err.status).toBe(400);
    expect(err.code).toBe('TEST');
  });
});
