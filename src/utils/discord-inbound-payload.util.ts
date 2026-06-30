import crypto from 'crypto';
import type { ExtractedMessage } from '@/services/discord-bot/MessageExtractor';
import type { DiscordRuleTrigger } from '@/types/discord-monitor';
import { DISCORD_RULE_TRIGGERS } from '@/types/discord-monitor';

const SNOWFLAKE = /^\d{17,19}$/;

export function isDiscordSnowflake(value: string): boolean {
  return SNOWFLAKE.test(value);
}

export interface InboundDiscordMessageInput {
  messageId?: unknown;
  guildId?: unknown;
  guildName?: unknown;
  channelId?: unknown;
  channelName?: unknown;
  parentChannelId?: unknown;
  authorId?: unknown;
  authorName?: unknown;
  authorTag?: unknown;
  isBot?: unknown;
  text?: unknown;
  content?: unknown;
  links?: unknown;
  embedTitles?: unknown;
  embedDescriptions?: unknown;
  captureKind?: unknown;
  primaryLink?: unknown;
  searchText?: unknown;
  hasEmbed?: unknown;
  hasImage?: unknown;
  hasLink?: unknown;
  authorRoleIds?: unknown;
  embedThumbnail?: unknown;
  embedAuthorName?: unknown;
}

export interface NormalizedInboundMessage {
  messageId: string;
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;
  parentChannelId?: string;
  authorId: string;
  authorName: string;
  authorTag: string;
  isBot: boolean;
  text: string;
  links: string[];
  embedTitles: string[];
  embedDescriptions: string[];
  captureKind?: string;
  primaryLink?: string;
  searchText: string;
  hasEmbed: boolean;
  hasImage: boolean;
  hasLink: boolean;
  authorRoleIds: string[];
  embedThumbnail?: string;
  embedAuthorName?: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(v => asString(v)).filter(Boolean);
}

export function normalizeInboundDiscordMessage(
  body: InboundDiscordMessageInput,
): NormalizedInboundMessage {
  const messageId = asString(body.messageId);
  const guildId = asString(body.guildId);
  const channelId = asString(body.channelId);
  const authorId = asString(body.authorId);
  const text = asString(body.text) || asString(body.content);
  const links = asStringArray(body.links);
  const explicitHasLink = body.hasLink === true || body.hasLink === 'true';
  const hasLink = explicitHasLink || links.length > 0 || /https?:\/\//.test(text);

  if (!messageId) throw new Error('messageId is required');
  if (!guildId || !isDiscordSnowflake(guildId)) throw new Error('guildId inválido');
  if (!channelId || !isDiscordSnowflake(channelId)) throw new Error('channelId inválido');
  if (!authorId || !isDiscordSnowflake(authorId)) throw new Error('authorId inválido');

  const parentChannelId = asString(body.parentChannelId);
  if (parentChannelId && !isDiscordSnowflake(parentChannelId)) {
    throw new Error('parentChannelId inválido');
  }

  const embedTitles = asStringArray(body.embedTitles);
  const embedDescriptions = asStringArray(body.embedDescriptions);
  const searchText =
    asString(body.searchText) ||
    [text, ...embedTitles, ...embedDescriptions].filter(Boolean).join('\n');

  return {
    messageId,
    guildId,
    guildName: asString(body.guildName),
    channelId,
    channelName: asString(body.channelName),
    parentChannelId: parentChannelId || undefined,
    authorId,
    authorName: asString(body.authorName) || authorId,
    authorTag: asString(body.authorTag) || asString(body.authorName) || authorId,
    isBot: body.isBot === true || body.isBot === 'true' || body.isBot === 1,
    text,
    links,
    embedTitles,
    embedDescriptions,
    captureKind: asString(body.captureKind) || undefined,
    primaryLink: asString(body.primaryLink) || links[0] || undefined,
    searchText,
    hasEmbed: body.hasEmbed === true || body.hasEmbed === 'true' || embedTitles.length > 0,
    hasImage: body.hasImage === true || body.hasImage === 'true',
    hasLink,
    authorRoleIds: asStringArray(body.authorRoleIds),
    embedThumbnail: asString(body.embedThumbnail) || undefined,
    embedAuthorName: asString(body.embedAuthorName) || undefined,
  };
}

