import { RedisManager } from '@/cache/RedisManager';
import { WebChatWidget } from '@/models/WebChatWidget';
import { WebChatConversation } from '@/models/WebChatConversation';
import type { WebChatLiveVisitorDto } from '@/types/webchat';
import { resolveTrafficSource } from './webchat-traffic.util';
import { clientIpFromRequest, resolveGeoFromIp } from './webchat-geo.util';
import { emitWebChatAgentEngage, emitWebChatPresenceToTenant } from './WebChatRealtime';
import { hashWebChatVisitorToken } from './webchat-token.util';
import { WebChatService } from './WebChatService';

const PRESENCE_TTL_SEC = 120;
const presencePrefix = (clientId: string) => `webchat:live:${clientId}:`;

/** Fallback dev/local quando Redis indisponível */
const memoryPresence = new Map<string, WebChatPresenceRecord>();

interface WebChatPresenceRecord extends WebChatLiveVisitorDto {
  publicKey?: string;
  visitorToken?: string;
  pendingAgentEngage?: {
    conversationId: string;
    visitorToken?: string;
    openChat?: boolean;
    skipPrechat?: boolean;
    queuedAt: string;
  };
}

export class WebChatPresenceService {
  private static instance: WebChatPresenceService;

  static getInstance(): WebChatPresenceService {
    if (!WebChatPresenceService.instance) {
      WebChatPresenceService.instance = new WebChatPresenceService();
    }
    return WebChatPresenceService.instance;
  }

  private key(clientId: string, presenceId: string): string {
    return `${presencePrefix(clientId)}${presenceId}`;
  }

  private toPublicDto(record: WebChatPresenceRecord): WebChatLiveVisitorDto {
    const { publicKey: _pk, visitorToken: _vt, pendingAgentEngage: _pe, ...dto } = record;
    return dto;
  }

  private async priorVisitorProfile(
    visitorToken?: string,
  ): Promise<{ visitorName?: string; visitorEmail?: string }> {
    if (!visitorToken?.startsWith('wcv_')) return {};
    const hash = hashWebChatVisitorToken(visitorToken);
    const prev = await WebChatConversation.findOne({ visitorTokenHash: hash })
      .sort({ updatedAt: -1 })
      .select('visitorName visitorEmail')
      .lean();
    return {
      visitorName: prev?.visitorName ?? undefined,
      visitorEmail: prev?.visitorEmail ?? undefined,
    };
  }

  private async queueAgentEngage(
    record: WebChatPresenceRecord,
    payload: {
      conversationId: string;
      visitorToken?: string;
      openChat?: boolean;
      skipPrechat?: boolean;
    },
  ): Promise<void> {
    record.pendingAgentEngage = {
      conversationId: payload.conversationId,
      visitorToken: payload.visitorToken,
      openChat: payload.openChat ?? true,
      skipPrechat: payload.skipPrechat ?? true,
      queuedAt: new Date().toISOString(),
    };
    await this.saveRecord(record);
    emitWebChatAgentEngage(record.id, payload);
  }

  async consumePendingEngage(
    publicKey: string,
    presenceId: string,
  ): Promise<{
    conversationId: string;
    visitorToken?: string;
    openChat?: boolean;
    skipPrechat?: boolean;
  } | null> {
    const widget = await WebChatWidget.findOne({ publicKey, active: true }).lean();
    if (!widget) return null;

    const clientId = String(widget.clientId);
    const id = presenceId?.trim();
    if (!id || id.length > 64) return null;

    const record = await this.getRecord(clientId, id);
    if (!record?.pendingAgentEngage) return null;

    const cmd = record.pendingAgentEngage;
    delete record.pendingAgentEngage;
    await this.saveRecord(record);
    return {
      conversationId: cmd.conversationId,
      visitorToken: cmd.visitorToken,
      openChat: cmd.openChat,
      skipPrechat: cmd.skipPrechat,
    };
  }

  private async saveRecord(record: WebChatPresenceRecord): Promise<void> {
    const redis = RedisManager.getInstance();
    const memKey = this.key(record.clientId, record.id);
    memoryPresence.set(memKey, { ...record });

    if (redis.isConnected()) {
      await redis.setWithTTL(memKey, JSON.stringify(record), PRESENCE_TTL_SEC);
    }
    emitWebChatPresenceToTenant(record.clientId, this.toPublicDto(record));
  }

  async getRecord(
    clientId: string,
    presenceId: string,
  ): Promise<WebChatPresenceRecord | null> {
    const memKey = this.key(clientId, presenceId);
    const cached = memoryPresence.get(memKey);
    if (cached) {
      const age = Date.now() - new Date(cached.lastSeenAt).getTime();
      if (age <= PRESENCE_TTL_SEC * 1000) return cached;
      memoryPresence.delete(memKey);
    }

    const redis = RedisManager.getInstance();
    if (!redis.isConnected()) return null;
    const raw = await redis.get(memKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as WebChatPresenceRecord;
      memoryPresence.set(memKey, parsed);
      return parsed;
    } catch {
      return null;
    }
  }

