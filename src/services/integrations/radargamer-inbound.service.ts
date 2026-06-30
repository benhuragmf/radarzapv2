import crypto from 'crypto';
import mongoose from 'mongoose';
import { QueueManager } from '@/cache/QueueManager';
import { RedisManager } from '@/cache/RedisManager';
import { Destination } from '@/models/Destination';
import type { IDestination } from '@/models/Destination';
import { ConsentStatus } from '@/types/consent';
import { WHATSAPP_LIMITS } from '@/config/limits';
import { createServiceLogger } from '@/utils/logger';
import { redactPhone } from '@/utils/redact-sensitive';
import type { WhatsAppSendKind } from '@/utils/whatsapp-session-rate-limit';

const logger = createServiceLogger('RadarGamerInboundService');

const DEFAULT_RATE_LIMIT_PER_MINUTE = 30;
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export type RadarGamerPriority = 'low' | 'medium' | 'high';

export interface RadarGamerInboundRequest {
  recipientPhone?: unknown;
  templateKey?: unknown;
  variables?: unknown;
  sourceEventId?: unknown;
  sourceUserId?: unknown;
  sourceGuildId?: unknown;
  priority?: unknown;
  metadata?: unknown;
  phone?: unknown;
  message?: unknown;
  userId?: unknown;
  source?: unknown;
}

export interface RadarGamerInboundResponse {
  accepted: true;
  messageId: string;
  status: 'queued' | 'qa_no_real_send';
  queuedAt: string;
  rateLimit: {
    remaining: number;
    resetAt: string;
  };
  correlationId: string;
}

interface RadarGamerInboundHeaders {
  authorization?: string;
  idempotencyKey?: string;
  source?: string;
  requestId?: string;
}

interface NormalizedRadarGamerPayload {
  recipientPhone: string;
  templateKey: string;
  variables: Record<string, unknown>;
  sourceEventId: string;
  sourceUserId: string;
  sourceGuildId?: string;
  priority: RadarGamerPriority;
  metadata: Record<string, unknown>;
  source: string;
}

interface RadarGamerTemplate {
  content: string;
  requiredVariables: string[];
}

type QueueLike = Pick<QueueManager, 'addJob'>;
type RedisLike = Pick<RedisManager, 'isConnected' | 'setIfNotExists' | 'increment' | 'ttl'>;
type DestinationLookup = {
  findByIdentifier(identifier: string, clientId?: mongoose.Types.ObjectId): Promise<IDestination | null>;
};

interface RadarGamerInboundDeps {
  queueManager?: QueueLike;
  redisManager?: RedisLike;
  destinationModel?: DestinationLookup;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  randomUUID?: () => string;
}

export class RadarGamerInboundError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'RadarGamerInboundError';
  }
}

const RADARGAMER_TEMPLATES: Record<string, RadarGamerTemplate> = {
  'radargamer.price_alert': {
    requiredVariables: ['message'],
    content: [
      '*RadarGamer*',
      '',
      '{message}',
      '',
      '{game}',
      '{price}',
      '{url}',
    ].join('\n'),
  },
  'radargamer.generic_message': {
    requiredVariables: ['message'],
    content: '{message}',
  },
};

const memoryIdempotency = new Map<string, number>();
const memoryRateLimit = new Map<string, { count: number; resetAt: number }>();

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true';
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeTokenEquals(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits || digits.length < 10 || digits.length > 15 || digits.startsWith('0')) {
    throw new RadarGamerInboundError(422, 'INVALID_PHONE', 'Invalid recipient phone');
  }
  return `+${digits}`;
}

function normalizeVariables(value: unknown, legacyMessage: string): Record<string, unknown> {
  const variables =
    value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  if (legacyMessage && variables.message == null) {
    variables.message = legacyMessage;
  }
  return variables;
}

function normalizeMetadata(value: unknown, source: string): Record<string, unknown> {
  const metadata =
    value && typeof value === 'object' && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  metadata.source = asTrimmedString(metadata.source) || source;
  return metadata;
}

function renderTemplate(template: RadarGamerTemplate, variables: Record<string, unknown>): string {
  let rendered = template.content;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? ''));
  }
  rendered = rendered.replace(/\{[^}]+\}/g, '');
  rendered = rendered
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!rendered) {
    throw new RadarGamerInboundError(422, 'TEMPLATE_RENDER_EMPTY', 'Template rendered an empty message');
  }
  return rendered;
}

