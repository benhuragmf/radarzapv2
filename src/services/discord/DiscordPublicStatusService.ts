import { DiscordChannel } from '@/models/DiscordChannel';
import { DiscordHealthService, type DiscordHealthSnapshot } from '@/services/discord/DiscordHealthService';
import { SessionCache } from '@/cache/SessionCache';
import { config } from '@/config/environment';
import { isDiscordSnowflake } from '@/utils/discord-inbound-payload.util';

export interface DiscordPublicStatus {
  gatewayStatus: DiscordHealthSnapshot['gatewayStatus'];
  gatewayConnected: boolean;
  botApiReachable: boolean;
  botUsername: string | null;
  guildId?: string;
  botInGuild: boolean | null;
  activeMonitors: number;
  automationActive: boolean;
  checkedAt: string;
}

export class DiscordPublicStatusService {
  private static instance: DiscordPublicStatusService;

  static getInstance(): DiscordPublicStatusService {
    if (!DiscordPublicStatusService.instance) {
      DiscordPublicStatusService.instance = new DiscordPublicStatusService();
    }
    return DiscordPublicStatusService.instance;
  }

  async getStatus(guildId?: string): Promise<DiscordPublicStatus> {
    const health = await DiscordHealthService.getInstance().getHealth();
    let botInGuild: boolean | null = null;
    let activeMonitors = 0;

    if (guildId) {
      if (!isDiscordSnowflake(guildId)) {
        throw new Error('guildId inválido');
      }

      const clientId = config.DISCORD.CLIENT_ID?.trim();
      if (clientId) {
        const session = await SessionCache.getInstance().getDiscordSession(clientId);
        const guilds: string[] = Array.isArray(session?.guilds) ? session.guilds : [];
        botInGuild = guilds.includes(guildId);
      }

      activeMonitors = await DiscordChannel.countDocuments({
        guildId,
        isActive: true,
      });
    }

    const automationActive =
      health.gatewayConnected && health.botApiReachable && (guildId ? activeMonitors > 0 : true);

    return {
      gatewayStatus: health.gatewayStatus,
      gatewayConnected: health.gatewayConnected,
      botApiReachable: health.botApiReachable,
      botUsername: health.botUsername,
      guildId: guildId || undefined,
      botInGuild,
      activeMonitors,
      automationActive,
      checkedAt: health.checkedAt,
    };
  }
}
