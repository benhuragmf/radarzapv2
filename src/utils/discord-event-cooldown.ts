import type { DiscordRuleTrigger } from '@/types/discord-monitor';

const DEFAULT_VOICE_SEC = 60;
const DEFAULT_MEMBER_SEC = 30;
const DEFAULT_OTHER_SEC = 20;

function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Cooldown anti-spam por usuário/evento (segundos). */
export function getDiscordEventCooldownSec(
  trigger: DiscordRuleTrigger,
  monitorOverrideSec?: number | null,
): number {
  if (monitorOverrideSec != null && monitorOverrideSec >= 0) {
    return monitorOverrideSec;
  }
  if (trigger.startsWith('voice_')) {
    return parseEnvInt('DISCORD_VOICE_COOLDOWN_SEC', DEFAULT_VOICE_SEC);
  }
  if (trigger.startsWith('member_')) {
    return parseEnvInt('DISCORD_MEMBER_COOLDOWN_SEC', DEFAULT_MEMBER_SEC);
  }
  if (trigger.startsWith('message_')) {
    return parseEnvInt('DISCORD_ENGAGEMENT_COOLDOWN_SEC', DEFAULT_OTHER_SEC);
  }
  return DEFAULT_OTHER_SEC;
}

export function discordEventCooldownKey(
  trigger: DiscordRuleTrigger,
  guildId: string,
  channelId: string,
  userId: string,
): string {
  return `discord-cooldown:${trigger}:${guildId}:${channelId}:${userId}`;
}