function queuePriority(priority: RadarGamerPriority): number {
  if (priority === 'high') return 8;
  if (priority === 'medium') return 5;
  return 2;
}

function cleanupExpiredMemoryEntries(nowMs: number): void {
  for (const [key, expiresAt] of memoryIdempotency.entries()) {
    if (expiresAt <= nowMs) memoryIdempotency.delete(key);
  }
  for (const [key, row] of memoryRateLimit.entries()) {
    if (row.resetAt <= nowMs) memoryRateLimit.delete(key);
  }
}

export class RadarGamerInboundService {
  private static instance: RadarGamerInboundService;
  private readonly queueManager: QueueLike;
  private readonly redisManager: RedisLike;
  private readonly destinationModel: DestinationLookup;
  private readonly env: NodeJS.ProcessEnv;
  private readonly now: () => Date;
  private readonly randomUUID: () => string;

  constructor(deps: RadarGamerInboundDeps = {}) {
    this.queueManager = deps.queueManager ?? QueueManager.getInstance();
    this.redisManager = deps.redisManager ?? RedisManager.getInstance();
    this.destinationModel = deps.destinationModel ?? Destination;
    this.env = deps.env ?? process.env;
    this.now = deps.now ?? (() => new Date());
    this.randomUUID = deps.randomUUID ?? (() => crypto.randomUUID());
  }

  static getInstance(): RadarGamerInboundService {
    if (!RadarGamerInboundService.instance) {
      RadarGamerInboundService.instance = new RadarGamerInboundService();
    }
    return RadarGamerInboundService.instance;
  }

  async acceptMessage(
    body: RadarGamerInboundRequest,
    headers: RadarGamerInboundHeaders,
  ): Promise<RadarGamerInboundResponse> {
    this.assertAuthorized(headers);

    const normalized = this.normalizePayload(body, headers);
    const clientId = this.resolveClientId();
    const clientObjectId = new mongoose.Types.ObjectId(clientId);
    const correlationId = asTrimmedString(headers.requestId) || this.randomUUID();
    const idempotencyKey =
      asTrimmedString(headers.idempotencyKey) || normalized.sourceEventId;

    await this.assertIdempotent(normalized.source, idempotencyKey);
    const rateLimit = await this.consumeRateLimit(normalized.source);

    const rendered = this.renderAndValidate(normalized);
    this.assertMessageLength(rendered);

    const destination = await this.destinationModel.findByIdentifier(
      normalized.recipientPhone,
      clientObjectId,
    );
    this.assertDestinationCanReceive(destination);

    const messageId = `radargamer-${sha256(`${normalized.source}:${idempotencyKey}`).slice(0, 16)}`;
    const queuedAt = this.now().toISOString();
    const qaNoRealSend = this.isQaNoRealSend();

    if (!qaNoRealSend) {
      try {
        await this.queueManager.addJob(
          'whatsapp-sending',
          'send-message',
          {
            clientId,
            destination: normalized.recipientPhone,
            content: { text: rendered },
            messageId,
            templateName: normalized.templateKey,
            resolvedTemplate: normalized.templateKey,
            consentOrigin: 'campaign',
            sendKind: 'marketing' as WhatsAppSendKind,
            source: 'radargamer',
            traceId: correlationId,
            metadata: {
              integration: 'radargamer',
              sourceEventId: normalized.sourceEventId,
              sourceUserId: normalized.sourceUserId,
              sourceGuildId: normalized.sourceGuildId,
              priority: normalized.priority,
            },
          },
          {
            priority: queuePriority(normalized.priority),
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          },
        );
      } catch (error) {
        logger.warn({
          correlationId,
          sourceEventId: normalized.sourceEventId,
          templateKey: normalized.templateKey,
          recipient: redactPhone(normalized.recipientPhone),
          error: (error as Error).message,
        }, 'RadarGamer enqueue failed');
        throw new RadarGamerInboundError(503, 'QUEUE_UNAVAILABLE', 'Delivery queue unavailable');
      }
    }

    logger.info({
      correlationId,
      sourceEventId: normalized.sourceEventId,
      templateKey: normalized.templateKey,
      recipient: redactPhone(normalized.recipientPhone),
      qaNoRealSend,
    }, 'RadarGamer inbound accepted');

    return {
      accepted: true,
      messageId,
      status: qaNoRealSend ? 'qa_no_real_send' : 'queued',
      queuedAt,
      rateLimit,
      correlationId,
    };
  }