  async upsertFromPublic(opts: {
    publicKey: string;
    presenceId: string;
    pageUrl?: string;
    pageTitle?: string;
    referrer?: string;
    chatOpened?: boolean;
    chatEverOpened?: boolean;
    proactiveInviteClicked?: boolean;
    notificationDismissed?: boolean;
    visitorToken?: string;
    origin?: string | null;
    referer?: string | null;
    headers: Record<string, string | string[] | undefined>;
    remoteIp?: string;
  }): Promise<WebChatLiveVisitorDto | null> {
    const widget = await WebChatWidget.findOne({ publicKey: opts.publicKey, active: true }).lean();
    if (!widget) return null;

    const clientId = String(widget.clientId);
    const presenceId = opts.presenceId?.trim();
    if (!presenceId || presenceId.length > 64) return null;

    const prev = await this.getRecord(clientId, presenceId);

    let conversationId = prev?.conversationId;
    let visitorName = prev?.visitorName;
    let visitorToken = prev?.visitorToken;

    if (opts.visitorToken?.startsWith('wcv_')) {
      visitorToken = opts.visitorToken;
      const hash = hashWebChatVisitorToken(opts.visitorToken);
      const conv = await WebChatConversation.findOne({
        visitorTokenHash: hash,
        widgetId: widget._id,
        status: 'open',
      })
        .select('_id visitorName')
        .lean();
      if (conv) {
        conversationId = String(conv._id);
        visitorName = conv.visitorName;
      }
    }

    const ip = clientIpFromRequest(opts.headers, opts.remoteIp);
    const geo = await resolveGeoFromIp(ip);
    const trafficSource = resolveTrafficSource(opts.referrer, opts.pageUrl);
    const now = new Date();

    const record: WebChatPresenceRecord = {
      id: presenceId,
      clientId,
      widgetId: String(widget._id),
      widgetName: widget.name,
      publicKey: widget.publicKey,
      visitorToken,
      conversationId,
      visitorName,
      pageUrl: opts.pageUrl?.trim() || '',
      pageTitle: opts.pageTitle?.trim() || undefined,
      trafficSource,
      referrer: opts.referrer?.trim() || undefined,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      chatOpened: Boolean(opts.chatOpened),
      chatEverOpened: Boolean(opts.chatEverOpened) || Boolean(prev?.chatEverOpened),
      proactiveInviteClicked:
        Boolean(opts.proactiveInviteClicked) || Boolean(prev?.proactiveInviteClicked),
      notificationDismissed: Boolean(opts.notificationDismissed),
      lastSeenAt: now.toISOString(),
      onlineSince: prev?.onlineSince ?? now.toISOString(),
      pendingAgentEngage: prev?.pendingAgentEngage,
    };

    await this.saveRecord(record);
    return this.toPublicDto(record);
  }

  async listLive(clientId: string): Promise<WebChatLiveVisitorDto[]> {
    const rows: WebChatLiveVisitorDto[] = [];
    const prefix = presencePrefix(clientId);
    const now = Date.now();

    for (const [key, record] of memoryPresence.entries()) {
      if (!key.startsWith(prefix)) continue;
      if (record.clientId !== clientId) continue;
      if (now - new Date(record.lastSeenAt).getTime() > PRESENCE_TTL_SEC * 1000) {
        memoryPresence.delete(key);
        continue;
      }
      rows.push(this.toPublicDto(record));
    }

    const redis = RedisManager.getInstance();
    if (redis.isConnected()) {
      const pattern = `${prefix}*`;
      const keys = await redis.keys(pattern);
      for (const key of keys) {
        if (memoryPresence.has(key)) continue;
        const raw = await redis.get(key);
        if (!raw) continue;
        try {
          const record = JSON.parse(raw) as WebChatPresenceRecord;
          memoryPresence.set(key, record);
          rows.push(this.toPublicDto(record));
        } catch {
          /* ignore */
        }
      }
    }

    const dedup = new Map<string, WebChatLiveVisitorDto>();
    for (const row of rows) dedup.set(row.id, row);
    return [...dedup.values()].sort(
      (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
    );
  }

  async countLive(clientId: string): Promise<number> {
    const list = await this.listLive(clientId);
    return list.length;
  }

  async engageVisitor(
    clientId: string,
    agentUserId: string,
    presenceId: string,
    opts?: { message?: string; openOnly?: boolean },
  ): Promise<{ conversationId: string; created: boolean }> {
    const record = await this.getRecord(clientId, presenceId);
    if (!record) throw new Error('Visitante não está mais online');

    const publicKey = record.publicKey;
    if (!publicKey) throw new Error('Widget do visitante não encontrado');

    let conversationId = record.conversationId;
    let visitorToken = record.visitorToken;
    let created = false;

    if (conversationId) {
      const open = await WebChatConversation.findOne({
        _id: conversationId,
        clientId,
        status: 'open',
      })
        .select('_id')
        .lean();
      if (!open) conversationId = undefined;
    }

    if (!conversationId) {
      const profile = await this.priorVisitorProfile(visitorToken);
      const session = await WebChatService.getInstance().createOrResumeSession(publicKey, {
        visitorName: profile.visitorName,
        visitorEmail: profile.visitorEmail,
        pageUrl: record.pageUrl,
        skipInitialGreeting: true,
      });
      conversationId = session.conversationId;
      visitorToken = session.visitorToken;
      created = true;
      record.conversationId = conversationId;
      record.visitorToken = visitorToken;
      await this.saveRecord(record);
    }

    await WebChatService.getInstance().assignConversation(clientId, agentUserId, conversationId);

    if (!opts?.openOnly) {
      const text =
        opts?.message?.trim() ||
        'Olá! Vi que você está no site. Posso te ajudar com alguma dúvida?';
      await WebChatService.getInstance().sendAgentMessage(
        clientId,
        agentUserId,
        conversationId,
        text,
      );
    }

    record.conversationId = conversationId;
    record.visitorToken = visitorToken;
    await this.queueAgentEngage(record, {
      visitorToken,
      conversationId,
      openChat: true,
      skipPrechat: true,
    });

    return { conversationId, created };
  }
}
