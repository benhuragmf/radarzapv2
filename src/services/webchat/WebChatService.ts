import mongoose from 'mongoose';
import { WebChatWidget, type IWebChatWidget } from '../../models/WebChatWidget';
import { InboxDepartment } from '../../models/InboxDepartment';
import { User } from '../../models/User';
import { WebChatConversation, type IWebChatConversation } from '../../models/WebChatConversation';
import { WebChatMessage, type IWebChatMessage } from '../../models/WebChatMessage';
import {
  DEFAULT_WEBCHAT_APPEARANCE,
  type WebChatConversationDto,
  type WebChatMessageDto,
  type WebChatPublicConfig,
  type WebChatWidgetAppearance,
  type WebChatQueueStatus,
  type WebChatVisitorSessionDto,
} from '../../types/webchat';
import {
  DEFAULT_AUTO_REPLY_MESSAGE,
  shouldSendWebChatAutoReply,
  WEBCHAT_BOT_SENDER_ID,
} from './webchat-bot.util';
import {
  generateWebChatPublicKey,
  generateWebChatVisitorToken,
  hashWebChatVisitorToken,
  isWebChatOriginAllowed,
} from './webchat-token.util';
import { emitWebChatToTenant, emitWebChatToVisitor } from './WebChatRealtime';
import { WebChatAiService } from './WebChatAiService';
import { resolveWebChatBusinessHours } from './webchat-business-hours.util';
import type { InboxWeeklySchedule } from '../../types/inbox-settings';
import { WebhookDispatcherService } from '../integrations/WebhookDispatcherService';
import { emitPanelEvent } from '../inbox/PanelNotifications';
import { loadInboxSettings } from '../../constants/inbox-triage';
import {
  expandQuickReply,
  normalizeQuickReplies,
  parseQuickReplyCode,
  type InboxQuickReply,
} from '../../types/inbox-quick-replies';
import { isAgentOnline } from '../inbox/inbox-agent-presence';
import {
  getQueuePriorityState,
  isAgentBusyWithClients,
} from '../inbox/inbox-queue-priority';
import { enrichWebChatInboxRow } from './webchat-inbox-enrich.util';
import { InboxService } from '../inbox/InboxService';
import { parseWebChatAttachment } from './webchat-attachment.util';
import {
  resolveWebChatMediaPath,
  saveWebChatMedia,
} from '../../utils/webchat-media-storage';
import type { WebChatMessageMediaType } from '../../types/webchat';
import crypto from 'crypto';
import path from 'path';
import {
  type InboxWebChatListRow,
  inboxStatusToWebChatFilter,
  mapWebChatToInboxStatus,
  toWebChatInboxId,
  visitorDisplayName,
} from './webchat-inbox-bridge';

export class WebChatService {
  private static instance: WebChatService;

  static getInstance(): WebChatService {
    if (!WebChatService.instance) {
      WebChatService.instance = new WebChatService();
    }
    return WebChatService.instance;
  }

