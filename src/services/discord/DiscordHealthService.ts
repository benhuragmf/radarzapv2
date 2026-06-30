import { config } from '@/config/environment';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('DiscordHealthService');

export interface DiscordHealthSnapshot {
  tokenConfigured: boolean;
  botApiReachable: boolean;
  botOnline: boolean;
  botUsername: string | null;
  botId: string | null;
  guildsInToken: number;
  clientIdConfigured: boolean;
  intents: {
    guildMessages: boolean;
    messageContent: boolean;
    guildMembers: boolean;
    guildVoiceStates: boolean;
  };
  checkedAt: string;
  error?: string;
}

export class DiscordHealthService {
  private static instance: DiscordHealthService;

  static getInstance(): DiscordHealthService {
    if (!DiscordHealthService.instance) {
      DiscordHealthService.instance = new DiscordHealthService();
    }
    return DiscordHealthService.instance;
  }

  async getHealth(): Promise<DiscordHealthSnapshot> {
    const token = config.DISCORD.TOKEN?.trim();
    const clientId = config.DISCORD.CLIENT_ID?.trim();
    const base: DiscordHealthSnapshot = {
      tokenConfigured: Boolean(token),
      botApiReachable: false,
      botOnline: false,
      botUsername: null,
      botId: null,
      guildsInToken: 0,
      clientIdConfigured: Boolean(clientId),
      intents: {
        guildMessages: true,
        messageContent: true,
        guildMembers: true,
        guildVoiceStates: true,
      },
      checkedAt: new Date().toISOString(),
    };

    if (!token) {
      base.error = 'DISCORD_TOKEN não configurado';
      return base;
    }

    try {
      const meRes = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${token}` },
      });
      base.botApiReachable = meRes.ok;
      if (!meRes.ok) {
        base.error = `API Discord ${meRes.status}`;
        return base;
      }

      const me = (await meRes.json()) as { id: string; username: string; bot?: boolean };
      base.botOnline = true;
      base.botUsername = me.username ?? null;
      base.botId = me.id ?? null;

      const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: `Bot ${token}` },
      });
      if (guildsRes.ok) {
        const guilds = (await guildsRes.json()) as unknown[];
        base.guildsInToken = guilds.length;
      }
    } catch (err) {
      logger.warn('Discord health check failed', { error: (err as Error).message });
      base.error = (err as Error).message;
    }

    return base;
  }
}
