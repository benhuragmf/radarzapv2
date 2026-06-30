import crypto from 'crypto';
import mongoose from 'mongoose';
import { QueueManager } from '@/cache/QueueManager';
import { RedisManager } from '@/cache/RedisManager';
import { ApiKey } from '@/models/ApiKey';
import { DiscordChannel, Organization } from '@/models';
import type { IDiscordChannel } from '@/models/DiscordChannel';
import { OrganizationService } from '@/services/organization/OrganizationService';
import { DiscordMonitorEventService } from '@/services/discord/DiscordMonitorEventService';
import { hashApiKey } from '@/utils/api-key';
import { isDiscordInboundEnabled } from '@/utils/discord-inbound.util';
import {
  buildExtractedFromInbound,
  normalizeInboundDiscordEvent,
  normalizeInboundDiscordMessage,
  type InboundDiscordEventInput,
  type InboundDiscordMessageInput,
} from '@/utils/discord-inbound-payload.util';
import {
  discordEventCooldownKey,
  getDiscordEventCooldownSec,
} from '@/utils/discord-event-cooldown';
import type { DiscordEventPayload, DiscordRuleTrigger } from '@/types/discord-monitor';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('DiscordInboundService');

const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export class DiscordInboundError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DiscordInboundError';
  }
}

export interface DiscordInboundResponse {
  accepted: true;
  status: 'queued' | 'qa_no_real_send' | 'skipped';
  correlationId: string;
  queuedAt: string;
  rateLimit: { remaining: number; resetAt: string };
  skipReason?: string;
}

interface InboundHeaders {
  apiKey?: string;
  idempotencyKey?: string;
  requestId?: string;
}

type QueueLike = Pick<QueueManager, 'addJob'>;
type RedisLike = Pick<RedisManager, 'isConnected' | 'setIfNotExists' | 'increment' | 'ttl'>;

interface DiscordInboundDeps {
  queueManager?: QueueLike;
  redisManager?: RedisLike;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  randomUUID?: () => string;
}

const memoryIdempotency = new Map<string, number>();
const memoryRateLimit = new Map<string, { count: number; resetAt: number }>();

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function cleanupExpiredMemoryEntries(nowMs: number): void {
  for (const [key, expiresAt] of memoryIdempotency) {
    if (expiresAt <= nowMs) memoryIdempotency.delete(key);
  }
  for (const [key, entry] of memoryRateLimit) {
    if (entry.resetAt <= nowMs) memoryRateLimit.delete(key);
  }
}

function parseBooleanEnv(value: string | undefined): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

export class DiscordInboundService {
  private static instance: DiscordInboundService;
  private queueManager: QueueLike;
  private redisManager: RedisLike;
  private env: NodeJS.ProcessEnv;
  private now: () => Date;
  private randomUUID: () => string;

  private constructor(deps: DiscordInboundDeps = {}) {
    this.queueManager = deps.queueManager ?? QueueManager.getInstance();
    this.redisManager = deps.redisManager ?? RedisManager.getInstance();
    this.env = deps.env ?? process.env;
    this.now = deps.now ?? (() => new Date());
    this.randomUUID = deps.randomUUID ?? (() => crypto.randomUUID());
  }

  static getInstance(deps?: DiscordInboundDeps): DiscordInboundService {
    if (!DiscordInboundService.instance) {
      DiscordInboundService.instance = new DiscordInboundService(deps);
    }
    return DiscordInboundService.instance;
  }

  static resetForTests(): void {
    DiscordInboundService.instance = undefined as unknown as DiscordInboundService;
    memoryIdempotency.clear();
    memoryRateLimit.clear();
  }