  private assertAuthorized(headers: RadarGamerInboundHeaders): void {
    const expectedToken = asTrimmedString(this.env.RADARCHAT_API_TOKEN);
    if (!expectedToken) {
      throw new RadarGamerInboundError(503, 'RADARCHAT_TOKEN_NOT_CONFIGURED', 'RadarChat API token is not configured');
    }

    const source = asTrimmedString(headers.source).toLowerCase();
    const allowedSources = (this.env.RADARCHAT_ALLOWED_SOURCES ?? 'radargamer')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    if (!source || !allowedSources.includes(source)) {
      throw new RadarGamerInboundError(403, 'SOURCE_NOT_ALLOWED', 'Source is not allowed');
    }

    const auth = asTrimmedString(headers.authorization);
    const match = /^Bearer\s+(.+)$/i.exec(auth);
    if (!match?.[1]) {
      throw new RadarGamerInboundError(401, 'AUTH_REQUIRED', 'Bearer token is required');
    }
    if (!safeTokenEquals(match[1].trim(), expectedToken)) {
      throw new RadarGamerInboundError(401, 'AUTH_INVALID', 'Bearer token is invalid');
    }
  }

  private normalizePayload(
    body: RadarGamerInboundRequest,
    headers: RadarGamerInboundHeaders,
  ): NormalizedRadarGamerPayload {
    const source = asTrimmedString(headers.source).toLowerCase();
    const recipientRaw = asTrimmedString(body.recipientPhone) || asTrimmedString(body.phone);
    const legacyMessage = asTrimmedString(body.message);
    const templateKey =
      asTrimmedString(body.templateKey) ||
      (legacyMessage ? 'radargamer.generic_message' : '');
    const variables = normalizeVariables(body.variables, legacyMessage);
    const sourceEventId =
      asTrimmedString(body.sourceEventId) || asTrimmedString(headers.idempotencyKey);
    const sourceUserId = asTrimmedString(body.sourceUserId) || asTrimmedString(body.userId);
    const sourceGuildId = asTrimmedString(body.sourceGuildId) || undefined;
    const priorityRaw = asTrimmedString(body.priority).toLowerCase();
    const priority: RadarGamerPriority =
      priorityRaw === 'high' || priorityRaw === 'low' || priorityRaw === 'medium'
        ? priorityRaw
        : 'medium';
    const metadata = normalizeMetadata(body.metadata, source);
    const metadataSource = asTrimmedString(metadata.source).toLowerCase();
    const legacySource = asTrimmedString(body.source).toLowerCase();

    if (!recipientRaw) {
      throw new RadarGamerInboundError(400, 'RECIPIENT_PHONE_REQUIRED', 'recipientPhone is required');
    }
    if (!templateKey) {
      throw new RadarGamerInboundError(400, 'TEMPLATE_KEY_REQUIRED', 'templateKey is required');
    }
    if (!sourceEventId) {
      throw new RadarGamerInboundError(400, 'SOURCE_EVENT_ID_REQUIRED', 'sourceEventId or Idempotency-Key is required');
    }
    if (!sourceUserId) {
      throw new RadarGamerInboundError(400, 'SOURCE_USER_ID_REQUIRED', 'sourceUserId is required');
    }
    if (metadataSource !== source || (legacySource && legacySource !== source)) {
      throw new RadarGamerInboundError(403, 'SOURCE_MISMATCH', 'Payload source does not match X-Source');
    }

    return {
      recipientPhone: normalizePhone(recipientRaw),
      templateKey,
      variables,
      sourceEventId,
      sourceUserId,
      sourceGuildId,
      priority,
      metadata,
      source,
    };
  }