  async createWidget(
    clientId: string,
    data: { name: string; allowedDomains?: string[]; appearance?: Partial<WebChatWidgetAppearance> },
  ): Promise<IWebChatWidget> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const doc = await WebChatWidget.create({
      clientId: clientOid,
      name: data.name.trim(),
      publicKey: generateWebChatPublicKey(),
      allowedDomains: (data.allowedDomains ?? []).map(d => d.trim()).filter(Boolean),
      appearance: { ...DEFAULT_WEBCHAT_APPEARANCE, ...data.appearance },
    });
    return doc;
  }

  async listWidgets(clientId: string) {
    return WebChatWidget.find({
      clientId: new mongoose.Types.ObjectId(clientId),
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  async updateWidget(
    clientId: string,
    widgetId: string,
    patch: {
      name?: string;
      active?: boolean;
      allowedDomains?: string[];
      appearance?: Partial<WebChatWidgetAppearance>;
      autoReplyEnabled?: boolean;
      autoReplyMessage?: string;
      autoReplySenderName?: string;
      autoReplyUseAi?: boolean;
      defaultDepartmentId?: string | null;
      useInboxBusinessHours?: boolean;
      businessHoursEnabled?: boolean;
      timezone?: string;
      schedule?: InboxWeeklySchedule;
      outsideHoursMessage?: string;
    },
  ): Promise<IWebChatWidget | null> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const widgetOid = new mongoose.Types.ObjectId(widgetId);
    const existing = await WebChatWidget.findOne({ _id: widgetOid, clientId: clientOid });
    if (!existing) return null;

    if (patch.name !== undefined) existing.name = patch.name.trim();
    if (patch.active !== undefined) existing.active = patch.active;
    if (patch.allowedDomains !== undefined) {
      existing.allowedDomains = patch.allowedDomains.map(d => d.trim()).filter(Boolean);
    }
    if (patch.appearance) {
      existing.appearance = { ...existing.appearance, ...patch.appearance };
    }
    if (patch.autoReplyEnabled !== undefined) existing.autoReplyEnabled = patch.autoReplyEnabled;
    if (patch.autoReplyMessage !== undefined) {
      existing.autoReplyMessage = patch.autoReplyMessage.trim();
    }
    if (patch.autoReplySenderName !== undefined) {
      existing.autoReplySenderName = patch.autoReplySenderName.trim();
    }
    if (patch.autoReplyUseAi !== undefined) existing.autoReplyUseAi = patch.autoReplyUseAi;
    if (patch.defaultDepartmentId !== undefined) {
      existing.defaultDepartmentId = patch.defaultDepartmentId
        ? new mongoose.Types.ObjectId(patch.defaultDepartmentId)
        : undefined;
    }
    if (patch.useInboxBusinessHours !== undefined) {
      existing.useInboxBusinessHours = patch.useInboxBusinessHours;
    }
    if (patch.businessHoursEnabled !== undefined) {
      existing.businessHoursEnabled = patch.businessHoursEnabled;
    }
    if (patch.timezone !== undefined) {
      existing.timezone = patch.timezone.trim() || 'America/Sao_Paulo';
    }
    if (patch.schedule !== undefined) {
      existing.schedule = patch.schedule;
    }
    if (patch.outsideHoursMessage !== undefined) {
      existing.outsideHoursMessage = patch.outsideHoursMessage.trim();
    }
    await existing.save();
    return existing;
  }

  async deleteWidget(clientId: string, widgetId: string): Promise<boolean> {
    const res = await WebChatWidget.deleteOne({
      _id: new mongoose.Types.ObjectId(widgetId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    return res.deletedCount > 0;
  }

  async getActiveWidgetByPublicKey(publicKey: string): Promise<IWebChatWidget | null> {
    return WebChatWidget.findOne({ publicKey, active: true });
  }

  async getPublicConfig(widget: IWebChatWidget): Promise<WebChatPublicConfig> {
    const a = widget.appearance ?? DEFAULT_WEBCHAT_APPEARANCE;
    const hours = await resolveWebChatBusinessHours(String(widget.clientId), widget);
    return {
      publicKey: widget.publicKey,
      title: a.title,
      subtitle: a.subtitle,
      greeting: a.greeting,
      primaryColor: a.primaryColor,
      position: a.position,
      askName: a.askName,
      askEmail: a.askEmail,
      isOnline: hours.isOnline,
      businessHoursEnabled: hours.businessHoursEnabled,
      outsideHoursMessage: hours.outsideHoursMessage,
      scheduleSummary: hours.scheduleSummary,
    };
  }

  assertOrigin(widget: IWebChatWidget, origin?: string | null, referer?: string | null): void {
    if (!isWebChatOriginAllowed(widget.allowedDomains ?? [], origin, referer)) {
      throw new Error('Origem não autorizada para este widget');
    }
  }

  async resolveVisitorToken(visitorToken: string): Promise<IWebChatConversation | null> {
    if (!visitorToken?.startsWith('wcv_')) return null;
    const hash = hashWebChatVisitorToken(visitorToken);
    return WebChatConversation.findOne({ visitorTokenHash: hash, status: 'open' });
  }

  private async departmentNameFor(
    departmentId?: mongoose.Types.ObjectId,
  ): Promise<string | undefined> {
    if (!departmentId) return undefined;
    const dept = await InboxDepartment.findById(departmentId).select('name').lean();
    return dept?.name;
  }

  private async visitorSessionDto(
    conversation: IWebChatConversation,
    messages: IWebChatMessage[] | Array<Record<string, unknown>>,
  ): Promise<WebChatVisitorSessionDto> {
    return {
      conversationId: String(conversation._id),
      status: conversation.status,
      queueStatus: (conversation.queueStatus as WebChatQueueStatus) ?? 'bot',
      departmentName: await this.departmentNameFor(conversation.departmentId),
      messages: messages.map(m => this.toMessageDto(m)),
    };
  }

  private emitWebchatWebhook(
    clientId: string,
    event: 'webchat.message.received' | 'webchat.conversation.escalated' | 'webchat.conversation.closed',
    data: Record<string, unknown>,
  ): void {
    WebhookDispatcherService.getInstance().emit(clientId, event, data);
  }

  private toMessageDto(msg: IWebChatMessage | Record<string, unknown>): WebChatMessageDto {
    const m = msg as IWebChatMessage;
    return {
      id: String(m._id),
      direction: m.direction,
      body: m.body,
      createdAt: (m.createdAt ?? new Date()).toISOString(),
      senderName: m.senderName,
      mediaType: m.mediaType as WebChatMessageMediaType | undefined,
      mediaUrl: m.mediaUrl,
      mediaMime: m.mediaMime,
      mediaFileName: m.mediaFileName,
    };
  }

  private async widgetNameMap(widgetIds: mongoose.Types.ObjectId[]): Promise<Map<string, string>> {
    const widgets = await WebChatWidget.find({ _id: { $in: widgetIds } }).select('name').lean();
    const map = new Map<string, string>();
    for (const w of widgets) {
      map.set(String(w._id), w.name);
    }
    return map;
  }

  private async departmentNameMap(
    deptIds: mongoose.Types.ObjectId[],
  ): Promise<Map<string, string>> {
    if (!deptIds.length) return new Map();
    const depts = await InboxDepartment.find({ _id: { $in: deptIds } }).select('name').lean();
    return new Map(depts.map(d => [String(d._id), d.name]));
  }

  private toConversationDto(
    conv: IWebChatConversation | Record<string, unknown>,
    widgetName?: string,
    departmentName?: string,
  ): WebChatConversationDto {
    const c = conv as IWebChatConversation;
    return {
      id: String(c._id),
      status: c.status,
      visitorName: c.visitorName,
      visitorEmail: c.visitorEmail,
      pageUrl: c.pageUrl,
      lastMessageAt: c.lastMessageAt?.toISOString(),
      lastMessagePreview: c.lastMessagePreview,
      unreadCount: c.unreadAgentCount ?? 0,
      assignedUserId: c.assignedUserId,
      widgetName,
      queueStatus: (c.queueStatus as WebChatQueueStatus) ?? 'bot',
      departmentId: c.departmentId ? String(c.departmentId) : undefined,
      departmentName,
    };
  }

  async createOrResumeSession(
    publicKey: string,
    opts: {
      visitorToken?: string;
      visitorName?: string;
      visitorEmail?: string;
      pageUrl?: string;
      userAgent?: string;
      origin?: string | null;
      referer?: string | null;
    },
  ): Promise<{
    visitorToken: string;
    conversationId: string;
    queueStatus: WebChatQueueStatus;
    departmentName?: string;
    messages: WebChatMessageDto[];
  }> {
    const widget = await this.getActiveWidgetByPublicKey(publicKey);
    if (!widget) throw new Error('Widget não encontrado');

    this.assertOrigin(widget, opts.origin, opts.referer);

    let visitorToken = opts.visitorToken?.trim();
    let conversation: IWebChatConversation | null = null;

    if (visitorToken) {
      conversation = await this.resolveVisitorToken(visitorToken);
      if (conversation && String(conversation.widgetId) !== String(widget._id)) {
        conversation = null;
      }
    }

    if (!conversation) {
      visitorToken = generateWebChatVisitorToken();
      conversation = await WebChatConversation.create({
        clientId: widget.clientId,
        widgetId: widget._id,
        visitorTokenHash: hashWebChatVisitorToken(visitorToken),
        visitorName: opts.visitorName?.trim() || undefined,
        visitorEmail: opts.visitorEmail?.trim() || undefined,
        pageUrl: opts.pageUrl?.trim() || undefined,
        userAgent: opts.userAgent?.trim() || undefined,
        status: 'open',
        queueStatus: 'bot',
        unreadAgentCount: 0,
      });

      const greeting = widget.appearance?.greeting?.trim();
      if (greeting) {
        await this.appendMessage(conversation, {
          direction: 'system',
          body: greeting,
          notifyVisitor: false,
        });
      }
    } else {
      const patch: Partial<IWebChatConversation> = {};
      if (opts.visitorName?.trim()) patch.visitorName = opts.visitorName.trim();
      if (opts.visitorEmail?.trim()) patch.visitorEmail = opts.visitorEmail.trim();
      if (opts.pageUrl?.trim()) patch.pageUrl = opts.pageUrl.trim();
      if (Object.keys(patch).length) {
        Object.assign(conversation, patch);
        await conversation.save();
      }
    }

    const messages = await WebChatMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    const session = await this.visitorSessionDto(conversation, messages);

    return {
      visitorToken: visitorToken!,
      conversationId: session.conversationId,
      queueStatus: session.queueStatus,
      departmentName: session.departmentName,
      messages: session.messages,
    };
  }

  async getStats(
    clientId: string,
    opts?: { userId?: string },
  ): Promise<{
    openCount: number;
    unreadCount: number;
    waitingQueueCount: number;
    myWaitingQueueCount?: number;
  }> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const [openCount, waitingQueueCount, unreadRows] = await Promise.all([
      WebChatConversation.countDocuments({ clientId: clientOid, status: 'open' }),
      WebChatConversation.countDocuments({
        clientId: clientOid,
        status: 'open',
        queueStatus: 'waiting_human',
      }),
      WebChatConversation.aggregate<{ total: number }>([
        { $match: { clientId: clientOid, status: 'open' } },
        { $group: { _id: null, total: { $sum: '$unreadAgentCount' } } },
      ]),
    ]);

    let myWaitingQueueCount: number | undefined;
    if (opts?.userId) {
      const depts = await InboxService.getInstance().listDepartmentsForUser(clientId, opts.userId);
      const deptOids = depts
        .filter(d => d.canViewQueue)
        .map(d => new mongoose.Types.ObjectId(d._id));
      myWaitingQueueCount = await WebChatConversation.countDocuments({
        clientId: clientOid,
        status: 'open',
        queueStatus: 'waiting_human',
        $or: [
          { departmentId: { $exists: false } },
          { departmentId: null },
          ...(deptOids.length ? [{ departmentId: { $in: deptOids } }] : []),
        ],
      });
    }

    return {
      openCount,
      waitingQueueCount,
      unreadCount: unreadRows[0]?.total ?? 0,
      myWaitingQueueCount,
    };
  }

  async listConversations(
    clientId: string,
    opts: {
      status?: 'open' | 'closed';
      queueStatus?: WebChatQueueStatus;
      limit?: number;
    } = {},
  ): Promise<WebChatConversationDto[]> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const filter: Record<string, unknown> = {
      clientId: new mongoose.Types.ObjectId(clientId),
    };
    if (opts.status) filter.status = opts.status;
    if (opts.queueStatus) filter.queueStatus = opts.queueStatus;

    const rows = await WebChatConversation.find(filter)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    const widgetIds = [...new Set(rows.map(r => r.widgetId as mongoose.Types.ObjectId))];
    const deptIds = [...new Set(rows.map(r => r.departmentId as mongoose.Types.ObjectId).filter(Boolean))];
    const [names, deptNames] = await Promise.all([
      this.widgetNameMap(widgetIds),
      this.departmentNameMap(deptIds),
    ]);

    return rows.map(r =>
      this.toConversationDto(
        r,
        names.get(String(r.widgetId)),
        r.departmentId ? deptNames.get(String(r.departmentId)) : undefined,
      ),
    );
  }

  async listForInbox(
    clientId: string,
    userId: string,
    filters: {
      status?: string;
      departmentId?: string;
      mine?: boolean;
      search?: string;
    } = {},
  ): Promise<InboxWebChatListRow[]> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const wcFilter = inboxStatusToWebChatFilter(filters.status);
    const query: Record<string, unknown> = { clientId: clientOid };

    if (wcFilter.conversationStatus) query.status = wcFilter.conversationStatus;
    if (wcFilter.queueStatus) query.queueStatus = wcFilter.queueStatus;

    // Chat do site: fila visível para todos os atendentes com Inbox (sem silo por setor).
    // Filtro por setor só quando o painel pede explicitamente.
    if (filters.departmentId) {
      query.departmentId = new mongoose.Types.ObjectId(filters.departmentId);
    }

    if (filters.mine) {
      const mineClause = { $or: [{ assignedUserId: userId }, { suggestedUserId: userId }] };
      if (query.$or) {
        query.$and = [{ $or: query.$or as unknown[] }, mineClause];
        delete query.$or;
      } else if (query.$and) {
        (query.$and as unknown[]).push(mineClause);
      } else {
        Object.assign(query, mineClause);
      }
    }

    const q = filters.search?.trim();
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchClause = {
        $or: [
          { visitorName: rx },
          { visitorEmail: rx },
          { lastMessagePreview: rx },
          { pageUrl: rx },
        ],
      };
      if (query.$or) {
        query.$and = [{ $or: query.$or as unknown[] }, searchClause];
        delete query.$or;
      } else {
        Object.assign(query, searchClause);
      }
    }

    const rows = await WebChatConversation.find(query)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(100)
      .lean();

    const widgetIds = [...new Set(rows.map(r => r.widgetId as mongoose.Types.ObjectId))];
    const deptIds = [...new Set(rows.map(r => r.departmentId as mongoose.Types.ObjectId).filter(Boolean))];
    const agentIds = [
      ...new Set(
        rows
          .flatMap(r => [r.assignedUserId, r.suggestedUserId])
          .filter(Boolean) as string[],
      ),
    ];

    const [widgetNames, deptNames, agents, inboxSettings] = await Promise.all([
      this.widgetNameMap(widgetIds),
      this.departmentNameMap(deptIds),
      agentIds.length
        ? User.find({ _id: { $in: agentIds } }).select('displayName email').lean()
        : Promise.resolve([]),
      loadInboxSettings(clientId),
    ]);
    const agentMap = new Map(
      agents.map(a => [
        String(a._id),
        a.displayName?.trim() || a.email?.split('@')[0] || 'Atendente',
      ]),
    );
    const pullTimeoutSeconds = inboxSettings.roundRobinPullTimeoutSeconds ?? 120;

    const baseRows = rows.map(r => {
      const { contactName, contactIdentifier } = visitorDisplayName(
        r.visitorName,
        r.visitorEmail,
      );
      return {
        _id: toWebChatInboxId(String(r._id)),
        channel: 'webchat_site' as const,
        contactName,
        contactIdentifier,
        status: mapWebChatToInboxStatus(r.status, r.queueStatus),
        departmentName: r.departmentId ? deptNames.get(String(r.departmentId)) : undefined,
        departmentId: r.departmentId ? String(r.departmentId) : undefined,
        assignedUserId: r.assignedUserId,
        assignedUserName: r.assignedUserId ? agentMap.get(r.assignedUserId) : undefined,
        suggestedUserId: r.suggestedUserId,
        suggestedAt: r.suggestedAt ? new Date(r.suggestedAt).toISOString() : undefined,
        lastMessageAt: (r.lastMessageAt ?? r.updatedAt ?? r.createdAt).toISOString(),
        lastMessagePreview: r.lastMessagePreview,
        unreadCount: r.unreadAgentCount ?? 0,
        widgetName: widgetNames.get(String(r.widgetId)),
        pageUrl: r.pageUrl,
        priorityForMe: false,
        canAccept: false,
        canPull: false,
      };
    });

    return Promise.all(
      baseRows.map(row =>
        enrichWebChatInboxRow(row, userId, clientId, agentMap, pullTimeoutSeconds),
      ),
    );
  }

  async getDetailForInbox(
    clientId: string,
    userId: string,
    conversationId: string,
  ): Promise<{
    conversation: InboxWebChatListRow & { createdAt?: string };
    messages: Array<{
      _id: string;
      direction: 'inbound' | 'outbound' | 'system';
      body: string;
      createdAt: string;
      senderName?: string;
    }>;
    transfers: [];
    contactStats?: undefined;
    previousConversations?: [];
    contact: null;
    quickReplies: InboxQuickReply[];
  } | null> {
    const detail = await this.getConversationForAgent(clientId, conversationId);
    if (!detail) return null;

    const convDoc = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    }).lean();
    if (!convDoc) return null;

    const { contactName, contactIdentifier } = visitorDisplayName(
      convDoc.visitorName,
      convDoc.visitorEmail,
    );
    let assignedUserName: string | undefined;
    if (convDoc.assignedUserId) {
      const agent = await User.findById(convDoc.assignedUserId).select('displayName email').lean();
      assignedUserName =
        agent?.displayName?.trim() || agent?.email?.split('@')[0] || 'Atendente';
    }

    const agentIds = [convDoc.assignedUserId, convDoc.suggestedUserId].filter(Boolean) as string[];
    const agents = agentIds.length
      ? await User.find({ _id: { $in: agentIds } }).select('displayName email').lean()
      : [];
    const agentMap = new Map(
      agents.map(a => [
        String(a._id),
        a.displayName?.trim() || a.email?.split('@')[0] || 'Atendente',
      ]),
    );
    const inboxSettings = await loadInboxSettings(clientId);
    const pullTimeoutSeconds = inboxSettings.roundRobinPullTimeoutSeconds ?? 120;

    const conversation = await enrichWebChatInboxRow(
      {
        _id: toWebChatInboxId(String(convDoc._id)),
        channel: 'webchat_site',
        contactName,
        contactIdentifier,
        status: mapWebChatToInboxStatus(convDoc.status, convDoc.queueStatus),
        departmentName: detail.conversation.departmentName,
        departmentId: detail.conversation.departmentId,
        assignedUserId: convDoc.assignedUserId,
        assignedUserName,
        suggestedUserId: convDoc.suggestedUserId,
        suggestedAt: convDoc.suggestedAt
          ? new Date(convDoc.suggestedAt).toISOString()
          : undefined,
        lastMessageAt: detail.conversation.lastMessageAt ?? convDoc.createdAt.toISOString(),
        lastMessagePreview: detail.conversation.lastMessagePreview,
        unreadCount: detail.conversation.unreadCount,
        widgetName: detail.conversation.widgetName,
        pageUrl: convDoc.pageUrl,
        priorityForMe: false,
        canAccept: false,
        canPull: false,
      },
      userId,
      clientId,
      agentMap,
      pullTimeoutSeconds,
    );

    return {
      conversation: { ...conversation, createdAt: convDoc.createdAt.toISOString() },
      messages: detail.messages.map(m => ({
        _id: m.id,
        direction: m.direction,
        body: m.body,
        createdAt: m.createdAt,
        senderName: m.senderName,
        mediaType: m.mediaType,
        mediaUrl: m.mediaUrl,
        mediaMime: m.mediaMime,
        mediaFileName: m.mediaFileName,
      })),
      transfers: [],
      contact: null,
      quickReplies: normalizeQuickReplies(inboxSettings.quickReplies),
    };
  }

  async getConversationForAgent(
    clientId: string,
    conversationId: string,
    userId?: string,
  ): Promise<{ conversation: WebChatConversationDto; messages: WebChatMessageDto[] } | null> {
    const conv = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    }).lean();
    if (!conv) return null;

    const widget = await WebChatWidget.findById(conv.widgetId).select('name').lean();
    const dept = conv.departmentId
      ? await InboxDepartment.findById(conv.departmentId).select('name').lean()
      : null;
    const messages = await WebChatMessage.find({ conversationId: conv._id })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();

    if (conv.unreadAgentCount > 0) {
      await WebChatConversation.updateOne(
        { _id: conv._id },
        { $set: { unreadAgentCount: 0 } },
      );
    }

    let conversation = this.toConversationDto(conv, widget?.name, dept?.name);

    if (userId) {
      const agentIds = [conv.assignedUserId, conv.suggestedUserId].filter(Boolean) as string[];
      const agents = agentIds.length
        ? await User.find({ _id: { $in: agentIds } }).select('displayName email').lean()
        : [];
      const agentMap = new Map(
        agents.map(a => [
          String(a._id),
          a.displayName?.trim() || a.email?.split('@')[0] || 'Atendente',
        ]),
      );
      const inboxSettings = await loadInboxSettings(clientId);
      const enriched = await enrichWebChatInboxRow(
        {
          _id: toWebChatInboxId(String(conv._id)),
          channel: 'webchat_site',
          contactName: conv.visitorName || conv.visitorEmail || 'Visitante',
          contactIdentifier: conv.visitorEmail || 'chat do site',
          status: mapWebChatToInboxStatus(conv.status, conv.queueStatus),
          departmentName: dept?.name,
          departmentId: conv.departmentId ? String(conv.departmentId) : undefined,
          assignedUserId: conv.assignedUserId,
          assignedUserName: conv.assignedUserId
            ? agentMap.get(conv.assignedUserId)
            : undefined,
          suggestedUserId: conv.suggestedUserId,
          suggestedAt: conv.suggestedAt
            ? new Date(conv.suggestedAt).toISOString()
            : undefined,
          lastMessageAt: (conv.lastMessageAt ?? conv.updatedAt ?? conv.createdAt).toISOString(),
          lastMessagePreview: conv.lastMessagePreview,
        },
        userId,
        clientId,
        agentMap,
        inboxSettings.roundRobinPullTimeoutSeconds ?? 120,
      );
      conversation = {
        ...conversation,
        assignedUserName: enriched.assignedUserName,
        suggestedUserId: enriched.suggestedUserId,
        suggestedUserName: enriched.suggestedUserName,
        priorityForMe: enriched.priorityForMe,
        canAccept: enriched.canAccept,
        canPull: enriched.canPull,
      };
    }

    return {
      conversation,
      messages: messages.map(m => this.toMessageDto(m)),
    };
  }

  private async appendMessage(
    conversation: IWebChatConversation,
    data: {
      direction: 'inbound' | 'outbound' | 'system';
      body: string;
      senderUserId?: string;
      senderName?: string;
      notifyVisitor?: boolean;
      mediaType?: WebChatMessageMediaType;
      mediaUrl?: string;
      mediaMime?: string;
      mediaFileName?: string;
    },
  ): Promise<IWebChatMessage> {
    const preview =
      data.mediaType === 'image'
        ? '📎 Imagem'
        : data.mediaType === 'document'
          ? '📎 PDF'
          : data.body.slice(0, 280);
    const now = new Date();

    const msg = await WebChatMessage.create({
      conversationId: conversation._id,
      clientId: conversation.clientId,
      direction: data.direction,
      body: data.body.trim(),
      senderUserId: data.senderUserId,
      senderName: data.senderName,
      mediaType: data.mediaType,
      mediaUrl: data.mediaUrl,
      mediaMime: data.mediaMime,
      mediaFileName: data.mediaFileName,
    });

    const unreadDelta = data.direction === 'inbound' ? 1 : 0;
    const currentStatus = await WebChatConversation.findById(conversation._id)
      .select('status')
      .lean();
    const setFields: Record<string, unknown> = {
      lastMessageAt: now,
      lastMessagePreview: preview,
    };
    if (currentStatus?.status !== 'closed') {
      setFields.status = 'open';
    }
    await WebChatConversation.updateOne(
      { _id: conversation._id },
      {
        $set: setFields,
        ...(unreadDelta ? { $inc: { unreadAgentCount: unreadDelta } } : {}),
      },
    );

    const clientId = String(conversation.clientId);
    const conversationId = String(conversation._id);
    const messageDto = this.toMessageDto(msg);
    const convDoc = await WebChatConversation.findById(conversation._id).lean();
    const widget = await WebChatWidget.findById(conversation.widgetId).select('name').lean();
    const dept = convDoc?.departmentId
      ? await InboxDepartment.findById(convDoc.departmentId).select('name').lean()
      : null;
    const conversationDto = convDoc
      ? this.toConversationDto(convDoc, widget?.name, dept?.name)
      : undefined;

    const payload = { clientId, conversationId, message: messageDto, conversation: conversationDto };

    emitWebChatToTenant(clientId, 'webchat:message', payload);
    if (data.notifyVisitor !== false) {
      emitWebChatToVisitor(conversationId, 'webchat:message', payload);
    }
    if (conversationDto) {
      emitWebChatToTenant(clientId, 'webchat:conversation', {
        clientId,
        conversationId,
        conversation: conversationDto,
      });
    }

    return msg;
  }

  async listVisitorMessages(
    visitorToken: string,
    origin?: string | null,
    referer?: string | null,
  ): Promise<WebChatVisitorSessionDto> {
    if (!visitorToken?.startsWith('wcv_')) throw new Error('Sessão inválida ou encerrada');
    const hash = hashWebChatVisitorToken(visitorToken);
    const conversation = await WebChatConversation.findOne({ visitorTokenHash: hash });
    if (!conversation) throw new Error('Sessão inválida ou encerrada');

    const widget = await WebChatWidget.findById(conversation.widgetId);
    if (!widget?.active) throw new Error('Widget inativo');
    this.assertOrigin(widget, origin, referer);

    const messages = await WebChatMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    return this.visitorSessionDto(conversation, messages);
  }

  async sendVisitorMessage(
    visitorToken: string,
    body: string,
    origin?: string | null,
    referer?: string | null,
  ): Promise<WebChatMessageDto> {
    const text = body?.trim();
    if (!text) throw new Error('Mensagem vazia');

    const conversation = await this.resolveVisitorToken(visitorToken);
    if (!conversation) throw new Error('Sessão inválida ou encerrada');

    const widget = await WebChatWidget.findById(conversation.widgetId);
    if (!widget?.active) throw new Error('Widget inativo');

    this.assertOrigin(widget, origin, referer);

    const msg = await this.appendMessage(conversation, {
      direction: 'inbound',
      body: text,
    });

    const hours = await resolveWebChatBusinessHours(String(widget.clientId), widget);
    if (!hours.isOnline && hours.businessHoursEnabled) {
      await this.appendMessage(conversation, {
        direction: 'system',
        body: hours.outsideHoursMessage,
      });
    } else {
      await this.maybeAutoReply(conversation, widget);
    }

    const clientIdStr = String(conversation.clientId);
    this.emitWebchatWebhook(clientIdStr, 'webchat.message.received', {
      conversation_id: String(conversation._id),
      message_id: String(msg._id),
      body: text,
      visitor_name: conversation.visitorName,
      visitor_email: conversation.visitorEmail,
      widget_id: String(conversation.widgetId),
      page_url: conversation.pageUrl,
      queue_status: conversation.queueStatus ?? 'bot',
    });

    return this.toMessageDto(msg);
  }

  async sendVisitorAttachment(
    visitorToken: string,
    input: { dataBase64: string; mimeType?: string; fileName?: string; caption?: string },
    origin?: string | null,
    referer?: string | null,
  ): Promise<WebChatMessageDto> {
    const parsed = parseWebChatAttachment(input);
    if (parsed.ok === false) throw new Error(parsed.error);

    const conversation = await this.resolveVisitorToken(visitorToken);
    if (!conversation) throw new Error('Sessão inválida ou encerrada');
    if (conversation.status === 'closed') throw new Error('Conversa encerrada');

    const widget = await WebChatWidget.findById(conversation.widgetId);
    if (!widget?.active) throw new Error('Widget inativo');
    this.assertOrigin(widget, origin, referer);

    const clientIdStr = String(conversation.clientId);
    const mediaUrl = saveWebChatMedia(clientIdStr, parsed.data, parsed.ext);

    const msg = await this.appendMessage(conversation, {
      direction: 'inbound',
      body: parsed.body,
      mediaType: parsed.mediaType,
      mediaUrl,
      mediaMime: parsed.mime,
      mediaFileName: parsed.fileName,
    });

    const hours = await resolveWebChatBusinessHours(clientIdStr, widget);
    if (!hours.isOnline && hours.businessHoursEnabled) {
      await this.appendMessage(conversation, {
        direction: 'system',
        body: hours.outsideHoursMessage,
      });
    } else {
      await this.maybeAutoReply(conversation, widget);
    }

    this.emitWebchatWebhook(clientIdStr, 'webchat.message.received', {
      conversation_id: String(conversation._id),
      message_id: String(msg._id),
      body: parsed.body,
      media_type: parsed.mediaType,
      media_url: mediaUrl,
      visitor_name: conversation.visitorName,
      visitor_email: conversation.visitorEmail,
      widget_id: String(conversation.widgetId),
      page_url: conversation.pageUrl,
      queue_status: conversation.queueStatus ?? 'bot',
    });

    return this.toMessageDto(msg);
  }

  async resolveVisitorMediaFile(
    visitorToken: string,
    filename: string,
    origin?: string | null,
    referer?: string | null,
  ): Promise<{ filePath: string; mime: string }> {
    if (!visitorToken?.startsWith('wcv_')) throw new Error('Sessão inválida ou encerrada');
    const safeName = path.basename(filename);
    if (!safeName || safeName !== filename) throw new Error('Arquivo inválido');

    const conversation = await this.resolveVisitorToken(visitorToken);
    if (!conversation) throw new Error('Sessão inválida ou encerrada');

    const widget = await WebChatWidget.findById(conversation.widgetId);
    if (!widget?.active) throw new Error('Widget inativo');
    this.assertOrigin(widget, origin, referer);

    const msg = await WebChatMessage.findOne({
      conversationId: conversation._id,
      mediaUrl: { $regex: `${safeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$` },
    }).lean();
    if (!msg?.mediaUrl) throw new Error('Arquivo não encontrado');

    const filePath = resolveWebChatMediaPath(msg.mediaUrl);
    if (!filePath) throw new Error('Arquivo não encontrado');

    return { filePath, mime: msg.mediaMime || 'application/octet-stream' };
  }

  resolveAgentMediaFile(clientId: string, clientIdParam: string, filename: string): string {
    if (clientId !== clientIdParam) throw new Error('Acesso negado');
    const safeName = path.basename(filename);
    const relative = `${clientId}/${safeName}`;
    const filePath = resolveWebChatMediaPath(relative);
    if (!filePath) throw new Error('Arquivo não encontrado');
    return filePath;
  }

  private async maybeAutoReply(
    conversation: IWebChatConversation,
    widget: IWebChatWidget,
  ): Promise<void> {
    const [hasHumanOutbound, hasBotOutbound] = await Promise.all([
      WebChatMessage.exists({
        conversationId: conversation._id,
        direction: 'outbound',
        senderUserId: { $exists: true, $nin: [null, '', WEBCHAT_BOT_SENDER_ID] },
      }),
      WebChatMessage.exists({
        conversationId: conversation._id,
        direction: 'outbound',
        senderUserId: WEBCHAT_BOT_SENDER_ID,
      }),
    ]);

    const fresh = await WebChatConversation.findById(conversation._id);
    if (!fresh || fresh.status === 'closed') return;

    if (
      !shouldSendWebChatAutoReply({
        autoReplyEnabled: Boolean(widget.autoReplyEnabled),
        autoReplyMessage: widget.autoReplyMessage,
        autoReplyUseAi: Boolean(widget.autoReplyUseAi),
        queueStatus: fresh.queueStatus,
        assignedUserId: fresh.assignedUserId,
        hasHumanOutbound: Boolean(hasHumanOutbound),
        hasBotOutbound: Boolean(hasBotOutbound),
      })
    ) {
      return;
    }

    let body = (widget.autoReplyMessage ?? DEFAULT_AUTO_REPLY_MESSAGE).trim();
    let senderName = widget.autoReplySenderName?.trim() || 'Assistente virtual';
    let shouldEscalate = false;

    if (widget.autoReplyUseAi) {
      const ai = await WebChatAiService.getInstance().generateVisitorReply(
        String(conversation.clientId),
        String(conversation._id),
        {
          visitorName: fresh.visitorName,
          visitorEmail: fresh.visitorEmail,
        },
      );
      if (ai) {
        body = ai.body;
        senderName = ai.senderName;
        shouldEscalate = Boolean(ai.shouldEscalate);
      }
    }

    await this.appendMessage(fresh, {
      direction: 'outbound',
      body,
      senderUserId: WEBCHAT_BOT_SENDER_ID,
      senderName,
    });

    if (shouldEscalate) {
      await this.escalateToQueue(String(fresh.clientId), String(fresh._id), {
        reason: 'A IA identificou que um atendente humano deve assumir esta conversa.',
      });
    }
  }

  async escalateToQueue(
    clientId: string,
    conversationId: string,
    opts: { departmentId?: string; userId?: string; reason?: string } = {},
  ): Promise<void> {
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');
    if (conversation.status === 'closed') throw new Error('Conversa encerrada');
    if (conversation.queueStatus === 'waiting_human') return;

    const widget = await WebChatWidget.findById(conversation.widgetId);
    const departmentOid = opts.departmentId
      ? new mongoose.Types.ObjectId(opts.departmentId)
      : widget?.defaultDepartmentId;

    conversation.queueStatus = 'waiting_human';
    conversation.escalatedAt = new Date();
    conversation.queueEnteredAt = new Date();
    conversation.assignedUserId = undefined;
    conversation.suggestedUserId = undefined;
    conversation.suggestedAt = undefined;
    if (departmentOid) conversation.departmentId = departmentOid;
    await conversation.save();

    const dept = departmentOid
      ? await InboxDepartment.findById(departmentOid).select('name').lean()
      : null;

    const systemBody =
      opts.reason?.trim() ||
      (dept?.name
        ? `Encaminhamos você para o setor ${dept.name}. Um atendente responderá em breve.`
        : 'Encaminhamos você para a fila de atendimento. Um especialista responderá em breve.');

    await this.appendMessage(conversation, {
      direction: 'system',
      body: systemBody,
    });

    if (departmentOid) {
      const rr = await InboxService.getInstance().suggestRoundRobinAgent(clientId, departmentOid);
      if (rr?.kind === 'suggested') {
        conversation.suggestedUserId = rr.userId;
        conversation.suggestedAt = new Date();
        await conversation.save();

        await this.appendMessage(conversation, {
          direction: 'system',
          body: `Prioridade para ${rr.agentName} — aguardando aceite no painel.`,
        });

        emitPanelEvent(String(conversation.clientId), {
          id: crypto.randomUUID(),
          type: 'inbox:priority',
          title: 'Prioridade de atendimento',
          body: `${rr.agentName} · chat do site`,
          href: `/platform/inbox?conv=${toWebChatInboxId(String(conversation._id))}`,
          conversationId: toWebChatInboxId(String(conversation._id)),
          createdAt: new Date().toISOString(),
        });
      } else if (rr?.kind === 'no_online') {
        await this.appendMessage(conversation, {
          direction: 'system',
          body: 'Nenhum atendente online no painel — fila aberta para a equipe assumir.',
        });
      }
    }

    this.emitWebchatWebhook(String(conversation.clientId), 'webchat.conversation.escalated', {
      conversation_id: String(conversation._id),
      department_id: departmentOid ? String(departmentOid) : undefined,
      department_name: dept?.name,
      widget_id: String(conversation.widgetId),
      visitor_name: conversation.visitorName,
      visitor_email: conversation.visitorEmail,
      escalated_by_user_id: opts.userId,
    });

    const visitorLabel =
      conversation.visitorName || conversation.visitorEmail || 'Visitante do site';
    emitPanelEvent(String(conversation.clientId), {
      id: crypto.randomUUID(),
      type: 'webchat:escalated',
      title: 'Chat do site — fila',
      body: dept?.name ? `${visitorLabel} · ${dept.name}` : visitorLabel,
      href: `/platform/inbox?conv=${toWebChatInboxId(String(conversation._id))}`,
      conversationId: String(conversation._id),
      createdAt: new Date().toISOString(),
    });
  }

  async assignConversation(
    clientId: string,
    userId: string,
    conversationId: string,
  ): Promise<InboxWebChatListRow> {
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');
    if (conversation.status === 'closed') throw new Error('Conversa encerrada');

    if (
      conversation.queueStatus === 'with_agent' &&
      conversation.assignedUserId &&
      String(conversation.assignedUserId) === String(userId)
    ) {
      const inboxSettings = await loadInboxSettings(clientId);
      const agent = await User.findById(userId).select('displayName email').lean();
      const agentName = agent?.displayName?.trim() || agent?.email?.split('@')[0] || 'Atendente';
      const agentMap = new Map([[userId, agentName]]);
      const { contactName, contactIdentifier } = visitorDisplayName(
        conversation.visitorName,
        conversation.visitorEmail,
      );
      return enrichWebChatInboxRow(
        {
          _id: toWebChatInboxId(String(conversation._id)),
          channel: 'webchat_site',
          contactName,
          contactIdentifier,
          status: 'in_progress',
          departmentId: conversation.departmentId ? String(conversation.departmentId) : undefined,
          assignedUserId: userId,
          assignedUserName: agentName,
          lastMessageAt: (conversation.lastMessageAt ?? conversation.updatedAt).toISOString(),
          lastMessagePreview: conversation.lastMessagePreview,
        },
        userId,
        clientId,
        agentMap,
        inboxSettings.roundRobinPullTimeoutSeconds ?? 120,
      );
    }

    if (
      conversation.queueStatus === 'with_agent' &&
      conversation.assignedUserId &&
      String(conversation.assignedUserId) !== String(userId)
    ) {
      throw new Error('Conversa em atendimento por outro agente');
    }

    if (conversation.queueStatus === 'waiting_human') {
      await this.assertCanTakeWebChatQueue(clientId, userId, conversation);
    }

    const pulledFrom = conversation.suggestedUserId;
    const wasPull = Boolean(pulledFrom && String(pulledFrom) !== String(userId));

    conversation.suggestedUserId = undefined;
    conversation.suggestedAt = undefined;
    conversation.assignedUserId = userId;
    conversation.queueStatus = 'with_agent';
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const agent = await User.findById(userId).select('displayName email').lean();
    const agentName = agent?.displayName?.trim() || agent?.email?.split('@')[0] || 'Atendente';

    if (wasPull) {
      await this.appendMessage(conversation, {
        direction: 'system',
        body: `${agentName} assumiu a conversa (prioridade anterior expirada ou atendente ocupado).`,
        senderUserId: userId,
        senderName: agentName,
      });
    } else {
      await this.appendMessage(conversation, {
        direction: 'system',
        body: `${agentName} entrou no atendimento.`,
        senderUserId: userId,
        senderName: agentName,
      });
    }

    emitWebChatToTenant(String(conversation.clientId), 'webchat:conversation', {
      clientId: String(conversation.clientId),
      conversationId: String(conversation._id),
    });

    const inboxSettings = await loadInboxSettings(clientId);
    const agentMap = new Map([[userId, agentName]]);
    return enrichWebChatInboxRow(
      {
        _id: toWebChatInboxId(String(conversation._id)),
        channel: 'webchat_site',
        contactName:
          conversation.visitorName?.trim() ||
          conversation.visitorEmail?.trim() ||
          'Visitante do site',
        contactIdentifier: conversation.visitorEmail?.trim() || 'chat do site',
        status: 'in_progress',
        assignedUserId: userId,
        assignedUserName: agentName,
        lastMessageAt: (conversation.lastMessageAt ?? conversation.updatedAt).toISOString(),
        lastMessagePreview: conversation.lastMessagePreview,
      },
      userId,
      clientId,
      agentMap,
      inboxSettings.roundRobinPullTimeoutSeconds ?? 120,
    );
  }

  private async assertCanTakeWebChatQueue(
    clientId: string,
    userId: string,
    conversation: IWebChatConversation,
  ): Promise<void> {
    const suggestedId = conversation.suggestedUserId;
    if (!suggestedId) return;
    if (String(suggestedId) === String(userId)) return;

    const settings = await loadInboxSettings(clientId);
    const busy = await isAgentBusyWithClients(clientId, suggestedId, {
      webChatConversationId: String(conversation._id),
    });
    const { pullAllowedByTimeout } = getQueuePriorityState(
      conversation.suggestedAt,
      settings.roundRobinPullTimeoutSeconds ?? 120,
    );

    if (!busy && !pullAllowedByTimeout && isAgentOnline(clientId, suggestedId)) {
      throw new Error(
        'Esta conversa está em prioridade para outro atendente. Aguarde o tempo ou até ele ficar ocupado.',
      );
    }
  }

  async sendAgentMessage(
    clientId: string,
    userId: string,
    conversationId: string,
    body: string,
    senderName?: string,
  ): Promise<WebChatMessageDto> {
    const raw = body?.trim();
    if (!raw) throw new Error('Mensagem vazia');

    const conversation = await this.prepareAgentReply(clientId, userId, conversationId);
    const settings = await loadInboxSettings(clientId);
    const quickReplies = normalizeQuickReplies(settings.quickReplies);
    const { contactName } = visitorDisplayName(
      conversation.visitorName,
      conversation.visitorEmail,
    );
    const quickCode = parseQuickReplyCode(raw);
    const text = expandQuickReply(raw, quickReplies, contactName);

    const msg = await this.appendMessage(conversation, {
      direction: 'outbound',
      body: text,
      senderUserId: userId,
      senderName: senderName?.trim() || 'Atendente',
    });

    if (quickCode === 'enc') {
      await this.closeConversation(clientId, conversationId, userId, { skipSystemMessage: true });
    }

    return this.toMessageDto(msg);
  }

  async sendAgentAttachment(
    clientId: string,
    userId: string,
    conversationId: string,
    input: { dataBase64: string; mimeType?: string; fileName?: string; caption?: string },
    senderName?: string,
  ): Promise<WebChatMessageDto> {
    const parsed = parseWebChatAttachment(input);
    if (parsed.ok === false) throw new Error(parsed.error);

    const conversation = await this.prepareAgentReply(clientId, userId, conversationId);
    const mediaUrl = saveWebChatMedia(clientId, parsed.data, parsed.ext);

    const msg = await this.appendMessage(conversation, {
      direction: 'outbound',
      body: parsed.body,
      senderUserId: userId,
      senderName: senderName?.trim() || 'Atendente',
      mediaType: parsed.mediaType,
      mediaUrl,
      mediaMime: parsed.mime,
      mediaFileName: parsed.fileName,
    });
    return this.toMessageDto(msg);
  }

  private async prepareAgentReply(
    clientId: string,
    userId: string,
    conversationId: string,
  ): Promise<IWebChatConversation> {
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');
    if (conversation.status === 'closed') throw new Error('Conversa encerrada');

    if (conversation.queueStatus === 'waiting_human') {
      if (
        conversation.suggestedUserId &&
        String(conversation.suggestedUserId) !== String(userId)
      ) {
        throw new Error('Aceite ou aguarde a prioridade desta conversa antes de responder');
      }
      throw new Error('Assuma a conversa antes de responder');
    }
    if (conversation.queueStatus === 'bot') {
      throw new Error('Assuma a conversa antes de responder');
    }
    const assignedId = conversation.assignedUserId
      ? String(conversation.assignedUserId)
      : '';
    if (!assignedId || assignedId !== String(userId)) {
      if (assignedId && assignedId !== String(userId)) {
        throw new Error('Conversa em atendimento por outro agente');
      }
      throw new Error('Assuma a conversa antes de responder');
    }

    return conversation;
  }

  async transferConversation(
    clientId: string,
    userId: string,
    conversationId: string,
    departmentId: string,
    reason?: string,
  ): Promise<InboxWebChatListRow> {
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');
    if (conversation.status === 'closed') throw new Error('Conversa encerrada');

    const target = await InboxDepartment.findOne({
      _id: new mongoose.Types.ObjectId(departmentId),
      clientId: new mongoose.Types.ObjectId(clientId),
      isActive: true,
    });
    if (!target) throw new Error('Setor inválido');

    await InboxService.getInstance().assertUserCanTransferToDepartment(
      clientId,
      userId,
      target,
    );

    if (
      conversation.queueStatus === 'with_agent' &&
      conversation.assignedUserId &&
      String(conversation.assignedUserId) !== String(userId)
    ) {
      throw new Error('Conversa em atendimento por outro agente');
    }

    const agent = await User.findById(userId).select('displayName email').lean();
    const agentName = agent?.displayName?.trim() || agent?.email?.split('@')[0] || 'Atendente';
    const customReason = reason?.trim();
    const systemReason =
      customReason ||
      (target.clientVisible !== false
        ? `Transferido para o setor ${target.name} por ${agentName}.`
        : `Transferência interna para ${target.name} por ${agentName}.`);

    await this.escalateToQueue(clientId, conversationId, {
      departmentId,
      reason: systemReason,
    });

    const inboxSettings = await loadInboxSettings(clientId);
    const { contactName, contactIdentifier } = visitorDisplayName(
      conversation.visitorName,
      conversation.visitorEmail,
    );
    const agentMap = new Map([[userId, agentName]]);

    return enrichWebChatInboxRow(
      {
        _id: toWebChatInboxId(String(conversation._id)),
        channel: 'webchat_site',
        contactName,
        contactIdentifier,
        status: 'waiting_queue',
        departmentName: target.name,
        departmentId: String(target._id),
        lastMessageAt: (conversation.lastMessageAt ?? conversation.updatedAt).toISOString(),
        lastMessagePreview: conversation.lastMessagePreview,
      },
      userId,
      clientId,
      agentMap,
      inboxSettings.roundRobinPullTimeoutSeconds ?? 120,
    );
  }

  async reopenConversation(
    clientId: string,
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');
    if (conversation.status === 'open') throw new Error('Conversa já está aberta');

    conversation.status = 'open';
    conversation.queueStatus = 'with_agent';
    conversation.assignedUserId = userId;
    await conversation.save();

    await this.appendMessage(conversation, {
      direction: 'system',
      body: 'Atendimento reaberto. Pode continuar por aqui.',
    });

    const clientIdStr = String(conversation.clientId);
    const convId = String(conversation._id);
    const widget = await WebChatWidget.findById(conversation.widgetId).select('name').lean();
    const dept = conversation.departmentId
      ? await InboxDepartment.findById(conversation.departmentId).select('name').lean()
      : null;
    const conversationDto = this.toConversationDto(conversation, widget?.name, dept?.name);

    emitWebChatToTenant(clientIdStr, 'webchat:conversation', {
      clientId: clientIdStr,
      conversationId: convId,
      conversation: conversationDto,
    });
    emitWebChatToVisitor(convId, 'webchat:conversation', {
      clientId: clientIdStr,
      conversationId: convId,
      conversation: conversationDto,
    });
  }

  async closeConversation(
    clientId: string,
    conversationId: string,
    _userId: string,
    opts?: { skipSystemMessage?: boolean },
  ): Promise<void> {
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');
    if (conversation.status === 'closed') return;

    if (!opts?.skipSystemMessage) {
      await this.appendMessage(conversation, {
        direction: 'system',
        body: 'Atendimento encerrado. Obrigado pelo contato!',
      });
    }

    conversation.status = 'closed';
    conversation.assignedUserId = undefined;
    conversation.suggestedUserId = undefined;
    conversation.suggestedAt = undefined;
    await conversation.save();

    this.emitWebchatWebhook(String(conversation.clientId), 'webchat.conversation.closed', {
      conversation_id: String(conversation._id),
      widget_id: String(conversation.widgetId),
      visitor_name: conversation.visitorName,
      visitor_email: conversation.visitorEmail,
      closed_by_user_id: _userId,
    });

    const clientIdStr = String(conversation.clientId);
    const convId = String(conversation._id);
    const widget = await WebChatWidget.findById(conversation.widgetId).select('name').lean();
    const dept = conversation.departmentId
      ? await InboxDepartment.findById(conversation.departmentId).select('name').lean()
      : null;
    const conversationDto = this.toConversationDto(conversation, widget?.name, dept?.name);

    emitWebChatToTenant(clientIdStr, 'webchat:conversation', {
      clientId: clientIdStr,
      conversationId: convId,
      conversation: conversationDto,
    });
    emitWebChatToVisitor(convId, 'webchat:conversation', {
      clientId: clientIdStr,
      conversationId: convId,
      conversation: conversationDto,
    });
  }
}