  async acceptMessage(
    body: InboundDiscordMessageInput,
    headers: InboundHeaders,
  ): Promise<DiscordInboundResponse> {
    const clientId = await this.resolveClientId(headers.apiKey);
    await this.assertInboundEnabled(clientId);
    const idempotencyKey = this.requireIdempotencyKey(headers);
    await this.assertIdempotent(clientId, idempotencyKey);
    const rateLimit = await this.consumeRateLimit(clientId);

    let normalized;
    try {
      normalized = normalizeInboundDiscordMessage(body);
    } catch (err) {
      throw new DiscordInboundError(400, 'INVALID_PAYLOAD', (err as Error).message);
    }

    const monitor = await this.resolveTextMonitor(clientId, normalized.channelId, normalized.parentChannelId);
    await this.assertMonitorTenant(clientId, monitor);

    if (!monitor.matchesMessageFilters(
      normalized.isBot,
      normalized.hasLink,
      normalized.hasImage,
      normalized.hasEmbed,
    )) {
      return this.skippedResponse(rateLimit, 'Filtros do monitor não atendidos');
    }

    if (normalized.isBot && monitor.filters.allowedBotIds.length > 0) {
      if (!monitor.filters.allowedBotIds.includes(normalized.authorId)) {
        return this.skippedResponse(rateLimit, 'Bot não permitido no monitor');
      }
    }
    if (!normalized.isBot && monitor.filters.allowedUserIds.length > 0) {
      if (!monitor.filters.allowedUserIds.includes(normalized.authorId)) {
        return this.skippedResponse(rateLimit, 'Usuário não permitido no monitor');
      }
    }

    if (!monitor.matchesFilters(normalized.searchText)) {
      return this.skippedResponse(rateLimit, 'Palavras-chave do monitor não atendidas');
    }

    const extractedData = buildExtractedFromInbound(normalized);
    const correlationId = headers.requestId?.trim() || this.randomUUID();
    const qaNoRealSend = this.isQaNoRealSend();

    if (!qaNoRealSend) {
      await this.queueManager.addJob(
        'message-processing',
        'process-discord-message',
        {
          messageId: normalized.messageId,
          channelId: normalized.channelId,
          guildId: normalized.guildId,
          clientId: monitor.clientId.toString(),
          extractedData,
          timestamp: this.now(),
          source: 'discord_inbound',
        },
        {
          priority: monitor.rulePriority === 'high' ? 8 : monitor.rulePriority === 'low' ? 2 : 5,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    }

    logger.info({
      correlationId,
      messageId: normalized.messageId,
      guildId: normalized.guildId,
      channelId: normalized.channelId,
      clientId,
      qaNoRealSend,
    }, 'Discord inbound message accepted');

    return {
      accepted: true,
      status: qaNoRealSend ? 'qa_no_real_send' : 'queued',
      correlationId,
      queuedAt: this.now().toISOString(),
      rateLimit,
    };
  }

  async acceptEvent(
    body: InboundDiscordEventInput,
    headers: InboundHeaders,
  ): Promise<DiscordInboundResponse> {
    const clientId = await this.resolveClientId(headers.apiKey);
    await this.assertInboundEnabled(clientId);
    const idempotencyKey = this.requireIdempotencyKey(headers);
    await this.assertIdempotent(clientId, idempotencyKey);
    const rateLimit = await this.consumeRateLimit(clientId);

    let normalized;
    try {
      normalized = normalizeInboundDiscordEvent(body);
    } catch (err) {
      throw new DiscordInboundError(400, 'INVALID_PAYLOAD', (err as Error).message);
    }

    const monitor = await this.resolveEventMonitor(normalized.trigger, normalized.guildId, normalized.channelId);
    await this.assertMonitorTenant(clientId, monitor);

    const eventId = `inbound-${sha256(idempotencyKey).slice(0, 24)}`;
    const cooldownSec = getDiscordEventCooldownSec(normalized.trigger, monitor.eventCooldownSec);
    const cooldownKey = discordEventCooldownKey(
      normalized.trigger,
      normalized.guildId,
      normalized.channelId,
      normalized.userId,
    );

    const allowed = await this.redisManager.setIfNotExists(cooldownKey, eventId, cooldownSec);
    if (!allowed) {
      await DiscordMonitorEventService.getInstance().recordSkippedCooldown(
        monitor,
        {
          guildId: normalized.guildId,
          guildName: normalized.guildName,
          channelId: normalized.channelId,
          channelName: normalized.channelName,
          trigger: normalized.trigger,
          userId: normalized.userId,
          userName: normalized.userName,
          userTag: normalized.userTag,
          timestamp: normalized.timestamp ?? this.now().toISOString(),
        },
        eventId,
        monitor.clientId.toString(),
        cooldownSec,
      );
      return this.skippedResponse(rateLimit, `Cooldown ${cooldownSec}s`);
    }

    const payload: Omit<DiscordEventPayload, 'clientId' | 'eventId' | 'monitorId' | 'monitorType'> = {
      trigger: normalized.trigger,
      guildId: normalized.guildId,
      guildName: normalized.guildName,
      channelId: normalized.channelId,
      channelName: normalized.channelName,
      userId: normalized.userId,
      userName: normalized.userName,
      userTag: normalized.userTag,
      moderatorId: normalized.moderatorId,
      moderatorName: normalized.moderatorName,
      reason: normalized.reason,
      memberCount: normalized.memberCount,
      messageId: normalized.messageId,
      messagePreview: normalized.messagePreview,
      emoji: normalized.emoji,
      roleIds: normalized.roleIds.length ? normalized.roleIds : undefined,
      timestamp: this.now().toISOString(),
    };

    const correlationId = headers.requestId?.trim() || this.randomUUID();
    const qaNoRealSend = this.isQaNoRealSend();

    await DiscordMonitorEventService.getInstance().recordCaptured(
      monitor,
      payload,
      eventId,
      monitor.clientId.toString(),
    );

    if (!qaNoRealSend) {
      const fullPayload: DiscordEventPayload = {
        ...payload,
        eventId,
        clientId: monitor.clientId.toString(),
        monitorId: monitor._id.toString(),
        monitorType: monitor.monitorType ?? 'guild',
      };

      await this.queueManager.addJob(
        'message-processing',
        'process-discord-event',
        { event: fullPayload, timestamp: this.now(), source: 'discord_inbound' },
        {
          priority: 6,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
    }

    return {
      accepted: true,
      status: qaNoRealSend ? 'qa_no_real_send' : 'queued',
      correlationId,
      queuedAt: this.now().toISOString(),
      rateLimit,
    };
  }

  private skippedResponse(
    rateLimit: DiscordInboundResponse['rateLimit'],
    skipReason: string,
  ): DiscordInboundResponse {
    return {
      accepted: true,
      status: 'skipped',
      correlationId: this.randomUUID(),
      queuedAt: this.now().toISOString(),
      rateLimit,
      skipReason,
    };
  }

  private async resolveClientId(apiKeyRaw?: string): Promise<string> {
    const apiKey = apiKeyRaw?.trim();
    if (!apiKey) {
      throw new DiscordInboundError(401, 'MISSING_API_KEY', 'Header X-API-Key é obrigatório');
    }
    if (!apiKey.startsWith('rz_') || apiKey.length < 32) {
      throw new DiscordInboundError(401, 'INVALID_API_KEY', 'Formato de API key inválido');
    }

    const keyDoc = await ApiKey.findOne({ keyHash: hashApiKey(apiKey), active: true });
    if (!keyDoc) {
      throw new DiscordInboundError(401, 'INVALID_API_KEY', 'API key inválida ou inativa');
    }

    keyDoc.lastUsedAt = this.now();
    await keyDoc.save();

    return keyDoc.organizationId.toString();
  }

  private async assertInboundEnabled(clientId: string): Promise<void> {
    const org = await Organization.findById(clientId).lean();
    if (!org) {
      throw new DiscordInboundError(401, 'INVALID_API_KEY_ORGANIZATION', 'Organização não encontrada');
    }
    if (!isDiscordInboundEnabled(org)) {
      throw new DiscordInboundError(
        403,
        'DISCORD_INBOUND_DISABLED',
        'Webhook inbound Discord desativado — ative em Discord → Configurações',
      );
    }
  }

  private requireIdempotencyKey(headers: InboundHeaders): string {
    const key = headers.idempotencyKey?.trim();
    if (!key || key.length < 8) {
      throw new DiscordInboundError(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        'Header Idempotency-Key é obrigatório (mín. 8 caracteres)',
      );
    }
    return key;
  }

  private async assertIdempotent(clientId: string, idempotencyKey: string): Promise<void> {
    const key = `radarchat:discord:inbound:idempotency:${clientId}:${sha256(idempotencyKey)}`;
    if (this.redisManager.isConnected()) {
      const created = await this.redisManager.setIfNotExists(key, this.now().toISOString(), IDEMPOTENCY_TTL_SECONDS);
      if (!created) {
        throw new DiscordInboundError(409, 'DUPLICATE_IDEMPOTENCY_KEY', 'Idempotency-Key duplicado');
      }
      return;
    }

    const nowMs = this.now().getTime();
    cleanupExpiredMemoryEntries(nowMs);
    if (memoryIdempotency.has(key)) {
      throw new DiscordInboundError(409, 'DUPLICATE_IDEMPOTENCY_KEY', 'Idempotency-Key duplicado');
    }
    memoryIdempotency.set(key, nowMs + IDEMPOTENCY_TTL_SECONDS * 1000);
  }

  private async consumeRateLimit(clientId: string): Promise<DiscordInboundResponse['rateLimit']> {
    const max = Math.max(
      1,
      Number.parseInt(this.env.RADARCHAT_DISCORD_INBOUND_RATE_LIMIT_PER_MINUTE ?? '', 10) ||
        DEFAULT_RATE_LIMIT_PER_MINUTE,
    );
    const windowSeconds = 60;
    const key = `radarchat:discord:inbound:rate:${clientId}:${Math.floor(this.now().getTime() / 60000)}`;

    if (this.redisManager.isConnected()) {
      const count = await this.redisManager.increment(key, windowSeconds);
      const ttl = await this.redisManager.ttl(key);
      const resetAt = new Date(this.now().getTime() + Math.max(1, ttl) * 1000).toISOString();
      if (count > max) {
        throw new DiscordInboundError(429, 'DISCORD_INBOUND_RATE_LIMIT', 'Rate limit excedido', {
          rateLimit: { remaining: 0, resetAt },
        });
      }
      return { remaining: Math.max(0, max - count), resetAt };
    }

    const nowMs = this.now().getTime();
    cleanupExpiredMemoryEntries(nowMs);
    const current = memoryRateLimit.get(key) ?? { count: 0, resetAt: nowMs + windowSeconds * 1000 };
    current.count += 1;
    memoryRateLimit.set(key, current);
    const resetAt = new Date(current.resetAt).toISOString();
    if (current.count > max) {
      throw new DiscordInboundError(429, 'DISCORD_INBOUND_RATE_LIMIT', 'Rate limit excedido', {
        rateLimit: { remaining: 0, resetAt },
      });
    }
    return { remaining: Math.max(0, max - current.count), resetAt };
  }

  private async resolveTextMonitor(
    clientId: string,
    channelId: string,
    parentChannelId?: string,
  ): Promise<IDiscordChannel> {
    const monitor = await DiscordChannel.findTextMonitorForMessage(channelId, parentChannelId);
    if (!monitor?.isActive) {
      throw new DiscordInboundError(404, 'MONITOR_NOT_FOUND', 'Canal não monitorado ou inativo');
    }
    return monitor;
  }

  private async resolveEventMonitor(
    trigger: DiscordRuleTrigger,
    guildId: string,
    channelId: string,
  ): Promise<IDiscordChannel> {
    let monitor: IDiscordChannel | null = null;
    if (trigger === 'voice_join' || trigger === 'voice_leave') {
      monitor = await DiscordChannel.findVoiceMonitor(channelId);
    } else {
      monitor = await DiscordChannel.findGuildMonitor(guildId);
    }
    if (!monitor?.isActive) {
      throw new DiscordInboundError(404, 'MONITOR_NOT_FOUND', 'Monitor de evento não encontrado ou inativo');
    }
    return monitor;
  }

  private async assertMonitorTenant(clientId: string, monitor: IDiscordChannel): Promise<void> {
    const monitorClient = monitor.clientId.toString();
    if (monitorClient === clientId) return;

    const related = await OrganizationService.getInstance().getRelatedClientIds(clientId);
    if (!related.some(id => id.toString() === monitorClient)) {
      throw new DiscordInboundError(403, 'MONITOR_FORBIDDEN', 'Monitor não pertence ao tenant da API key');
    }
  }

  private isQaNoRealSend(): boolean {
    return (
      parseBooleanEnv(this.env.RADARCHAT_NO_REAL_SEND) ||
      parseBooleanEnv(this.env.QA_NO_REAL_SEND)
    );
  }
}