export function buildExtractedFromInbound(input: NormalizedInboundMessage): ExtractedMessage {
  const hash = crypto.createHash('sha256').update(input.messageId).digest('hex');
  return {
    messageId: input.messageId,
    guildId: input.guildId,
    guildName: input.guildName,
    channelId: input.channelId,
    channelName: input.channelName,
    authorId: input.authorId,
    authorName: input.authorName,
    authorTag: input.authorTag,
    isBot: input.isBot,
    authorRoleIds: input.authorRoleIds.length ? input.authorRoleIds : undefined,
    text: input.text,
    hasEmbed: input.hasEmbed,
    hasLink: input.hasLink,
    hasImage: input.hasImage,
    links: input.links,
    imageUrls: input.embedThumbnail ? [input.embedThumbnail] : [],
    embedTitles: input.embedTitles,
    embedDescriptions: input.embedDescriptions,
    captureKind: input.captureKind,
    searchText: input.searchText,
    embedAuthorName: input.embedAuthorName,
    embedThumbnail: input.embedThumbnail,
    primaryLink: input.primaryLink,
    timestamp: new Date(),
    hash,
  };
}

export interface InboundDiscordEventInput {
  trigger?: unknown;
  guildId?: unknown;
  guildName?: unknown;
  channelId?: unknown;
  channelName?: unknown;
  userId?: unknown;
  userName?: unknown;
  userTag?: unknown;
  moderatorId?: unknown;
  moderatorName?: unknown;
  reason?: unknown;
  memberCount?: unknown;
  messageId?: unknown;
  messagePreview?: unknown;
  emoji?: unknown;
  roleIds?: unknown;
}

export function normalizeInboundDiscordEvent(body: InboundDiscordEventInput): {
  trigger: DiscordRuleTrigger;
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;
  userId: string;
  userName: string;
  userTag: string;
  moderatorId?: string;
  moderatorName?: string;
  reason?: string;
  memberCount?: number;
  messageId?: string;
  messagePreview?: string;
  emoji?: string;
  roleIds: string[];
} {
  const trigger = asString(body.trigger) as DiscordRuleTrigger;
  if (!DISCORD_RULE_TRIGGERS.includes(trigger) || trigger === 'message') {
    throw new Error('trigger inválido para evento inbound');
  }

  const guildId = asString(body.guildId);
  const channelId = asString(body.channelId);
  const userId = asString(body.userId);

  if (!guildId || !isDiscordSnowflake(guildId)) throw new Error('guildId inválido');
  if (!channelId || !isDiscordSnowflake(channelId)) throw new Error('channelId inválido');
  if (!userId || !isDiscordSnowflake(userId)) throw new Error('userId inválido');

  const memberCountRaw = body.memberCount;
  const memberCount =
    typeof memberCountRaw === 'number' && Number.isFinite(memberCountRaw)
      ? memberCountRaw
      : undefined;

  return {
    trigger,
    guildId,
    guildName: asString(body.guildName),
    channelId,
    channelName: asString(body.channelName),
    userId,
    userName: asString(body.userName) || userId,
    userTag: asString(body.userTag) || asString(body.userName) || userId,
    moderatorId: asString(body.moderatorId) || undefined,
    moderatorName: asString(body.moderatorName) || undefined,
    reason: asString(body.reason) || undefined,
    memberCount,
    messageId: asString(body.messageId) || undefined,
    messagePreview: asString(body.messagePreview) || undefined,
    emoji: asString(body.emoji) || undefined,
    roleIds: asStringArray(body.roleIds),
  };
}
