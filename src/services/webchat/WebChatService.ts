import mongoose from 'mongoose';
import { WebChatWidget, type IWebChatWidget } from '../../models/WebChatWidget';
import { InboxDepartment } from '../../models/InboxDepartment';
import { InboxSettings } from '../../models/InboxSettings';
import { User } from '../../models/User';
import { CompanyMember } from '../../models/CompanyMember';
import { ContactGroup } from '../../models/ContactGroup';
import { Destination } from '../../models/Destination';
import { Organization } from '../../models/Organization';
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
import {
  isVisitorVisibleWebChatMessage,
  VISITOR_VISIBLE_WEBCHAT_MESSAGE_QUERY,
} from '../../utils/webchat-visitor-message.util';
import { mentionsSupervisor } from '../../utils/internal-chat-supervisor-mention';
import {
  DEFAULT_AUTO_REPLY_MESSAGE,
  shouldSendWebChatAutoReply,
  WEBCHAT_BOT_SENDER_ID,
  WEBCHAT_VISITOR_CLOSE_ID,
} from './webchat-bot.util';
import {
  canRemoveBranding,
  getOrganizationPlanId,
  RADAR_CHAT_BRAND_URL,
  resolveProductBrandingVisible,
} from '@/utils/branding-plan.util';
import {
  generateWebChatPublicKey,
  generateWebChatVisitorToken,
  hashWebChatVisitorToken,
  normalizeAllowedDomainEntry,
} from './webchat-token.util';
import {
  getOrganizationWebsite,
  isEmbedOriginAllowed,
} from '@/utils/embed-allowed-domains.util';
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
import {
  applyContactClassificationPatch,
  attachClassificationToConversationRows,
  classifyDestination,
  loadCampaignClassificationContext,
} from '../destinations/destination-classification.service';
import type { IDestination } from '../../models/Destination';
import type {
  CommercialStatus,
  ContactKind,
  ContactOrigin,
  ContactTemperature,
} from '../../types/contact-classification';
import type { InboxWeeklySchedule } from '../../types/inbox-settings';
import {
  shouldAutoCloseTriageStalled,
  shouldCloseTriageInactivity,
  shouldSendTriageInactivityWarning,
  shouldSendTriageStallWarning,
  isEncInactivityCloseQuickReplyAllowed,
  isEncOkCloseQuickReplyAllowed,
  triageInactivityTotalMinutes,
} from '../inbox/inbox-inactivity';
import { DEFAULT_INBOX_SLA, DEFAULT_INBOX_TRIAGE_INACTIVITY, resolveGracefulCloseQuickReplyGateEnabled, resolveInactivityCloseGateWaitMinutes, resolveInactivityCloseQuickReplyGateEnabled } from '../../types/inbox-settings';
import {
  applyQuickReplyTemplate,
  expandQuickReply,
  normalizeQuickReplies,
  parseQuickReplyCode,
  resolveInactivityWarningQuickCode,
  resolveInactivityCloseQuickCode,
  resolveGracefulCloseQuickCode,
  resolveInactivityCloseGracefulQuickCode,
  isInactivityCloseQuickCode,
  isInactivityCloseGracefulQuickCode,
  type InboxQuickReply,
} from '../../types/inbox-quick-replies';
import {
  applyInboundCloseGate,
  applyOutboundCloseGate,
  clearCloseGateFields,
} from '../inbox/inbox-graceful-close.util';
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
import { effectiveWebChatPremiumAi, resolveAttendanceMode } from '../../types/attendance-mode';
import {
  assertWebChatVisitorMessage,
  resolveWebChatEscalationSystemMessage,
  shouldEscalateWebChatOnPremiumAiFailure,
  WEBCHAT_QUEUE_WAITING_VISITOR_MESSAGE,
} from '../../types/webchat-public.util';
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

function optionalIsoDate(value?: Date | string | null): string | undefined {
  if (value == null) return undefined;
  return value instanceof Date ? value.toISOString() : String(value);
}
import { loadInboxSettings } from '@/constants/inbox-triage';
import { departmentBadgeFieldsFrom } from '@/services/inbox/inbox-department-badge.util';
import { WebhookDispatcherService } from '@/services/integrations/WebhookDispatcherService';
import { emitPanelEvent } from '@/services/inbox/PanelNotifications';
import { isAgentAvailableForQueue } from '@/services/inbox/inbox-agent-presence';
import {
  canAgentManuallyAssumeConversation,
  formatManualAssumeBlockMessage,
  resolveMaxConcurrentChatsForPlan,
} from '@/services/inbox/agent-availability';
import { notifySupervisorInternalChatMention } from '@/services/inbox/inbox-supervisor-notify.service';
import {
  assertWebChatSendAllowed,
  applyWebChatAgentHumanDelay,
  WebChatSendRateLimitError,
} from './webchat-send-guard.service';
import {
  deactivateWhatsappBridge,
  forwardVisitorMessageToWhatsappBridge,
} from './webchat-whatsapp-bridge.service';
import {
  isFallbackAcceptTimeoutElapsed,
  processFallbackWhatsappRotation,
  type FallbackWhatsappRotationResult,
} from './webchat-whatsapp-fallback.service';
import {
  resolveFallbackAcceptTimeoutSeconds,
  resolveFallbackWaitMode,
  shouldRetryFallbackAfterCooldown,
} from './webchat-fallback-timing.util';
import {
  DEFAULT_WEBCHAT_QUEUE_MAX_WAIT_CLOSE_MESSAGE,
  DEFAULT_WHATSAPP_FALLBACK_VISITOR_MESSAGE,
} from '@/types/inbox-settings';

