import {
  getDiscordEventCooldownSec,
  discordEventCooldownKey,
} from '../discord-event-cooldown';

describe('discord-event-cooldown', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  describe('getDiscordEventCooldownSec', () => {
    it('usa override do monitor quando definido', () => {
      expect(getDiscordEventCooldownSec('voice_join', 120)).toBe(120);
      expect(getDiscordEventCooldownSec('member_join', 0)).toBe(0);
    });

    it('usa padrão de voz via env', () => {
      process.env.DISCORD_VOICE_COOLDOWN_SEC = '90';
      expect(getDiscordEventCooldownSec('voice_leave')).toBe(90);
    });

    it('usa padrão de membros via env', () => {
      process.env.DISCORD_MEMBER_COOLDOWN_SEC = '45';
      expect(getDiscordEventCooldownSec('member_kick')).toBe(45);
    });

    it('fallback 60s voz e 30s membros', () => {
      delete process.env.DISCORD_VOICE_COOLDOWN_SEC;
      delete process.env.DISCORD_MEMBER_COOLDOWN_SEC;
      expect(getDiscordEventCooldownSec('voice_join')).toBe(60);
      expect(getDiscordEventCooldownSec('member_ban')).toBe(30);
    });
  });

  describe('discordEventCooldownKey', () => {
    it('monta chave única por trigger/guild/canal/usuário', () => {
      expect(
        discordEventCooldownKey('voice_join', 'g1', 'c1', 'u1'),
      ).toBe('discord-cooldown:voice_join:g1:c1:u1');
    });
  });
});
