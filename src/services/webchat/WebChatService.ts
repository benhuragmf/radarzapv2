import mongoose from 'mongoose';
import { WebChatWidget, type IWebChatWidget } from '../../models/WebChatWidget';
import { InboxDepartment } from '../../models/InboxDepartment';
import { InboxSettings } from '../../models/InboxSettings';
import { User } from '../../models/User';
import { CompanyMember } from '../../models/CompanyMember';
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
import {
  emitWebChatToTenant,
  emitWebChatToVisitor,
  emitWebChatTypingToTenant,
  emitWebChatTypingToVisitor,
} from './WebChatRealtime';
import { WebChatAiService } from './WebChatAiService';
import { WebChatRoboticTriageService } from './webchat-robotic-triage.service';
import { WebChatBasicTriageService } from './webchat-basic-triage.service';
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
import { notifySupervisorInternalChatMention } from '../inbox/inbox-supervisor-notify.service';
import { loadInboxSettings } from '../../constants/inbox-triage';
import {
  isFallbackAcceptTimeoutElapsed,
  processFallbackWhatsappRotation,
} from './webchat-whatsapp-fallback.service';
import {
  deactivateWhatsappBridge,
  forwardVisitorMessageToWhatsappBridge,
} from './webchat-whatsapp-bridge.service';
import { isAgentAvailableForQueue } from '../inbox/inbox-agent-presence';
import {
  applyWebChatAgentHumanDelay,
  assertWebChatSendAllowed,
  WebChatSendRateLimitError,
} from './webchat-send-guard.service';
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
  confirmTicketTokenResendOtp,
  ensureInboxTicketPublicAccessToken,
  formatTicketCreatedWithTokenMessage,
  lookupTicketByPublicAccess,
  requestTicketTokenResendOtp,
  rotateInboxTicketPublicAccessToken,
  sendTicketAccessTokenEmail,
  type TicketTokenResendChannel,
} from '../inbox/ticket-public-access.service';
import { InboxTicket } from '../../models/InboxTicket';
import { generateInboxTicketRef } from '../../utils/inbox-ticket-ref';
import { looksLikeEmail, normalizeEmailForTicketMatch } from '../../utils/ticket-public-access.util';
import { TICKET_CLIENT_REPLY_FOOTER } from '../../types/inbox-ticket';
import { InboxService } from '../inbox/InboxService';
import { parseWebChatAttachment } from './webchat-attachment.util';
import {
  markInboundReadByAgent,
  markInboundReadOnTeamReply,
  markOutboundDelivered,
  markOutboundReadThrough,
} from './webchat-message-receipt.service';
import { AiKnowledgeBaseService } from '../ai/AiKnowledgeBaseService';
import { AiSettingsService } from '../ai/AiSettingsService';
import { effectiveWebChatPremiumAi } from '../../types/attendance-mode';
import { AI_AUTO_RESOLVE_MIN_SCORE } from '../../utils/ai-text-match';
import {
  buildWebChatFaqReplyBody,
  buildWebChatFaqPickerIntro,
} from '../../utils/webchat-faq-reply.util';
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
    const kbSvc = AiKnowledgeBaseService.getInstance();
    const faqQuickReplies =
      faqEnabled && widget.faqShowQuickReplies !== false
        ? await kbSvc.listQuickReplies(String(widget.clientId))
        : [];
    const faqCatalogAvailable =
      faqEnabled && (await kbSvc.countActiveArticles(String(widget.clientId))) > 0;
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
      faqCatalogAvailable,
      chatLayout: a.chatLayout === 'copilot' ? 'copilot' : 'classic',
      previewTemplateId: a.previewTemplateId,
    };
  }

  async getFaqCatalog(widget: IWebChatWidget): Promise<import('../../types/webchat').WebChatFaqCatalog> {
    if (widget.faqInChatEnabled === false) {
      return { categories: [] };
    }
    return AiKnowledgeBaseService.getInstance().listFaqCatalog(String(widget.clientId));
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
      kbSuggestions: m.kbSuggestions?.length ? m.kbSuggestions : undefined,
      deliveredAt: m.deliveredAt ? new Date(m.deliveredAt).toISOString() : undefined,
      readAt: m.readAt ? new Date(m.readAt).toISOString() : undefined,
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

    const { InboxService } = await import('@/services/inbox/InboxService');
    const visibility = await InboxService.getInstance().getDepartmentVisibility(clientId, userId);
    const userOid = new mongoose.Types.ObjectId(userId);

    if (visibility.restricted) {
      const assignedClause = {
        $or: [{ assignedUserId: userOid }, { suggestedUserId: userOid }],
      };
      if (filters.departmentId) {
        const deptOid = new mongoose.Types.ObjectId(filters.departmentId);
        const allowedDept = visibility.departmentIds.some(id => id.equals(deptOid));
        query.departmentId = deptOid;
        if (!allowedDept) {
          Object.assign(query, assignedClause);
        }
      } else if (visibility.departmentIds.length > 0) {
        query.$or = [{ departmentId: { $in: visibility.departmentIds } }, assignedClause];
      } else {
        Object.assign(query, assignedClause);
      }
    } else if (filters.departmentId) {
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
    const detail = await this.getConversationForAgent(clientId, conversationId, userId);
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
        deliveredAt: m.deliveredAt,
        readAt: m.readAt,
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

    /** Ticket legado (!assumir / fallback WA) pode existir sem token — visitante ainda não foi notificado. */
    const needsOpeningNotification = created || !ticket.publicAccessTokenHash;

    let publicAccessToken: string | undefined;
    if (needsOpeningNotification) {
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

    if (needsOpeningNotification) {
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

      if (publicAccessToken) {
        const emailSet = new Set<string>();
        const addEmail = (raw?: string | null) => {
          const n = normalizeEmailForTicketMatch(raw);
          if (n) emailSet.add(n);
        };
        addEmail(conversation.visitorEmail);
        if (looksLikeEmail(contactIdentifier)) addEmail(contactIdentifier);
        for (const email of emailSet) {
          void sendTicketAccessTokenEmail({
            ticketRef: ref,
            accessToken: publicAccessToken,
            toEmail: email,
            contactName,
          }).catch(err => {
            this.serviceLogger.warn('Failed to send ticket token email on create', {
              err: (err as Error).message,
              ticketRef: ref,
            });
          });
        }
      }
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
      notifiedClient: needsOpeningNotification,
      ok: true,
    };
  }

  /**
   * Reenvia token de consulta no chat do visitante (chamado já aberto no painel).
   * Não abre chamado — use `convertToTicket` / Abrir chamado antes.
   */
  async sendTicketTokenToVisitor(
    clientId: string,
    userId: string,
    conversationId: string,
  ): Promise<{ ticketRef: string; token: string; rotated: boolean }> {
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');
    if (conversation.status === 'closed') throw new Error('Conversa encerrada');

    let ticket = await InboxTicket.findOne({
      clientId: conversation.clientId,
      ticketRef: (conversation.ticketRef ?? '').trim().toUpperCase(),
    });

    if (!ticket) {
      throw new Error(
        'Chamado ainda não aberto. Use !abrir TK-… no WhatsApp ou Abrir chamado no painel.',
      );
    }

    const ref = ticket.ticketRef;
    let token: string;
    let rotated = false;

    if (!ticket.publicAccessTokenHash) {
      const access = await ensureInboxTicketPublicAccessToken(ticket);
      if (!access.token) throw new Error('Não foi possível gerar token.');
      token = access.token;
      const body = [
        `📋 Chamado *${ref}*`,
        '',
        formatTicketCreatedWithTokenMessage(ref, token),
        '',
        TICKET_CLIENT_REPLY_FOOTER,
      ].join('\n');
      await this.appendMessage(conversation, {
        direction: 'system',
        body,
        notifyVisitor: true,
      });
    } else {
      token = await rotateInboxTicketPublicAccessToken(ticket);
      rotated = true;
      const body = [
        `🔑 Token de consulta reenviado — *${ref}*`,
        '',
        formatTicketCreatedWithTokenMessage(ref, token),
        '',
        'O token anterior deixa de valer. Use *Consultar chamado* no widget.',
      ].join('\n');
      await this.appendMessage(conversation, {
        direction: 'system',
        body,
        notifyVisitor: true,
      });
    }

    return { ticketRef: ref, token, rotated };
  }

  /** Notificação formal ao visitante (abertura, atualização ou fechamento de chamado). */
  async sendTicketClientNotification(
    clientId: string,
    userId: string,
    conversationId: string,
    body: string,
  ): Promise<void> {
    const text = body?.trim();
    if (!text) throw new Error('Mensagem vazia');

    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');
    if (conversation.status === 'closed') throw new Error('Conversa encerrada');

    await this.appendMessage(conversation, {
      direction: 'system',
      body: text,
      senderUserId: userId,
      notifyVisitor: true,
    });
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

    if (userId && (conv.unreadAgentCount ?? 0) > 0) {
      await markInboundReadByAgent(clientId, conversationId);
      await WebChatConversation.updateOne(
        { _id: conv._id },
        { $set: { unreadAgentCount: 0 } },
      );
    }

    const widget = await WebChatWidget.findById(conv.widgetId).select('name').lean();
    const dept = conv.departmentId
      ? await InboxDepartment.findById(conv.departmentId).select('name').lean()
      : null;
    const messages = await WebChatMessage.find({ conversationId: conv._id })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();

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
      kbSuggestions?: import('../../types/webchat').WebChatKbSuggestion[];
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
      ...(data.direction === 'inbound' ? { deliveredAt: now } : {}),
      ...(data.actionLinks?.length
        ? { actionLinks: sanitizeWebChatActionLinks(data.actionLinks) }
        : {}),
      ...(data.kbSuggestions?.length ? { kbSuggestions: data.kbSuggestions } : {}),
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
    if (data.direction === 'outbound') {
      void markInboundReadOnTeamReply(clientId, conversationId, msg.createdAt).catch(err => {
        this.serviceLogger.warn('markInboundReadOnTeamReply failed', {
          clientId,
          conversationId,
          err: (err as Error).message,
        });
      });
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

  async markVisitorMessageReceipts(
    visitorToken: string,
    opts: { deliveredMessageIds?: string[]; readThroughMessageId?: string },
    origin?: string | null,
    referer?: string | null,
  ): Promise<void> {
    const conversation = await this.resolveVisitorToken(visitorToken);
    if (!conversation) throw new Error('Sessão inválida ou encerrada');

    const widget = await WebChatWidget.findById(conversation.widgetId);
    if (!widget?.active) throw new Error('Widget inativo');
    this.assertOrigin(widget, origin, referer);

    const clientIdStr = String(conversation.clientId);
    const convId = String(conversation._id);

    if (opts.deliveredMessageIds?.length) {
      await markOutboundDelivered(clientIdStr, convId, opts.deliveredMessageIds);
    }
    if (opts.readThroughMessageId) {
      await markOutboundReadThrough(clientIdStr, convId, opts.readThroughMessageId);
    }
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

    try {
      await assertWebChatSendAllowed(clientIdStr, convId, 'visitor');
    } catch (err) {
      if (err instanceof WebChatSendRateLimitError) throw err;
      throw err;
    }

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

    void InboxService.getInstance()
      .syncWebChatVisitorMessageToTicket(clientIdStr, conversation.ticketRef, text)
      .catch(err => {
        this.serviceLogger.warn('syncWebChatVisitorMessageToTicket failed', {
          clientId: clientIdStr,
          err: (err as Error).message,
        });
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
    if (!hours.isOnline && hours.businessHoursEnabled) {
      const systemMsg = await this.appendMessage(conversation, {
        direction: 'system',
        body: hours.outsideHoursMessage,
      });
      replies.push(this.toMessageDto(systemMsg));
    } else {
      const roboticReplies = await this.tryRoboticTriage(freshAfterInbound, widget, text);
      if (roboticReplies !== null) {
        replies.push(...roboticReplies);
      } else {
        const basicReplies = await this.tryBasicTriage(freshAfterInbound, widget, text);
        if (basicReplies !== null) {
          replies.push(...basicReplies);
        } else {
          const faqReply = await this.tryFaqAutoReply(freshAfterInbound, widget, text);
          if (faqReply) {
            replies.push(faqReply);
          } else {
            replies.push(...(await this.maybeAutoReply(conversation, widget)));
          }
        }
      }
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
      const roboticReplies = await this.tryRoboticTriage(freshAfterInbound ?? conversation, widget, '');
      if (roboticReplies !== null) {
        replies.push(...roboticReplies);
      } else {
        const basicReplies = await this.tryBasicTriage(freshAfterInbound ?? conversation, widget, '');
        if (basicReplies !== null) {
          replies.push(...basicReplies);
        } else {
          replies.push(...(await this.maybeAutoReply(conversation, widget)));
        }
      }
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

  async pickFaqArticle(
    visitorToken: string,
    articleId: string,
    origin?: string | null,
    referer?: string | null,
  ): Promise<{ message: WebChatMessageDto }> {
    const conversation = await this.resolveVisitorToken(visitorToken);
    if (!conversation) throw new Error('Sessão inválida ou encerrada');

    const widget = await WebChatWidget.findById(conversation.widgetId);
    if (!widget?.active) throw new Error('Widget inativo');
    this.assertOrigin(widget, origin, referer);
    if (widget.faqInChatEnabled === false) throw new Error('FAQ desativada neste widget');

    const fresh = await WebChatConversation.findById(conversation._id);
    if (!fresh || fresh.status === 'closed') throw new Error('Conversa encerrada');
    if (fresh.queueStatus === 'with_agent' && fresh.assignedUserId) {
      throw new Error('Atendimento humano ativo');
    }

    const row = await AiKnowledgeBaseService.getInstance().findByIdForClient(
      String(conversation.clientId),
      articleId,
    );
    if (!row) throw new Error('Artigo não encontrado');

    const dto = await this.appendKbArticleReply(fresh, widget, row);
    return { message: dto };
  }

  private async appendKbArticleReply(
    conversation: IWebChatConversation,
    widget: IWebChatWidget,
    row: { content: string; links?: import('../../types/webchat').WebChatActionLink[]; title: string },
  ): Promise<WebChatMessageDto> {
    const body = buildWebChatFaqReplyBody(row.content);
    if (!body) throw new Error('Artigo sem conteúdo');

    const links = sanitizeWebChatActionLinks(row.links ?? []);
    const botMsg = await this.appendMessage(conversation, {
      direction: 'outbound',
      body,
      senderUserId: WEBCHAT_BOT_SENDER_ID,
      senderName: widget.autoReplySenderName?.trim() || 'Assistente',
      actionLinks: links.length ? links : undefined,
    });
    return this.toMessageDto(botMsg);
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

    const kb = AiKnowledgeBaseService.getInstance();
    const clientId = String(conversation.clientId);

    const exact = await kb.matchForWebChat(clientId, query);
    if (exact && exact.score >= 100) {
      return this.appendKbArticleReply(fresh, widget, exact.row);
    }

    const hits = await kb.searchForWebChatPicker(clientId, query);
    if (!hits.length) {
      if (exact && exact.score >= AI_AUTO_RESOLVE_MIN_SCORE) {
        return this.appendKbArticleReply(fresh, widget, exact.row);
      }
      return null;
    }

    if (hits.length === 1 && hits[0].score >= AI_AUTO_RESOLVE_MIN_SCORE) {
      return this.appendKbArticleReply(fresh, widget, hits[0].row);
    }

    const suggestions = kb.buildKbSuggestions(hits);
    if (!suggestions.length) return null;

    const botMsg = await this.appendMessage(fresh, {
      direction: 'outbound',
      body: buildWebChatFaqPickerIntro(suggestions.length),
      senderUserId: WEBCHAT_BOT_SENDER_ID,
      senderName: widget.autoReplySenderName?.trim() || 'Assistente',
      kbSuggestions: suggestions,
    });
    return this.toMessageDto(botMsg);
  }

  /**
   * Menu robotizado WebChat — só quando `AiSettings.attendanceMode === robotic`.
   * Retorna `null` se o fluxo padrão (FAQ / auto-reply / IA) deve continuar.
   */
  private async tryRoboticTriage(
    conversation: IWebChatConversation,
    widget: IWebChatWidget,
    text: string,
  ): Promise<WebChatMessageDto[] | null> {
    const clientIdStr = String(conversation.clientId);
    const convId = String(conversation._id);
    const senderName = widget.autoReplySenderName?.trim() || 'Assistente';

    const result = await WebChatRoboticTriageService.getInstance().handleInbound({
      clientId: clientIdStr,
      conversation,
      text,
      sendBotReply: async (body: string) => {
        const fresh = await WebChatConversation.findById(conversation._id);
        if (!fresh || fresh.status === 'closed') {
          throw new Error('Conversa encerrada');
        }
        const msg = await this.appendMessage(fresh, {
          direction: 'outbound',
          body,
          senderUserId: WEBCHAT_BOT_SENDER_ID,
          senderName,
        });
        return this.toMessageDto(msg);
      },
      escalate: async (departmentId: string, reason: string) => {
        await this.escalateToQueue(clientIdStr, convId, { departmentId, reason });
      },
    });

    if (!result.handled) return null;
    return result.replies as WebChatMessageDto[];
  }

  /**
   * IA Básica no WebChat — classificador local + KB antes de IA Premium.
   * Retorna `null` se o fluxo padrão deve continuar.
   */
  private async tryBasicTriage(
    conversation: IWebChatConversation,
    widget: IWebChatWidget,
    text: string,
  ): Promise<WebChatMessageDto[] | null> {
    const clientIdStr = String(conversation.clientId);
    const convId = String(conversation._id);
    const senderName = widget.autoReplySenderName?.trim() || 'Assistente';
    const basicSvc = WebChatBasicTriageService.getInstance();

    if (!(await basicSvc.isBasicTriageMode(clientIdStr))) return null;

    const messageRows = await basicSvc.loadMessageRows(conversation._id as mongoose.Types.ObjectId);

    const result = await basicSvc.handleInbound({
      clientId: clientIdStr,
      conversation,
      text,
      messageRows,
      sendBotReply: async (body: string) => {
        const fresh = await WebChatConversation.findById(conversation._id);
        if (!fresh || fresh.status === 'closed') {
          throw new Error('Conversa encerrada');
        }
        const msg = await this.appendMessage(fresh, {
          direction: 'outbound',
          body,
          senderUserId: WEBCHAT_BOT_SENDER_ID,
          senderName,
        });
        return this.toMessageDto(msg);
      },
      escalate: async (departmentId: string, reason: string) => {
        await this.escalateToQueue(clientIdStr, convId, { departmentId, reason });
      },
    });

    if (!result.handled) return null;
    return result.replies as WebChatMessageDto[];
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

    const clientIdStr = String(conversation.clientId);
    const aiSettings = await AiSettingsService.getInstance().getSettingsDoc(clientIdStr);
    const usePremiumAi = effectiveWebChatPremiumAi(Boolean(widget.autoReplyUseAi), aiSettings);

    if (
      !shouldSendWebChatAutoReply({
        autoReplyEnabled: Boolean(widget.autoReplyEnabled),
        autoReplyMessage: widget.autoReplyMessage,
        autoReplyUseAi: usePremiumAi,
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

    if (usePremiumAi) {
      const aiCtx = await this.aiContextFromConversation(fresh, widget);
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
          targetUserId: rr.userId,
          createdAt: new Date().toISOString(),
        });
      } else if (rr?.kind === 'no_online') {
        const rotation = await processFallbackWhatsappRotation(clientId, conversation, {
          immediate: true,
        });
        if (rotation.kind === 'sent') {
          await this.appendMessage(conversation, {
            direction: 'system',
            body: `Alerta enviado no WhatsApp para ${rotation.agentName} — aguardando !assumir.`,
          });
        }
      }
    } else {
      const rotation = await processFallbackWhatsappRotation(clientId, conversation, {
        immediate: true,
      });
      if (rotation.kind === 'sent') {
        await this.appendMessage(conversation, {
          direction: 'system',
          body: `Alerta enviado no WhatsApp para ${rotation.agentName} — aguardando !assumir.`,
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

  /** Scan periódico: após timeout configurável sem aceite, dispara fallback WhatsApp. */
  async processWebChatFallbackAcceptTimeouts(): Promise<void> {
    const rows = await InboxSettings.find({ whatsappFallbackEnabled: true })
      .select('clientId whatsappFallbackAcceptTimeoutSeconds')
      .lean();

    const nowMs = Date.now();
    for (const row of rows) {
      const clientId = String(row.clientId);
      const timeoutSec = Math.min(
        900,
        Math.max(30, Number(row.whatsappFallbackAcceptTimeoutSeconds) || 60),
      );

      const candidates = await WebChatConversation.find({
        clientId: row.clientId,
        status: 'open',
        queueStatus: 'waiting_human',
        assignedUserId: { $in: [null, undefined, ''] },
        whatsappFallbackAlertSentAt: { $exists: false },
      })
        .limit(25)
        .exec();

      for (const conv of candidates) {
        if (!isFallbackAcceptTimeoutElapsed(conv, timeoutSec, nowMs)) continue;

        const fresh = await WebChatConversation.findById(conv._id);
        if (!fresh) continue;
        if (fresh.status === 'closed' || fresh.queueStatus !== 'waiting_human') continue;
        if (fresh.assignedUserId?.trim()) continue;
        if (fresh.whatsappFallbackAlertSentAt) continue;

        const rotation = await processFallbackWhatsappRotation(clientId, fresh, {
          timeoutSeconds: timeoutSec,
        });

        if (rotation.kind === 'none') continue;

        const visitorLabel =
          fresh.visitorName || fresh.visitorEmail || 'Visitante do site';

        if (rotation.kind === 'rotated') {
          await this.appendMessage(fresh, {
            direction: 'system',
            body: `${rotation.agentName} foi alertado no WhatsApp — aguardando !assumir.`,
          });
          emitPanelEvent(clientId, {
            id: crypto.randomUUID(),
            type: 'webchat:fallback_missed',
            title: 'Chat perdido — próximo atendente',
            body: `${visitorLabel} · alerta enviado para ${rotation.agentName}`,
            href: `/platform/inbox?conv=${toWebChatInboxId(String(fresh._id))}`,
            conversationId: toWebChatInboxId(String(fresh._id)),
            targetUserId: rotation.fromUserId,
            urgent: true,
            createdAt: new Date(nowMs).toISOString(),
          });
          continue;
        }

        if (rotation.kind === 'sent') {
          await this.appendMessage(fresh, {
            direction: 'system',
            body: `Alerta enviado no WhatsApp para ${rotation.agentName} — aguardando !assumir.`,
          });
          continue;
        }

        if (rotation.kind === 'exhausted') {
          await this.appendMessage(fresh, { direction: 'system', body: rotation.visitorMessage });
          emitPanelEvent(clientId, {
            id: crypto.randomUUID(),
            type: 'webchat:fallback_missed',
            title: 'Chat perdido — fallback WhatsApp',
            body: `${visitorLabel} · tempo esgotado sem aceite`,
            href: `/platform/inbox?conv=${toWebChatInboxId(String(fresh._id))}`,
            conversationId: toWebChatInboxId(String(fresh._id)),
            targetUserId: fresh.suggestedUserId?.trim() || undefined,
            urgent: true,
            createdAt: new Date(nowMs).toISOString(),
          });
        }
      }
    }
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

    if (!busy && !pullAllowedByTimeout && isAgentAvailableForQueue(clientId, suggestedId)) {
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

    const contactName =
      conversation.visitorName?.trim() ||
      conversation.visitorEmail?.trim() ||
      'Visitante do site';

    void notifySupervisorInternalChatMention({
      clientId,
      authorUserId: userId,
      authorName,
      conversationId: toWebChatInboxId(String(conversation._id)),
      contactName,
      body: raw,
    }).catch(() => {});

    return this.toMessageDto(msg);
  }

  async sendAgentMessage(
    clientId: string,
    userId: string,
    conversationId: string,
    body: string,
    senderName?: string,
    opts?: { humanDelay?: 'panel' | 'bridge' | 'off' },
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

    const clientIdStr = String(conversation.clientId);
    const convId = String(conversation._id);
    const agentName = senderName?.trim() || 'Atendente';

    await assertWebChatSendAllowed(clientIdStr, convId, 'agent');

    const delayMode = opts?.humanDelay ?? 'panel';
    if (delayMode !== 'off') {
      await applyWebChatAgentHumanDelay(
        clientIdStr,
        text,
        typing => {
          this.emitTypingIndicator({
            clientId: clientIdStr,
            conversationId: convId,
            typing,
            senderType: 'agent',
            senderName: agentName,
          });
        },
        undefined,
        delayMode === 'bridge' ? 'bridge' : 'panel',
      );
    }

    const msg = await this.appendMessage(conversation, {
      direction: 'outbound',
      body: text,
      senderUserId: userId,
      senderName: agentName,
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

    const isBridgeAgent =
      conversation.whatsappBridgeActive &&
      conversation.whatsappBridgeAgentUserId &&
      String(conversation.whatsappBridgeAgentUserId) === String(userId);

    if (conversation.queueStatus === 'waiting_human') {
      if (
        conversation.suggestedUserId &&
        String(conversation.suggestedUserId) !== String(userId)
      ) {
        throw new Error('Aceite ou aguarde a prioridade desta conversa antes de responder');
      }
      if (!isBridgeAgent) {
        throw new Error('Assuma a conversa antes de responder');
      }
    }
    if (conversation.queueStatus === 'bot') {
      if (!isBridgeAgent) {
        throw new Error('Assuma a conversa antes de responder');
      }
    }
    const assignedId = conversation.assignedUserId
      ? String(conversation.assignedUserId)
      : '';
    if (!assignedId || assignedId !== String(userId)) {
      if (isBridgeAgent) {
        return conversation;
      }
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

  /** Desativa bridge WhatsApp e encerra sessão do visitante; chamado Inbox permanece aberto (!encerrarchat). */
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

    conversation.status = 'closed';
    conversation.assignedUserId = undefined;
    conversation.suggestedUserId = undefined;
    conversation.suggestedAt = undefined;
    conversation.queueStatus = 'bot';
    await conversation.save();

    const agent = await User.findById(userId).select('displayName email').lean();
    const agentName = agent?.displayName?.trim() || agent?.email?.split('@')[0] || 'Atendente';

    await this.appendMessage(conversation, {
      direction: 'system',
      body: `${agentName} encerrou o atendimento. Obrigado pelo contato!`,
      senderUserId: userId,
      senderName: agentName,
    });

    this.emitWebchatWebhook(String(conversation.clientId), 'webchat.conversation.closed', {
      conversation_id: String(conversation._id),
      widget_id: String(conversation.widgetId),
      visitor_name: conversation.visitorName,
      visitor_email: conversation.visitorEmail,
      closed_by_user_id: userId,
      bridge_only: true,
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

  async resendTicketTokenPublic(
    publicKey: string,
    opts: {
      ticketRef: string;
      channel?: TicketTokenResendChannel;
      phone?: string;
      email?: string;
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

    const channel: TicketTokenResendChannel =
      opts.channel === 'email' || (opts.email && !opts.phone) ? 'email' : 'whatsapp';

    return requestTicketTokenResendOtp({
      clientId: String(widget.clientId),
      ticketRef: opts.ticketRef,
      channel,
      phone: opts.phone,
      email: opts.email,
      remoteIp: opts.remoteIp,
    });
  }

  async confirmTicketTokenResendPublic(
    publicKey: string,
    opts: {
      ticketRef: string;
      channel?: TicketTokenResendChannel;
      phone?: string;
      email?: string;
      verificationCode: string;
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

    const channel: TicketTokenResendChannel =
      opts.channel === 'email' || (opts.email && !opts.phone) ? 'email' : 'whatsapp';

    return confirmTicketTokenResendOtp({
      clientId: String(widget.clientId),
      ticketRef: opts.ticketRef,
      channel,
      phone: opts.phone,
      email: opts.email,
      verificationCode: opts.verificationCode,
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

  async supervisorReassignConversation(
    clientId: string,
    supervisorUserId: string,
    conversationId: string,
    targetUserId: string,
    mode: 'suggest' | 'assign' = 'suggest',
  ): Promise<InboxWebChatListRow> {
    await InboxService.getInstance().listSupervisorQueue(clientId, supervisorUserId);

    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');
    if (conversation.status === 'closed') throw new Error('Conversa já finalizada');

    const targetMember = await CompanyMember.findOne({
      userId: new mongoose.Types.ObjectId(targetUserId),
      organizationId: new mongoose.Types.ObjectId(clientId),
      isActive: true,
    });
    if (!targetMember?.userId) throw new Error('Atendente inválido');

    const agent = await User.findById(targetUserId).select('displayName email').lean();
    const agentName = agent?.displayName?.trim() || agent?.email?.split('@')[0] || 'Atendente';

    if (mode === 'assign') {
      conversation.assignedUserId = targetUserId;
      conversation.suggestedUserId = undefined;
      conversation.suggestedAt = undefined;
      conversation.queueStatus = 'with_agent';
      conversation.lastMessageAt = new Date();
      await conversation.save();
      await this.appendMessage(conversation, {
        direction: 'system',
        body: `Supervisor reatribuiu o atendimento para ${agentName}.`,
        senderUserId: supervisorUserId,
        senderName: 'Supervisor',
      });
    } else {
      conversation.suggestedUserId = targetUserId;
      conversation.suggestedAt = new Date();
      conversation.assignedUserId = undefined;
      conversation.queueStatus = 'waiting_human';
      conversation.lastMessageAt = new Date();
      await conversation.save();
      await this.appendMessage(conversation, {
        direction: 'system',
        body: `Supervisor indicou prioridade para ${agentName}.`,
        senderUserId: supervisorUserId,
        senderName: 'Supervisor',
      });
      emitPanelEvent(String(conversation.clientId), {
        id: crypto.randomUUID(),
        type: 'inbox:priority',
        title: 'Prioridade (supervisor)',
        body: `${agentName} · chat do site`,
        href: `/platform/inbox?conv=${toWebChatInboxId(String(conversation._id))}`,
        conversationId: toWebChatInboxId(String(conversation._id)),
        createdAt: new Date().toISOString(),
      });
    }

    emitWebChatToTenant(String(conversation.clientId), 'webchat:conversation', {
      clientId: String(conversation.clientId),
      conversationId: String(conversation._id),
    });

    const inboxSettings = await loadInboxSettings(clientId);
    const agentMap = new Map([[targetUserId, agentName]]);
    const display = visitorDisplayName(
      conversation.visitorName,
      conversation.visitorEmail,
      conversation.visitorPhone,
    );
    const inboxStatus =
      conversation.queueStatus === 'with_agent'
        ? 'in_progress'
        : conversation.queueStatus === 'waiting_human'
          ? 'waiting_queue'
          : 'bot_triage';

    return enrichWebChatInboxRow(
      {
        _id: toWebChatInboxId(String(conversation._id)),
        channel: 'webchat_site',
        contactName: display.contactName,
        contactIdentifier: display.contactIdentifier,
        status: inboxStatus,
        departmentId: conversation.departmentId ? String(conversation.departmentId) : undefined,
        assignedUserId: conversation.assignedUserId,
        assignedUserName: conversation.assignedUserId ? agentName : undefined,
        suggestedUserId: conversation.suggestedUserId,
        suggestedAt: conversation.suggestedAt?.toISOString(),
        lastMessageAt: (conversation.lastMessageAt ?? conversation.updatedAt).toISOString(),
        lastMessagePreview: conversation.lastMessagePreview,
      },
      supervisorUserId,
      clientId,
      agentMap,
      inboxSettings.roundRobinPullTimeoutSeconds ?? 120,
    );
  }
}