const FALLBACK_EXHAUSTED_COOLDOWN_MS = 15 * 60 * 1000;

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
    data: { name: string; allowedDomains?: string[]; includeCompanyWebsite?: boolean; appearance?: Partial<WebChatWidgetAppearance> },
  ): Promise<IWebChatWidget> {
    const { assertCanCreateWebchatWidget } = await import(
      '@/services/billing/plan-limit-enforcement'
    );
    await assertCanCreateWebchatWidget(clientId);

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const doc = await WebChatWidget.create({
      clientId: clientOid,
      name: data.name.trim(),
      publicKey: generateWebChatPublicKey(),
      allowedDomains: (data.allowedDomains ?? []).map(normalizeAllowedDomainEntry).filter(Boolean),
      includeCompanyWebsite: data.includeCompanyWebsite !== false,
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
      includeCompanyWebsite?: boolean;
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
      existing.allowedDomains = patch.allowedDomains.map(normalizeAllowedDomainEntry).filter(Boolean);
    }
    if (patch.includeCompanyWebsite !== undefined) {
      existing.includeCompanyWebsite = Boolean(patch.includeCompanyWebsite);
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
      const planId = await getOrganizationPlanId(clientId);
      if (!canRemoveBranding(planId)) {
        existing.appearance.showPoweredBy = true;
      }
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
    const planId = await getOrganizationPlanId(String(widget.clientId));
    const showPoweredBy = resolveProductBrandingVisible(planId, a.showPoweredBy !== false);
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
      showPoweredBy,
      brandUrl: RADAR_CHAT_BRAND_URL,
    };
  }

  async getFaqCatalog(widget: IWebChatWidget): Promise<import('../../types/webchat').WebChatFaqCatalog> {
    if (widget.faqInChatEnabled === false) {
      return { categories: [] };
    }
    return AiKnowledgeBaseService.getInstance().listFaqCatalog(String(widget.clientId));
  }

  async assertOrigin(widget: IWebChatWidget, origin?: string | null, referer?: string | null): Promise<void> {
    const companyWebsite = await getOrganizationWebsite(String(widget.clientId));
    if (
      !isEmbedOriginAllowed(widget.allowedDomains ?? [], origin, referer, {
        companyWebsite,
        includeCompanyWebsite: widget.includeCompanyWebsite,
      })
    ) {
      throw new Error('Origem não autorizada para este widget');
    }
  }

  async resolveVisitorToken(visitorToken: string): Promise<IWebChatConversation | null> {
    if (!visitorToken?.startsWith('wcv_')) return null;
    const hash = hashWebChatVisitorToken(visitorToken);
    return WebChatConversation.findOne({ visitorTokenHash: hash, status: 'open' });
  }

  /** Valida origem do handshake Socket.IO do visitante (paridade com REST e wcp_*). */
  async assertVisitorSocketOrigin(
    conversation: IWebChatConversation,
    origin?: string | null,
    referer?: string | null,
    publicKey?: string | null,
  ): Promise<void> {
    const pk = publicKey?.trim();
    const widget = pk
      ? await WebChatWidget.findOne({
          publicKey: pk,
          active: true,
          clientId: conversation.clientId,
          _id: conversation.widgetId,
        })
      : await WebChatWidget.findOne({
          _id: conversation.widgetId,
          active: true,
          clientId: conversation.clientId,
        });
    if (!widget) throw new Error('Unauthorized');
    await this.assertOrigin(widget, origin, referer);
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
        .filter(m => isVisitorVisibleWebChatMessage(m as { direction: string; body: string }))
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

  private async departmentRecordMap(
    deptIds: mongoose.Types.ObjectId[],
  ): Promise<Map<string, { name: string; clientVisible?: boolean; internalRank?: number; menuKey?: string }>> {
    if (!deptIds.length) return new Map();
    const depts = await InboxDepartment.find({ _id: { $in: deptIds } })
      .select('name clientVisible internalRank menuKey')
      .lean();
    return new Map(depts.map(d => [String(d._id), d]));
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

    await this.assertOrigin(widget, opts.origin, opts.referer);

    const intakeRaw: Record<string, string | undefined> = {
      ...(opts.visitorIntake ?? {}),
    };
    if (opts.visitorName?.trim()) intakeRaw.name = opts.visitorName.trim();
    if (opts.visitorEmail?.trim()) intakeRaw.email = opts.visitorEmail.trim();
    if (opts.visitorPhone?.trim()) intakeRaw.phone = opts.visitorPhone.trim();
    if (opts.contactReason?.trim()) intakeRaw.contact_reason = opts.contactReason.trim();
    const applied = applyVisitorIntake(intakeRaw, widget.appearance);
    const linkedExisting = await linkWebChatVisitorToDestination(
      String(widget.clientId),
      applied,
      { pageUrl: opts.pageUrl, pageTitle: opts.pageTitle },
    );
    let destinationId = linkedExisting;
    const hadExistingContact = Boolean(linkedExisting);

    const { loadInboundRegistrationPolicy, shouldAutoCaptureLead } = await import(
      '../inbound/inbound-registration-policy.service'
    );
    const { resolveChannelRegistration } = await import('@/types/inbound-registration-policy');
    const regPolicy = await loadInboundRegistrationPolicy(String(widget.clientId));
    const channelActions = resolveChannelRegistration(regPolicy, 'webchat', {
      isReturn: hadExistingContact,
    });

    if (
      !destinationId &&
      applied.visitorPhone?.trim() &&
      channelActions.createCrmContact
    ) {
      const ensured = await ensureDestinationForWebChatVisitor(
        String(widget.clientId),
        applied.visitorPhone,
        applied.visitorName?.trim() || applied.visitorPhone,
        {
          email: applied.visitorEmail,
          crmRegistrationStatus: channelActions.crmStatus,
        },
      );
      if (ensured) destinationId = ensured;
    }

    let visitorToken = opts.visitorToken?.trim();
    let conversation: IWebChatConversation | null = null;
    let isNewConversation = false;

    if (visitorToken) {
      conversation = await this.resolveVisitorToken(visitorToken);
      if (conversation && String(conversation.widgetId) !== String(widget._id)) {
        conversation = null;
      }
    }

    if (!conversation) {
      visitorToken = generateWebChatVisitorToken();
      isNewConversation = true;
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

    if (isNewConversation && applied.visitorPhone?.trim()) {
      const { LeadFormService } = await import('../leads/LeadFormService');
      const messageParts = [applied.contactReason?.trim(), opts.pageTitle?.trim()].filter(Boolean);
      const captureLead = shouldAutoCaptureLead({
        channel: 'webchat',
        isNewContact: !hadExistingContact,
        isNewConversation: true,
        hadExistingContact,
        message: messageParts.length ? messageParts.join(' · ') : undefined,
        policy: regPolicy,
      });
      if (captureLead) {
        void LeadFormService.getInstance()
          .maybeCaptureWebChatSession(String(widget.clientId), {
            webchatConversationId: String(conversation._id),
            phone: applied.visitorPhone,
            name: applied.visitorName?.trim() || applied.visitorPhone,
            message: messageParts.length ? messageParts.join(' · ') : undefined,
            pageUrl: opts.pageUrl,
            pageTitle: opts.pageTitle,
            hadExistingContact,
            isNewConversation: true,
            destinationId: destinationId ? String(destinationId) : undefined,
            policyApproved: true,
          })
          .catch(err => {
            this.serviceLogger.warn('Falha ao capturar lead WebChat', {
              clientId: String(widget.clientId),
              error: (err as Error).message,
            });
          });
      }
    }

    const messages = await WebChatMessage.find({
      conversationId: conversation._id,
      ...VISITOR_VISIBLE_WEBCHAT_MESSAGE_QUERY,
    })
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

    await this.assertOrigin(widget, opts.origin, opts.referer);

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

    const messages = await WebChatMessage.find({
      conversationId: conversation._id,
      ...VISITOR_VISIBLE_WEBCHAT_MESSAGE_QUERY,
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    const visitorSession = await this.visitorSessionDto(conversation, messages);

    return {
      visitorToken: session.visitorToken,
      conversationId: session.conversationId,
      sent: true,
      messages: visitorSession.messages,
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
      destinationIds?: mongoose.Types.ObjectId[];
    } = {},
  ): Promise<InboxWebChatListRow[]> {
    if (filters.destinationIds !== undefined && filters.destinationIds.length === 0) {
      return [];
    }
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const wcFilter = inboxStatusToWebChatFilter(filters.status);
    const query: Record<string, unknown> = { clientId: clientOid };

    if (wcFilter.conversationStatus) query.status = wcFilter.conversationStatus;
    if (wcFilter.queueStatus) query.queueStatus = wcFilter.queueStatus;

    const inboxSettings = await loadInboxSettings(clientId);
    const attendantTriageVisible = inboxSettings.attendantTriageVisible === true;

    const { InboxService } = await import('@/services/inbox/InboxService');
    const { applyRestrictedWebChatListVisibility } = await import(
      '@/services/inbox/inbox-department-visibility.util'
    );
    const visibility = await InboxService.getInstance().getDepartmentVisibility(clientId, userId);
    const userOid = new mongoose.Types.ObjectId(userId);

    applyRestrictedWebChatListVisibility(query, visibility, userOid, filters, {
      attendantTriageVisible,
    });
    if (!visibility.restricted && filters.departmentId) {
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

    if (filters.destinationIds?.length) {
      query.destinationId = { $in: filters.destinationIds };
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

    const [widgetNames, deptRecords, agentNameMap] = await Promise.all([
      this.widgetNameMap(widgetIds),
      this.departmentRecordMap(deptIds),
      agentIds.length
        ? (async () => {
            const { resolveAgentChatDisplayNameMap } = await import(
              '@/services/organization/chat-display-name.service'
            );
            return resolveAgentChatDisplayNameMap(clientId, agentIds);
          })()
        : Promise.resolve(new Map<string, string>()),
    ]);
    const agentMap = agentNameMap;
    const pullTimeoutSeconds = inboxSettings.roundRobinPullTimeoutSeconds ?? 120;
    const triageTotalMin = triageInactivityTotalMinutes(
      inboxSettings.triageWarningMinutes ?? DEFAULT_INBOX_TRIAGE_INACTIVITY.triageWarningMinutes,
      inboxSettings.triageCloseAfterWarningMinutes ??
        DEFAULT_INBOX_TRIAGE_INACTIVITY.triageCloseAfterWarningMinutes,
    );
    const inactivitySla = {
      inactivityCloseMinutes:
        inboxSettings.inactivityCloseMinutes ?? DEFAULT_INBOX_SLA.inactivityCloseMinutes,
      inactivityWarningMinutes:
        inboxSettings.inactivityWarningMinutes ?? DEFAULT_INBOX_SLA.inactivityWarningMinutes,
      inactivityCloseGateWaitMinutes: resolveInactivityCloseGateWaitMinutes(inboxSettings),
      gracefulCloseAfterPromptMinutes:
        inboxSettings.gracefulCloseAfterPromptMinutes ??
        DEFAULT_INBOX_SLA.gracefulCloseAfterPromptMinutes,
      closeQuickReplyGateEnabled: inboxSettings.closeQuickReplyGateEnabled,
    };
    const fallbackSettings = {
      whatsappFallbackEnabled: Boolean(inboxSettings.whatsappFallbackEnabled),
      whatsappFallbackAcceptTimeoutSeconds: inboxSettings.whatsappFallbackAcceptTimeoutSeconds,
      whatsappFallbackNoAgentTimeoutSeconds: inboxSettings.whatsappFallbackNoAgentTimeoutSeconds,
    };

    const baseRows = rows.map(r => {
      const { contactName, contactIdentifier } = visitorDisplayName(
        r.visitorName,
        r.visitorEmail,
        r.visitorPhone,
        r.visitorIntake as Record<string, string> | undefined,
      );
      const dept = r.departmentId ? deptRecords.get(String(r.departmentId)) : undefined;
      const deptBadge = dept
        ? departmentBadgeFieldsFrom({
            name: dept.name,
            clientVisible: dept.clientVisible ?? true,
            internalRank: dept.internalRank,
            menuKey: dept.menuKey,
          })
        : {};
      return {
        _id: toWebChatInboxId(String(r._id)),
        channel: 'webchat_site' as const,
        contactName,
        contactIdentifier,
        status: mapWebChatToInboxStatus(r.status, r.queueStatus),
        departmentId: r.departmentId ? String(r.departmentId) : undefined,
        ...deptBadge,
        assignedUserId: r.assignedUserId,
        assignedUserName: r.assignedUserId ? agentMap.get(r.assignedUserId) : undefined,
        suggestedUserId: r.suggestedUserId,
        suggestedAt: optionalIsoDate(r.suggestedAt),
        queueEnteredAt: optionalIsoDate(r.queueEnteredAt),
        acceptedAt: optionalIsoDate(r.acceptedAt),
        whatsappFallbackPriorityStartedAt: optionalIsoDate(r.whatsappFallbackPriorityStartedAt),
        whatsappFallbackWaNotifiedAt: optionalIsoDate(r.whatsappFallbackWaNotifiedAt),
        whatsappFallbackWaNotifiedUserId: r.whatsappFallbackWaNotifiedUserId,
        createdAt: optionalIsoDate(r.createdAt),
        visitorPhone: r.visitorPhone,
        contactReason: r.contactReason,
        visitorIntake: r.visitorIntake as Record<string, string> | undefined,
        lastMessageAt: (r.lastMessageAt ?? r.updatedAt ?? r.createdAt).toISOString(),
        lastMessagePreview: r.lastMessagePreview,
        unreadCount: r.unreadAgentCount ?? 0,
        lastInboundAt: optionalIsoDate(r.lastInboundAt),
        lastOutboundAt: optionalIsoDate(r.lastOutboundAt),
        inactivityWarnedAt: optionalIsoDate(r.inactivityWarnedAt),
        gracefulClosePromptAt: optionalIsoDate(r.gracefulClosePromptAt),
        gracefulCloseAckAt: optionalIsoDate(r.gracefulCloseAckAt),
        closeGateSource: r.closeGateSource,
        widgetName: widgetNames.get(String(r.widgetId)),
        pageUrl: r.pageUrl,
        ticketRef: r.ticketRef?.trim() || undefined,
        whatsappBridgeActive: Boolean(r.whatsappBridgeActive),
        destinationId: r.destinationId ? String(r.destinationId) : undefined,
        priorityForMe: false,
        canAccept: false,
        canPull: false,
      };
    });

    const enriched = await Promise.all(
      baseRows.map(row =>
        enrichWebChatInboxRow(
          row,
          userId,
          clientId,
          agentMap,
          pullTimeoutSeconds,
          triageTotalMin,
          inactivitySla,
          fallbackSettings,
        ),
      ),
    );
    return attachClassificationToConversationRows(clientId, enriched);
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
    inactivitySla: {
      inactivityAutoCloseEnabled: boolean;
      inactivityCloseMinutes: number;
      inactivityWarningMinutes: number;
      inactivityWarningQuickCode: string;
      inactivityCloseQuickCode: string;
      gracefulCloseQuickCode: string;
      gracefulCloseAfterPromptMinutes?: number;
      gracefulCloseDetectPhrases?: boolean;
      inactivityCloseGracefulQuickCode: string;
      closeQuickReplyGateEnabled: boolean;
      gracefulCloseQuickReplyGateEnabled: boolean;
      inactivityCloseGateWaitMinutes: number;
    };
  } | null> {
    const detail = await this.getConversationForAgent(clientId, conversationId, userId);
    if (!detail) return null;

    const convDoc = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    }).lean();
    if (!convDoc) return null;

    await this.assertWebChatInboxAccess(clientId, userId, convDoc);

    const { contactName, contactIdentifier } = visitorDisplayName(
      convDoc.visitorName,
      convDoc.visitorEmail,
      convDoc.visitorPhone,
      convDoc.visitorIntake as Record<string, string> | undefined,
    );
    let assignedUserName: string | undefined;
    const agentIds = [convDoc.assignedUserId, convDoc.suggestedUserId].filter(Boolean) as string[];
    const { resolveAgentChatDisplayNameMap } = await import(
      '@/services/organization/chat-display-name.service'
    );
    const agentNameMap = await resolveAgentChatDisplayNameMap(clientId, agentIds);
    if (convDoc.assignedUserId) {
      assignedUserName = agentNameMap.get(String(convDoc.assignedUserId));
    }

    const agents = agentIds.length
      ? await User.find({ _id: { $in: agentIds } }).select('displayName email').lean()
      : [];
    const agentMap = new Map<string, string>();
    for (const uid of agentIds) {
      const fromMember = agentNameMap.get(String(uid));
      if (fromMember) agentMap.set(String(uid), fromMember);
    }
    for (const a of agents) {
      const id = String(a._id);
      if (!agentMap.has(id)) {
        agentMap.set(id, a.displayName?.trim() || a.email?.split('@')[0] || 'Atendente');
      }
    }
    const inboxSettings = await loadInboxSettings(clientId);
    const pullTimeoutSeconds = inboxSettings.roundRobinPullTimeoutSeconds ?? 120;

    let deptBadge: ReturnType<typeof departmentBadgeFieldsFrom> | Record<string, never> = {};
    if (convDoc.departmentId) {
      const dept = await InboxDepartment.findById(convDoc.departmentId)
        .select('name clientVisible internalRank menuKey')
        .lean();
      if (dept) deptBadge = departmentBadgeFieldsFrom(dept);
    }

    const inactivitySla = {
      inactivityCloseMinutes:
        inboxSettings.inactivityCloseMinutes ?? DEFAULT_INBOX_SLA.inactivityCloseMinutes,
      inactivityWarningMinutes:
        inboxSettings.inactivityWarningMinutes ?? DEFAULT_INBOX_SLA.inactivityWarningMinutes,
      inactivityCloseGateWaitMinutes: resolveInactivityCloseGateWaitMinutes(inboxSettings),
      gracefulCloseAfterPromptMinutes:
        inboxSettings.gracefulCloseAfterPromptMinutes ??
        DEFAULT_INBOX_SLA.gracefulCloseAfterPromptMinutes,
      closeQuickReplyGateEnabled: inboxSettings.closeQuickReplyGateEnabled,
    };
    const fallbackSettings = {
      whatsappFallbackEnabled: Boolean(inboxSettings.whatsappFallbackEnabled),
      whatsappFallbackAcceptTimeoutSeconds: inboxSettings.whatsappFallbackAcceptTimeoutSeconds,
      whatsappFallbackNoAgentTimeoutSeconds: inboxSettings.whatsappFallbackNoAgentTimeoutSeconds,
    };

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
        departmentId: convDoc.departmentId ? String(convDoc.departmentId) : undefined,
        ...deptBadge,
        assignedUserId: convDoc.assignedUserId,
        assignedUserName,
        suggestedUserId: convDoc.suggestedUserId,
        suggestedAt: convDoc.suggestedAt
          ? new Date(convDoc.suggestedAt).toISOString()
          : undefined,
        queueEnteredAt: convDoc.queueEnteredAt
          ? new Date(convDoc.queueEnteredAt).toISOString()
          : undefined,
        acceptedAt: convDoc.acceptedAt
          ? new Date(convDoc.acceptedAt).toISOString()
          : undefined,
        whatsappFallbackPriorityStartedAt: convDoc.whatsappFallbackPriorityStartedAt
          ? new Date(convDoc.whatsappFallbackPriorityStartedAt).toISOString()
          : undefined,
        whatsappFallbackWaNotifiedAt: convDoc.whatsappFallbackWaNotifiedAt
          ? new Date(convDoc.whatsappFallbackWaNotifiedAt).toISOString()
          : undefined,
        whatsappFallbackWaNotifiedUserId: convDoc.whatsappFallbackWaNotifiedUserId,
        lastMessageAt: detail.conversation.lastMessageAt ?? convDoc.createdAt.toISOString(),
        lastMessagePreview: detail.conversation.lastMessagePreview,
        unreadCount: detail.conversation.unreadCount,
        lastInboundAt: optionalIsoDate(convDoc.lastInboundAt),
        lastOutboundAt: optionalIsoDate(convDoc.lastOutboundAt),
        inactivityWarnedAt: optionalIsoDate(convDoc.inactivityWarnedAt),
        gracefulClosePromptAt: optionalIsoDate(convDoc.gracefulClosePromptAt),
        gracefulCloseAckAt: optionalIsoDate(convDoc.gracefulCloseAckAt),
        closeGateSource: convDoc.closeGateSource,
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
      triageInactivityTotalMinutes(
        inboxSettings.triageWarningMinutes ?? DEFAULT_INBOX_TRIAGE_INACTIVITY.triageWarningMinutes,
        inboxSettings.triageCloseAfterWarningMinutes ??
          DEFAULT_INBOX_TRIAGE_INACTIVITY.triageCloseAfterWarningMinutes,
      ),
      inactivitySla,
      fallbackSettings,
    );

    const destination = convDoc.destinationId
      ? await Destination.findOne({
          _id: convDoc.destinationId,
          clientId: new mongoose.Types.ObjectId(clientId),
        })
          .select(
            'name email notes organization identifier contactGroupIds tags lastMessageSent consentStatus consent pendingOutboundCount contactKind contactOrigin commercialStatus temperature phoneQuality phoneType profilePictureMime type',
          )
          .lean()
      : null;

    const classificationCtx = destination
      ? await loadCampaignClassificationContext(clientId)
      : null;

    const visitorContact = destination
      ? null
      : this.buildVisitorProfileContact(convDoc);

    const contact = destination
      ? {
          _id: String(destination._id),
          name: destination.name,
          email: destination.email ?? '',
          notes: destination.notes ?? '',
          organization: destination.organization ?? '',
          identifier: destination.identifier,
          contactGroupIds: (destination.contactGroupIds ?? []).map(String),
          tags: destination.tags ?? [],
          lastMessageSent: destination.lastMessageSent,
          classification: classificationCtx
            ? classifyDestination(destination, classificationCtx)
            : undefined,
        }
      : visitorContact;

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
      contact,
      quickReplies: normalizeQuickReplies(inboxSettings.quickReplies),
      inactivitySla: {
        inactivityAutoCloseEnabled: inboxSettings.inactivityAutoCloseEnabled,
        inactivityCloseMinutes: inboxSettings.inactivityCloseMinutes,
        inactivityWarningMinutes: inboxSettings.inactivityWarningMinutes,
        inactivityWarningQuickCode: resolveInactivityWarningQuickCode(inboxSettings),
        inactivityCloseQuickCode: resolveInactivityCloseQuickCode(inboxSettings),
        gracefulCloseQuickCode: resolveGracefulCloseQuickCode(inboxSettings),
        gracefulCloseAfterPromptMinutes: inboxSettings.gracefulCloseAfterPromptMinutes,
        gracefulCloseDetectPhrases: inboxSettings.gracefulCloseDetectPhrases,
        inactivityCloseGracefulQuickCode: resolveInactivityCloseGracefulQuickCode(inboxSettings),
        closeQuickReplyGateEnabled: resolveInactivityCloseQuickReplyGateEnabled(inboxSettings),
        gracefulCloseQuickReplyGateEnabled: resolveGracefulCloseQuickReplyGateEnabled(inboxSettings),
        inactivityCloseGateWaitMinutes: resolveInactivityCloseGateWaitMinutes(inboxSettings),
      },
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
      address?: string;
      deliveryAddress?: string;
      taxDocument?: string;
      notes?: string;
      contactGroupIds?: string[];
      contactKind?: ContactKind | null;
      contactOrigin?: ContactOrigin | null;
      commercialStatus?: CommercialStatus | null;
      temperature?: ContactTemperature | null;
    },
  ) {
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation) throw new Error('Conversa não encontrada');

    const name = data.name.trim();
    if (!name) throw new Error('Nome é obrigatório');

    const contactAddressInput = data.address ?? data.deliveryAddress;

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
      if (contactAddressInput !== undefined) {
        dest.address = contactAddressInput.trim().slice(0, 500) || undefined;
      }
      if (data.taxDocument !== undefined) dest.taxDocument = data.taxDocument.trim().slice(0, 20) || undefined;
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
      applyContactClassificationPatch(dest, {
        contactKind: data.contactKind,
        contactOrigin: data.contactOrigin,
        commercialStatus: data.commercialStatus,
        temperature: data.temperature,
      });
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
        if (contactAddressInput !== undefined) {
          dest.address = contactAddressInput.trim().slice(0, 500) || undefined;
        }
        if (data.taxDocument !== undefined) dest.taxDocument = data.taxDocument.trim().slice(0, 20) || undefined;
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
        applyContactClassificationPatch(dest, {
          contactKind: data.contactKind,
          contactOrigin: data.contactOrigin,
          commercialStatus: data.commercialStatus,
          temperature: data.temperature,
        });
        await dest.save();
      }
    }

    await conversation.save();

    if (destinationId) {
      const dest = await Destination.findById(destinationId)
        .select(
          'name email notes organization identifier contactGroupIds tags lastMessageSent consentStatus consent pendingOutboundCount contactKind contactOrigin commercialStatus temperature phoneQuality phoneType profilePictureMime type',
        )
        .lean();
      if (dest) {
        const classificationCtx = await loadCampaignClassificationContext(clientId);
        return {
          contact: {
            _id: String(dest._id),
            name: dest.name,
            email: dest.email ?? '',
            notes: dest.notes ?? '',
            organization: dest.organization ?? '',
            identifier: dest.identifier,
            contactGroupIds: (dest.contactGroupIds ?? []).map(String),
            tags: dest.tags ?? [],
            lastMessageSent: dest.lastMessageSent,
            classification: classifyDestination(dest, classificationCtx),
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

    const agentName = await this.agentDisplayName(clientId, userId);

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
      assignedName = await this.agentDisplayName(clientId, String(conversation.assignedUserId));
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

    if (userId) {
      await markInboundReadByAgent(clientId, conversationId);
      if ((conv.unreadAgentCount ?? 0) > 0) {
        await WebChatConversation.updateOne(
          { _id: conv._id },
          { $set: { unreadAgentCount: 0 } },
        );
      }
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
      const { resolveAgentChatDisplayNameMap } = await import(
        '@/services/organization/chat-display-name.service'
      );
      const agentMap = await resolveAgentChatDisplayNameMap(clientId, agentIds);
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
    if (data.direction === 'inbound') {
      setFields.lastInboundAt = now;
    }
    if (data.direction === 'outbound') {
      setFields.lastOutboundAt = now;
    }
    if (!isInternal) {
      setFields.lastMessagePreview = preview;
    }
    if (currentStatus?.status !== 'closed') {
      setFields.status = 'open';
    }
    const updateDoc: Record<string, unknown> = {
      $set: setFields,
      ...(unreadDelta ? { $inc: { unreadAgentCount: unreadDelta } } : {}),
    };
    if (data.direction === 'inbound') {
      const convSnap = await WebChatConversation.findById(conversation._id)
        .select(
          'lastOutboundAt inactivityWarnedAt gracefulClosePromptAt gracefulCloseAckAt closeGateSource',
        )
        .lean();
      if (convSnap) {
        const gate = {
          lastInboundAt: now,
          lastOutboundAt: convSnap.lastOutboundAt,
          inactivityWarnedAt: convSnap.inactivityWarnedAt,
          gracefulClosePromptAt: convSnap.gracefulClosePromptAt,
          gracefulCloseAckAt: convSnap.gracefulCloseAckAt,
          closeGateSource: convSnap.closeGateSource,
        };
        const inboxSettings = await loadInboxSettings(String(conversation.clientId));
        applyInboundCloseGate(
          gate,
          data.body,
          inboxSettings.gracefulCloseDetectPhrases !== false,
        );
        if (gate.inactivityWarnedAt) setFields.inactivityWarnedAt = gate.inactivityWarnedAt;
        if (gate.gracefulClosePromptAt) setFields.gracefulClosePromptAt = gate.gracefulClosePromptAt;
        if (gate.gracefulCloseAckAt) setFields.gracefulCloseAckAt = gate.gracefulCloseAckAt;
        if (gate.closeGateSource) setFields.closeGateSource = gate.closeGateSource;
        const unset: Record<string, ''> = {};
        if (!gate.inactivityWarnedAt) unset.inactivityWarnedAt = '';
        if (!gate.gracefulClosePromptAt) unset.gracefulClosePromptAt = '';
        if (!gate.gracefulCloseAckAt) unset.gracefulCloseAckAt = '';
        if (!gate.closeGateSource) unset.closeGateSource = '';
        if (Object.keys(unset).length) {
          updateDoc.$unset = { ...(updateDoc.$unset as Record<string, ''> | undefined), ...unset };
        }
      }
    }
    await WebChatConversation.updateOne({ _id: conversation._id }, updateDoc);

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

  /** Mensagem automática ao visitante (ex.: status de pedido PIX). */
  async sendCatalogAutomatedReply(
    clientId: string,
    conversationId: string,
    body: string,
    senderName = 'Equipe',
  ): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) return;
    const conversation = await WebChatConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!conversation || conversation.status === 'closed') return;
    const text = body.trim();
    if (!text) return;
    await this.appendMessage(conversation, {
      direction: 'outbound',
      body: text,
      senderUserId: WEBCHAT_BOT_SENDER_ID,
      senderName,
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
      name = await this.agentDisplayName(clientId, userId);
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

    await this.assertOrigin(widget, origin, referer);

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
    await this.assertOrigin(widget, origin, referer);

    const messages = await WebChatMessage.find({
      conversationId: conversation._id,
      ...VISITOR_VISIBLE_WEBCHAT_MESSAGE_QUERY,
    })
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
    await this.assertOrigin(widget, origin, referer);

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
    await this.assertOrigin(widget, origin, referer);

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
    const text = assertWebChatVisitorMessage(body);

    const conversation = await this.resolveVisitorToken(visitorToken);
    if (!conversation) throw new Error('Sessão inválida ou encerrada');

    const widget = await WebChatWidget.findById(conversation.widgetId);
    if (!widget?.active) throw new Error('Widget inativo');

    await this.assertOrigin(widget, origin, referer);

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

    const phone = conversation.visitorPhone?.trim();
    const destId = conversation.destinationId ? String(conversation.destinationId) : undefined;
    if (phone && destId) {
      const { LeadFormService } = await import('../leads/LeadFormService');
      void LeadFormService.getInstance()
        .maybeCaptureWebChatCommercialIntent(clientIdStr, {
          webchatConversationId: convId,
          phone,
          name: conversation.visitorName?.trim() || phone,
          message: text,
          destinationId: destId,
          pageUrl: conversation.pageUrl,
          pageTitle: conversation.pageTitle,
        })
        .catch(err => {
          this.serviceLogger.warn('Falha ao capturar lead comercial WebChat', {
            clientId: clientIdStr,
            error: (err as Error).message,
          });
        });
    }

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
      await WebChatMessage.find({
        conversationId: conversation._id,
        ...VISITOR_VISIBLE_WEBCHAT_MESSAGE_QUERY,
      })
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
      replies.push(...(await this.runVisitorAutomationPipeline(freshAfterInbound, widget, text)));
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
    await this.assertOrigin(widget, origin, referer);

    const clientIdStr = String(conversation.clientId);
    const convId = String(conversation._id);
    try {
      await assertWebChatSendAllowed(clientIdStr, convId, 'visitor');
    } catch (err) {
      if (err instanceof WebChatSendRateLimitError) throw err;
      throw err;
    }

    const mediaUrl = saveWebChatMedia(clientIdStr, parsed.data, parsed.ext);

    const msg = await this.appendMessage(conversation, {
      direction: 'inbound',
      body: parsed.body,
      mediaType: parsed.mediaType,
      mediaUrl,
      mediaMime: parsed.mime,
      mediaFileName: parsed.fileName,
    });

    const { CatalogSalesService } = await import('../catalog/CatalogSalesService');
    void CatalogSalesService.getInstance()
      .handleInboundProof({
        clientId: clientIdStr,
        conversation: {
          conversationId: convId,
          channel: 'webchat',
          destinationId: conversation.destinationId ? String(conversation.destinationId) : undefined,
          contactIdentifier: conversation.visitorPhone ?? conversation.visitorEmail,
          contactName: conversation.visitorName ?? 'Visitante',
        },
        media: {
          mediaUrl,
          mediaMime: parsed.mime,
          mediaType: parsed.mediaType,
          messageId: String(msg._id),
        },
      })
      .catch(() => undefined);

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
      replies.push(
        ...(await this.runVisitorAutomationPipeline(freshAfterInbound ?? conversation, widget, '')),
      );
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
    await this.assertOrigin(widget, origin, referer);

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
    await this.assertOrigin(widget, origin, referer);
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
  /**
   * Pipeline unificado por modo: humano → robô/menu → básica → FAQ → premium → fila (híbrido).
   */
  private async runVisitorAutomationPipeline(
    conversation: IWebChatConversation,
    widget: IWebChatWidget,
    text: string,
  ): Promise<WebChatMessageDto[]> {
    const clientIdStr = String(conversation.clientId);
    const convId = String(conversation._id);
    const aiSettings = await AiSettingsService.getInstance().getSettingsDoc(clientIdStr);
    const mode = resolveAttendanceMode(aiSettings);

    if (mode === 'disabled') {
      const fresh = await WebChatConversation.findById(conversation._id);
      if (fresh?.queueStatus === 'bot' && !fresh.assignedUserId) {
        await this.escalateToQueue(clientIdStr, convId, {
          reason: WEBCHAT_QUEUE_WAITING_VISITOR_MESSAGE,
        });
      }
      return [];
    }

    const roboticReplies = await this.tryRoboticTriage(conversation, widget, text);
    if (roboticReplies !== null) return roboticReplies;

    const basicReplies = await this.tryBasicTriage(conversation, widget, text);
    if (basicReplies !== null) return basicReplies;

    const faqReply = await this.tryFaqAutoReply(conversation, widget, text);
    if (faqReply) return [faqReply];

    const autoReplies = await this.maybeAutoReply(conversation, widget);
    if (autoReplies.length > 0) return autoReplies;

    if (mode === 'hybrid') {
      const fresh = await WebChatConversation.findById(conversation._id);
      if (fresh?.queueStatus === 'bot' && !fresh.assignedUserId) {
        await this.escalateToQueue(clientIdStr, convId, {
          reason: 'Encaminhando para atendimento humano.',
        });
      }
    }

    return autoReplies;
  }

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
      } else if (shouldEscalateWebChatOnPremiumAiFailure(usePremiumAi, false)) {
        this.serviceLogger.warn('WebChat IA indisponível — escalando para fila humana', {
          conversationId: String(conversation._id),
          clientId: String(conversation.clientId),
        });
        shouldEscalate = true;
        body =
          (widget.autoReplyMessage ?? DEFAULT_AUTO_REPLY_MESSAGE).trim() ||
          WEBCHAT_QUEUE_WAITING_VISITOR_MESSAGE;
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

  private async maybeNotifyVisitorFallbackMessage(
    conversation: IWebChatConversation,
    settings: Awaited<ReturnType<typeof loadInboxSettings>>,
  ): Promise<boolean> {
    if (conversation.whatsappFallbackVisitorNotifiedAt) return false;
    const body =
      settings.whatsappFallbackVisitorMessage?.trim() ||
      DEFAULT_WHATSAPP_FALLBACK_VISITOR_MESSAGE;
    await this.appendMessage(conversation, {
      direction: 'outbound',
      body,
      senderUserId: WEBCHAT_BOT_SENDER_ID,
      senderName: 'Assistente',
      notifyVisitor: true,
    });
    conversation.whatsappFallbackVisitorNotifiedAt = new Date();
    await conversation.save();
    return true;
  }

  private async appendFallbackRotationMessages(
    clientId: string,
    conversation: IWebChatConversation,
    rotation: FallbackWhatsappRotationResult,
    nowMs: number,
  ): Promise<void> {
    if (rotation.kind === 'none') return;

    const settings = await loadInboxSettings(clientId);
    const visitorLabel =
      conversation.visitorName || conversation.visitorEmail || 'Visitante do site';

    if (rotation.kind === 'sent' || rotation.kind === 'rotated') {
      await this.maybeNotifyVisitorFallbackMessage(conversation, settings);
    }

    if (rotation.kind === 'rotated') {
      await this.appendMessage(conversation, {
        direction: 'system',
        body: `${rotation.agentName} foi alertado no WhatsApp — aguardando !assumir.`,
      });
      emitPanelEvent(clientId, {
        id: crypto.randomUUID(),
        type: 'webchat:fallback_missed',
        title: 'Chat perdido — próximo atendente',
        body: `${visitorLabel} · alerta enviado para ${rotation.agentName}`,
        href: `/platform/inbox?conv=${toWebChatInboxId(String(conversation._id))}`,
        conversationId: toWebChatInboxId(String(conversation._id)),
        targetUserId: rotation.fromUserId,
        urgent: true,
        createdAt: new Date(nowMs).toISOString(),
      });
      return;
    }

    if (rotation.kind === 'sent') {
      await this.appendMessage(conversation, {
        direction: 'system',
        body: `Alerta enviado no WhatsApp para ${rotation.agentName} — aguardando !assumir.`,
      });
      return;
    }

    if (rotation.kind === 'exhausted') {
      await this.maybeNotifyVisitorFallbackMessage(conversation, settings);
      await this.appendMessage(conversation, {
        direction: 'system',
        body: 'Equipe notificada — aguardando retorno pelo WhatsApp.',
      });
      emitPanelEvent(clientId, {
        id: crypto.randomUUID(),
        type: 'webchat:fallback_missed',
        title: 'Chat perdido — fallback WhatsApp',
        body: `${visitorLabel} · tempo esgotado sem aceite`,
        href: `/platform/inbox?conv=${toWebChatInboxId(String(conversation._id))}`,
        conversationId: toWebChatInboxId(String(conversation._id)),
        targetUserId: conversation.suggestedUserId?.trim() || undefined,
        urgent: true,
        createdAt: new Date(nowMs).toISOString(),
      });
    }
  }

  /** Sem atendente online / fila aberta — alerta WA imediato se configurado (0s). */
  private async maybeTriggerNoAgentFallbackOnEscalate(
    clientId: string,
    conversation: IWebChatConversation,
  ): Promise<void> {
    const settings = await loadInboxSettings(clientId);
    if (!settings.whatsappFallbackEnabled) return;

    const mode = resolveFallbackWaitMode(clientId, conversation);
    if (mode !== 'no_agent_available') return;

    const noAgentSec = resolveFallbackAcceptTimeoutSeconds(settings, mode);
    if (noAgentSec > 0) return;

    const rotation = await processFallbackWhatsappRotation(clientId, conversation, {
      immediate: true,
    });
    await this.appendFallbackRotationMessages(
      clientId,
      conversation,
      rotation,
      Date.now(),
    );
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
    conversation.whatsappFallbackTriedUserIds = undefined;
    conversation.whatsappFallbackWaNotifiedUserId = undefined;
    conversation.whatsappFallbackWaNotifiedAt = undefined;
    conversation.whatsappFallbackVisitorNotifiedAt = undefined;
    conversation.whatsappFallbackAlertSentAt = undefined;
    conversation.whatsappFallbackPriorityStartedAt = undefined;
    if (departmentOid) conversation.departmentId = departmentOid;
    await conversation.save();

    const dept = departmentOid
      ? await InboxDepartment.findById(departmentOid).select('name').lean()
      : null;

    const systemBody = resolveWebChatEscalationSystemMessage({
      reason: opts.reason,
      departmentName: dept?.name,
    });

    await this.appendMessage(conversation, {
      direction: 'system',
      body: systemBody,
    });

    if (departmentOid) {
      const rr = await InboxService.getInstance().suggestRoundRobinAgent(clientId, departmentOid);
      if (rr?.kind === 'suggested') {
        conversation.suggestedUserId = rr.userId;
        conversation.suggestedAt = new Date();
        conversation.whatsappFallbackPriorityStartedAt = new Date();
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
      } else if (rr?.kind === 'all_busy') {
        await this.appendMessage(conversation, {
          direction: 'system',
          body: 'Nossos atendentes estão em atendimento agora. Você entrou na fila e será chamado assim que possível.',
        });
        await this.maybeTriggerNoAgentFallbackOnEscalate(clientId, conversation);
      } else {
        await this.maybeTriggerNoAgentFallbackOnEscalate(clientId, conversation);
      }
    } else {
      await this.maybeTriggerNoAgentFallbackOnEscalate(clientId, conversation);
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
      .select(
        'clientId whatsappFallbackAcceptTimeoutSeconds whatsappFallbackNoAgentTimeoutSeconds',
      )
      .lean();

    const nowMs = Date.now();
    const cooldownCutoff = new Date(nowMs - FALLBACK_EXHAUSTED_COOLDOWN_MS);

    for (const row of rows) {
      const clientId = String(row.clientId);
      const timingSettings = {
        whatsappFallbackAcceptTimeoutSeconds: row.whatsappFallbackAcceptTimeoutSeconds,
        whatsappFallbackNoAgentTimeoutSeconds: row.whatsappFallbackNoAgentTimeoutSeconds,
      };

      const candidates = await WebChatConversation.find({
        clientId: row.clientId,
        status: 'open',
        queueStatus: 'waiting_human',
        assignedUserId: { $in: [null, undefined, ''] },
        $or: [
          { whatsappFallbackAlertSentAt: { $exists: false } },
          { whatsappFallbackAlertSentAt: null },
          { whatsappFallbackAlertSentAt: { $lte: cooldownCutoff } },
        ],
      })
        .limit(25)
        .exec();

      for (const conv of candidates) {
        if (!isFallbackAcceptTimeoutElapsed(clientId, conv, timingSettings, nowMs)) continue;

        const fresh = await WebChatConversation.findById(conv._id);
        if (!fresh) continue;
        if (fresh.status === 'closed' || fresh.queueStatus !== 'waiting_human') continue;
        if (fresh.assignedUserId?.trim()) continue;

        const rotation = await processFallbackWhatsappRotation(clientId, fresh, {
          allowRetry: shouldRetryFallbackAfterCooldown(
            fresh.whatsappFallbackAlertSentAt,
            FALLBACK_EXHAUSTED_COOLDOWN_MS,
            nowMs,
          ),
        });

        if (rotation.kind === 'none') continue;

        await this.appendFallbackRotationMessages(clientId, fresh, rotation, nowMs);
      }
    }
  }

  /** Encerra conversas WebChat na fila após tempo máximo (opção 2 — equilibrada). */
  async processWebChatQueueMaxWait(): Promise<void> {
    const rows = await InboxSettings.find({
      whatsappFallbackEnabled: true,
      webchatQueueMaxWaitMinutes: { $gt: 0 },
    })
      .select('clientId webchatQueueMaxWaitMinutes webchatQueueMaxWaitCloseMessage')
      .lean();

    const nowMs = Date.now();

    for (const row of rows) {
      const clientId = String(row.clientId);
      const maxMin = Math.min(480, Math.max(1, Number(row.webchatQueueMaxWaitMinutes) || 0));
      const closeMessage =
        row.webchatQueueMaxWaitCloseMessage?.trim() ||
        DEFAULT_WEBCHAT_QUEUE_MAX_WAIT_CLOSE_MESSAGE;
      const cutoff = new Date(nowMs - maxMin * 60_000);

      const convs = await WebChatConversation.find({
        clientId: row.clientId,
        status: 'open',
        queueStatus: 'waiting_human',
        assignedUserId: { $in: [null, undefined, ''] },
        queueEnteredAt: { $lte: cutoff },
        whatsappBridgeActive: { $ne: true },
      })
        .limit(20)
        .exec();

      for (const conv of convs) {
        try {
          await this.appendMessage(conv, {
            direction: 'outbound',
            body: closeMessage,
            senderUserId: WEBCHAT_BOT_SENDER_ID,
            senderName: 'Assistente',
            notifyVisitor: true,
          });
          await this.closeConversation(clientId, String(conv._id), WEBCHAT_BOT_SENDER_ID, {
            skipSystemMessage: true,
          });
        } catch (err) {
          this.serviceLogger.warn('Falha ao encerrar WebChat por tempo máximo na fila', {
            clientId,
            conversationId: String(conv._id),
            err,
          });
        }
      }
    }
  }

  /** Encerra triagem WebChat quando o visitante não interage (SLA configurável em Inbox → Bot). */
  async processWebChatTriageInactivity(): Promise<void> {
    const rows = await InboxSettings.find({})
      .select(
        'clientId triageInactivityEnabled triageWarningMinutes triageCloseAfterWarningMinutes triageWarningMessage triageCloseMessage',
      )
      .lean();

    const nowMs = Date.now();
    for (const row of rows) {
      if (row.triageInactivityEnabled === false) continue;

      const clientId = String(row.clientId);
      const warningMinutes =
        row.triageWarningMinutes ?? DEFAULT_INBOX_TRIAGE_INACTIVITY.triageWarningMinutes;
      const closeAfterWarningMinutes =
        row.triageCloseAfterWarningMinutes ??
        DEFAULT_INBOX_TRIAGE_INACTIVITY.triageCloseAfterWarningMinutes;
      const warnTemplate =
        row.triageWarningMessage?.trim() || DEFAULT_INBOX_TRIAGE_INACTIVITY.triageWarningMessage;
      const closeTemplate =
        row.triageCloseMessage?.trim() || DEFAULT_INBOX_TRIAGE_INACTIVITY.triageCloseMessage;

      const config = {
        enabled: true,
        warningMinutes,
        closeAfterWarningMinutes,
      };

      const convs = await WebChatConversation.find({
        clientId: row.clientId,
        status: 'open',
        queueStatus: 'bot',
        $or: [{ assignedUserId: { $exists: false } }, { assignedUserId: null }, { assignedUserId: '' }],
        whatsappBridgeActive: { $ne: true },
      })
        .limit(80)
        .exec();

      for (const conv of convs) {
        const ts = {
          lastInboundAt: conv.lastInboundAt,
          lastOutboundAt: conv.lastOutboundAt,
          inactivityWarnedAt: conv.inactivityWarnedAt,
          createdAt: conv.createdAt,
        };

        const visitorName = conv.visitorName?.trim() || 'visitante';
        const warnBody = applyQuickReplyTemplate(warnTemplate, visitorName);
        const closeBody = applyQuickReplyTemplate(closeTemplate, visitorName);

        if (
          shouldSendTriageInactivityWarning(ts, config, nowMs) ||
          shouldSendTriageStallWarning(ts, warningMinutes, true, nowMs)
        ) {
          try {
            await this.appendMessage(conv, {
              direction: 'outbound',
              body: warnBody,
              senderUserId: WEBCHAT_BOT_SENDER_ID,
              senderName: 'Assistente',
            });
            await WebChatConversation.updateOne(
              { _id: conv._id },
              { $set: { inactivityWarnedAt: new Date(nowMs), lastOutboundAt: new Date(nowMs) } },
            );
          } catch (err) {
            this.serviceLogger.warn('Falha ao avisar inatividade WebChat triagem', {
              clientId,
              conversationId: String(conv._id),
              err,
            });
          }
          continue;
        }

        if (
          shouldCloseTriageInactivity(ts, config, nowMs) ||
          shouldAutoCloseTriageStalled(ts, warningMinutes, true, nowMs)
        ) {
          try {
            await this.appendMessage(conv, {
              direction: 'outbound',
              body: closeBody,
              senderUserId: WEBCHAT_BOT_SENDER_ID,
              senderName: 'Assistente',
            });
            await this.closeConversation(clientId, String(conv._id), WEBCHAT_BOT_SENDER_ID, {
              skipSystemMessage: true,
            });
          } catch (err) {
            this.serviceLogger.warn('Falha ao encerrar WebChat triagem por inatividade', {
              clientId,
              conversationId: String(conv._id),
              err,
            });
          }
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

    await this.assertWebChatInboxAccess(clientId, userId, conversation);

    if (
      conversation.queueStatus === 'with_agent' &&
      conversation.assignedUserId &&
      String(conversation.assignedUserId) === String(userId)
    ) {
      const inboxSettings = await loadInboxSettings(clientId);
      const agentName = await this.agentDisplayName(clientId, userId);
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
      const [inboxSettings, org] = await Promise.all([
        loadInboxSettings(clientId),
        Organization.findById(clientId).select('plan').lean(),
      ]);
      const maxConcurrent = resolveMaxConcurrentChatsForPlan(
        (org?.plan as string | undefined) ?? 'free',
        inboxSettings.maxConcurrentChatsPerAgent,
      );
      const canTake = await canAgentManuallyAssumeConversation(clientId, userId, maxConcurrent, {
        webChatConversationId: String(conversation._id),
      });
      if (canTake.ok === false) {
        throw new Error(formatManualAssumeBlockMessage(canTake.reason, maxConcurrent));
      }
    }

    const pulledFrom = conversation.suggestedUserId;
    const wasPull = Boolean(pulledFrom && String(pulledFrom) !== String(userId));

    conversation.suggestedUserId = undefined;
    conversation.suggestedAt = undefined;
    conversation.assignedUserId = userId;
    conversation.queueStatus = 'with_agent';
    if (!conversation.acceptedAt) {
      conversation.acceptedAt = new Date();
    }
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const agentName = await this.agentDisplayName(clientId, userId);

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

  private async assertWebChatInboxAccess(
    clientId: string,
    userId: string,
    conv: Pick<
      IWebChatConversation,
      'status' | 'queueStatus' | 'assignedUserId' | 'suggestedUserId' | 'departmentId'
    >,
  ): Promise<void> {
    const { InboxService } = await import('@/services/inbox/InboxService');
    const { isUnassignedTriageBlockedForAttendant } = await import(
      '@/services/inbox/inbox-department-visibility.util'
    );
    const visibility = await InboxService.getInstance().getDepartmentVisibility(clientId, userId);
    if (
      visibility.restricted &&
      conv.departmentId &&
      !visibility.departmentIds.some(id => id.equals(conv.departmentId!))
    ) {
      throw new Error('Sem permissão para este setor');
    }
    const inboxSettings = await loadInboxSettings(clientId);
    if (
      isUnassignedTriageBlockedForAttendant(visibility, {
        attendantTriageVisible: inboxSettings.attendantTriageVisible === true,
        status: mapWebChatToInboxStatus(conv.status, conv.queueStatus),
        assignedUserId: conv.assignedUserId
          ? new mongoose.Types.ObjectId(String(conv.assignedUserId))
          : null,
        suggestedUserId: conv.suggestedUserId
          ? new mongoose.Types.ObjectId(String(conv.suggestedUserId))
          : null,
        departmentId: conv.departmentId
          ? new mongoose.Types.ObjectId(String(conv.departmentId))
          : null,
      })
    ) {
      throw new Error('Triagem restrita — habilite em Triagem e Bot');
    }
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
    if (mentionsSupervisor(raw)) {
      throw new Error(
        'Para mencionar @supervisor, use a aba "Chat interno" no Inbox — esta mensagem não pode ser enviada ao visitante.',
      );
    }

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
    const warnCode = resolveInactivityWarningQuickCode(settings);
    const closeCode = resolveInactivityCloseQuickCode(settings);
    const maisCode = resolveGracefulCloseQuickCode(settings);
    const encOkCode = resolveInactivityCloseGracefulQuickCode(settings);

    const freshBefore = await WebChatConversation.findById(conversation._id);
    if (isInactivityCloseQuickCode(quickCode, settings) && freshBefore) {
      const inactivityGateEnabled = resolveInactivityCloseQuickReplyGateEnabled(settings);
      const encAllowed = isEncInactivityCloseQuickReplyAllowed(
        {
          lastInboundAt: freshBefore.lastInboundAt,
          lastOutboundAt: freshBefore.lastOutboundAt,
          inactivityWarnedAt: freshBefore.inactivityWarnedAt,
          gracefulClosePromptAt: freshBefore.gracefulClosePromptAt,
          gracefulCloseAckAt: freshBefore.gracefulCloseAckAt,
          closeGateSource: freshBefore.closeGateSource,
        },
        {
          inactivityCloseGateWaitMinutes: resolveInactivityCloseGateWaitMinutes(settings),
        },
      );
      if (inactivityGateEnabled && !encAllowed) {
        const afterAus = resolveInactivityCloseGateWaitMinutes(settings);
        throw new Error(
          `O atalho /${closeCode} só libera após enviar /${warnCode} e aguardar ${afterAus} min.`,
        );
      }
    }

    if (isInactivityCloseGracefulQuickCode(quickCode, settings) && freshBefore) {
      const gracefulGateEnabled = resolveGracefulCloseQuickReplyGateEnabled(settings);
      const encOkAllowed = isEncOkCloseQuickReplyAllowed(
        {
          lastInboundAt: freshBefore.lastInboundAt,
          lastOutboundAt: freshBefore.lastOutboundAt,
          inactivityWarnedAt: freshBefore.inactivityWarnedAt,
          gracefulClosePromptAt: freshBefore.gracefulClosePromptAt,
          gracefulCloseAckAt: freshBefore.gracefulCloseAckAt,
          closeGateSource: freshBefore.closeGateSource,
        },
        {
          gracefulCloseAfterPromptMinutes:
            settings.gracefulCloseAfterPromptMinutes ??
            DEFAULT_INBOX_SLA.gracefulCloseAfterPromptMinutes,
        },
      );
      if (gracefulGateEnabled && !encOkAllowed) {
        const afterMais =
          settings.gracefulCloseAfterPromptMinutes ??
          DEFAULT_INBOX_SLA.gracefulCloseAfterPromptMinutes;
        throw new Error(
          `O atalho /${encOkCode} só libera após enviar /${maisCode} (${afterMais} min ou resposta do cliente).`,
        );
      }
    }

    const clientIdStr = String(conversation.clientId);
    const convId = String(conversation._id);
    const agentName =
      senderName?.trim() || (await this.agentDisplayName(clientIdStr, userId));

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

    const gateDoc = await WebChatConversation.findById(conversation._id);
    if (gateDoc) {
      applyOutboundCloseGate(gateDoc, quickCode, settings, warnCode, closeCode, maisCode, encOkCode);
      await gateDoc.save();
    }

    if (
      isInactivityCloseQuickCode(quickCode, settings) ||
      isInactivityCloseGracefulQuickCode(quickCode, settings)
    ) {
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
    const agentName =
      senderName?.trim() || (await this.agentDisplayName(clientId, userId));
    const mediaUrl = saveWebChatMedia(clientId, parsed.data, parsed.ext);

    const msg = await this.appendMessage(conversation, {
      direction: 'outbound',
      body: parsed.body,
      senderUserId: userId,
      senderName: agentName,
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

    const agentName = await this.agentDisplayName(clientId, userId);
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

    const agentName = await this.agentDisplayName(clientId, userId);

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

    clearCloseGateFields(conversation);
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

    const { LeadFormService } = await import('@/services/leads/LeadFormService');
    void LeadFormService.getInstance().syncCaptureAfterConversationClosed(clientId, {
      webchatConversationId: convId,
      closedByUserId: _userId,
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
    await this.assertOrigin(widget, opts.origin, opts.referer);

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
    await this.assertOrigin(widget, opts.origin, opts.referer);

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
    await this.assertOrigin(widget, opts.origin, opts.referer);

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

    const messages = await WebChatMessage.find({
      conversationId: conversation._id,
      ...VISITOR_VISIBLE_WEBCHAT_MESSAGE_QUERY,
    })
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

    const agentName = await this.agentDisplayName(clientId, targetUserId);

    if (mode === 'assign') {
      conversation.assignedUserId = targetUserId;
      conversation.suggestedUserId = undefined;
      conversation.suggestedAt = undefined;
      conversation.whatsappFallbackPriorityStartedAt = undefined;
      conversation.queueStatus = 'with_agent';
      if (!conversation.acceptedAt) {
        conversation.acceptedAt = new Date();
      }
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
      if (!conversation.whatsappFallbackPriorityStartedAt) {
        conversation.whatsappFallbackPriorityStartedAt = new Date();
      }
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

  private async agentDisplayName(clientId: string, userId: string): Promise<string> {
    const { resolveAgentChatDisplayName } = await import(
      '@/services/organization/chat-display-name.service'
    );
    return resolveAgentChatDisplayName(clientId, userId);
  }
}
