jest.mock('@/models/DiscordChannel', () => ({
  DiscordChannel: {
    countDocuments: jest.fn(),
  },
}));

jest.mock('@/services/discord/DiscordHealthService', () => ({
  DiscordHealthService: {
    getInstance: jest.fn(),
  },
}));

jest.mock('@/cache/SessionCache', () => ({
  SessionCache: {
    getInstance: jest.fn(),
  },
}));

jest.mock('@/config/environment', () => ({
  config: { DISCORD: { CLIENT_ID: 'bot-client-id' } },
}));

import { DiscordPublicStatusService } from '@/services/discord/DiscordPublicStatusService';
import { DiscordHealthService } from '@/services/discord/DiscordHealthService';
import { SessionCache } from '@/cache/SessionCache';
import { DiscordChannel } from '@/models/DiscordChannel';

describe('DiscordPublicStatusService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (DiscordHealthService.getInstance as jest.Mock).mockReturnValue({
      getHealth: jest.fn().mockResolvedValue({
        gatewayStatus: 'connected',
        gatewayConnected: true,
        botApiReachable: true,
        botUsername: 'radarbot',
        checkedAt: '2026-06-30T12:00:00.000Z',
      }),
      isBotInGuild: jest.fn().mockResolvedValue(true),
    });
    (SessionCache.getInstance as jest.Mock).mockReturnValue({
      getDiscordSession: jest.fn().mockResolvedValue({
        status: 'connected',
        guilds: ['9876543210987654321'],
      }),
    });
    (DiscordChannel.countDocuments as jest.Mock).mockResolvedValue(2);
  });

  it('retorna status global sem guildId', async () => {
    const status = await DiscordPublicStatusService.getInstance().getStatus();
    expect(status.gatewayConnected).toBe(true);
    expect(status.botInGuild).toBeNull();
    expect(status.automationActive).toBe(true);
  });

  it('retorna botInGuild e monitores quando guildId informado', async () => {
    const status = await DiscordPublicStatusService.getInstance().getStatus('9876543210987654321');
    expect(status.botInGuild).toBe(true);
    expect(status.activeMonitors).toBe(2);
    expect(status.automationActive).toBe(true);
  });

  it('rejeita guildId inválido', async () => {
    await expect(DiscordPublicStatusService.getInstance().getStatus('abc')).rejects.toThrow(/guildId/);
  });
});