  private resolveClientId(): string {
    const clientId =
      asTrimmedString(this.env.RADARCHAT_RADARGAMER_CLIENT_ID) ||
      asTrimmedString(this.env.RADARCHAT_DEFAULT_CLIENT_ID);
    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
      throw new RadarGamerInboundError(503, 'RADARGAMER_TENANT_NOT_CONFIGURED', 'RadarGamer tenant is not configured');
    }
    return clientId;
  }

  private async assertIdempotent(source: string, idempotencyKey: string): Promise<void> {
    const key = `radarchat:integration:${source}:idempotency:${sha256(idempotencyKey)}`;
    const value = this.now().toISOString();
    if (this.redisManager.isConnected()) {
      const created = await this.redisManager.setIfNotExists(key, value, IDEMPOTENCY_TTL_SECONDS);
      if (!created) {
        throw new RadarGamerInboundError(409, 'DUPLICATE_IDEMPOTENCY_KEY', 'Duplicate idempotency key');
      }
      return;
    }

    const nowMs = this.now().getTime();
    cleanupExpiredMemoryEntries(nowMs);
    if (memoryIdempotency.has(key)) {
      throw new RadarGamerInboundError(409, 'DUPLICATE_IDEMPOTENCY_KEY', 'Duplicate idempotency key');
    }
    memoryIdempotency.set(key, nowMs + IDEMPOTENCY_TTL_SECONDS * 1000);
  }

  private async consumeRateLimit(source: string): Promise<RadarGamerInboundResponse['rateLimit']> {
    const max = Math.max(
      1,
      Number.parseInt(this.env.RADARCHAT_RADARGAMER_RATE_LIMIT_PER_MINUTE ?? '', 10) ||
        DEFAULT_RATE_LIMIT_PER_MINUTE,
    );
    const windowSeconds = 60;
    const key = `radarchat:integration:${source}:rate:${Math.floor(this.now().getTime() / 60000)}`;

    if (this.redisManager.isConnected()) {
      const count = await this.redisManager.increment(key, windowSeconds);
      const ttl = await this.redisManager.ttl(key);
      const resetAt = new Date(this.now().getTime() + Math.max(1, ttl) * 1000).toISOString();
      if (count > max) {
        throw new RadarGamerInboundError(429, 'RADARGAMER_RATE_LIMIT', 'RadarGamer integration rate limit exceeded', {
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
      throw new RadarGamerInboundError(429, 'RADARGAMER_RATE_LIMIT', 'RadarGamer integration rate limit exceeded', {
        rateLimit: { remaining: 0, resetAt },
      });
    }
    return { remaining: Math.max(0, max - current.count), resetAt };
  }

  private renderAndValidate(normalized: NormalizedRadarGamerPayload): string {
    const template = RADARGAMER_TEMPLATES[normalized.templateKey];
    if (!template) {
      throw new RadarGamerInboundError(404, 'TEMPLATE_NOT_FOUND', 'Template not found');
    }
    const missing = template.requiredVariables.filter(key => {
      const value = normalized.variables[key];
      return value == null || String(value).trim() === '';
    });
    if (missing.length > 0) {
      throw new RadarGamerInboundError(422, 'TEMPLATE_VARIABLES_INVALID', 'Template variables invalid', {
        missing,
      });
    }
    return renderTemplate(template, normalized.variables);
  }

  private assertMessageLength(rendered: string): void {
    if (rendered.length > WHATSAPP_LIMITS.MAX_MESSAGE_LENGTH) {
      throw new RadarGamerInboundError(422, 'MESSAGE_TOO_LONG', 'Rendered message exceeds WhatsApp limit');
    }
  }

  private assertDestinationCanReceive(destination: IDestination | null): void {
    if (!destination) {
      throw new RadarGamerInboundError(404, 'RECIPIENT_NOT_FOUND', 'Recipient is not configured in RadarChat');
    }
    if (destination.type !== 'contact') {
      throw new RadarGamerInboundError(422, 'RECIPIENT_NOT_CONTACT', 'Recipient must be a contact phone');
    }
    if (!destination.isActive) {
      throw new RadarGamerInboundError(422, 'RECIPIENT_INACTIVE', 'Recipient is inactive');
    }
    const status = destination.consentStatus ?? (destination.consent?.granted ? ConsentStatus.ACCEPTED : ConsentStatus.PENDING);
    if (status !== ConsentStatus.ACCEPTED || destination.consent?.granted !== true) {
      throw new RadarGamerInboundError(422, 'RECIPIENT_OPT_IN_REQUIRED', 'Recipient has no active opt-in');
    }
  }

  private isQaNoRealSend(): boolean {
    return (
      parseBooleanEnv(this.env.RADARCHAT_INTEGRATION_QA_NO_SEND) ||
      parseBooleanEnv(this.env.RADARCHAT_NO_REAL_SEND) ||
      parseBooleanEnv(this.env.QA_NO_REAL_SEND)
    );
  }
}
