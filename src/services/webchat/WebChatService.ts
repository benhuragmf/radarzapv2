import mongoose from 'mongoose';
import { WebChatWidget, type IWebChatWidget } from '../../models/WebChatWidget';
import { InboxDepartment } from '../../models/InboxDepartment';
import { User } from '../../models/User';
import { ContactGroup } from '../../models/ContactGroup';
import { Destination } from '../../models/Destination';
import { WebChatConversation, type IWebChatConversation } from '../../models/WebChatConversation';
import { WebChatMessage, type IWebChatMessage } from '../../models/WebChatMessage';
import {
  DEFAULT_WEBCHAT_APPEARANCE,
  DEFAULT_WEBCHAT_CONTACT_REASON_OPTIONS,
  DEFAULT_WEBCHAT_PROACTIVE_GREETING_MESSAGE,
  type WebChatConversationDto,
  type WebChatMessageDto,
  type WebChatPublicConfig,
  type WebChatWidgetAppearance,
  type WebChatQueueStatus,
  type WebChatVisitorSessionDto,
  type WebChatVisitorSendResult,
  type WebChatTypingSenderType,
  type WebChatAiEscalationPolicy,
} from '../../types/webchat';
import { normalizeEscalationPolicy } from './webchat-ai-escalation-policy.util';
import {
  applyVisitorIntake,
  buildIntakeSystemNote,
  enabledPrechatFields,
  intakeForAiContext,
  normalizePrechatField,
  resolvePrechatMode,
  syncLegacyAppearanceFlags,
  toPlainAppearance,
} from '../../utils/webchat-prechat-fields.util';
import { isVisitorHiddenSystemMessage } from '../../utils/webchat-visitor-message.util';
import {
  DEFAULT_AUTO_REPLY_MESSAGE,
  shouldSendWebChatAutoReply,
  WEBCHAT_BOT_SENDER_ID,
  WEBCHAT_VISITOR_CLOSE_ID,
} from './webchat-bot.util';
import {
  generateWebChatPublicKey,
  generateWebChatVisitorToken,
  hashWebChatVisitorToken,
  isWebChatOriginAllowed,
} from './webchat-token.util';
import { emitWebChatToTenant, emitWebChatToVisitor, emitWebChatTypingToTenant, emitWebChatTypingToVisitor } from './WebChatRealtime';
import { WebChatAiService } from './WebChatAiService';
import { resolveWebChatBusinessHours } from './webchat-business-hours.util';
import { shouldSendProactiveGreeting, getProactiveGreetingSkipReason } from './webchat-proactive.util';
import type { WebChatMessageRow } from './webchat-ai-triage.util';
import {
  visitorRefusesHumanHandoff,
  visitorWantsToCloseChat,
  WEBCHAT_CLOSE_GOODBYE,
  WEBCHAT_DEESCALATE_REPLY,
} from './webchat-visitor-intent.util';
import { linkWebChatVisitorToDestination, ensureDestinationForWebChatVisitor } from './webchat-destination-link.util';
import type { InboxWeeklySchedule } from '../../types/inbox-settings';
import { WebhookDispatcherService } from '../integrations/WebhookDispatcherService';
import { emitPanelEvent } from '../inbox/PanelNotifications';
import { loadInboxSettings } from '../../constants/inbox-triage';
import { handleWebChatNoAgentOnline } from './webchat-whatsapp-fallback.service';
import {
  deactivateWhatsappBridge,
  forwardVisitorMessageToWhatsappBridge,
} from './webchat-whatsapp-bridge.service';
import { getOnlineAgentIds, isAgentOnline } from '../inbox/inbox-agent-presence';
import {
  expandQuickReply,
  normalizeQuickReplies,
  parseQuickReplyCode,
  type InboxQuickReply,
} from '../../types/inbox-quick-replies';
import {
  getQueuePriorityState,
  isAgentBusyWithClients,
} from '../inbox/inbox-queue-priority';
import { enrichWebChatInboxRow } from './webchat-inbox-enrich.util';
import { createServiceLogger } from '../../utils/logger';
import {
  ensureInboxTicketPublicAccessToken,
  formatTicketCreatedWithTokenMessage,
  lookupTicketByPublicAccess,
} from '../inbox/ticket-public-access.service';
import { InboxTicket } from '../../models/InboxTicket';
import { generateInboxTicketRef } from '../../utils/inbox-ticket-ref';
import { TICKET_CLIENT_REPLY_FOOTER } from '../../types/inbox-ticket';
import { InboxService } from '../inbox/InboxService';
import { parseWebChatAttachment } from './webchat-attachment.util';
import { AiKnowledgeBaseService } from '../ai/AiKnowledgeBaseService';
import { buildWebChatFaqReplyBody } from '../../utils/webchat-faq-reply.util';
import { sanitizeWebChatActionLinks } from '../../utils/webchat-safe-url.util';
import type { WebChatActionLink } from '../../types/webchat';
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
  private serviceLogger = createServiceLogger('WebChatService');

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
      aiEscalationPolicy?: Partial<WebChatAiEscalationPolicy>;
      proactiveGreetingEnabled?: boolean;
      proactiveGreetingMessage?: string;
      proactiveGreetingDelaySeconds?: number;
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
      const merged = {
        ...toPlainAppearance(existing.appearance),
        ...patch.appearance,
      } as WebChatWidgetAppearance;
      if (merged.prechatFields?.length) {
        merged.prechatFields = merged.prechatFields.map(normalizePrechatField);
      }
      existing.appearance = syncLegacyAppearanceFlags(merged);
      existing.markModified('appearance');
    }
    if (patch.autoReplyEnabled !== undefined) existing.autoReplyEnabled = patch.autoReplyEnabled;
    if (patch.autoReplyMessage !== undefined) {
      existing.autoReplyMessage = patch.autoReplyMessage.trim();
    }
    if (patch.autoReplySenderName !== undefined) {
      existing.autoReplySenderName = patch.autoReplySenderName.trim();
    }
    if (patch.autoReplyUseAi !== undefined) existing.autoReplyUseAi = patch.autoReplyUseAi;
    if (patch.aiEscalationPolicy !== undefined) {
      existing.aiEscalationPolicy = normalizeEscalationPolicy(patch.aiEscalationPolicy);
      existing.markModified('aiEscalationPolicy');
    }
    if (patch.proactiveGreetingEnabled !== undefined) {
      existing.proactiveGreetingEnabled = patch.proactiveGreetingEnabled;
    }
    if (patch.proactiveGreetingMessage !== undefined) {
      existing.proactiveGreetingMessage = patch.proactiveGreetingMessage.trim();
    }
    if (patch.proactiveGreetingDelaySeconds !== undefined) {
      const delay = Math.round(Number(patch.proactiveGreetingDelaySeconds));
      existing.proactiveGreetingDelaySeconds = Math.min(300, Math.max(5, delay || 30));
    }
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
    const a = syncLegacyAppearanceFlags(widget.appearance ?? DEFAULT_WEBCHAT_APPEARANCE);
    const hours = await resolveWebChatBusinessHours(String(widget.clientId), widget);
    const prechatFields = enabledPrechatFields(a);
    const faqEnabled = widget.faqInChatEnabled !== false;
    const faqQuickReplies =
      faqEnabled && widget.faqShowQuickReplies !== false
        ? await AiKnowledgeBaseService.getInstance().listQuickReplies(String(widget.clientId))
        : [];
    return {
      publicKey: widget.publicKey,
      title: a.title,
      subtitle: a.subtitle,
      greeting: a.greeting,
      primaryColor: a.primaryColor,
      position: a.position,
      askName: a.askName,
      askPhone: a.askPhone ?? true,
      askContactReason: a.askContactReason ?? true,
      contactReasonOptions:
        a.contactReasonOptions?.length
          ? a.contactReasonOptions
          : [...DEFAULT_WEBCHAT_CONTACT_REASON_OPTIONS],
      askEmail: a.askEmail,
      prechatFields,
      prechatMode: resolvePrechatMode(a),
      theme: a.theme ?? 'light',
      isOnline: hours.isOnline,
      businessHoursEnabled: hours.businessHoursEnabled,
      outsideHoursMessage: hours.outsideHoursMessage,
      scheduleSummary: hours.scheduleSummary,
      proactiveGreetingEnabled: Boolean(widget.proactiveGreetingEnabled),
      proactiveGreetingMessage:
        widget.proactiveGreetingMessage?.trim() || DEFAULT_WEBCHAT_PROACTIVE_GREETING_MESSAGE,
      proactiveGreetingDelaySeconds: widget.proactiveGreetingDelaySeconds ?? 30,
      ticketLookupEnabled: widget.ticketLookupEnabled !== false,
      faqInChatEnabled: faqEnabled,
      faqQuickReplies,
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
      visitorName: conversation.visitorName,
      visitorEmail: conversation.visitorEmail,
      visitorPhone: conversation.visitorPhone,
      contactReason: conversation.contactReason,
      pageTitle: conversation.pageTitle,
      visitorIntake: conversation.visitorIntake,
      messages: messages
        .filter(m => {
          const dir = (m as IWebChatMessage).direction;
          if (dir === 'internal') return false;
          return !isVisitorHiddenSystemMessage(m as { direction: string; body: string });
        })
        .map(m => this.toMessageDto(m)),
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
      actionLinks: m.actionLinks?.length ? sanitizeWebChatActionLinks(m.actionLinks) : undefined,
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
      visitorPhone: c.visitorPhone,
      contactReason: c.contactReason,
      pageUrl: c.pageUrl,
      pageTitle: c.pageTitle,
      visitorIntake: c.visitorIntake as Record<string, string> | undefined,
      userAgent: c.userAgent,
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
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
      visitorPhone?: string;
      contactReason?: string;
      visitorIntake?: Record<string, string>;
      pageUrl?: string;
      pageTitle?: string;
      userAgent?: string;
      origin?: string | null;
      referer?: string | null;
      skipInitialGreeting?: boolean;
    },
  ): Promise<{
    visitorToken: string;
    conversationId: string;
    queueStatus: WebChatQueueStatus;
    departmentName?: string;
    visitorName?: string;
    visitorEmail?: string;
    visitorPhone?: string;
    contactReason?: string;
    visitorIntake?: Record<string, string>;
    messages: WebChatMessageDto[];
  }> {
    const widget = await this.getActiveWidgetByPublicKey(publicKey);
    if (!widget) throw new Error('Widget não encontrado');

    this.assertOrigin(widget, opts.origin, opts.referer);

    const intakeRaw: Record<string, string | undefined> = {
      ...(opts.visitorIntake ?? {}),
    };
    if (opts.visitorName?.trim()) intakeRaw.name = opts.visitorName.trim();
    if (opts.visitorEmail?.trim()) intakeRaw.email = opts.visitorEmail.trim();
    if (opts.visitorPhone?.trim()) intakeRaw.phone = opts.visitorPhone.trim();
    if (opts.contactReason?.trim()) intakeRaw.contact_reason = opts.contactReason.trim();
    const applied = applyVisitorIntake(intakeRaw, widget.appearance);
    const destinationId = await linkWebChatVisitorToDestination(
      String(widget.clientId),
      applied,
      { pageUrl: opts.pageUrl, pageTitle: opts.pageTitle },
    );

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
        visitorName: applied.visitorName,
        visitorEmail: applied.visitorEmail,
        visitorPhone: applied.visitorPhone,
        contactReason: applied.contactReason,
        visitorIntake: applied.visitorIntake,
        pageUrl: opts.pageUrl?.trim() || undefined,
        pageTitle: opts.pageTitle?.trim() || undefined,
        userAgent: opts.userAgent?.trim() || undefined,
        destinationId,
        status: 'open',
        queueStatus: 'bot',
        unreadAgentCount: 0,
      });

      const greeting = widget.appearance?.greeting?.trim();
      if (greeting && !opts.skipInitialGreeting) {
        await this.appendMessage(conversation, {
          direction: 'system',
          body: greeting,
          notifyVisitor: false,
        });
      }

      const intakeNote = buildIntakeSystemNote(applied.visitorIntake, widget.appearance, {
        url: opts.pageUrl,
        title: opts.pageTitle,
      });
      if (intakeNote) {
        await this.appendMessage(conversation, {
          direction: 'system',
          body: intakeNote,
          notifyVisitor: false,
        });
      }
    } else {
      const patch: Partial<IWebChatConversation> = {};
      if (applied.visitorName) patch.visitorName = applied.visitorName;
      if (applied.visitorEmail) patch.visitorEmail = applied.visitorEmail;
      if (applied.visitorPhone) patch.visitorPhone = applied.visitorPhone;
      if (applied.contactReason) patch.contactReason = applied.contactReason;
      if (Object.keys(applied.visitorIntake).length) {
        patch.visitorIntake = { ...(conversation.visitorIntake ?? {}), ...applied.visitorIntake };
      }
      if (opts.pageUrl?.trim()) patch.pageUrl = opts.pageUrl.trim();
      if (opts.pageTitle?.trim()) patch.pageTitle = opts.pageTitle.trim();
      if (destinationId) patch.destinationId = destinationId;
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
      visitorName: session.visitorName,
      visitorEmail: session.visitorEmail,
      visitorPhone: session.visitorPhone,
      contactReason: session.contactReason,
      visitorIntake: session.visitorIntake,
      messages: session.messages,
    };
  }

  private async aiContextFromConversation(
    conversation: IWebChatConversation,
    widget?: IWebChatWidget | null,
  ) {
    const w =
      widget ??
      (await WebChatWidget.findById(conversation.widgetId).lean());
    const intake: Record<string, string> = { ...(conversation.visitorIntake ?? {}) };
    if (!intake.name && conversation.visitorName?.trim()) {
      intake.name = conversation.visitorName.trim();
    }
    if (!intake.email && conversation.visitorEmail?.trim()) {
      intake.email = conversation.visitorEmail.trim();
    }
    if (!intake.phone && conversation.visitorPhone?.trim()) {
      intake.phone = conversation.visitorPhone.trim();
    }
    if (!intake.contact_reason && conversation.contactReason?.trim()) {
      intake.contact_reason = conversation.contactReason.trim();
    }
    return intakeForAiContext(intake, w?.appearance, {
      url: conversation.pageUrl,
      title: conversation.pageTitle,
    });
  }

  async triggerProactiveGreeting(
    publicKey: string,
    opts: {
      visitorToken?: string;
      pageUrl?: string;
      userAgent?: string;
      origin?: string | null;
      referer?: string | null;
    },
  ): Promise<{
    visitorToken: string;
    conversationId: string;
    sent: boolean;
    skipReason?: string;
    messages: WebChatMessageDto[];
  }> {
    const widget = await this.getActiveWidgetByPublicKey(publicKey);
    if (!widget) throw new Error('Widget não encontrado');

    this.assertOrigin(widget, opts.origin, opts.referer);

    const session = await this.createOrResumeSession(publicKey, {
      ...opts,
      skipInitialGreeting: true,
    });

    const conversation = await WebChatConversation.findById(session.conversationId);
    if (!conversation) throw new Error('Conversa não encontrada');

    const inboundCount = await WebChatMessage.countDocuments({
      conversationId: conversation._id,
      direction: 'inbound',
    });
    const outboundCount = await WebChatMessage.countDocuments({
      conversationId: conversation._id,
      direction: 'outbound',
    });

    const skipReason = getProactiveGreetingSkipReason({
      proactiveGreetingEnabled: Boolean(widget.proactiveGreetingEnabled),
      proactiveGreetingMessage: widget.proactiveGreetingMessage,
      proactiveGreetingSentAt: conversation.proactiveGreetingSentAt,
      hasVisitorInbound: inboundCount > 0,
      outboundCount,
    });

    if (skipReason) {
      return {
        visitorToken: session.visitorToken,
        conversationId: session.conversationId,
        sent: false,
        skipReason,
        messages: session.messages,
      };
    }

    const body = (widget.proactiveGreetingMessage || DEFAULT_WEBCHAT_PROACTIVE_GREETING_MESSAGE).trim();
    const senderName =
      widget.autoReplySenderName?.trim() ||
      widget.appearance?.title?.trim() ||
      'Atendimento';

    await this.appendMessage(conversation, {
      direction: 'outbound',
      body,
      senderName,
      senderUserId: WEBCHAT_BOT_SENDER_ID,
      notifyVisitor: true,
    });

    conversation.proactiveGreetingSentAt = new Date();
    await conversation.save();

    const messages = await WebChatMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    return {
      visitorToken: session.visitorToken,
      conversationId: session.conversationId,
      sent: true,
      messages: messages.map(m => this.toMessageDto(m)),
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
      hasTicket?: boolean;
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

    if (filters.hasTicket === true) {
      query.ticketRef = { $exists: true, $nin: [null, ''] };
    } else if (filters.hasTicket === false) {
      const noTicketClause = {
        $or: [{ ticketRef: { $exists: false } }, { ticketRef: null }, { ticketRef: '' }],
      };
      if (query.$and) {
        (query.$and as unknown[]).push(noTicketClause);
      } else if (query.$or) {
        query.$and = [{ $or: query.$or as unknown[] }, noTicketClause];
        delete query.$or;
      } else {
        Object.assign(query, noTicketClause);
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
        r.visitorPhone,
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
        ticketRef: r.ticketRef?.trim() || undefined,
        whatsappBridgeActive: Boolean(r.whatsappBridgeActive),
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
      direction: 'inbound' | 'outbound' | 'system' | 'internal';
      body: string;
      createdAt: string;
      senderName?: string;
    }>;
    transfers: [];
    contactStats?: undefined;
    previousConversations?: [];
    contact: {
      _id: string;
      name: string;
      email: string;
      notes: string;
      organization: string;
      identifier: string;
      contactGroupIds: string[];
    } | null;
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
      convDoc.visitorPhone,
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
        destinationId: convDoc.destinationId ? String(convDoc.destinationId) : undefined,
        visitorPhone: convDoc.visitorPhone,
        contactReason: convDoc.contactReason,
        visitorIntake: convDoc.visitorIntake as Record<string, string> | undefined,
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
        ticketRef: convDoc.ticketRef?.trim() || undefined,
        whatsappBridgeActive: Boolean(convDoc.whatsappBridgeActive),
        priorityForMe: false,
        canAccept: false,
        canPull: false,
      },
      userId,
      clientId,
      agentMap,
      pullTimeoutSeconds,
    );

    const destination = convDoc.destinationId
      ? await Destination.findOne({
          _id: convDoc.destinationId,
          clientId: new mongoose.Types.ObjectId(clientId),
        })
          .select('name email notes organization identifier contactGroupIds')
          .lean()
      : null;

    const visitorContact = destination
      ? null
      : this.buildVisitorProfileContact(convDoc);

    return {
      conversation: { ...conversation, createdAt: convDoc.createdAt.toISOString(), ticketRef: convDoc.ticketRef?.trim() || undefined },
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
      contact: destination
        ? {
            _id: String(destination._id),
            name: destination.name,
            email: destination.email ?? '',
            notes: destination.notes ?? '',
            organization: destination.organization ?? '',
            identifier: destination.identifier,
            contactGroupIds: (destination.contactGroupIds ?? []).map(String),
          }
        : visitorContact,
      quickReplies: normalizeQuickReplies(inboxSettings.quickReplies),
    };
  }

  private buildVisitorProfileContact(convDoc: {
    visitorName?: string;
    visitorEmail?: string;
    visitorPhone?: string;
    visitorIntake?: Record<string, string>;
  }) {
    const phone = convDoc.visitorPhone?.trim() || convDoc.visitorIntake?.phone?.trim() || '';
    const email = convDoc.visitorEmail?.trim() || convDoc.visitorIntake?.email?.trim() || '';
    const name =
      convDoc.visitorName?.trim() ||
      convDoc.visitorIntake?.name?.trim() ||
      email ||
      phone ||
      '';
    if (!name && !phone && !email) return null;
    return {
      _id: '',
      name: name || 'Visitante',
      email,
      notes: '',
      organization: '',
      identifier: phone || email,
      contactGroupIds: [] as string[],
    };
  }

  /** Atualiza perfil do visitante (contato CRM + campos da conversa WebChat). */
  async updateVisitorProfileFromInbox(
    clientId: string,
    _userId: string,
    conversationId: string,
    data: {
      name: string;
      identifier?: string;
      email?: string;
      organization?: string;
      notes?: string;
      contactGroupIds?: string[];
    },
  ) {
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');

    const name = data.name.trim();
    if (!name) throw new Error('Nome é obrigatório');

    conversation.visitorName = name.slice(0, 120);
    if (data.email !== undefined) {
      conversation.visitorEmail = data.email.trim().toLowerCase().slice(0, 200) || undefined;
    }
    const phoneInput = data.identifier?.trim() || conversation.visitorPhone?.trim();
    if (phoneInput) {
      conversation.visitorPhone = phoneInput.slice(0, 40);
    }

    let destinationId = conversation.destinationId;

    if (destinationId) {
      const dest = await Destination.findOne({
        _id: destinationId,
        clientId: conversation.clientId,
      });
      if (!dest) throw new Error('Contato vinculado não encontrado');
      dest.name = name.slice(0, 100);
      if (data.email !== undefined) dest.email = data.email.trim() || undefined;
      if (data.notes !== undefined) dest.notes = data.notes.trim() || undefined;
      if (data.organization !== undefined) dest.organization = data.organization.trim() || undefined;
      if (data.contactGroupIds !== undefined) {
        if (!Array.isArray(data.contactGroupIds)) {
          throw new Error('contactGroupIds deve ser um array');
        }
        const validGroups = await ContactGroup.find({
          clientId: conversation.clientId,
          _id: { $in: data.contactGroupIds.filter(Boolean) },
        }).select('_id');
        const validIds = new Set(validGroups.map(g => String(g._id)));
        dest.contactGroupIds = data.contactGroupIds
          .filter(id => validIds.has(String(id)))
          .map(id => new mongoose.Types.ObjectId(id));
      }
      await dest.save();
    } else if (phoneInput) {
      const ensured = await ensureDestinationForWebChatVisitor(clientId, phoneInput, name, {
        email: data.email,
        notes: data.notes,
        organization: data.organization,
      });
      if (!ensured) {
        throw new Error(
          'Informe o número com DDI internacional (ex: +5511999999999 ou +351912345678).',
        );
      }
      destinationId = ensured;
      conversation.destinationId = ensured;

      const dest = await Destination.findById(ensured);
      if (dest) {
        if (data.notes !== undefined) dest.notes = data.notes.trim() || undefined;
        if (data.organization !== undefined) dest.organization = data.organization.trim() || undefined;
        if (data.contactGroupIds !== undefined && Array.isArray(data.contactGroupIds)) {
          const validGroups = await ContactGroup.find({
            clientId: conversation.clientId,
            _id: { $in: data.contactGroupIds.filter(Boolean) },
          }).select('_id');
          const validIds = new Set(validGroups.map(g => String(g._id)));
          dest.contactGroupIds = data.contactGroupIds
            .filter(id => validIds.has(String(id)))
            .map(id => new mongoose.Types.ObjectId(id));
        }
        await dest.save();
      }
    }

    await conversation.save();

    if (destinationId) {
      const dest = await Destination.findById(destinationId)
        .select('name email notes organization identifier contactGroupIds')
        .lean();
      if (dest) {
        return {
          contact: {
            _id: String(dest._id),
            name: dest.name,
            email: dest.email ?? '',
            notes: dest.notes ?? '',
            organization: dest.organization ?? '',
            identifier: dest.identifier,
            contactGroupIds: (dest.contactGroupIds ?? []).map(String),
          },
        };
      }
    }

    return {
      contact: this.buildVisitorProfileContact(conversation),
    };
  }

  /** Converte conversa do chat do site em chamado (paridade com WhatsApp no Inbox). */
  async convertToTicket(
    clientId: string,
    userId: string,
    conversationId: string,
  ): Promise<{
    ticketRef: string;
    ticketStatus: string;
    notifiedClient: boolean;
    ok: boolean;
  }> {
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');
    if (conversation.status === 'closed') throw new Error('Conversa encerrada');

    const clientOid = conversation.clientId;
    const ref = (conversation.ticketRef ?? generateInboxTicketRef()).trim().toUpperCase();

    if (!conversation.ticketRef) {
      conversation.ticketRef = ref;
      await conversation.save();
    }

    const { contactName, contactIdentifier } = visitorDisplayName(
      conversation.visitorName,
      conversation.visitorEmail,
      conversation.visitorPhone,
    );

    const agent = await User.findById(userId).select('displayName email').lean();
    const agentName = agent?.displayName?.trim() || agent?.email?.split('@')[0] || 'Atendente';

    let ticket = await InboxTicket.findOne({ clientId: clientOid, ticketRef: ref });
    let created = false;

    if (!ticket) {
      const assignedOid =
        conversation.assignedUserId &&
        mongoose.Types.ObjectId.isValid(conversation.assignedUserId)
          ? new mongoose.Types.ObjectId(conversation.assignedUserId)
          : undefined;

      ticket = await InboxTicket.create({
        clientId: clientOid,
        ticketRef: ref,
        channel: 'webchat_site',
        webChatConversationId: conversation._id,
        ...(conversation.destinationId ? { destinationId: conversation.destinationId } : {}),
        contactName,
        contactIdentifier,
        ...(conversation.departmentId ? { departmentId: conversation.departmentId } : {}),
        ...(assignedOid ? { assignedUserId: assignedOid } : {}),
        status: assignedOid ? 'in_progress' : 'open',
        openedByUserId: new mongoose.Types.ObjectId(userId),
        teamHasMessagedClient: true,
      });
      created = true;
    }

    let publicAccessToken: string | undefined;
    if (created) {
      const access = await ensureInboxTicketPublicAccessToken(ticket);
      publicAccessToken = access.token || undefined;
    }

    const dept = conversation.departmentId
      ? await InboxDepartment.findById(conversation.departmentId).select('name').lean()
      : null;

    let assignedName: string | undefined;
    if (conversation.assignedUserId) {
      const assignee = await User.findById(conversation.assignedUserId)
        .select('displayName email')
        .lean();
      assignedName =
        assignee?.displayName?.trim() || assignee?.email?.split('@')[0] || 'Atendente';
    }

    if (created) {
      const tokenBlock =
        publicAccessToken && formatTicketCreatedWithTokenMessage(ref, publicAccessToken);
      const body = [
        `📋 Chamado aberto — *${ref}*`,
        '',
        `Olá *${contactName}*!`,
        '',
        tokenBlock || `Registramos sua solicitação. Guarde a referência *${ref}* para acompanhar.`,
        dept?.name ? `Setor: ${dept.name}` : null,
        assignedName ? `Responsável: ${assignedName}` : null,
        `Aberto por: ${agentName}`,
        '',
        TICKET_CLIENT_REPLY_FOOTER,
      ]
        .filter((line): line is string => Boolean(line))
        .join('\n');

      await this.appendMessage(conversation, {
        direction: 'system',
        body,
        notifyVisitor: true,
      });
    } else {
      await this.appendMessage(conversation, {
        direction: 'system',
        body: `Chamado *${ref}* já estava aberto — acompanhe em Chamados no painel.`,
        notifyVisitor: false,
      });
    }

    return {
      ticketRef: ref,
      ticketStatus: ticket.status,
      notifiedClient: created,
      ok: true,
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
      const display = visitorDisplayName(conv.visitorName, conv.visitorEmail, conv.visitorPhone);
      const enriched = await enrichWebChatInboxRow(
        {
          _id: toWebChatInboxId(String(conv._id)),
          channel: 'webchat_site',
          contactName: display.contactName,
          contactIdentifier: display.contactIdentifier,
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
      direction: 'inbound' | 'outbound' | 'system' | 'internal';
      body: string;
      senderUserId?: string;
      senderName?: string;
      notifyVisitor?: boolean;
      mediaType?: WebChatMessageMediaType;
      mediaUrl?: string;
      mediaMime?: string;
      mediaFileName?: string;
      actionLinks?: WebChatActionLink[];
    },
  ): Promise<IWebChatMessage> {
    const isInternal = data.direction === 'internal';
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
      ...(data.actionLinks?.length
        ? { actionLinks: sanitizeWebChatActionLinks(data.actionLinks) }
        : {}),
    });

    const unreadDelta = data.direction === 'inbound' ? 1 : 0;
    const currentStatus = await WebChatConversation.findById(conversation._id)
      .select('status')
      .lean();
    const setFields: Record<string, unknown> = {
      lastMessageAt: now,
    };
    if (!isInternal) {
      setFields.lastMessagePreview = preview;
    }
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
    if (!isInternal && data.notifyVisitor !== false) {
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

  /** Mensagem de sistema visível (ex.: ativação do bridge WhatsApp). */
  async appendBridgeSystemMessage(
    conversation: IWebChatConversation,
    body: string,
  ): Promise<IWebChatMessage> {
    return this.appendMessage(conversation, {
      direction: 'system',
      body,
      notifyVisitor: false,
    });
  }

  emitTypingIndicator(input: {
    clientId: string;
    conversationId: string;
    typing: boolean;
    senderType: WebChatTypingSenderType;
    senderName?: string;
  }): void {
    const payload = {
      clientId: input.clientId,
      conversationId: input.conversationId,
      typing: input.typing,
      senderType: input.senderType,
      senderName: input.senderName,
    };
    if (input.senderType === 'visitor') {
      emitWebChatTypingToTenant(input.clientId, payload);
      return;
    }
    emitWebChatTypingToVisitor(input.conversationId, payload);
  }

  async relayAgentTyping(
    clientId: string,
    userId: string,
    conversationId: string,
    typing: boolean,
    senderName?: string,
  ): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) return;

    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    })
      .select('status')
      .lean();
    if (!conversation || conversation.status === 'closed') return;

    let name = senderName?.trim();
    if (!name) {
      const user = await User.findById(userId).select('displayName').lean();
      name = user?.displayName?.trim() || 'Atendente';
    }

    this.emitTypingIndicator({
      clientId,
      conversationId,
      typing,
      senderType: 'agent',
      senderName: name,
    });
  }

  async setVisitorTyping(
    visitorToken: string,
    typing: boolean,
    origin?: string | null,
    referer?: string | null,
  ): Promise<void> {
    const conversation = await this.resolveVisitorToken(visitorToken);
    if (!conversation || conversation.status === 'closed') return;

    const widget = await WebChatWidget.findById(conversation.widgetId);
    if (!widget?.active) return;

    this.assertOrigin(widget, origin, referer);

    this.emitTypingIndicator({
      clientId: String(conversation.clientId),
      conversationId: String(conversation._id),
      typing,
      senderType: 'visitor',
    });
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

  async closeVisitorConversation(
    visitorToken: string,
    origin?: string | null,
    referer?: string | null,
  ): Promise<void> {
    const conversation = await this.resolveVisitorToken(visitorToken);
    if (!conversation) throw new Error('Sessão inválida ou encerrada');

    const widget = await WebChatWidget.findById(conversation.widgetId);
    if (!widget?.active) throw new Error('Widget inativo');
    this.assertOrigin(widget, origin, referer);

    await this.closeConversation(
      String(conversation.clientId),
      String(conversation._id),
      WEBCHAT_VISITOR_CLOSE_ID,
    );
  }

  async sendVisitorMessage(
    visitorToken: string,
    body: string,
    origin?: string | null,
    referer?: string | null,
  ): Promise<WebChatVisitorSendResult> {
    const text = body?.trim();
    if (!text) throw new Error('Mensagem vazia');

    const conversation = await this.resolveVisitorToken(visitorToken);
    if (!conversation) throw new Error('Sessão inválida ou encerrada');

    const widget = await WebChatWidget.findById(conversation.widgetId);
    if (!widget?.active) throw new Error('Widget inativo');

    this.assertOrigin(widget, origin, referer);

    const clientIdStr = String(conversation.clientId);
    const convId = String(conversation._id);
    this.emitTypingIndicator({
      clientId: clientIdStr,
      conversationId: convId,
      typing: false,
      senderType: 'visitor',
    });

    const msg = await this.appendMessage(conversation, {
      direction: 'inbound',
      body: text,
    });

    const replies: WebChatMessageDto[] = [];
    const messageRows: WebChatMessageRow[] = (
      await WebChatMessage.find({ conversationId: conversation._id })
        .sort({ createdAt: 1 })
        .limit(24)
        .lean()
    ).map(m => ({
      direction: m.direction as WebChatMessageRow['direction'],
      body: m.body,
    }));

    const freshAfterInbound = await WebChatConversation.findById(conversation._id);
    if (!freshAfterInbound || freshAfterInbound.status === 'closed') {
      return { message: this.toMessageDto(msg), replies };
    }

    if (freshAfterInbound.whatsappBridgeActive) {
      await forwardVisitorMessageToWhatsappBridge(freshAfterInbound, text);
      this.emitWebchatWebhook(clientIdStr, 'webchat.message.received', {
        conversation_id: String(conversation._id),
        message_id: String(msg._id),
        body: text,
        visitor_name: conversation.visitorName,
        visitor_email: conversation.visitorEmail,
        widget_id: String(conversation.widgetId),
        page_url: conversation.pageUrl,
        queue_status: freshAfterInbound.queueStatus ?? 'bot',
      });
      return { message: this.toMessageDto(msg), replies: [] };
    }

    const intentReply = await this.handleVisitorIntentMessages(
      freshAfterInbound,
      widget,
      text,
      messageRows,
    );
    if (intentReply.handled) {
      const clientIdStr = String(conversation.clientId);
      this.emitWebchatWebhook(clientIdStr, 'webchat.message.received', {
        conversation_id: String(conversation._id),
        message_id: String(msg._id),
        body: text,
        visitor_name: conversation.visitorName,
        visitor_email: conversation.visitorEmail,
        widget_id: String(conversation.widgetId),
        page_url: conversation.pageUrl,
        queue_status: freshAfterInbound.queueStatus ?? 'bot',
      });
      return { message: this.toMessageDto(msg), replies: intentReply.replies };
    }

    const hours = await resolveWebChatBusinessHours(String(widget.clientId), widget);
    const faqReply = await this.tryFaqAutoReply(freshAfterInbound, widget, text);
    if (faqReply) {
      replies.push(faqReply);
    } else if (!hours.isOnline && hours.businessHoursEnabled) {
      const systemMsg = await this.appendMessage(conversation, {
        direction: 'system',
        body: hours.outsideHoursMessage,
      });
      replies.push(this.toMessageDto(systemMsg));
    } else {
      replies.push(...(await this.maybeAutoReply(conversation, widget)));
    }

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

    return { message: this.toMessageDto(msg), replies };
  }

  async sendVisitorAttachment(
    visitorToken: string,
    input: { dataBase64: string; mimeType?: string; fileName?: string; caption?: string },
    origin?: string | null,
    referer?: string | null,
  ): Promise<WebChatVisitorSendResult> {
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

    const replies: WebChatMessageDto[] = [];
    const freshAfterInbound = await WebChatConversation.findById(conversation._id);
    if (freshAfterInbound?.whatsappBridgeActive) {
      const mediaLabel =
        parsed.mediaType === 'image'
          ? `📎 Imagem${parsed.body ? `: ${parsed.body}` : ''}`
          : `📎 PDF${parsed.body ? `: ${parsed.body}` : ''}`;
      await forwardVisitorMessageToWhatsappBridge(freshAfterInbound, parsed.body, { mediaLabel });
      return { message: this.toMessageDto(msg), replies: [] };
    }

    const hours = await resolveWebChatBusinessHours(clientIdStr, widget);
    if (!hours.isOnline && hours.businessHoursEnabled) {
      const systemMsg = await this.appendMessage(conversation, {
        direction: 'system',
        body: hours.outsideHoursMessage,
      });
      replies.push(this.toMessageDto(systemMsg));
    } else {
      replies.push(...(await this.maybeAutoReply(conversation, widget)));
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

    return { message: this.toMessageDto(msg), replies };
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

  private async handleVisitorIntentMessages(
    conversation: IWebChatConversation,
    widget: IWebChatWidget,
    text: string,
    messageRows: WebChatMessageRow[],
  ): Promise<{ handled: boolean; replies: WebChatMessageDto[] }> {
    const replies: WebChatMessageDto[] = [];
    const senderName = widget.autoReplySenderName?.trim() || 'Assistente virtual';
    const clientId = String(conversation.clientId);
    const convId = String(conversation._id);

    if (visitorWantsToCloseChat(text)) {
      const goodbye = await this.appendMessage(conversation, {
        direction: 'outbound',
        body: WEBCHAT_CLOSE_GOODBYE,
        senderUserId: WEBCHAT_BOT_SENDER_ID,
        senderName,
      });
      replies.push(this.toMessageDto(goodbye));
      await this.closeConversation(clientId, convId, WEBCHAT_BOT_SENDER_ID, {
        skipSystemMessage: true,
      });
      return { handled: true, replies };
    }

    if (visitorRefusesHumanHandoff(text, messageRows)) {
      await this.deescalateFromQueue(clientId, convId);
      const reply = await this.appendMessage(conversation, {
        direction: 'outbound',
        body: WEBCHAT_DEESCALATE_REPLY,
        senderUserId: WEBCHAT_BOT_SENDER_ID,
        senderName,
      });
      replies.push(this.toMessageDto(reply));
      return { handled: true, replies };
    }

    return { handled: false, replies };
  }

  private async deescalateFromQueue(clientId: string, conversationId: string): Promise<void> {
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation || conversation.status === 'closed') return;
    if (conversation.queueStatus === 'bot') return;

    conversation.queueStatus = 'bot';
    conversation.escalatedAt = undefined;
    conversation.queueEnteredAt = undefined;
    conversation.suggestedUserId = undefined;
    conversation.suggestedAt = undefined;
    await conversation.save();

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

  private async tryFaqAutoReply(
    conversation: IWebChatConversation,
    widget: IWebChatWidget,
    query: string,
  ): Promise<WebChatMessageDto | null> {
    if (widget.faqInChatEnabled === false) return null;

    const fresh = await WebChatConversation.findById(conversation._id);
    if (!fresh || fresh.status === 'closed') return null;
    if (fresh.queueStatus === 'with_agent' && fresh.assignedUserId) return null;

    const match = await AiKnowledgeBaseService.getInstance().matchForWebChat(
      String(conversation.clientId),
      query,
    );
    if (!match) return null;

    const links = sanitizeWebChatActionLinks(match.row.links ?? []);
    const body = buildWebChatFaqReplyBody(match.row.content);
    if (!body) return null;

    const botMsg = await this.appendMessage(fresh, {
      direction: 'outbound',
      body,
      senderUserId: WEBCHAT_BOT_SENDER_ID,
      senderName: widget.autoReplySenderName?.trim() || 'Assistente',
      actionLinks: links,
    });
    return this.toMessageDto(botMsg);
  }

  private async maybeAutoReply(
    conversation: IWebChatConversation,
    widget: IWebChatWidget,
  ): Promise<WebChatMessageDto[]> {
    const replies: WebChatMessageDto[] = [];
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
    if (!fresh || fresh.status === 'closed') return replies;

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
      return replies;
    }

    let body = (widget.autoReplyMessage ?? DEFAULT_AUTO_REPLY_MESSAGE).trim();
    let senderName = widget.autoReplySenderName?.trim() || 'Assistente virtual';
    let shouldEscalate = false;

    if (widget.autoReplyUseAi) {
      const aiCtx = await this.aiContextFromConversation(fresh, widget);
      const clientIdStr = String(conversation.clientId);
      const convId = String(conversation._id);
      this.emitTypingIndicator({
        clientId: clientIdStr,
        conversationId: convId,
        typing: true,
        senderType: 'bot',
        senderName,
      });
      const typingStartedAt = Date.now();
      let ai: Awaited<ReturnType<WebChatAiService['generateVisitorReply']>> = null;
      try {
        ai = await WebChatAiService.getInstance().generateVisitorReply(
          clientIdStr,
          convId,
          {
            ...aiCtx,
            escalationPolicy: normalizeEscalationPolicy(widget.aiEscalationPolicy),
          },
        );
      } finally {
        const minVisibleMs = 900;
        const elapsed = Date.now() - typingStartedAt;
        if (elapsed < minVisibleMs) {
          await new Promise(resolve => setTimeout(resolve, minVisibleMs - elapsed));
        }
        this.emitTypingIndicator({
          clientId: clientIdStr,
          conversationId: convId,
          typing: false,
          senderType: 'bot',
          senderName,
        });
      }
      if (ai) {
        body = ai.body;
        senderName = ai.senderName;
        shouldEscalate = Boolean(ai.shouldEscalate);
      } else {
        this.serviceLogger.warn('WebChat IA indisponível — usando mensagem fixa', {
          conversationId: String(conversation._id),
          clientId: String(conversation.clientId),
        });
      }
    }

    const botMsg = await this.appendMessage(fresh, {
      direction: 'outbound',
      body,
      senderUserId: WEBCHAT_BOT_SENDER_ID,
      senderName,
    });
    replies.push(this.toMessageDto(botMsg));

    if (shouldEscalate) {
      await this.escalateToQueue(String(fresh.clientId), String(fresh._id), {
        reason: 'A IA identificou que um atendente humano deve assumir esta conversa.',
      });
    }

    return replies;
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
      } else if (await this.isNoAgentOnlineForEscalation(clientId, departmentOid, rr)) {
        const { visitorMessage } = await handleWebChatNoAgentOnline(clientId, conversation, {
          departmentName: dept?.name,
        });
        await this.appendMessage(conversation, {
          direction: 'system',
          body: visitorMessage,
        });
      }
    } else if (await this.isNoAgentOnlineForEscalation(clientId, undefined, null)) {
      const { visitorMessage } = await handleWebChatNoAgentOnline(clientId, conversation);
      await this.appendMessage(conversation, {
        direction: 'system',
        body: visitorMessage,
      });
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

  private async isNoAgentOnlineForEscalation(
    clientId: string,
    departmentOid: mongoose.Types.ObjectId | undefined,
    rr: Awaited<ReturnType<InboxService['suggestRoundRobinAgent']>> | null,
  ): Promise<boolean> {
    if (rr?.kind === 'no_online') return true;
    if (rr?.kind === 'suggested') return false;
    if (departmentOid) {
      const settings = await loadInboxSettings(clientId);
      if (settings.roundRobinEnabled) return false;
    }
    const online = getOnlineAgentIds(clientId).filter(uid => isAgentOnline(clientId, uid));
    return online.length === 0;
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
        conversation.visitorPhone,
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
    const display = visitorDisplayName(
      conversation.visitorName,
      conversation.visitorEmail,
      conversation.visitorPhone,
    );
    return enrichWebChatInboxRow(
      {
        _id: toWebChatInboxId(String(conversation._id)),
        channel: 'webchat_site',
        contactName: display.contactName,
        contactIdentifier: display.contactIdentifier,
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

  async sendInternalChatMessage(
    clientId: string,
    userId: string,
    conversationId: string,
    body: string,
    senderName?: string,
    opts?: { canSupervise?: boolean },
  ): Promise<WebChatMessageDto> {
    const raw = body?.trim();
    if (!raw) throw new Error('Mensagem vazia');

    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');
    if (conversation.status === 'closed') throw new Error('Conversa encerrada');

    const canSupervise = opts?.canSupervise === true;
    const assignedId = conversation.assignedUserId
      ? String(conversation.assignedUserId)
      : '';
    if (!canSupervise) {
      if (conversation.queueStatus !== 'with_agent') {
        throw new Error('Assuma a conversa para usar o chat interno');
      }
      if (!assignedId || assignedId !== String(userId)) {
        throw new Error('Somente o atendente responsável ou supervisor pode enviar no chat interno');
      }
    }

    let authorName = senderName?.trim();
    if (!authorName) {
      const user = await User.findById(userId).select('displayName email').lean();
      authorName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Equipe';
    }

    const msg = await this.appendMessage(conversation, {
      direction: 'internal',
      body: raw,
      senderUserId: userId,
      senderName: authorName,
      notifyVisitor: false,
    });

    return this.toMessageDto(msg);
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
      conversation.visitorPhone,
    );
    const quickCode = parseQuickReplyCode(raw);
    const text = expandQuickReply(raw, quickReplies, contactName);

    this.emitTypingIndicator({
      clientId,
      conversationId,
      typing: false,
      senderType: 'agent',
      senderName: senderName?.trim() || 'Atendente',
    });

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
      conversation.visitorPhone,
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

  /** Desativa bridge WhatsApp sem fechar chamado/conversa (comando !encerrarchat). */
  async endWhatsappBridgeOnly(
    clientId: string,
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');
    if (conversation.status === 'closed') {
      throw new Error('Conversa já está encerrada.');
    }
    if (!conversation.whatsappBridgeActive) {
      throw new Error('Bridge WhatsApp não está ativo neste chamado.');
    }

    await deactivateWhatsappBridge(clientId, conversationId);

    const agent = await User.findById(userId).select('displayName email').lean();
    const agentName = agent?.displayName?.trim() || agent?.email?.split('@')[0] || 'Atendente';

    await this.appendMessage(conversation, {
      direction: 'system',
      body: `${agentName} encerrou o atendimento via WhatsApp. O chamado permanece aberto — você pode continuar aqui no chat ou aguardar retorno.`,
      senderUserId: userId,
      senderName: agentName,
    });

    const reloaded = await WebChatConversation.findById(conversation._id);
    if (!reloaded) return;

    const clientIdStr = String(reloaded.clientId);
    const convId = String(reloaded._id);
    const widget = await WebChatWidget.findById(reloaded.widgetId).select('name').lean();
    const dept = reloaded.departmentId
      ? await InboxDepartment.findById(reloaded.departmentId).select('name').lean()
      : null;
    const conversationDto = this.toConversationDto(reloaded, widget?.name, dept?.name);

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

    if (conversation.whatsappBridgeActive) {
      await deactivateWhatsappBridge(clientId, conversationId);
    }

    conversation.status = 'closed';
    conversation.assignedUserId = undefined;
    conversation.suggestedUserId = undefined;
    conversation.suggestedAt = undefined;
    await conversation.save();

    if (!opts?.skipSystemMessage) {
      await this.appendMessage(conversation, {
        direction: 'system',
        body: 'Atendimento encerrado. Obrigado pelo contato!',
      });
    }

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

  async lookupTicketPublic(
    publicKey: string,
    opts: {
      ticketRef: string;
      accessToken: string;
      origin?: string | null;
      referer?: string | null;
      remoteIp?: string;
    },
  ) {
    const widget = await this.getActiveWidgetByPublicKey(publicKey);
    if (!widget) throw new Error('Widget não encontrado');
    if (widget.ticketLookupEnabled === false) {
      throw new Error('Consulta de chamado não está disponível');
    }
    this.assertOrigin(widget, opts.origin, opts.referer);

    return lookupTicketByPublicAccess({
      clientId: String(widget.clientId),
      ticketRef: opts.ticketRef,
      accessToken: opts.accessToken,
      remoteIp: opts.remoteIp,
    });
  }

  /** Reabre sessão do visitante na conversa WebChat vinculada ao chamado (token válido). */
  async resumeTicketSession(
    publicKey: string,
    opts: {
      ticketRef: string;
      accessToken: string;
      pageUrl?: string;
      pageTitle?: string;
      userAgent?: string;
      origin?: string | null;
      referer?: string | null;
      remoteIp?: string;
    },
  ) {
    const lookup = await this.lookupTicketPublic(publicKey, opts);
    if (!lookup.canContinueInChat) {
      throw new Error('Este chamado não pode ser continuado pelo chat do site no momento.');
    }

    const widget = await this.getActiveWidgetByPublicKey(publicKey);
    if (!widget) throw new Error('Widget não encontrado');

    const ticket = await InboxTicket.findOne({
      clientId: widget.clientId,
      ticketRef: lookup.ticketRef,
    }).select('+publicAccessTokenHash webChatConversationId');
    if (!ticket?.webChatConversationId) {
      throw new Error('Conversa vinculada não encontrada');
    }

    const conversation = await WebChatConversation.findOne({
      _id: ticket.webChatConversationId,
      clientId: widget.clientId,
      status: 'open',
    });
    if (!conversation) {
      throw new Error('Conversa encerrada — inicie um novo atendimento.');
    }
    if (String(conversation.widgetId) !== String(widget._id)) {
      throw new Error('Chamado não pertence a este widget');
    }

    const visitorToken = generateWebChatVisitorToken();
    conversation.visitorTokenHash = hashWebChatVisitorToken(visitorToken);
    if (opts.pageUrl?.trim()) conversation.pageUrl = opts.pageUrl.trim();
    if (opts.pageTitle?.trim()) conversation.pageTitle = opts.pageTitle.trim();
    await conversation.save();

    const messages = await WebChatMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();
    const session = await this.visitorSessionDto(conversation, messages);

    await this.appendMessage(conversation, {
      direction: 'system',
      body: `Você retomou o chamado *${lookup.ticketRef}* pelo chat do site.`,
      notifyVisitor: true,
    });

    return {
      visitorToken,
      conversationId: session.conversationId,
      queueStatus: session.queueStatus,
      departmentName: session.departmentName,
      messages: session.messages,
      ticket: lookup,
    };
  }
}
