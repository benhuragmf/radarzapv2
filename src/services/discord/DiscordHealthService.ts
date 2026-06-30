import { config } from '@/config/environment';
import { SessionCache } from '@/cache/SessionCache';
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
  /** Gateway Discord.js (captura em tempo real) */
  gatewayStatus: 'connected' | 'connecting' | 'disconnected' | 'unknown';
  gatewayConnected: boolean;
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
      gatewayStatus: 'unknown',
      gatewayConnected: false,
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
      const clientIdForSession = clientId || config.DISCORD.CLIENT_ID?.trim();
      if (clientIdForSession) {
        const session = await SessionCache.getInstance().getDiscordSession(clientIdForSession);
        const status = session?.status as DiscordHealthSnapshot['gatewayStatus'] | undefined;
        if (status === 'connected' || status === 'connecting' || status === 'disconnected') {
          base.gatewayStatus = status;
          base.gatewayConnected = status === 'connected';
        }
      }
    } catch (err) {
      logger.debug('Gateway session read failed', { error: (err as Error).message });
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

  /** Verifica se o bot (DISCORD_TOKEN) está no servidor — consulta API Discord diretamente. */
  async isBotInGuild(guildId: string): Promise<boolean | null> {
    const token = config.DISCORD.TOKEN?.trim();
    if (!token) return null;

    try {
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
        headers: { Authorization: `Bot ${token}` },
      });
      if (res.status === 404) return false;
      if (res.ok) return true;
      return null;
    } catch (err) {
      logger.debug('isBotInGuild failed', { guildId, error: (err as Error).message });
      return null;
    }
  }
}
