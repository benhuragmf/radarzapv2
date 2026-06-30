/** Tipos de monitoramento em DiscordChannel */
export type DiscordMonitorType = 'text' | 'voice' | 'guild';

/** Gatilhos de regra Discord → WhatsApp */
export type DiscordRuleTrigger =
  | 'message'
  | 'voice_join'
  | 'voice_leave'
  | 'member_join'
  | 'member_leave'
  | 'member_kick'
  | 'member_ban';

export const DISCORD_RULE_TRIGGERS: DiscordRuleTrigger[] = [
  'message',
  'voice_join',
  'voice_leave',
  'member_join',
  'member_leave',
  'member_kick',
  'member_ban',
];

export const DISCORD_TRIGGER_LABELS: Record<DiscordRuleTrigger, string> = {
  message: 'Nova mensagem',
  voice_join: 'Entrou na chamada de voz',
  voice_leave: 'Saiu da chamada de voz',
  member_join: 'Membro entrou no servidor',
  member_leave: 'Membro saiu do servidor',
  member_kick: 'Membro removido (kick)',
  member_ban: 'Membro banido',
};

export const DISCORD_MONITOR_LABELS: Record<DiscordMonitorType, string> = {
  text: 'Canal de texto',
  voice: 'Canal de voz',
  guild: 'Eventos do servidor',
};

/** Mapeamento trigger → webhook outbound */
export const DISCORD_TRIGGER_WEBHOOK_EVENT: Record<
  Exclude<DiscordRuleTrigger, 'message'>,
  string
> = {
  voice_join: 'discord.voice.join',
  voice_leave: 'discord.voice.leave',
  member_join: 'discord.member.join',
  member_leave: 'discord.member.leave',
  member_kick: 'discord.member.kick',
  member_ban: 'discord.member.ban',
};

export function discordTriggerToWebhookEvent(
  trigger: DiscordRuleTrigger,
): string | null {
  if (trigger === 'message') return null;
  return DISCORD_TRIGGER_WEBHOOK_EVENT[trigger];
}

export function buildDiscordWebhookPayload(event: {
  eventId: string;
  trigger: DiscordRuleTrigger;
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;
  monitorType?: DiscordMonitorType;
  userId: string;
  userName: string;
  userTag?: string;
  moderatorName?: string;
  reason?: string;
  memberCount?: number;
  waJobsEnqueued?: number;
}): Record<string, unknown> {
  return {
    event_id: event.eventId,
    trigger: event.trigger,
    guild_id: event.guildId,
    guild_name: event.guildName,
    channel_id: event.channelId,
    channel_name: event.channelName,
    monitor_type: event.monitorType ?? 'guild',
    user_id: event.userId,
    user_name: event.userName,
    user_tag: event.userTag ?? null,
    moderator_name: event.moderatorName ?? null,
    reason: event.reason ?? null,
    member_count: event.memberCount ?? null,
    wa_jobs_enqueued: event.waJobsEnqueued ?? 0,
  };
}

/** Payload enfileirado pelo bot para eventos não-mensagem */
export interface DiscordEventPayload {
  eventId: string;
  trigger: DiscordRuleTrigger;
  guildId: string;
  guildName: string;
  clientId: string;
  monitorId?: string;
  monitorType?: DiscordMonitorType;
  /** Canal de voz (voice_*) ou guild id (member_*) */
  channelId: string;
  channelName: string;
  userId: string;
  userName: string;
  userTag: string;
  moderatorId?: string;
  moderatorName?: string;
  reason?: string;
  memberCount?: number;
  timestamp: string;
}
