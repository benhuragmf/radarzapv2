import mongoose from 'mongoose';
import { IDestination, Destination } from '@/models/Destination';
import { generateInboxTicketRef } from '@/utils/inbox-ticket-ref';
import { InboxTicket, IInboxTicket } from '@/models/InboxTicket';
import { WebChatConversation } from '@/models/WebChatConversation';
import { mapWebChatToInboxStatus } from '../webchat/webchat-inbox-bridge';
import { InboxDepartment, IInboxDepartment } from '@/models/InboxDepartment';
import { InboxConversation, IInboxConversation } from '@/models/InboxConversation';
import { InboxMessage } from '@/models/InboxMessage';
import { InboxTransfer } from '@/models/InboxTransfer';
import { ConsentService } from '@/services/consent/ConsentService';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { CompanyMember } from '@/models/CompanyMember';
import { CompanyRole } from '@/auth/rbac/roles';
import {
  buildAgentJoinMessage,
  buildInboxTriageMenu,
  buildInvalidMenuHint,
  buildOutsideHoursMessage,
  buildQueueConfirmation,
  buildResolvedMessage,
  buildTransferMessage,
  loadActiveDepartments,
  loadClientVisibleDepartments,
  loadInboxSettings,
  parseInboxMenuChoice,
} from '@/constants/inbox-triage';
import { InboxSettings, IInboxSettings } from '@/models/InboxSettings';
import { Organization } from '@/models/Organization';
import { User } from '@/models/User';
import { InboxConversationStatus, InboxMessageMediaType } from '@/types/inbox';
import { DEFAULT_INBOX_SLA, DEFAULT_INBOX_TRIAGE_INACTIVITY, INBOX_WEEKDAYS, InboxWeeklySchedule } from '@/types/inbox-settings';
import {
  applyQuickReplyTemplate,
  expandQuickReply,
  normalizeQuickReplies,
  parseQuickReplyCode,
  InboxQuickReply,
  resolveInactivityWarningQuickCode,
  resolveInactivityCloseQuickCode,
  resolveGracefulCloseQuickCode,
  resolveInactivityCloseGracefulQuickCode,
  isInactivityWarningQuickCode,
  isInactivityCloseQuickCode,
  isInactivityCloseGracefulQuickCode,
  isGracefulCloseQuickCode,
  inactivityCloseAfterWarningMinutes,
} from '@/types/inbox-quick-replies';
import { INBOX_MEDIA_LABEL } from '@/utils/inbox-media-storage';
import { WebhookDispatcherService } from '@/services/integrations/WebhookDispatcherService';
import { recordAttendanceEvent } from '@/services/attendance/attendance-audit.service';
import {
  attachClassificationToConversationRows,
  classifyDestination,
  loadCampaignClassificationContext,
} from '@/services/destinations/destination-classification.service';
import { AiConversationService } from '@/services/ai/AiConversationService';
import { AiBasicTriageService } from '@/services/ai/AiBasicTriageService';
import { AiSettingsService } from '@/services/ai/AiSettingsService';
import { resolveAttendanceMode } from '@/types/attendance-mode';
import { sanitizePremiumAiResponse } from '@/types/premium-ai.util';
import { AiConversationState } from '@/models/AiConversationState';
import { AiConversationStatus } from '@/types/ai-assistant';
import {
  InboxTicketStatus,
  INBOX_TICKET_STATUS_LABEL,
  buildTicketFollowUpMenu,
  parseTicketClientExit,
  parseTicketFinalize,
  isNewServiceGreeting,
  isTicketClientAcknowledgment,
  parseTicketFollowUpChoice,
  parseTicketStatusRequest,
  TICKET_CLIENT_EXIT_ACK,
  TICKET_CLIENT_GRACE_EXPIRED_ACK,
  TICKET_CLIENT_REPLY_FOOTER,
  TICKET_CLIENT_REPLY_GRACE_MS,
  TICKET_CLIENT_REPLY_GRACE_PROMPT,
  TICKET_CLOSE_REPLY_HINT,
  TICKET_FOLLOW_UP_MENU_AFTER_MS,
  TICKET_FOLLOW_UP_TICKET_READY,
  TICKET_POST_CLOSE_REPLY_HOURS,
  normalizeTicketMenuKeyword,
  ticketIsActive,
  type TicketInboundMode,
} from '@/types/inbox-ticket';
import { isWithinBusinessHours } from '@/services/inbox/inbox-business-hours';
import { emitInboxEvent } from '@/services/inbox/InboxRealtime';
import { emitPanelEvent, PanelEventType } from '@/services/inbox/PanelNotifications';
import { notifySupervisorInternalChatMention } from '@/services/inbox/inbox-supervisor-notify.service';
import crypto from 'crypto';
import {
  getQueuePriorityState,
  getQueueWaitState,
  elapsedSecSince,
  isSuggestedUserBusy,
  isAgentAtCapacity,
  getQueuePositionForConversation,
} from '@/services/inbox/inbox-queue-priority';
import {
  getAgentPresence,
  isAgentAvailableForQueue,
  isAgentOnline,
  setAgentPresenceTimeout,
} from '@/services/inbox/inbox-agent-presence';
import {
  canAgentManuallyAssumeConversation,
  canAgentReceiveNewAssignment,
  formatManualAssumeBlockMessage,
  resolveMaxConcurrentChatsForPlan,
} from '@/services/inbox/agent-availability';
import {
  assertInboxOrganizationMember,
  canOverrideAssignedConversation,
} from '@/services/inbox/inbox-org-access.util';
import { filterQueueEligibleAgentIds } from '@/services/inbox/inbox-queue-eligibility.util';
import {
  shouldAlertQueueStall,
  shouldAutoCloseForInactivity,
  shouldAutoCloseTriageStalled,
  shouldCloseTriageInactivity,
  shouldSendInactivityWarning,
  shouldSendTriageInactivityWarning,
  shouldSendTriageStallWarning,
  isInactivityCloseQuickReplyAllowed,
  isEncInactivityCloseQuickReplyAllowed,
  isEncOkCloseQuickReplyAllowed,
  isGracefulCloseQuickReplyAllowed,
  triageInactivityTotalMinutes,
  triageWaitElapsedSec,
  triageWaitUrgency,
} from '@/services/inbox/inbox-inactivity';
import { parseCsatScore, isCsatIntent, DEFAULT_CSAT_PROMPT, shouldBypassCsatForNewService } from '@/services/inbox/csat.util';
import {
  applyInboundCloseGate,
  applyOutboundCloseGate,
  clearCloseGateFields,
} from '@/services/inbox/inbox-graceful-close.util';
import {
  applyRestrictedWaListVisibility,
  isUnassignedTriageBlockedForAttendant,
} from '@/services/inbox/inbox-department-visibility.util';
import {
  closedTicketReplyWindowMongoFilter,
  isClosedTicketReplyWindowActive,
} from '@/services/inbox/ticket-reply-window.util';
import { ContactAutoSegmentService } from '@/services/contacts/ContactAutoSegmentService';
import { isLeadInboxDepartment } from '@/constants/contact-segments';
import { LEAD_CAPTURE_ORIGIN_LABEL, type LeadCaptureOrigin } from '@/types/lead-form';
import { LeadCapture } from '@/models/LeadCapture';
import { LeadFormService } from '@/services/leads/LeadFormService';
import {
  departmentInternalRank,
  formatInternalRankLabel,
  INBOX_INTERNAL_RANK_MIN,
} from '@/types/inbox-department';
import { departmentBadgeFieldsFrom } from '@/services/inbox/inbox-department-badge.util';
import {
  buildRepairedMenuKeyPlan,
  departmentMenuKeysNeedRepair,
  nextInternalMenuKeyFrom,
  nextPublicMenuKeyFrom,
} from '@/services/inbox/inbox-department-menu-key.util';
import { createServiceLogger } from '@/utils/logger';
import {
  ensureInboxTicketPublicAccessToken,
} from '@/services/inbox/ticket-public-access.service';
import type { InboxMenuContext } from '@/types/inbox-menu-context';
import { TicketClientMenuService } from '@/services/inbox/TicketClientMenuService';
import { serializeTicketDisplayFields } from '@/services/inbox/ticket-display-status';
import type { TicketBriefForAssist } from '@/types/ticket-assist';
import {
  applyTeamSlaOnClientReply,
  clearTeamSlaOnTeamReply,
} from '@/services/inbox/ticket-team-sla';
import { type ConversationAiStatus, isAiFallbackExpired } from '@/types/inbox-conversation-ai';
import {
  evaluateTicketInboundRouting,
  buildTicketGraceExpiredMenu,
  parseTicketGraceExpiredChoice,
  TICKET_GRACE_REOPEN_ACK,
  TICKET_WAITING_RETURN_ACK,
  wantsNewInboundService,
} from '@/services/inbox/inbound-routing';
import { setContactMenuContext } from '@/services/inbox/menu-context';
import {
  isDuplicateInboundMessage,
  markInboundMessageProcessed,
} from '@/services/inbox/inbound-dedup';

export interface InboxInboundPayload {
  text?: string;
  whatsappMessageId?: string;
  media?: {
    mediaType: InboxMessageMediaType;
    mediaUrl: string;
    mediaMime?: string;
    whatsappMessageId?: string;
  };
}

const TERMINAL_STATUSES = new Set<InboxConversationStatus>([
  InboxConversationStatus.RESOLVED,
  InboxConversationStatus.CLOSED,
]);

const TICKET_NOT_DELETED = {
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

const logger = createServiceLogger('InboxService');

/** Campos mínimos para timer de grace (lean ou documento). */
type ClientReplyGraceTicket = Pick<IInboxTicket, 'ticketRef' | 'clientReplyGraceUntil'>;

/** Linha de ticket para listagem/enriquecimento (sem Document do Mongoose). */
type TicketEnrichmentRow = Pick<
  IInboxTicket,
  | '_id'
  | 'ticketRef'
  | 'status'
  | 'channel'
  | 'conversationId'
  | 'webChatConversationId'
  | 'contactName'
  | 'contactIdentifier'
  | 'departmentId'
  | 'assignedUserId'
  | 'openedByUserId'
  | 'closedByUserId'
  | 'updatedAt'
  | 'closedAt'
  | 'createdAt'
  | 'unreadClientReply'
  | 'clientReplyPaused'
  | 'clientReplyExpiresAt'
  | 'clientReplyGraceUntil'
  | 'teamHasMessagedClient'
  | 'lastTeamMessageAt'
  | 'teamSlaDueAt'
  | 'teamSlaBreachedAt'
>;

export class InboxService {
  private static instance: InboxService;

  private graceTimers = new Map<string, NodeJS.Timeout>();
  private graceMonitorStarted = false;
  private slaMonitorStarted = false;

  static getInstance(): InboxService {
    if (!InboxService.instance) InboxService.instance = new InboxService();
    return InboxService.instance;
  }

  private async resolveMaxConcurrentForClient(clientId: string): Promise<number> {
    const [settings, org] = await Promise.all([
      loadInboxSettings(clientId),
      Organization.findById(clientId).select('plan').lean(),
    ]);
    return resolveMaxConcurrentChatsForPlan(
      (org?.plan as string | undefined) ?? 'free',
      settings.maxConcurrentChatsPerAgent,
    );
  }

  /** Alerta supervisão quando atendente desconecta com conversas ativas (TOP 05). */
  async notifyAgentWentOffline(clientId: string, userId: string): Promise<void> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const active = await InboxConversation.find({
      clientId: clientOid,
      assignedUserId: new mongoose.Types.ObjectId(userId),
      status: InboxConversationStatus.IN_PROGRESS,
    })
      .limit(25)
      .lean();
    if (!active.length) return;

    const agentName = await this.resolveAgentDisplayName(userId);
    for (const conv of active) {
      await this.pushPanelEvent(
        clientId,
        'inbox:agent_offline_risk',
        'Atendente offline — atenção',
        `${conv.contactName ?? 'Cliente'}: ${agentName} ficou offline com atendimento em andamento`,
        { conversationId: String(conv._id) },
      );
    }
  }

  async setConversationAiStatus(
    clientId: string,
    conversationId: string,
    aiStatus: ConversationAiStatus | null,
    aiFallbackUntil?: Date,
  ): Promise<void> {
    const update: Record<string, unknown> = { aiStatus };
    if (aiFallbackUntil) update.aiFallbackUntil = aiFallbackUntil;
    else if (aiStatus !== 'ai_fallback_standard') update.aiFallbackUntil = null;

    await InboxConversation.updateOne(
      {
        _id: new mongoose.Types.ObjectId(conversationId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      { $set: update },
    );
  }

  async clearConversationAi(clientId: string, conversationId: string): Promise<void> {
    await InboxConversation.updateOne(
      {
        _id: new mongoose.Types.ObjectId(conversationId),
        clientId: new mongoose.Types.ObjectId(clientId),
      },
      { $set: { aiStatus: null, aiFallbackUntil: null } },
    );
  }

  private async syncHumanAssignedAiState(clientId: string, conversationId: string): Promise<void> {
    await AiConversationState.updateOne(
      { conversationId: new mongoose.Types.ObjectId(conversationId) },
      { status: AiConversationStatus.HUMAN_ASSIGNED },
    );
    await this.setConversationAiStatus(clientId, conversationId, 'human_assigned');
  }

  /** Recupera timers de grace após restart e varre tickets expirados + SLA Inbox. */
  startClientReplyGraceMonitor(): void {
    if (this.graceMonitorStarted) return;
    this.graceMonitorStarted = true;
    setInterval(() => void this.processExpiredClientReplyGrace(), 60_000);
    void this.bootstrapClientReplyGraceTimers();
    void this.processExpiredClientReplyGrace();
    this.startInactivitySlaMonitor();
  }

  private startInactivitySlaMonitor(): void {
    if (this.slaMonitorStarted) return;
    this.slaMonitorStarted = true;
    setInterval(() => void this.processInactivityAndQueueSla(), 60_000);
    void this.processInactivityAndQueueSla();
  }

  async ensureDepartments(clientId: string) {
    await this.repairDepartmentMenuKeysIfNeeded(clientId);
    return loadActiveDepartments(clientId);
  }

  /** Corrige menuKey: internos usam i1,i2…; públicos 1,2,3… sem buracos por setor interno. */
  async repairDepartmentMenuKeysIfNeeded(clientId: string): Promise<boolean> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const all = await InboxDepartment.find({ clientId: clientOid }).sort({ sortOrder: 1, createdAt: 1 });
    if (all.length === 0 || !departmentMenuKeysNeedRepair(all)) return false;

    const plan = buildRepairedMenuKeyPlan(all);

    // menuKey maxlength=8 — chaves temporárias curtas (z0, z1…) para não colidir no índice único
    for (let i = 0; i < all.length; i++) {
      all[i].menuKey = `z${i}`;
    }
    await Promise.all(all.map(d => d.save()));

    for (const dept of all) {
      const nextKey = plan.get(String(dept._id));
      if (nextKey) dept.menuKey = nextKey;
    }
    await Promise.all(all.map(d => d.save()));
    logger.info('Menu keys de setores reparados', { clientId, count: all.length });
    return true;
  }

  /** Lista setores para o painel — admins veem todos; atendentes só os permitidos + alvos de transferência. */
  async listDepartmentsForUser(clientId: string, userId: string, opts?: { all?: boolean }) {
    if (opts?.all) {
      await this.repairDepartmentMenuKeysIfNeeded(clientId);
    }
    const depts = await loadActiveDepartments(clientId);
    const visibility = await this.departmentVisibility(clientId, userId);
    const isAdmin = !visibility.restricted;
    const allowed = new Set(visibility.departmentIds.map(String));

    const enriched = await Promise.all(
      depts.map(async d => {
        const canTransferTo =
          isAdmin || (await this.canUserTransferToDepartment(clientId, userId, d));
        const canViewQueue = isAdmin || allowed.has(String(d._id));
        return this.serializeDepartment(d, { canTransferTo, canViewQueue });
      }),
    );

    if (opts?.all) return enriched;
    if (isAdmin) return enriched;
    return enriched.filter(d => d.canViewQueue || d.canTransferTo);
  }

  private serializeDepartment(
    d: IInboxDepartment,
    extras?: { canTransferTo?: boolean; canViewQueue?: boolean },
  ) {
    const internalRank = departmentInternalRank(d);
    return {
      _id: String(d._id),
      name: d.name,
      description: d.description,
      menuKey: d.menuKey,
      clientVisible: d.clientVisible !== false,
      internalRank,
      internalRankLabel: formatInternalRankLabel(internalRank),
      memberUserIds: (d.memberUserIds ?? []).map(String),
      isActive: d.isActive,
      sortOrder: d.sortOrder,
      ...extras,
    };
  }

  async getSettings(clientId: string): Promise<IInboxSettings> {
    return loadInboxSettings(clientId);
  }

  async updateSettings(
    clientId: string,
    patch: Partial<{
      welcomeWithCompany: string;
      welcomeGeneric: string;
      menuIntro: string;
      menuFooter: string;
      queueMessage: string;
      waitingMessage: string;
      outsideHoursMessage: string;
      invalidMenuHint: string;
      resolvedMessage: string;
      transferMessage: string;
      businessHoursEnabled: boolean;
      timezone: string;
      schedule: InboxWeeklySchedule;
      roundRobinEnabled: boolean;
      roundRobinPullTimeoutSeconds: number;
      maxConcurrentChatsPerAgent: number;
      queuePositionMessage: string;
      queueAllBusyMessage: string;
      alertSoundEnabled: boolean;
      alertOnNewChat: boolean;
      alertOnNewMessage: boolean;
      inactivityAutoCloseEnabled: boolean;
      inactivityCloseMinutes: number;
      inactivityWarningMinutes: number;
      inactivityWarningQuickCode?: string;
      inactivityCloseQuickCode?: string;
      gracefulCloseQuickCode?: string;
      gracefulCloseAfterPromptMinutes?: number;
      gracefulCloseDetectPhrases?: boolean;
      inactivityCloseGracefulQuickCode?: string;
      closeQuickReplyGateEnabled?: boolean;
      queueSlaAlertMinutes: number;
      ticketTeamResponseHours: number;
      triageInactivityEnabled: boolean;
      attendantTriageVisible?: boolean;
      triageWarningMinutes: number;
      triageCloseAfterWarningMinutes: number;
      triageWarningMessage: string;
      triageCloseMessage: string;
      csatEnabled: boolean;
      csatPrompt: string;
      csatThankYou: string;
      quickReplies: InboxQuickReply[];
      whatsappFallbackEnabled: boolean;
      whatsappFallbackAlertPhones: string[];
      whatsappFallbackVisitorMessage: string;
      whatsappFallbackAcceptTimeoutSeconds: number;
      whatsappFallbackNoAgentTimeoutSeconds: number;
      webchatQueueMaxWaitMinutes: number;
      webchatQueueMaxWaitCloseMessage: string;
      agentPresenceTimeoutSeconds: number;
      presenceIdleTimeoutSeconds: number;
    }>,
  ): Promise<IInboxSettings> {
    const settings = await InboxSettings.getOrCreate(clientId);
    if (patch.welcomeWithCompany !== undefined) {
      settings.welcomeWithCompany = patch.welcomeWithCompany.trim();
    }
    if (patch.welcomeGeneric !== undefined) settings.welcomeGeneric = patch.welcomeGeneric.trim();
    if (patch.menuIntro !== undefined) settings.menuIntro = patch.menuIntro.trim();
    if (patch.menuFooter !== undefined) settings.menuFooter = patch.menuFooter.trim();
    if (patch.queueMessage !== undefined) settings.queueMessage = patch.queueMessage.trim();
    if (patch.waitingMessage !== undefined) settings.waitingMessage = patch.waitingMessage.trim();
    if (patch.outsideHoursMessage !== undefined) {
      settings.outsideHoursMessage = patch.outsideHoursMessage.trim();
    }
    if (patch.invalidMenuHint !== undefined) settings.invalidMenuHint = patch.invalidMenuHint.trim();
    if (patch.resolvedMessage !== undefined) settings.resolvedMessage = patch.resolvedMessage.trim();
    if (patch.transferMessage !== undefined) settings.transferMessage = patch.transferMessage.trim();
    if (patch.businessHoursEnabled !== undefined) {
      settings.businessHoursEnabled = Boolean(patch.businessHoursEnabled);
    }
    if (patch.roundRobinEnabled !== undefined) {
      settings.roundRobinEnabled = Boolean(patch.roundRobinEnabled);
    }
    if (patch.roundRobinPullTimeoutSeconds !== undefined) {
      const sec = Math.min(900, Math.max(30, Number(patch.roundRobinPullTimeoutSeconds) || 120));
      settings.roundRobinPullTimeoutSeconds = sec;
    }
    if (patch.maxConcurrentChatsPerAgent !== undefined) {
      const org = await Organization.findById(clientId).select('plan').lean();
      settings.maxConcurrentChatsPerAgent = resolveMaxConcurrentChatsForPlan(
        (org?.plan as string | undefined) ?? 'free',
        Number(patch.maxConcurrentChatsPerAgent) || 1,
      );
    }
    if (patch.queuePositionMessage !== undefined) {
      settings.queuePositionMessage = patch.queuePositionMessage.trim();
    }
    if (patch.queueAllBusyMessage !== undefined) {
      settings.queueAllBusyMessage = patch.queueAllBusyMessage.trim();
    }
    if (patch.alertSoundEnabled !== undefined) {
      settings.alertSoundEnabled = Boolean(patch.alertSoundEnabled);
    }
    if (patch.alertOnNewChat !== undefined) {
      settings.alertOnNewChat = Boolean(patch.alertOnNewChat);
    }
    if (patch.alertOnNewMessage !== undefined) {
      settings.alertOnNewMessage = Boolean(patch.alertOnNewMessage);
    }
    if (patch.inactivityAutoCloseEnabled !== undefined) {
      settings.inactivityAutoCloseEnabled = Boolean(patch.inactivityAutoCloseEnabled);
    }
    if (patch.inactivityCloseMinutes !== undefined) {
      settings.inactivityCloseMinutes = Math.min(
        1440,
        Math.max(0, Number(patch.inactivityCloseMinutes) || 0),
      );
    }
    if (patch.inactivityWarningMinutes !== undefined) {
      settings.inactivityWarningMinutes = Math.min(
        1440,
        Math.max(0, Number(patch.inactivityWarningMinutes) || 0),
      );
    }
    if (patch.inactivityWarningQuickCode !== undefined) {
      settings.inactivityWarningQuickCode = resolveInactivityWarningQuickCode({
        inactivityWarningQuickCode: String(patch.inactivityWarningQuickCode ?? ''),
      });
    }
    if (patch.inactivityCloseQuickCode !== undefined) {
      settings.inactivityCloseQuickCode = resolveInactivityCloseQuickCode({
        inactivityCloseQuickCode: String(patch.inactivityCloseQuickCode ?? ''),
      });
    }
    if (patch.gracefulCloseQuickCode !== undefined) {
      settings.gracefulCloseQuickCode = resolveGracefulCloseQuickCode({
        gracefulCloseQuickCode: String(patch.gracefulCloseQuickCode ?? ''),
      });
    }
    if (patch.gracefulCloseAfterPromptMinutes !== undefined) {
      settings.gracefulCloseAfterPromptMinutes = Math.min(
        1440,
        Math.max(0, Number(patch.gracefulCloseAfterPromptMinutes) || 0),
      );
    }
    if (patch.gracefulCloseDetectPhrases !== undefined) {
      settings.gracefulCloseDetectPhrases = Boolean(patch.gracefulCloseDetectPhrases);
    }
    if (patch.inactivityCloseGracefulQuickCode !== undefined) {
      settings.inactivityCloseGracefulQuickCode = resolveInactivityCloseGracefulQuickCode({
        inactivityCloseGracefulQuickCode: String(patch.inactivityCloseGracefulQuickCode ?? ''),
      });
    }
    if (patch.closeQuickReplyGateEnabled !== undefined) {
      settings.closeQuickReplyGateEnabled = Boolean(patch.closeQuickReplyGateEnabled);
    }
    if (patch.queueSlaAlertMinutes !== undefined) {
      settings.queueSlaAlertMinutes = Math.min(
        1440,
        Math.max(0, Number(patch.queueSlaAlertMinutes) || 0),
      );
    }
    if (patch.ticketTeamResponseHours !== undefined) {
      settings.ticketTeamResponseHours = Math.min(
        168,
        Math.max(0, Number(patch.ticketTeamResponseHours) || 0),
      );
    }
    if (patch.triageInactivityEnabled !== undefined) {
      settings.triageInactivityEnabled = Boolean(patch.triageInactivityEnabled);
    }
    if (patch.attendantTriageVisible !== undefined) {
      settings.attendantTriageVisible = Boolean(patch.attendantTriageVisible);
    }
    if (patch.triageWarningMinutes !== undefined) {
      settings.triageWarningMinutes = Math.min(
        1440,
        Math.max(0, Number(patch.triageWarningMinutes) || 0),
      );
    }
    if (patch.triageCloseAfterWarningMinutes !== undefined) {
      settings.triageCloseAfterWarningMinutes = Math.min(
        1440,
        Math.max(0, Number(patch.triageCloseAfterWarningMinutes) || 0),
      );
    }
    if (patch.triageWarningMessage !== undefined) {
      settings.triageWarningMessage = patch.triageWarningMessage.trim();
    }
    if (patch.triageCloseMessage !== undefined) {
      settings.triageCloseMessage = patch.triageCloseMessage.trim();
    }
    if (patch.csatEnabled !== undefined) {
      settings.csatEnabled = Boolean(patch.csatEnabled);
    }
    if (patch.csatPrompt !== undefined) settings.csatPrompt = patch.csatPrompt.trim();
    if (patch.csatThankYou !== undefined) settings.csatThankYou = patch.csatThankYou.trim();
    if (patch.quickReplies !== undefined) {
      settings.quickReplies = normalizeQuickReplies(patch.quickReplies);
    }
    if (patch.whatsappFallbackEnabled !== undefined) {
      settings.whatsappFallbackEnabled = Boolean(patch.whatsappFallbackEnabled);
    }
    if (patch.whatsappFallbackAlertPhones !== undefined) {
      settings.whatsappFallbackAlertPhones = patch.whatsappFallbackAlertPhones
        .map(p => p.trim())
        .filter(Boolean)
        .slice(0, 10);
    }
    if (patch.whatsappFallbackVisitorMessage !== undefined) {
      settings.whatsappFallbackVisitorMessage = patch.whatsappFallbackVisitorMessage.trim();
    }
    if (patch.whatsappFallbackAcceptTimeoutSeconds !== undefined) {
      settings.whatsappFallbackAcceptTimeoutSeconds = Math.min(
        900,
        Math.max(30, Number(patch.whatsappFallbackAcceptTimeoutSeconds) || 120),
      );
    }
    if (patch.whatsappFallbackNoAgentTimeoutSeconds !== undefined) {
      settings.whatsappFallbackNoAgentTimeoutSeconds = Math.min(
        120,
        Math.max(0, Number(patch.whatsappFallbackNoAgentTimeoutSeconds) || 0),
      );
    }
    if (patch.webchatQueueMaxWaitMinutes !== undefined) {
      settings.webchatQueueMaxWaitMinutes = Math.min(
        480,
        Math.max(0, Number(patch.webchatQueueMaxWaitMinutes) || 0),
      );
    }
    if (patch.webchatQueueMaxWaitCloseMessage !== undefined) {
      settings.webchatQueueMaxWaitCloseMessage = patch.webchatQueueMaxWaitCloseMessage.trim();
    }
    if (patch.agentPresenceTimeoutSeconds !== undefined) {
      settings.agentPresenceTimeoutSeconds = Math.min(
        300,
        Math.max(30, Number(patch.agentPresenceTimeoutSeconds) || 90),
      );
    }
    if (patch.presenceIdleTimeoutSeconds !== undefined) {
      settings.presenceIdleTimeoutSeconds = Math.min(
        3600,
        Math.max(60, Number(patch.presenceIdleTimeoutSeconds) || 300),
      );
    }
    if (patch.timezone !== undefined) {
      settings.timezone = patch.timezone.trim() || 'America/Sao_Paulo';
    }
    if (patch.schedule) {
      for (const day of INBOX_WEEKDAYS) {
        const incoming = patch.schedule[day];
        if (!incoming) continue;
        settings.schedule[day] = {
          enabled: Boolean(incoming.enabled),
          start: incoming.start?.trim() || '09:00',
          end: incoming.end?.trim() || '18:00',
        };
      }
      settings.markModified('schedule');
    }
    await settings.save();
    setAgentPresenceTimeout(clientId, settings.agentPresenceTimeoutSeconds ?? 90);
    return settings;
  }

  async getQuickReplies(clientId: string): Promise<InboxQuickReply[]> {
    const settings = await loadInboxSettings(clientId);
    return normalizeQuickReplies(settings.quickReplies);
  }

  async updateQuickReplies(clientId: string, replies: InboxQuickReply[]): Promise<InboxQuickReply[]> {
    const settings = await InboxSettings.getOrCreate(clientId);
    settings.quickReplies = normalizeQuickReplies(replies);
    await settings.save();
    return settings.quickReplies;
  }

  private async buildContactContext(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
    currentConvId: mongoose.Types.ObjectId,
  ) {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const allConvs = await InboxConversation.find({ clientId: clientOid, destinationId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const convIds = allConvs.map(c => c._id);
    const messageCounts = convIds.length
      ? await InboxMessage.aggregate([
          { $match: { conversationId: { $in: convIds } } },
          { $group: { _id: '$conversationId', count: { $sum: 1 } } },
        ])
      : [];
    const countMap = new Map(
      messageCounts.map((r: { _id: mongoose.Types.ObjectId; count: number }) => [
        String(r._id),
        r.count,
      ]),
    );

    const deptIds = [
      ...new Set(allConvs.map(c => c.departmentId?.toString()).filter(Boolean)),
    ] as string[];
    const depts = deptIds.length
      ? await InboxDepartment.find({ _id: { $in: deptIds } }).select('name').lean()
      : [];
    const deptMap = new Map(depts.map(d => [String(d._id), d.name]));

    const previousConversations = allConvs
      .filter(c => String(c._id) !== String(currentConvId))
      .map(c => ({
        _id: String(c._id),
        status: c.status,
        ticketRef: c.ticketRef,
        departmentName: c.departmentId ? deptMap.get(String(c.departmentId)) : undefined,
        createdAt: c.createdAt,
        resolvedAt: c.resolvedAt,
        lastMessageAt: c.lastMessageAt,
        messageCount: countMap.get(String(c._id)) ?? 0,
      }));

    const totalMessages = messageCounts.reduce(
      (sum: number, r: { count: number }) => sum + r.count,
      0,
    );

    return {
      contactStats: {
        totalConversations: allConvs.length,
        totalMessages,
      },
      previousConversations,
    };
  }

  private notifyConversation(clientId: string, conv: IInboxConversation): void {
    emitInboxEvent(clientId, 'inbox:conversation', {
      clientId,
      conversationId: String(conv._id),
      status: conv.status,
      departmentId: conv.departmentId ? String(conv.departmentId) : undefined,
      assignedUserId: conv.assignedUserId ? String(conv.assignedUserId) : undefined,
      suggestedUserId: conv.suggestedUserId ? String(conv.suggestedUserId) : undefined,
    });
  }

  private async enrichConversationRow(
    row: Record<string, unknown>,
    userId: string,
    clientId: string,
    agentMap: Map<string, string>,
    pullTimeoutSeconds: number,
    triageInactivityTotalMin = triageInactivityTotalMinutes(
      DEFAULT_INBOX_TRIAGE_INACTIVITY.triageWarningMinutes,
      DEFAULT_INBOX_TRIAGE_INACTIVITY.triageCloseAfterWarningMinutes,
    ),
    inactivitySla?: {
      inactivityAutoCloseEnabled: boolean;
      inactivityCloseMinutes: number;
      inactivityWarningMinutes: number;
      gracefulCloseAfterPromptMinutes?: number;
      closeQuickReplyGateEnabled?: boolean;
    },
  ) {
    const suggestedId = row.suggestedUserId
      ? String(row.suggestedUserId)
      : undefined;
    const assignedId = row.assignedUserId ? String(row.assignedUserId) : undefined;
    const status = String(row.status);
    const convId = String(row._id);

    let canAccept = false;
    let canPull = false;
    let priorityForMe = false;
    let suggestedUserBusy = false;
    let suggestedUserOnline = true;

    if (status === InboxConversationStatus.WAITING_QUEUE && suggestedId) {
      priorityForMe = suggestedId === userId;
      canAccept = priorityForMe;
      suggestedUserOnline = isAgentAvailableForQueue(clientId, suggestedId);
      if (!priorityForMe) {
        suggestedUserBusy = await isSuggestedUserBusy(clientId, suggestedId, convId);
        const { pullAllowedByTimeout } = getQueuePriorityState(
          row.suggestedAt as Date | string | undefined,
          pullTimeoutSeconds,
        );
        canPull = suggestedUserBusy || pullAllowedByTimeout || !suggestedUserOnline;
      }
    } else if (status === InboxConversationStatus.WAITING_QUEUE && !assignedId) {
      canAccept = true;
      canPull = true;
    } else if (status === InboxConversationStatus.BOT_TRIAGE && !assignedId) {
      canAccept = true;
    }

    const priority = getQueuePriorityState(
      row.suggestedAt as Date | string | undefined,
      pullTimeoutSeconds,
    );
    const queueWait = getQueueWaitState(
      row.queueEnteredAt as Date | string | undefined,
      row.suggestedAt as Date | string | undefined,
      pullTimeoutSeconds,
    );
    const handleTimeSec =
      status === InboxConversationStatus.IN_PROGRESS
        ? elapsedSecSince(
            (row.acceptedAt as Date | string | undefined) ??
              (row.lastOutboundAt as Date | string | undefined),
          )
        : undefined;

    const triageWaitSince =
      status === InboxConversationStatus.BOT_TRIAGE && !assignedId
        ? (row.createdAt as Date | string | undefined)
        : undefined;
    const triageElapsedSec = triageWaitSince
      ? triageWaitElapsedSec(triageWaitSince)
      : 0;
    const triageUrgency = triageWaitSince
      ? triageWaitUrgency(triageElapsedSec, triageInactivityTotalMin)
      : 0;

    const encQuickReplyAllowed =
      status === InboxConversationStatus.IN_PROGRESS && inactivitySla
        ? isEncInactivityCloseQuickReplyAllowed(
            {
              lastInboundAt: row.lastInboundAt as Date | undefined,
              lastOutboundAt: row.lastOutboundAt as Date | undefined,
              inactivityWarnedAt: row.inactivityWarnedAt as Date | undefined,
              gracefulClosePromptAt: row.gracefulClosePromptAt as Date | undefined,
              gracefulCloseAckAt: row.gracefulCloseAckAt as Date | undefined,
              closeGateSource: row.closeGateSource as 'inactivity' | 'graceful' | undefined,
            },
            {
              inactivityCloseMinutes:
                inactivitySla.inactivityCloseMinutes ?? DEFAULT_INBOX_SLA.inactivityCloseMinutes,
              inactivityWarningMinutes:
                inactivitySla.inactivityWarningMinutes ?? DEFAULT_INBOX_SLA.inactivityWarningMinutes,
            },
          )
        : false;

    const encOkQuickReplyAllowed =
      status === InboxConversationStatus.IN_PROGRESS && inactivitySla
        ? isEncOkCloseQuickReplyAllowed(
            {
              lastInboundAt: row.lastInboundAt as Date | undefined,
              lastOutboundAt: row.lastOutboundAt as Date | undefined,
              inactivityWarnedAt: row.inactivityWarnedAt as Date | undefined,
              gracefulClosePromptAt: row.gracefulClosePromptAt as Date | undefined,
              gracefulCloseAckAt: row.gracefulCloseAckAt as Date | undefined,
              closeGateSource: row.closeGateSource as 'inactivity' | 'graceful' | undefined,
            },
            {
              gracefulCloseAfterPromptMinutes:
                inactivitySla.gracefulCloseAfterPromptMinutes ??
                DEFAULT_INBOX_SLA.gracefulCloseAfterPromptMinutes,
            },
          )
        : false;

    return {
      ...row,
      assignedUserName: assignedId ? agentMap.get(assignedId) : undefined,
      suggestedUserName: suggestedId ? agentMap.get(suggestedId) : undefined,
      suggestedUserOnline,
      priorityForMe,
      canAccept,
      canPull,
      suggestedUserBusy,
      pullTimeoutSeconds,
      queueEnteredAt: row.queueEnteredAt
        ? new Date(row.queueEnteredAt as Date | string).toISOString()
        : undefined,
      queueElapsedSec: queueWait.elapsedSec,
      queueUrgency: suggestedId ? priority.urgency : queueWait.urgency,
      handleTimeSec,
      acceptedAt: row.acceptedAt
        ? new Date(row.acceptedAt as Date | string).toISOString()
        : undefined,
      triageWaitSince: triageWaitSince
        ? new Date(triageWaitSince).toISOString()
        : undefined,
      triageElapsedSec,
      triageUrgency,
      triageInactivityTotalMin,
      encQuickReplyAllowed,
      encOkQuickReplyAllowed,
      inactivityWarnedAt: row.inactivityWarnedAt
        ? new Date(row.inactivityWarnedAt as Date | string).toISOString()
        : undefined,
      gracefulClosePromptAt: row.gracefulClosePromptAt
        ? new Date(row.gracefulClosePromptAt as Date | string).toISOString()
        : undefined,
      gracefulCloseAckAt: row.gracefulCloseAckAt
        ? new Date(row.gracefulCloseAckAt as Date | string).toISOString()
        : undefined,
      closeGateSource: row.closeGateSource as 'inactivity' | 'graceful' | undefined,
      lastOutboundAt: row.lastOutboundAt
        ? new Date(row.lastOutboundAt as Date | string).toISOString()
        : undefined,
      createdAt: row.createdAt
        ? new Date(row.createdAt as Date | string).toISOString()
        : undefined,
    };
  }

  private async touchClientOutboundPrompt(conversation: IInboxConversation): Promise<void> {
    conversation.lastOutboundAt = new Date();
    clearCloseGateFields(conversation);
    await conversation.save();
  }

  /** Metadados do setor (público ou interno) para badge na lista do Inbox. */
  private attachDepartmentBadgeMeta<T extends Record<string, unknown>>(
    rows: T[],
    deptById: Map<string, Pick<IInboxDepartment, 'name' | 'clientVisible' | 'internalRank' | 'menuKey'>>,
    leadConvSet?: Set<string>,
  ): (T & {
    departmentName?: string
    departmentBadgeLabel?: string
    departmentClientVisible?: boolean
    departmentInternalRank?: number
    departmentInternalRankLabel?: string
    isLeadEntry?: boolean
  })[] {
    return rows.map(row => {
      const deptId = row.departmentId ? String(row.departmentId) : undefined
      const dept = deptId ? deptById.get(deptId) : undefined
      const next = { ...row } as T & {
        departmentName?: string
        departmentBadgeLabel?: string
        departmentClientVisible?: boolean
        departmentInternalRank?: number
        departmentInternalRankLabel?: string
        isLeadEntry?: boolean
      }

      if (dept) {
        Object.assign(next, departmentBadgeFieldsFrom(dept));
      }

      if (leadConvSet?.has(String(row._id))) {
        next.isLeadEntry = true
      }

      return next
    })
  }

  private notifyMessage(clientId: string, conversationId: string): void {
    emitInboxEvent(clientId, 'inbox:message', {
      clientId,
      conversationId,
    });
  }

  private async pushPanelEvent(
    clientId: string,
    type: PanelEventType,
    title: string,
    body: string,
    opts?: { conversationId?: string; href?: string; targetUserId?: string },
  ): Promise<void> {
    emitPanelEvent(clientId, {
      id: crypto.randomUUID(),
      type,
      title,
      body,
      href: opts?.href ?? (opts?.conversationId ? `/platform/inbox?conv=${opts.conversationId}` : '/platform/inbox'),
      conversationId: opts?.conversationId,
      targetUserId: opts?.targetUserId,
      createdAt: new Date().toISOString(),
    });
  }

  async listTeamMembersForAssignment(clientId: string) {
    const members = await CompanyMember.findByOrg(clientId);
    const active = members.filter(m => m.isActive && m.companyRole !== CompanyRole.OWNER);
    const userIds = active.map(m => m.userId).filter(Boolean) as mongoose.Types.ObjectId[];
    const users = await User.find({ _id: { $in: userIds } })
      .select('displayName email')
      .lean();
    const userMap = new Map(users.map(u => [String(u._id), u]));

    return active.map(m => {
      const u = m.userId ? userMap.get(String(m.userId)) : undefined;
      const presence = m.userId ? getAgentPresence(clientId, String(m.userId)) : null;
      return {
        memberId: String(m._id),
        userId: m.userId ? String(m.userId) : null,
        email: m.email,
        companyRole: m.companyRole,
        displayName: u?.displayName?.trim() || m.email?.split('@')[0] || 'Sem nome',
        linked: Boolean(m.userId),
        whatsappPhone: m.whatsappPhone?.trim() || undefined,
        online: presence?.online ?? false,
        availableForQueue: presence?.availableForQueue ?? false,
        operationalStatus: presence?.operationalStatus ?? 'offline',
        statusLabel: presence?.statusLabel ?? 'Offline',
      };
    });
  }

  async createDepartment(
    clientId: string,
    data: {
      name: string;
      description?: string;
      memberUserIds?: string[];
      clientVisible?: boolean;
      internalRank?: number;
    },
  ): Promise<IInboxDepartment> {
    const name = data.name?.trim();
    if (!name) throw new Error('Nome do setor é obrigatório');

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const clientVisible = data.clientVisible !== false;
    const internalRank = clientVisible
      ? 0
      : Math.max(INBOX_INTERNAL_RANK_MIN, data.internalRank ?? INBOX_INTERNAL_RANK_MIN);
    const menuKey = clientVisible
      ? await this.nextPublicMenuKey(clientOid)
      : await this.nextInternalMenuKey(clientOid);
    const sortOrder = await InboxDepartment.countDocuments({ clientId: clientOid });
    const memberUserIds = await this.resolveMemberUserIds(clientId, data.memberUserIds ?? []);

    return InboxDepartment.create({
      clientId: clientOid,
      name,
      description: data.description?.trim() || undefined,
      menuKey,
      clientVisible,
      internalRank,
      sortOrder,
      memberUserIds,
      isActive: true,
    });
  }

  async updateDepartment(
    clientId: string,
    departmentId: string,
    data: {
      name?: string;
      description?: string;
      memberUserIds?: string[];
      isActive?: boolean;
      sortOrder?: number;
      clientVisible?: boolean;
      internalRank?: number;
    },
  ): Promise<IInboxDepartment> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const dept = await InboxDepartment.findOne({
      _id: new mongoose.Types.ObjectId(departmentId),
      clientId: clientOid,
    });
    if (!dept) throw new Error('Setor não encontrado');

    if (data.name?.trim()) dept.name = data.name.trim();
    if (data.description !== undefined) dept.description = data.description.trim() || undefined;
    if (data.isActive !== undefined) dept.isActive = data.isActive;
    if (data.sortOrder !== undefined) dept.sortOrder = data.sortOrder;
    if (data.memberUserIds) {
      dept.memberUserIds = await this.resolveMemberUserIds(clientId, data.memberUserIds);
    }
    if (data.clientVisible !== undefined && data.clientVisible !== dept.clientVisible) {
      dept.clientVisible = data.clientVisible;
      dept.menuKey = data.clientVisible
        ? await this.nextPublicMenuKey(clientOid, String(dept._id))
        : await this.nextInternalMenuKey(clientOid, String(dept._id));
      dept.internalRank = data.clientVisible
        ? 0
        : Math.max(INBOX_INTERNAL_RANK_MIN, dept.internalRank || INBOX_INTERNAL_RANK_MIN);
    }
    if (data.internalRank !== undefined && dept.clientVisible === false) {
      dept.internalRank = Math.max(INBOX_INTERNAL_RANK_MIN, data.internalRank);
    }
    await dept.save();
    return dept;
  }

  private async nextPublicMenuKey(clientOid: mongoose.Types.ObjectId, excludeId?: string): Promise<string> {
    const depts = await InboxDepartment.find({ clientId: clientOid })
      .select('menuKey _id clientVisible isActive')
      .lean();
    return nextPublicMenuKeyFrom(depts, excludeId);
  }

  private async nextInternalMenuKey(clientOid: mongoose.Types.ObjectId, excludeId?: string): Promise<string> {
    const depts = await InboxDepartment.find({ clientId: clientOid })
      .select('menuKey _id clientVisible isActive')
      .lean();
    return nextInternalMenuKeyFrom(depts, excludeId);
  }

  private async assertUserCanAccessDepartment(
    clientId: string,
    userId: string,
    departmentId: mongoose.Types.ObjectId | string,
  ): Promise<void> {
    const visibility = await this.departmentVisibility(clientId, userId);
    if (!visibility.restricted) return;
    const id = String(departmentId);
    if (!visibility.departmentIds.some(d => String(d) === id)) {
      throw new Error('Sem permissão para este setor');
    }
  }

  private getDepartmentRank(dept: IInboxDepartment): number {
    return departmentInternalRank(dept);
  }

  private async hasActiveDepartmentsWithRank(clientId: string, rank: number): Promise<boolean> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    if (rank === 0) {
      return (
        (await InboxDepartment.countDocuments({
          clientId: clientOid,
          isActive: true,
          clientVisible: { $ne: false },
        })) > 0
      );
    }
    return (
      (await InboxDepartment.countDocuments({
        clientId: clientOid,
        isActive: true,
        clientVisible: false,
        internalRank: rank,
      })) > 0
    );
  }

  /** Membro de pelo menos um setor ativo no nível indicado (rank 0 = público). */
  private async userIsMemberOfRank(clientId: string, userId: string, rank: number): Promise<boolean> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const userOid = new mongoose.Types.ObjectId(userId);
    const query =
      rank === 0
        ? { clientId: clientOid, isActive: true, clientVisible: { $ne: false } }
        : { clientId: clientOid, isActive: true, clientVisible: false, internalRank: rank };

    const depts = await InboxDepartment.find(query).select('memberUserIds');
    if (!depts.length) return false;

    return depts.some(
      d => d.memberUserIds.length === 0 || d.memberUserIds.some(id => id.equals(userOid)),
    );
  }

  /** Escalação: rank R exige membro do rank R-1 (ou tier público se não houver nível intermediário). */
  private async canUserTransferToDepartment(
    clientId: string,
    userId: string,
    target: IInboxDepartment,
  ): Promise<boolean> {
    const visibility = await this.departmentVisibility(clientId, userId);
    if (!visibility.restricted) return true;

    const targetRank = this.getDepartmentRank(target);
    if (targetRank === 0) {
      return visibility.departmentIds.some(d => d.equals(target._id as mongoose.Types.ObjectId));
    }

    if (await this.userIsMemberOfRank(clientId, userId, targetRank)) {
      return true;
    }

    let requiredRank = targetRank - 1;
    while (requiredRank >= 0) {
      if (await this.hasActiveDepartmentsWithRank(clientId, requiredRank)) {
        return this.userIsMemberOfRank(clientId, userId, requiredRank);
      }
      requiredRank--;
    }
    return false;
  }

  async assertUserCanTransferToDepartment(
    clientId: string,
    userId: string,
    target: IInboxDepartment,
  ): Promise<void> {
    const can = await this.canUserTransferToDepartment(clientId, userId, target);
    if (can) return;

    const rank = this.getDepartmentRank(target);
    if (rank >= INBOX_INTERNAL_RANK_MIN) {
      throw new Error(
        `Sem permissão para transferir para ${formatInternalRankLabel(rank)} — é preciso estar no nível anterior.`,
      );
    }
    throw new Error('Sem permissão para transferir para este setor');
  }

  private async resolveMemberUserIds(
    clientId: string,
    rawIds: string[],
  ): Promise<mongoose.Types.ObjectId[]> {
    if (!rawIds.length) return [];
    const members = await CompanyMember.findByOrg(clientId);
    const allowed = new Set(
      members
        .filter(m => m.isActive && m.userId)
        .map(m => String(m.userId)),
    );
    const out: mongoose.Types.ObjectId[] = [];
    for (const id of rawIds) {
      if (!allowed.has(id)) {
        throw new Error('Atendente inválido ou ainda não vinculou a conta');
      }
      out.push(new mongoose.Types.ObjectId(id));
    }
    return out;
  }

  private async resolveAgentDisplayName(userId: string): Promise<string> {
    const user = await User.findById(userId).select('displayName email').lean();
    if (user?.displayName?.trim()) return user.displayName.trim();
    const fromEmail = user?.email?.split('@')[0]?.trim();
    return fromEmail || 'Atendente';
  }

  private async announceAgentJoin(
    clientId: string,
    conv: IInboxConversation,
    userId: string,
  ): Promise<void> {
    const agentName = await this.resolveAgentDisplayName(userId);
    const text = buildAgentJoinMessage(agentName);
    await this.sendToContact(clientId, conv.contactIdentifier, text);
    await InboxMessage.create({
      clientId: conv.clientId,
      conversationId: conv._id,
      direction: 'outbound',
      body: text,
      authorUserId: new mongoose.Types.ObjectId(userId),
    });
    await this.appendSystemMessage(
      conv,
      `${agentName} entrou no atendimento.`,
      new mongoose.Types.ObjectId(userId),
    );
    conv.lastOutboundAt = new Date();
    conv.inactivityWarnedAt = undefined;
    await conv.save();
  }

  /** Contato com ticket fechado/aberto na janela de resposta — LGPD não deve capturar "sair". */
  async hasActiveClientTicketContext(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
  ): Promise<boolean> {
    const ticket = await this.findTicketForClientReply(clientId, destinationId);
    if (!ticket) return false;
    if (ticket.status !== 'closed') {
      return Boolean(
        ticket.teamHasMessagedClient ||
          (ticket.clientReplyExpiresAt && this.isWithinPostAckReplyWindow(ticket)),
      );
    }
    return this.isWithinPostAckReplyWindow(ticket);
  }

  /** Processa resposta do cliente no contexto de ticket (antes do consent, evita "sair" = opt-out). */
  async handleTicketInboundMessage(
    clientId: string,
    fromJid: string,
    text: string,
    altJid?: string,
    media?: InboxInboundPayload['media'],
  ): Promise<boolean> {
    this.startClientReplyGraceMonitor();
    const consentSvc = ConsentService.getInstance();
    const dest = await consentSvc.findOrCreateContactFromInbound(clientId, fromJid, altJid);
    if (!dest) return false;

    const trimmed = text.trim();

    if (consentSvc.shouldDeferToConsentFlow(dest, trimmed)) return false;

    if (trimmed && !media) {
      const csatHandled = await this.tryHandleCsatReply(clientId, dest, trimmed);
      if (csatHandled) return true;
    }

    const destinationId = dest._id as mongoose.Types.ObjectId;

    const ticket = await this.findTicketForClientReply(clientId, destinationId);
    if (!ticket) {
      if (await this.inboxTriageContextActive(clientId, destinationId)) return false;
      return false;
    }

    const inGrace =
      Boolean(ticket.clientReplyGraceUntil) &&
      new Date() < new Date(ticket.clientReplyGraceUntil!) &&
      !ticket.clientReplyPaused;

    const inboxCompeting = await this.inboxServiceCompetingWithTicket(
      clientId,
      destinationId,
      ticket.ticketInboundMode,
    );
    if (inboxCompeting && !inGrace) {
      return false;
    }

    if (wantsNewInboundService(trimmed)) {
      await this.releaseTicketsForInboxTriage(clientId, destinationId);
      await this.releaseTicketToInbox(ticket);
      return false;
    }

    const displayBody =
      trimmed || (media ? INBOX_MEDIA_LABEL[media.mediaType] ?? 'Mídia recebida' : '');
    if (!displayBody) return false;

    const inReplyWindow = this.canClientReplyToTicket(ticket);

    if (parseTicketClientExit(trimmed) || parseTicketFinalize(trimmed)) {
      if (ticket.clientReplyPaused) return true;
      if (!(inReplyWindow || ticket.teamHasMessagedClient || ticket.clientReplyExpiresAt)) {
        return false;
      }
      ticket.clientReplyPaused = true;
      ticket.clientReplyGraceUntil = undefined;
      ticket.ticketInboundMode = undefined;
      ticket.updatedAt = new Date();
      await ticket.save();
      this.cancelClientReplyGrace(clientId, ticket.ticketRef);
      await this.sendToContact(clientId, dest.identifier, TICKET_CLIENT_EXIT_ACK);
      const conv = await InboxConversation.findById(ticket.conversationId);
      if (conv) {
        await this.appendSystemMessage(
          conv,
          `Cliente encerrou respostas no ticket *${ticket.ticketRef}*.`,
          undefined,
          clientId,
        );
      }
      this.notifyTicketUpdated(clientId, ticket.ticketRef);
      return true;
    }

    if (ticket.clientReplyPaused && this.isWithinPostAckReplyWindow(ticket)) {
      const pausedHandled = await this.handleTicketPausedInbound(
        clientId,
        dest.identifier,
        ticket,
        trimmed,
        media,
      );
      if (pausedHandled !== 'continue') return pausedHandled;
    }

    const routing = await this.resolveTicketRouting(clientId, dest, ticket, trimmed);
    if (routing === 'release_inbox') return false;

    if (routing === 'grace_menu') {
      const handled = await this.handleGraceExpiredInbound(
        clientId,
        dest,
        ticket,
        trimmed,
      );
      return handled;
    }

    if (
      !ticket.clientReplyPaused &&
      this.isWithinPostAckReplyWindow(ticket) &&
      this.isPastFollowUpMenuHours(ticket) &&
      ticket.ticketInboundMode !== 'ticket'
    ) {
      const menuHandled = await this.handleTicketFollowUpMenu(
        clientId,
        dest.identifier,
        ticket,
        trimmed,
      );
      if (menuHandled !== false) return menuHandled;
    }

    if (ticket.ticketInboundMode === 'ticket' && parseTicketStatusRequest(trimmed)) {
      await this.sendToContact(
        clientId,
        dest.identifier,
        this.buildTicketQuickStatusReply(ticket),
      );
      return true;
    }

    if (!inReplyWindow) {
      await this.releaseTicketToInbox(ticket);
      return false;
    }

    const recheck = await this.resolveTicketRouting(clientId, dest, ticket, trimmed);
    if (recheck !== 'capture') return false;

    await this.recordTicketClientReply(clientId, dest.identifier, ticket, displayBody, media);
    return true;
  }

  /** Cliente escreve após expirar os 30 min de complemento. */
  private async handleGraceExpiredInbound(
    clientId: string,
    dest: IDestination,
    ticket: IInboxTicket,
    trimmed: string,
  ): Promise<boolean> {
    const choice = parseTicketGraceExpiredChoice(trimmed);
    if (choice === 'new_service' || wantsNewInboundService(trimmed)) {
      await this.releaseTicketToInbox(ticket);
      return false;
    }
    if (choice === 'add_info') {
      ticket.clientReplyPaused = false;
      ticket.clientReplyGraceUntil = new Date(Date.now() + TICKET_CLIENT_REPLY_GRACE_MS);
      ticket.ticketInboundMode = 'ticket';
      ticket.updatedAt = new Date();
      await ticket.save();
      this.scheduleClientReplyGrace(clientId, ticket);
      await this.sendToContact(clientId, dest.identifier, TICKET_GRACE_REOPEN_ACK);
      return true;
    }
    if (choice === 'wait_ticket') {
      await this.sendToContact(clientId, dest.identifier, TICKET_WAITING_RETURN_ACK);
      return true;
    }

    const menu = buildTicketGraceExpiredMenu();
    await this.sendToContact(clientId, dest.identifier, menu);
    await setContactMenuContext(dest._id as mongoose.Types.ObjectId, 'ticket_grace_expired');
    return true;
  }

  private isWithinPostAckReplyWindow(ticket: IInboxTicket): boolean {
    if (ticket.status === 'closed') {
      return isClosedTicketReplyWindowActive(ticket);
    }
    if (!ticket.clientReplyExpiresAt) return false;
    return new Date() < new Date(ticket.clientReplyExpiresAt);
  }

  /** Equipe enviou ao cliente — abre/renova janela de 12 h e reinicia contagem de 2 h / 30 min. */
  private renewTeamClientReplyWindow(
    ticket: IInboxTicket,
    ticketInboundMode: TicketInboundMode | undefined = 'ticket',
  ): void {
    const now = new Date();
    ticket.clientReplyExpiresAt = new Date(
      now.getTime() + TICKET_POST_CLOSE_REPLY_HOURS * 60 * 60 * 1000,
    );
    ticket.clientReplyWindowStartedAt = now;
    ticket.clientReplyPaused = false;
    ticket.ticketInboundMode = ticketInboundMode;
    ticket.lastTeamMessageAt = now;
  }

  private isPastFollowUpMenuHours(ticket: IInboxTicket): boolean {
    const start = ticket.clientReplyWindowStartedAt ?? ticket.closedAt ?? ticket.updatedAt;
    if (!start) return false;
    return Date.now() - new Date(start).getTime() >= TICKET_FOLLOW_UP_MENU_AFTER_MS;
  }

  /** Cliente pausado (confirmação, 30 min ou sair) dentro das 12h — menu após 2h */
  private async handleTicketPausedInbound(
    clientId: string,
    contactIdentifier: string,
    ticket: IInboxTicket,
    trimmed: string,
    media?: InboxInboundPayload['media'],
  ): Promise<boolean | 'continue'> {
    if (!this.isPastFollowUpMenuHours(ticket)) return false;

    if (
      await this.shouldDeferToInboxTriage(
        clientId,
        ticket.destinationId as mongoose.Types.ObjectId,
        ticket,
        trimmed,
      )
    ) {
      ticket.ticketInboundMode = 'new_service';
      ticket.clientReplyPaused = false;
      ticket.clientReplyGraceUntil = undefined;
      await ticket.save();
      return false;
    }

    if (ticket.ticketInboundMode === 'ticket') {
      if (parseTicketStatusRequest(trimmed)) {
        await this.sendToContact(
          clientId,
          contactIdentifier,
          this.buildTicketQuickStatusReply(ticket),
        );
        return true;
      }
      const displayBody =
        trimmed || (media ? INBOX_MEDIA_LABEL[media.mediaType] ?? 'Mídia recebida' : '');
      if (!displayBody) return true;
      await this.recordTicketClientReply(clientId, contactIdentifier, ticket, displayBody, media);
      return true;
    }

    const choice = parseTicketFollowUpChoice(trimmed);
    if (choice === 'new_service') {
      ticket.ticketInboundMode = 'new_service';
      await ticket.save();
      return false;
    }
    if (choice === 'ticket') {
      ticket.ticketInboundMode = 'ticket';
      ticket.clientReplyPaused = false;
      await ticket.save();
      if (trimmed === '1' || normalizeTicketMenuKeyword(trimmed) === 'inserir') {
        await this.sendToContact(clientId, contactIdentifier, TICKET_FOLLOW_UP_TICKET_READY);
        return true;
      }
      if (parseTicketStatusRequest(trimmed)) {
        await this.sendToContact(
          clientId,
          contactIdentifier,
          this.buildTicketQuickStatusReply(ticket),
        );
        return true;
      }
      return 'continue';
    }

    const followMenu = buildTicketFollowUpMenu(ticket.ticketRef);
    await this.sendToContact(clientId, contactIdentifier, followMenu);
    ticket.ticketInboundMode = 'awaiting_follow_up';
    await ticket.save();
    await setContactMenuContext(
      ticket.destinationId as mongoose.Types.ObjectId,
      'ticket_followup',
    );
    return true;
  }

  /** Primeiro contato após 2h da janela — menu antes de capturar */
  private async handleTicketFollowUpMenu(
    clientId: string,
    contactIdentifier: string,
    ticket: IInboxTicket,
    trimmed: string,
  ): Promise<boolean> {
    if (
      await this.shouldDeferToInboxTriage(
        clientId,
        ticket.destinationId as mongoose.Types.ObjectId,
        ticket,
        trimmed,
      )
    ) {
      ticket.ticketInboundMode = 'new_service';
      ticket.clientReplyPaused = false;
      ticket.clientReplyGraceUntil = undefined;
      await ticket.save();
      return false;
    }

    const choice = parseTicketFollowUpChoice(trimmed);
    if (choice === 'new_service') {
      ticket.ticketInboundMode = 'new_service';
      await ticket.save();
      return false;
    }
    if (choice === 'ticket') {
      ticket.ticketInboundMode = 'ticket';
      ticket.clientReplyPaused = false;
      await ticket.save();
      if (trimmed === '1' || normalizeTicketMenuKeyword(trimmed) === 'inserir') {
        await this.sendToContact(clientId, contactIdentifier, TICKET_FOLLOW_UP_TICKET_READY);
        return true;
      }
      if (parseTicketStatusRequest(trimmed)) {
        await this.sendToContact(
          clientId,
          contactIdentifier,
          this.buildTicketQuickStatusReply(ticket),
        );
        return true;
      }
      return false;
    }
    const followMenu = buildTicketFollowUpMenu(ticket.ticketRef);
    await this.sendToContact(clientId, contactIdentifier, followMenu);
    ticket.ticketInboundMode = 'awaiting_follow_up';
    await ticket.save();
    await setContactMenuContext(
      ticket.destinationId as mongoose.Types.ObjectId,
      'ticket_followup',
    );
    return true;
  }

  private buildTicketQuickStatusReply(ticket: IInboxTicket): string {
    const display = serializeTicketDisplayFields(ticket);
    const statusLabel =
      display.displayStatusLabel ?? INBOX_TICKET_STATUS_LABEL[ticket.status] ?? ticket.status;
    const hint = this.ticketStatusHint(display.displayStatus ?? ticket.status);
    return (
      `*${ticket.ticketRef}*\n` +
      `Status: *${statusLabel}*\n` +
      (hint ? `${hint}\n` : '') +
      (ticket.subject ? `Assunto: ${ticket.subject}\n` : '') +
      `\nPara enviar mais informações, digite sua mensagem. Para encerrar: *sair* ou *finalizar*.`
    );
  }

  private ticketStatusHint(displayStatus: string): string {
    switch (displayStatus) {
      case 'waiting_team':
      case 'client_replied':
        return 'Nossa equipe foi avisada e retornará assim que possível.';
      case 'waiting_client':
        return 'Aguardamos seu retorno ou complemento neste chamado.';
      case 'in_progress':
        return 'Nossa equipe está analisando este chamado.';
      case 'open':
        return 'Chamado registrado; em breve a equipe iniciará a análise.';
      case 'closed':
        return 'Chamado encerrado — você ainda pode enviar complementos dentro da janela de retorno.';
      case 'paused':
        return 'Complementos pausados; aguarde nova atualização da equipe.';
      case 'expired':
        return 'A janela de retorno deste chamado encerrou.';
      default:
        return '';
    }
  }

  /** Contexto do ticket para IA / auto-resolve. */
  async getTicketBriefForAssist(
    clientId: string,
    ticketRef: string,
  ): Promise<TicketBriefForAssist | null> {
    const normalized = ticketRef.trim().toUpperCase();
    const ticket = await InboxTicket.findOne({
      clientId: new mongoose.Types.ObjectId(clientId),
      ticketRef: normalized,
      ...TICKET_NOT_DELETED,
    });
    if (!ticket) return null;

    const display = serializeTicketDisplayFields(ticket);
    const recentClientReplies = (ticket.clientReplies ?? [])
      .slice(-3)
      .map(r => r.body.trim())
      .filter(Boolean);
    const recentTeamComments = ticket.comments
      .slice(-2)
      .map(c => c.body.trim())
      .filter(Boolean);

    const lines = [
      `Ticket: ${ticket.ticketRef}`,
      `Status: ${display.displayStatusLabel ?? ticket.status}`,
      ticket.subject ? `Assunto: ${ticket.subject}` : null,
      recentClientReplies.length
        ? `Últimas mensagens do cliente no ticket: ${recentClientReplies.join(' | ')}`
        : null,
      recentTeamComments.length
        ? `Último acompanhamento interno (resumo): ${recentTeamComments.join(' | ')}`
        : null,
    ].filter(Boolean) as string[];

    return {
      ticketRef: ticket.ticketRef,
      status: ticket.status,
      displayStatusLabel: display.displayStatusLabel ?? ticket.status,
      subject: ticket.subject,
      recentClientReplies,
      recentTeamComments,
      contextBlock: lines.join('\n'),
    };
  }

  /** Resposta curta de status para cliente (IA / bot / ticket handler). */
  async getTicketStatusReplyForClient(clientId: string, ticketRef: string): Promise<string | null> {
    const normalized = ticketRef.trim().toUpperCase();
    const ticket = await InboxTicket.findOne({
      clientId: new mongoose.Types.ObjectId(clientId),
      ticketRef: normalized,
      ...TICKET_NOT_DELETED,
    });
    if (!ticket) return null;
    return this.buildTicketQuickStatusReply(ticket);
  }

  private startTicketPostAckWindow(ticket: IInboxTicket, clientId: string): void {
    ticket.clientReplyGraceUntil = undefined;
    ticket.clientReplyPaused = true;
    ticket.ticketInboundMode = undefined;
    this.cancelClientReplyGrace(clientId, ticket.ticketRef);

    if (this.isWithinPostAckReplyWindow(ticket)) return;

    const now = new Date();
    ticket.clientReplyExpiresAt = new Date(
      now.getTime() + TICKET_POST_CLOSE_REPLY_HOURS * 60 * 60 * 1000,
    );
    ticket.clientReplyWindowStartedAt = now;
  }

  private async recordTicketClientReply(
    clientId: string,
    contactIdentifier: string,
    ticket: IInboxTicket,
    displayBody: string,
    media?: InboxInboundPayload['media'],
  ): Promise<void> {
    const wasInActiveGrace = Boolean(
      ticket.clientReplyGraceUntil && new Date() < new Date(ticket.clientReplyGraceUntil),
    );
    const isAck = isTicketClientAcknowledgment(displayBody);

    ticket.clientReplies.push({
      body: displayBody,
      createdAt: new Date(),
      mediaType: media?.mediaType,
      mediaUrl: media?.mediaUrl,
    });
    ticket.lastClientReplyAt = new Date();
    ticket.unreadClientReply = true;

    if (isAck) {
      this.startTicketPostAckWindow(ticket, clientId);
    } else {
      ticket.clientReplyGraceUntil = new Date(Date.now() + TICKET_CLIENT_REPLY_GRACE_MS);
      ticket.clientReplyPaused = false;
      ticket.ticketInboundMode = 'ticket';
    }

    if (ticket.status !== 'closed') {
      ticket.status = 'client_replied';
    }
    if (!isAck) {
      await this.applyTicketClientReplySla(clientId, ticket);
    }
    ticket.lastStatusChangeAt = new Date();
    ticket.updatedAt = new Date();
    await ticket.save();

    const conv = await InboxConversation.findById(ticket.conversationId);

    if (!isAck && !wasInActiveGrace) {
      await this.sendToContact(clientId, contactIdentifier, TICKET_CLIENT_REPLY_GRACE_PROMPT);
      if (conv) {
        await InboxMessage.create({
          clientId: conv.clientId,
          conversationId: conv._id,
          direction: 'outbound',
          body: TICKET_CLIENT_REPLY_GRACE_PROMPT,
        });
        conv.lastMessageAt = new Date();
        await conv.save();
      }
    }

    if (conv) {
      await this.recordInbound(conv, displayBody, clientId, {
        mediaType: media?.mediaType,
        mediaUrl: media?.mediaUrl,
        mediaMime: media?.mediaMime,
        whatsappMessageId: media?.whatsappMessageId,
      });
      await this.appendSystemMessage(
        conv,
        `Resposta do cliente no ticket *${ticket.ticketRef}*.`,
        undefined,
        clientId,
      );
    }

    if (!isAck) {
      this.scheduleClientReplyGrace(clientId, ticket);
    }
    await this.notifyClientRepliedToAssignee(clientId, ticket, displayBody);
    this.notifyTicketUpdated(clientId, ticket.ticketRef);

    if (!isAck) {
      WebhookDispatcherService.getInstance().emit(clientId, 'ticket.client_replied', {
        ticket_ref: ticket.ticketRef,
        conversation_id: String(ticket.conversationId),
        contact_identifier: ticket.contactIdentifier,
        body_preview: displayBody.slice(0, 500),
        media_type: media?.mediaType ?? null,
      });
      await recordAttendanceEvent({
        clientId,
        kind: 'ticket.client_replied',
        ticketRef: ticket.ticketRef,
        conversationId: String(ticket.conversationId),
        meta: {
          bodyLength: displayBody.length,
          media_type: media?.mediaType ?? null,
        },
      });
    }
  }

  private graceTimerKey(clientId: string, ticketRef: string): string {
    return `${clientId}:${ticketRef}`;
  }

  private scheduleClientReplyGrace(clientId: string, ticket: ClientReplyGraceTicket): void {
    if (!ticket.clientReplyGraceUntil) return;
    const key = this.graceTimerKey(clientId, ticket.ticketRef);
    const existing = this.graceTimers.get(key);
    if (existing) clearTimeout(existing);

    const delay = Math.max(new Date(ticket.clientReplyGraceUntil).getTime() - Date.now(), 1000);
    const timer = setTimeout(() => {
      this.graceTimers.delete(key);
      void this.finalizeClientReplyGrace(clientId, ticket.ticketRef);
    }, delay);
    this.graceTimers.set(key, timer);
  }

  private cancelClientReplyGrace(clientId: string, ticketRef: string): void {
    const key = this.graceTimerKey(clientId, ticketRef);
    const timer = this.graceTimers.get(key);
    if (timer) clearTimeout(timer);
    this.graceTimers.delete(key);
  }

  private async bootstrapClientReplyGraceTimers(): Promise<void> {
    const now = new Date();
    const pending = await InboxTicket.find({
      clientReplyGraceUntil: { $gt: now },
      clientReplyPaused: false,
    })
      .select('clientId ticketRef clientReplyGraceUntil')
      .limit(200)
      .lean();

    for (const row of pending) {
      this.scheduleClientReplyGrace(String(row.clientId), {
        ticketRef: row.ticketRef,
        clientReplyGraceUntil: row.clientReplyGraceUntil,
      });
    }
  }

  private async processExpiredClientReplyGrace(): Promise<void> {
    const now = new Date();
    const expired = await InboxTicket.find({
      clientReplyGraceUntil: { $lte: now },
      clientReplyPaused: false,
    })
      .limit(50)
      .lean();

    for (const row of expired) {
      await this.finalizeClientReplyGrace(String(row.clientId), row.ticketRef);
    }
  }

  private async finalizeClientReplyGrace(clientId: string, ticketRef: string): Promise<void> {
    const normalized = ticketRef.trim().toUpperCase();
    const ticket = await InboxTicket.findOne({
      clientId: new mongoose.Types.ObjectId(clientId),
      ticketRef: normalized,
    });
    if (!ticket || ticket.clientReplyPaused) return;
    if (!ticket.clientReplyGraceUntil) return;
    if (new Date() < new Date(ticket.clientReplyGraceUntil)) {
      this.scheduleClientReplyGrace(clientId, ticket);
      return;
    }

    ticket.clientReplyPaused = true;
    ticket.clientReplyGraceUntil = undefined;
    ticket.ticketInboundMode = undefined;
    await ticket.save();
    this.cancelClientReplyGrace(clientId, ticket.ticketRef);

    const graceMenu = buildTicketGraceExpiredMenu();
    await this.sendToContact(clientId, ticket.contactIdentifier, graceMenu);
    await setContactMenuContext(
      ticket.destinationId as mongoose.Types.ObjectId,
      'ticket_grace_expired',
    );

    const conv = await InboxConversation.findById(ticket.conversationId);
    if (conv) {
      await InboxMessage.create({
        clientId: conv.clientId,
        conversationId: conv._id,
        direction: 'outbound',
        body: graceMenu,
      });
      await this.appendSystemMessage(
        conv,
        `Prazo de 30 min expirou no ticket *${ticket.ticketRef}* — complementos encerrados.`,
        undefined,
        clientId,
      );
      conv.lastMessageAt = new Date();
      await conv.save();
    }

    this.notifyTicketUpdated(clientId, ticket.ticketRef);
  }

  private clearClientReplyGraceState(ticket: IInboxTicket, clientId: string): void {
    ticket.clientReplyGraceUntil = undefined;
    this.cancelClientReplyGrace(clientId, ticket.ticketRef);
  }

  private async notifyClientRepliedToAssignee(
    clientId: string,
    ticket: IInboxTicket,
    preview: string,
  ): Promise<void> {
    const assigneeName = ticket.assignedUserId
      ? await this.resolveAgentDisplayName(String(ticket.assignedUserId))
      : 'Equipe';
    const title = `Cliente respondeu — ${ticket.ticketRef}`;
    const body = `${ticket.contactName}: ${preview.slice(0, 100)}`;

    await this.pushPanelEvent(clientId, 'inbox:priority', title, body, {
      conversationId: String(ticket.conversationId),
    });

    emitPanelEvent(clientId, {
      id: crypto.randomUUID(),
      type: 'inbox:priority',
      title,
      body: ticket.assignedUserId
        ? `${assigneeName}, ${body}`
        : body,
      href: `/platform/inbox/tickets/${ticket.ticketRef}`,
      conversationId: String(ticket.conversationId),
      createdAt: new Date().toISOString(),
    });
  }

  private canClientReplyToTicket(ticket: IInboxTicket): boolean {
    if (ticket.clientReplyPaused) return false;
    if (ticket.status === 'closed') {
      return isClosedTicketReplyWindowActive(ticket);
    }
    return Boolean(ticket.teamHasMessagedClient);
  }

  private async findTicketForClientReply(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
  ): Promise<IInboxTicket | null> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const now = new Date();
    return InboxTicket.findOne({
      clientId: clientOid,
      destinationId,
      ...TICKET_NOT_DELETED,
      $or: [
        {
          status: { $in: ['open', 'in_progress', 'client_replied'] },
          teamHasMessagedClient: true,
        },
        closedTicketReplyWindowMongoFilter(now),
      ],
    }).sort({ updatedAt: -1 });
  }

  private async releaseTicketToInbox(ticket: IInboxTicket): Promise<void> {
    ticket.ticketInboundMode = 'new_service';
    ticket.clientReplyPaused = false;
    ticket.clientReplyGraceUntil = undefined;
    ticket.updatedAt = new Date();
    await ticket.save();
  }

  private async getPrimaryOpenConversationStatus(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
  ): Promise<InboxConversationStatus | undefined> {
    const botTriage = await InboxConversation.exists({
      clientId: new mongoose.Types.ObjectId(clientId),
      destinationId,
      status: InboxConversationStatus.BOT_TRIAGE,
    });
    if (botTriage) return InboxConversationStatus.BOT_TRIAGE;
    const conv = await this.findOpenConversation(clientId, destinationId);
    return conv?.status;
  }

  private async resolveTicketRouting(
    clientId: string,
    dest: IDestination,
    ticket: IInboxTicket,
    trimmed: string,
  ): Promise<'capture' | 'release_inbox' | 'grace_menu'> {
    const inboxChoice = trimmed ? await parseInboxMenuChoice(clientId, trimmed) : null;
    const destinationId = dest._id as mongoose.Types.ObjectId;
    const [conversationStatus, inboxTriageActive, aiTriageActive] = await Promise.all([
      this.getPrimaryOpenConversationStatus(clientId, destinationId),
      this.inboxTriageContextActive(clientId, destinationId),
      this.contactHasActiveAiTriage(clientId, destinationId),
    ]);
    const decision = evaluateTicketInboundRouting({
      trimmed,
      ticketStatus: ticket.status,
      ticketInboundMode: ticket.ticketInboundMode,
      clientReplyPaused: ticket.clientReplyPaused,
      clientReplyExpiresAt: ticket.clientReplyExpiresAt,
      lastTeamMessageAt: ticket.lastTeamMessageAt,
      closedAt: ticket.closedAt,
      clientReplyGraceUntil: ticket.clientReplyGraceUntil,
      teamHasMessagedClient: ticket.teamHasMessagedClient,
      lastMenuContext: dest.lastMenuContext,
      lastMenuSentAt: dest.lastMenuSentAt,
      conversationStatus,
      inboxTriageActive,
      aiTriageActive,
      inboxMenuChoice: inboxChoice,
    });

    if (decision === 'defer_inbox') {
      if (
        ticket.clientReplyPaused &&
        this.isWithinPostAckReplyWindow(ticket)
      ) {
        return 'release_inbox';
      }
      if (ticket.clientReplyPaused && ticket.status === 'closed') {
        return 'grace_menu';
      }
      return 'release_inbox';
    }

    if (decision === 'release_inbox') {
      await this.releaseTicketToInbox(ticket);
      return 'release_inbox';
    }

    return decision === 'capture' ? 'capture' : 'release_inbox';
  }

  private notifyTicketUpdated(clientId: string, ticketRef: string): void {
    emitPanelEvent(clientId, {
      id: crypto.randomUUID(),
      type: 'inbox:priority',
      title: 'Ticket atualizado',
      body: ticketRef,
      href: `/platform/inbox/tickets/${ticketRef}`,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Grava complemento do cliente no ticket via fluxo IA (sem menu grace de 30min).
   * Retorna false se o ticket não existir para este cliente.
   */
  async appendTicketClientReplyFromAi(
    clientId: string,
    ticketRef: string,
    body: string,
    contactIdentifier: string,
  ): Promise<boolean> {
    const normalizedRef = ticketRef.trim().toUpperCase();
    const trimmedBody = body.trim();
    if (!normalizedRef || !trimmedBody) return false;

    const ticket = await InboxTicket.findOne({
      clientId: new mongoose.Types.ObjectId(clientId),
      ticketRef: normalizedRef,
      ...TICKET_NOT_DELETED,
    });
    if (!ticket) return false;

    const duplicate = ticket.clientReplies.some(
      r => r.body.trim() === trimmedBody && Date.now() - new Date(r.createdAt).getTime() < 60_000,
    );
    if (duplicate) {
      logger.info('IA ignorou complemento duplicado no ticket', { clientId, ticketRef: normalizedRef });
      return true;
    }

    ticket.clientReplies.push({
      body: trimmedBody,
      createdAt: new Date(),
    });
    ticket.lastClientReplyAt = new Date();
    ticket.unreadClientReply = true;
    if (ticket.status === 'closed') {
      const now = new Date();
      ticket.clientReplyExpiresAt = new Date(
        now.getTime() + TICKET_POST_CLOSE_REPLY_HOURS * 60 * 60 * 1000,
      );
      ticket.clientReplyWindowStartedAt = now;
      ticket.clientReplyPaused = false;
      ticket.ticketInboundMode = 'ticket';
    }
    ticket.status = 'client_replied';
    await this.applyTicketClientReplySla(clientId, ticket);
    ticket.lastStatusChangeAt = new Date();
    ticket.updatedAt = new Date();
    await ticket.save();

    const conv = await InboxConversation.findById(ticket.conversationId);
    if (conv) {
      await this.appendSystemMessage(
        conv,
        `Informação adicionada ao ticket *${ticket.ticketRef}* (via assistente IA).`,
        undefined,
        clientId,
      );
    }

    this.notifyTicketUpdated(clientId, ticket.ticketRef);
    logger.info('Complemento gravado no ticket via IA', {
      clientId,
      ticketRef: normalizedRef,
      contactIdentifier,
    });
    return true;
  }

  private async applyTicketClientReplySla(clientId: string, ticket: IInboxTicket): Promise<void> {
    const settings = await loadInboxSettings(clientId);
    const hours =
      settings.ticketTeamResponseHours ?? DEFAULT_INBOX_SLA.ticketTeamResponseHours;
    applyTeamSlaOnClientReply(ticket, hours);
  }

  private buildTeamCommentClientMessage(ticketRef: string, authorName: string, body: string): string {
    return `*${authorName}* · Ticket *${ticketRef}*\n\n${body}`;
  }

  /** Processa mensagem inbound — cliente que iniciou contato vai direto ao menu de setores. */
  async handleInboundMessage(
    clientId: string,
    fromJid: string,
    payload: string | InboxInboundPayload,
    altJid?: string,
  ): Promise<void> {
    const normalized: InboxInboundPayload =
      typeof payload === 'string' ? { text: payload } : payload;

    const consentSvc = ConsentService.getInstance();
    const existingContact = await consentSvc.findContactDestinationForInbound(clientId, fromJid, altJid);
    const isNewContact = !existingContact;
    const dest = await consentSvc.findOrCreateContactFromInbound(clientId, fromJid, altJid);
    if (!dest) return;

    const triageActive = await this.inboxTriageContextActive(
      clientId,
      dest._id as mongoose.Types.ObjectId,
    );
    if (
      !triageActive &&
      consentSvc.shouldDeferToConsentFlow(dest, (normalized.text ?? '').trim())
    ) {
      return;
    }

    const channelOpen = await consentSvc.acceptInboundInitiated(clientId, dest);
    if (!channelOpen) return;
    if (dest.optOutConfirmPendingAt) return;

    const trimmed = (normalized.text ?? '').trim();
    const media = normalized.media;

    if (trimmed && !media) {
      const csatHandled = await this.tryHandleCsatReply(clientId, dest, trimmed);
      if (csatHandled) return;
    }

    if (!trimmed && !media) return;

    const settings = await loadInboxSettings(clientId);
    const openHours = isWithinBusinessHours(
      settings.businessHoursEnabled,
      settings.timezone,
      settings.schedule,
    );

    let conversation = await this.findOpenConversation(clientId, dest._id as mongoose.Types.ObjectId);
    const isNew = !conversation;
    if (!conversation) {
      conversation = await this.createConversation(clientId, dest);
      this.notifyConversation(clientId, conversation);
      WebhookDispatcherService.getInstance().emit(clientId, 'inbox.conversation.created', {
        conversation_id: String(conversation._id),
        contact_identifier: conversation.contactIdentifier,
        contact_name: conversation.contactName,
        status: conversation.status,
      });
      await this.pushPanelEvent(clientId, 'inbox:new_chat', 'Novo contato', dest.name || dest.identifier, {
        conversationId: String(conversation._id),
      });
    }

    const displayBody =
      trimmed ||
      (media ? INBOX_MEDIA_LABEL[media.mediaType] ?? 'Mídia recebida' : '');

    await this.recordInbound(conversation, displayBody, clientId, {
      mediaType: media?.mediaType,
      mediaUrl: media?.mediaUrl,
      mediaMime: media?.mediaMime,
      whatsappMessageId: normalized.whatsappMessageId ?? media?.whatsappMessageId,
    });

    if (isNewContact || isNew) {
      void LeadFormService.getInstance()
        .maybeCaptureWhatsAppInbound(clientId, {
          destinationId: String(dest._id),
          conversationId: String(conversation._id),
          phone: dest.identifier,
          name: dest.name || dest.identifier,
          message: displayBody,
          isNewContact,
          isNewConversation: isNew,
        })
        .catch(err => {
          logger.warn('Falha ao capturar lead WhatsApp inbound', {
            clientId,
            error: (err as Error).message,
          });
        });
    } else if (trimmed) {
      void LeadFormService.getInstance()
        .maybeCaptureWhatsAppCommercialIntent(clientId, {
          destinationId: String(dest._id),
          conversationId: String(conversation._id),
          phone: dest.identifier,
          name: dest.name || dest.identifier,
          message: displayBody,
        })
        .catch(err => {
          logger.warn('Falha ao capturar lead comercial WhatsApp', {
            clientId,
            error: (err as Error).message,
          });
        });
    }

    if (!openHours) {
      const outsideMsg = await buildOutsideHoursMessage(clientId);
      await this.sendToContact(clientId, dest.identifier, outsideMsg);
      await this.appendSystemMessage(conversation, outsideMsg);
      return;
    }

    if (
      trimmed &&
      isNewServiceGreeting(trimmed) &&
      conversation.status === InboxConversationStatus.WAITING_QUEUE &&
      !conversation.assignedUserId
    ) {
      await this.resetConversationForBotTriage(conversation);
    }

    if (conversation.status === InboxConversationStatus.BOT_TRIAGE) {
      await this.releaseTicketsForInboxTriage(clientId, dest._id as mongoose.Types.ObjectId);

      if (isAiFallbackExpired(conversation.aiStatus, conversation.aiFallbackUntil)) {
        await this.clearConversationAi(clientId, String(conversation._id));
        conversation.aiStatus = null;
        conversation.aiFallbackUntil = undefined;
      }

      const aiSettings = await AiSettingsService.getInstance().getSettingsDoc(clientId);
      const attendanceMode = resolveAttendanceMode(aiSettings);

      if (attendanceMode === 'disabled') {
        await this.routeHumanOnlyFromBotTriage(clientId, conversation, dest);
        return;
      }

      if (attendanceMode === 'robotic') {
        await this.handleStandardBotTriage(clientId, conversation, dest, trimmed, {
          isNew,
          hasMedia: Boolean(media),
        });
        return;
      }

      if (attendanceMode === 'hybrid') {
        await this.handleHybridBotTriage(clientId, conversation, dest, trimmed, {
          isNew,
          hasMedia: Boolean(media),
        });
        return;
      }

      let forceStandardMenu = false;
      const aiActive = await AiConversationService.getInstance().isEnabled(clientId);
      const basicActive = await AiBasicTriageService.getInstance().isActive(clientId);

      if (aiActive) {
        const aiResult = await AiConversationService.getInstance().handleInbound(
          {
            clientId,
            conversation,
            dest,
            text: trimmed,
            isNew,
            hasMedia: Boolean(media),
            mediaType: media?.mediaType,
          },
          this,
        );
        if (aiResult.handled) return;
        if (!aiResult.useStandardTriage) return;
        forceStandardMenu = true;
      } else if (basicActive) {
        const basicResult = await AiBasicTriageService.getInstance().handleInbound(
          {
            clientId,
            conversation,
            dest,
            text: trimmed,
            isNew,
            hasMedia: Boolean(media),
            mediaType: media?.mediaType,
          },
          this,
        );
        if (basicResult.handled) return;
        // IA Básica ativa — não cair no bot robotizado (menu de setores).
        return;
      }

      await this.handleStandardBotTriage(clientId, conversation, dest, trimmed, {
        isNew,
        hasMedia: Boolean(media),
        forceMenu: forceStandardMenu,
      });
      return;
    }

    if (trimmed && (await this.contactRecentlyReceivedInboxTriageMenu(clientId, dest._id as mongoose.Types.ObjectId))) {
      const inboxChoice = await parseInboxMenuChoice(clientId, trimmed);
      if (inboxChoice) {
        await this.releaseTicketsForInboxTriage(clientId, dest._id as mongoose.Types.ObjectId);
        await this.resetConversationForBotTriage(conversation);
        await this.handleTriageReply(clientId, conversation, trimmed, dest);
      }
    }
  }

  /**
   * Modo humano/manual — encaminha direto para fila sem robô nem IA.
   */
  private async routeHumanOnlyFromBotTriage(
    clientId: string,
    conversation: IInboxConversation,
    dest: IDestination,
  ): Promise<void> {
    if (conversation.status !== InboxConversationStatus.BOT_TRIAGE) return;

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const department =
      (conversation.departmentId
        ? await InboxDepartment.findById(conversation.departmentId)
        : null) ??
      (await InboxDepartment.findOne({
        clientId: clientOid,
        isActive: true,
        clientVisible: { $ne: false },
      }).sort({ order: 1 }));

    if (department) {
      conversation.departmentId = department._id as mongoose.Types.ObjectId;
    }

    conversation.assignedUserId = undefined;
    conversation.suggestedUserId = undefined;
    conversation.suggestedAt = undefined;
    conversation.status = InboxConversationStatus.WAITING_QUEUE;
    conversation.queueEnteredAt = new Date();
    conversation.queueSlaNotifiedAt = undefined;
    conversation.priorityPullNotifiedAt = undefined;
    conversation.lastMessageAt = new Date();

    const suggested = department
      ? await this.tryRoundRobinSuggest(clientId, conversation, department)
      : undefined;
    await conversation.save();
    this.notifyConversation(clientId, conversation);

    const confirm = department
      ? await buildQueueConfirmation(
          clientId,
          department.name,
          conversation.queueEnteredAt
            ? await getQueuePositionForConversation(
                clientId,
                department._id as mongoose.Types.ObjectId,
                conversation.queueEnteredAt,
                String(conversation._id),
              )
            : undefined,
        )
      : 'Aguardando atendimento humano. Um especialista responderá em breve.';

    await this.sendToContact(clientId, dest.identifier, confirm);
    await this.appendSystemMessage(conversation, confirm, undefined, clientId);
    await this.pushPanelEvent(clientId, 'inbox:new_chat', 'Nova conversa na fila', department?.name ?? 'Geral', {
      conversationId: String(conversation._id),
    });
    void recordAttendanceEvent({
      clientId,
      kind: 'inbox.queued',
      conversationId: String(conversation._id),
      meta: {
        channel: conversation.channel,
        departmentId: department ? String(department._id) : null,
        source: 'human_only_mode',
      },
    });
    logger.info('Modo humano/manual — conversa na fila', {
      clientId,
      conversationId: conversation._id,
      department: department?.name,
      suggestedUserId: suggested?.toString(),
    });
  }

  /**
   * Modo híbrido — menu robotizado → triagem básica → IA Premium (se ativa) → fila humana.
   */
  private async handleHybridBotTriage(
    clientId: string,
    conversation: IInboxConversation,
    dest: IDestination,
    trimmed: string,
    opts: { isNew: boolean; hasMedia: boolean },
  ): Promise<void> {
    const choice = trimmed ? await parseInboxMenuChoice(clientId, trimmed) : null;
    if (choice) {
      await this.handleTriageReply(clientId, conversation, trimmed, dest);
      return;
    }

    const lacksMenu = await this.conversationLacksTriageMenu(
      clientId,
      conversation._id as mongoose.Types.ObjectId,
    );
    const needsMenu = opts.isNew || lacksMenu || (opts.hasMedia && !trimmed);

    if (needsMenu) {
      const menu = await buildInboxTriageMenu(clientId);
      await setContactMenuContext(dest._id as mongoose.Types.ObjectId, 'inbox_triage');
      await this.sendToContact(clientId, dest.identifier, menu);
      await this.appendSystemMessage(conversation, menu);
      await this.touchClientOutboundPrompt(conversation);
      return;
    }

    if (!trimmed) return;

    const basicResult = await AiBasicTriageService.getInstance().handleInbound(
      {
        clientId,
        conversation,
        dest,
        text: trimmed,
        isNew: opts.isNew,
        hasMedia: opts.hasMedia,
      },
      this,
    );
    if (basicResult.handled) return;

    const aiActive = await AiConversationService.getInstance().isEnabled(clientId);
    if (aiActive) {
      const aiResult = await AiConversationService.getInstance().handleInbound(
        {
          clientId,
          conversation,
          dest,
          text: trimmed,
          isNew: opts.isNew,
          hasMedia: opts.hasMedia,
        },
        this,
      );
      if (aiResult.handled) return;
      if (!aiResult.useStandardTriage) return;
    }

    await this.routeHumanOnlyFromBotTriage(clientId, conversation, dest);
  }

  /**
   * Bot fixo de triagem (setores/filas) — independente da IA.
   * Com IA desativada, este é o único caminho em BOT_TRIAGE.
   */
  private async handleStandardBotTriage(
    clientId: string,
    conversation: IInboxConversation,
    dest: IDestination,
    trimmed: string,
    opts: { isNew: boolean; hasMedia: boolean; forceMenu?: boolean },
  ): Promise<void> {
    if (trimmed) {
      const ticketMenuHandled = await TicketClientMenuService.getInstance().handleInbound(
        clientId,
        conversation,
        dest,
        trimmed,
        this,
      );
      if (ticketMenuHandled) return;
    }

    const choice = trimmed ? await parseInboxMenuChoice(clientId, trimmed) : null;
    if (choice) {
      await this.handleTriageReply(clientId, conversation, trimmed, dest);
      return;
    }

    const lacksMenu = await this.conversationLacksTriageMenu(
      clientId,
      conversation._id as mongoose.Types.ObjectId,
    );
    const needsMenu =
      opts.forceMenu || opts.isNew || lacksMenu || (opts.hasMedia && !trimmed);

    if (needsMenu) {
      const menu = await buildInboxTriageMenu(clientId);
      await setContactMenuContext(dest._id as mongoose.Types.ObjectId, 'inbox_triage');
      await this.sendToContact(clientId, dest.identifier, menu);
      await this.appendSystemMessage(conversation, menu);
      await this.touchClientOutboundPrompt(conversation);
      return;
    }

    if (trimmed) {
      await this.handleTriageReply(clientId, conversation, trimmed, dest);
    }
  }

  private async recordInbound(
    conversation: IInboxConversation,
    body: string,
    clientId?: string,
    opts?: {
      mediaType?: InboxMessageMediaType;
      mediaUrl?: string;
      mediaMime?: string;
      whatsappMessageId?: string;
    },
  ): Promise<void> {
    const cid = clientId ?? String(conversation.clientId);
    const waId = opts?.whatsappMessageId;
    if (waId) {
      const dup = await isDuplicateInboundMessage(cid, conversation.channel, waId);
      if (dup) return;
    }

    try {
      await InboxMessage.create({
        clientId: conversation.clientId,
        conversationId: conversation._id,
        direction: 'inbound',
        body,
        mediaType: opts?.mediaType,
        mediaUrl: opts?.mediaUrl,
        mediaMime: opts?.mediaMime,
        ...(waId?.trim() ? { whatsappMessageId: waId.trim() } : {}),
      });
    } catch (e) {
      if ((e as { code?: number }).code === 11000 && waId) {
        markInboundMessageProcessed(cid, conversation.channel, waId);
        return;
      }
      throw e;
    }

    if (waId) markInboundMessageProcessed(cid, conversation.channel, waId);

    conversation.lastInboundAt = new Date();
    const settings = await loadInboxSettings(cid);
    applyInboundCloseGate(
      conversation,
      body,
      settings.gracefulCloseDetectPhrases !== false,
    );
    conversation.lastMessageAt = new Date();
    await conversation.save();
    this.notifyMessage(cid, String(conversation._id));
    this.notifyConversation(cid, conversation);
    WebhookDispatcherService.getInstance().emit(cid, 'inbox.message.received', {
      conversation_id: String(conversation._id),
      contact_identifier: conversation.contactIdentifier,
      body_preview: body.slice(0, 500),
      has_media: Boolean(opts?.mediaType),
      media_type: opts?.mediaType ?? null,
    });

    if (
      conversation.status === InboxConversationStatus.IN_PROGRESS ||
      conversation.status === InboxConversationStatus.WAITING_QUEUE
    ) {
      await this.pushPanelEvent(cid, 'inbox:new_message', 'Nova mensagem', conversation.contactName, {
        conversationId: String(conversation._id),
      });
    }
  }

  private async findOpenConversation(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
  ): Promise<IInboxConversation | null> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const conv = await InboxConversation.findOne({
      clientId: clientOid,
      destinationId,
      status: { $nin: [...TERMINAL_STATUSES] },
    }).sort({ lastMessageAt: -1 });
    return conv;
  }

  private async createConversation(clientId: string, dest: IDestination): Promise<IInboxConversation> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    return InboxConversation.create({
      clientId: clientOid,
      destinationId: dest._id,
      contactIdentifier: dest.identifier,
      contactName: dest.name || dest.identifier,
      status: InboxConversationStatus.BOT_TRIAGE,
      channel: 'whatsapp_qr',
      lastMessageAt: new Date(),
    });
  }

  /** Contato com conversa Inbox em triagem (menu de setores) — ticket TK não deve interceptar. */
  private async contactHasActiveInboxBotTriage(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
  ): Promise<boolean> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const active = await InboxConversation.exists({
      clientId: clientOid,
      destinationId,
      status: InboxConversationStatus.BOT_TRIAGE,
    });
    return Boolean(active);
  }

  /** Triagem inbox ativa ou menu de setores enviado recentemente — ticket não captura 1/2/3/4. */
  private async inboxTriageContextActive(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
  ): Promise<boolean> {
    if (await this.contactHasActiveInboxBotTriage(clientId, destinationId)) return true;
    return this.contactRecentlyReceivedInboxTriageMenu(clientId, destinationId);
  }

  /** IA coletando, aguardando ou escalada — ack solto não vai para ticket antigo. */
  private async contactHasActiveAiTriage(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
  ): Promise<boolean> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const active = await InboxConversation.exists({
      clientId: clientOid,
      destinationId,
      status: { $nin: [...TERMINAL_STATUSES] },
      aiStatus: { $in: ['ai_collecting', 'ai_waiting_client', 'ai_escalated'] },
    });
    return Boolean(active);
  }

  /** Inbox/IA ao vivo compete com ticket — salvo modo explícito do chamado ou grace 30 min. */
  private async inboxServiceCompetingWithTicket(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
    ticketInboundMode?: TicketInboundMode,
  ): Promise<boolean> {
    if (ticketInboundMode === 'ticket' || ticketInboundMode === 'awaiting_follow_up') {
      return false;
    }
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const conv = await InboxConversation.findOne({
      clientId: clientOid,
      destinationId,
      status: { $nin: [...TERMINAL_STATUSES] },
    })
      .select('status aiStatus')
      .sort({ lastMessageAt: -1 })
      .lean();
    if (!conv) return false;
    if (
      conv.status === InboxConversationStatus.BOT_TRIAGE ||
      conv.status === InboxConversationStatus.WAITING_QUEUE ||
      conv.status === InboxConversationStatus.IN_PROGRESS
    ) {
      return true;
    }
    if (await this.inboxTriageContextActive(clientId, destinationId)) return true;
    return this.contactHasActiveAiTriage(clientId, destinationId);
  }

  private async resetConversationForBotTriage(conversation: IInboxConversation): Promise<void> {
    conversation.status = InboxConversationStatus.BOT_TRIAGE;
    conversation.departmentId = undefined;
    conversation.assignedUserId = undefined;
    conversation.suggestedUserId = undefined;
    conversation.suggestedAt = undefined;
    conversation.queueEnteredAt = undefined;
    conversation.queueSlaNotifiedAt = undefined;
    conversation.priorityPullNotifiedAt = undefined;
    conversation.aiStatus = null;
    conversation.aiFallbackUntil = undefined;
    conversation.lastMessageAt = new Date();
    await conversation.save();
  }

  private async releaseTicketsForInboxTriage(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
  ): Promise<void> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const now = new Date();
    await InboxTicket.updateMany(
      {
        clientId: clientOid,
        destinationId,
        $or: [
          { status: { $in: ['open', 'in_progress', 'client_replied'] } },
          closedTicketReplyWindowMongoFilter(now),
        ],
      },
      {
        $set: { ticketInboundMode: 'new_service', clientReplyPaused: false },
        $unset: { clientReplyGraceUntil: '' },
      },
    );
  }

  /**
   * Resposta numérica/nome de setor após menu do Inbox — não confundir com ticket (1=chamado, 2=novo).
   */
  private async shouldDeferToInboxTriage(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
    ticket: IInboxTicket,
    trimmed: string,
  ): Promise<boolean> {
    if (ticket.ticketInboundMode === 'new_service') return true;
    if (ticket.ticketInboundMode === 'ticket') return false;
    if (!trimmed) return false;
    if (await this.inboxTriageContextActive(clientId, destinationId)) return true;
    const choice = await parseInboxMenuChoice(clientId, trimmed);
    if (!choice) return false;
    return this.contactRecentlyReceivedInboxTriageMenu(clientId, destinationId);
  }

  private async contactRecentlyReceivedInboxTriageMenu(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
    windowMs = 30 * 60 * 1000,
  ): Promise<boolean> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const convs = await InboxConversation.find({ clientId: clientOid, destinationId })
      .select('_id')
      .lean();
    if (!convs.length) return false;

    const depts = await loadClientVisibleDepartments(clientId);
    if (!depts.length) return false;

    const since = new Date(Date.now() - windowMs);
    const outbound = await InboxMessage.find({
      conversationId: { $in: convs.map(c => c._id) },
      direction: 'outbound',
      createdAt: { $gte: since },
    })
      .select('body')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return depts.some(d =>
      outbound.some(m => m.body?.includes(`${d.menuKey} - ${d.name}`)),
    );
  }

  /** Conversa em triagem que ainda não recebeu o menu de setores (ex.: veio só da IA). */
  private async conversationLacksTriageMenu(
    clientId: string,
    conversationId: mongoose.Types.ObjectId,
  ): Promise<boolean> {
    const depts = await loadClientVisibleDepartments(clientId);
    if (!depts.length) return true;

    const outbound = await InboxMessage.find({
      conversationId,
      direction: 'outbound',
    })
      .select('body')
      .sort({ createdAt: -1 })
      .limit(25)
      .lean();

    if (!outbound.length) return true;

    const sentMenu = depts.some(d =>
      outbound.some(m => m.body?.includes(`${d.menuKey} - ${d.name}`)),
    );
    return !sentMenu;
  }

  /** Roteia conversa para setor via menuKey — usado pela IA Básica. */
  async routeFromTriageChoice(
    clientId: string,
    conversation: IInboxConversation,
    dest: IDestination,
    menuKey: string,
  ): Promise<void> {
    await this.handleTriageReply(clientId, conversation, menuKey, dest);
  }

  private async handleTriageReply(
    clientId: string,
    conversation: IInboxConversation,
    text: string,
    dest: IDestination,
  ): Promise<void> {
    const choice = await parseInboxMenuChoice(clientId, text);
    if (!choice) {
      const hint = await buildInvalidMenuHint(clientId);
      await this.sendToContact(clientId, dest.identifier, hint);
      await this.appendSystemMessage(conversation, hint);
      await this.touchClientOutboundPrompt(conversation);
      return;
    }

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const department = await InboxDepartment.findOne({
      clientId: clientOid,
      menuKey: choice,
      isActive: true,
      clientVisible: { $ne: false },
    });
    if (!department) {
      const hint = await buildInvalidMenuHint(clientId);
      await this.sendToContact(clientId, dest.identifier, hint);
      await this.appendSystemMessage(conversation, hint);
      await this.touchClientOutboundPrompt(conversation);
      return;
    }

    await ContactAutoSegmentService.getInstance().tagLeadFromInboxDepartment(
      clientId,
      dest,
      department.name,
    );

    conversation.departmentId = department._id as mongoose.Types.ObjectId;
    conversation.assignedUserId = undefined;
    conversation.suggestedUserId = undefined;
    conversation.suggestedAt = undefined;
    conversation.status = InboxConversationStatus.WAITING_QUEUE;
    conversation.queueEnteredAt = new Date();
    conversation.queueSlaNotifiedAt = undefined;
    conversation.priorityPullNotifiedAt = undefined;
    conversation.lastMessageAt = new Date();

    const suggested = await this.tryRoundRobinSuggest(clientId, conversation, department);
    await this.pushPanelEvent(clientId, 'inbox:new_chat', 'Nova conversa na fila', department.name, {
      conversationId: String(conversation._id),
    });
    await conversation.save();
    this.notifyConversation(clientId, conversation);

    const confirm = await buildQueueConfirmation(
      clientId,
      department.name,
      conversation.queueEnteredAt
        ? await getQueuePositionForConversation(
            clientId,
            department._id as mongoose.Types.ObjectId,
            conversation.queueEnteredAt,
            String(conversation._id),
          )
        : undefined,
    );
    await this.sendToContact(clientId, dest.identifier, confirm);
    await this.appendSystemMessage(conversation, confirm, undefined, clientId);
    void recordAttendanceEvent({
      clientId,
      kind: 'inbox.queued',
      conversationId: String(conversation._id),
      meta: {
        channel: conversation.channel,
        departmentId: String(department._id),
        source: 'triage_menu',
        suggestedUserId: suggested?.toString() ?? null,
      },
    });
    logger.info('Conversa direcionada para fila', {
      clientId,
      conversationId: conversation._id,
      department: department.name,
      suggestedUserId: suggested?.toString(),
    });
  }

  /** Indica prioridade ao próximo atendente — não assume automaticamente. */
  private async pickNextRoundRobinUser(
    clientId: string,
    department: IInboxDepartment,
  ): Promise<mongoose.Types.ObjectId | { noOnline: true } | { allBusy: true } | null> {
    const settings = await loadInboxSettings(clientId);
    if (!settings.roundRobinEnabled) return null;

    const maxConcurrent = await this.resolveMaxConcurrentForClient(clientId);
    const candidates = await this.resolveRoundRobinCandidates(clientId, department);
    const availableOnly = filterQueueEligibleAgentIds(
      clientId,
      candidates.map(c => c.toString()),
    ).map(id => new mongoose.Types.ObjectId(id));
    if (!availableOnly.length) return { noOnline: true };

    const lastIdx = department.lastRoundRobinIndex ?? -1;

    for (let offset = 0; offset < availableOnly.length; offset++) {
      const nextIdx = (lastIdx + 1 + offset) % availableOnly.length;
      const userId = availableOnly[nextIdx];
      const atCapacity = await isAgentAtCapacity(
        clientId,
        userId.toString(),
        maxConcurrent,
      );
      if (!atCapacity) {
        department.lastRoundRobinIndex = nextIdx;
        await department.save();
        return userId;
      }
    }

    return { allBusy: true };
  }

  /**
   * Sugere atendente online (round-robin) para fila de um setor.
   * Usado pelo WebChat e integrações externas — não altera conversa do Inbox.
   */
  async suggestRoundRobinAgent(
    clientId: string,
    departmentId: mongoose.Types.ObjectId,
  ): Promise<
    | { kind: 'suggested'; userId: string; agentName: string }
    | { kind: 'no_online' }
    | { kind: 'all_busy' }
    | null
  > {
    const department = await InboxDepartment.findOne({
      _id: departmentId,
      clientId: new mongoose.Types.ObjectId(clientId),
    });
    if (!department) return null;

    const picked = await this.pickNextRoundRobinUser(clientId, department);
    if (!picked) return null;
    if (typeof picked === 'object' && 'noOnline' in picked) return { kind: 'no_online' };
    if (typeof picked === 'object' && 'allBusy' in picked) return { kind: 'all_busy' };

    const agentName = await this.resolveAgentDisplayName(picked.toString());
    return { kind: 'suggested', userId: picked.toString(), agentName };
  }

  private async tryRoundRobinSuggest(
    clientId: string,
    conversation: IInboxConversation,
    department: IInboxDepartment,
  ): Promise<mongoose.Types.ObjectId | null> {
    const picked = await this.pickNextRoundRobinUser(clientId, department);
    if (!picked) return null;
    if (typeof picked === 'object' && 'noOnline' in picked) {
      await this.appendSystemMessage(
        conversation,
        'Nenhum atendente online no painel — fila aberta para a equipe assumir.',
        undefined,
        clientId,
      );
      await this.pushPanelEvent(
        clientId,
        'inbox:priority_expired',
        'Fila aberta — assumir',
        `${conversation.contactName}: nenhum atendente online em ${department.name}`,
        { conversationId: String(conversation._id) },
      );
      logger.info('Round-robin: nenhum atendente online — fila aberta', {
        clientId,
        conversationId: conversation._id,
        departmentId: department._id,
      });
      return null;
    }
    if (typeof picked === 'object' && 'allBusy' in picked) {
      await this.appendSystemMessage(
        conversation,
        'Todos os atendentes online estão em atendimento — aguardando na fila.',
        undefined,
        clientId,
      );
      logger.info('Round-robin: atendentes ocupados — cliente aguarda na fila', {
        clientId,
        conversationId: conversation._id,
        departmentId: department._id,
      });
      return null;
    }

    const userId = picked;

    conversation.suggestedUserId = userId;
    conversation.suggestedAt = new Date();
    conversation.assignedUserId = undefined;
    conversation.priorityPullNotifiedAt = undefined;

    const agentName = await this.resolveAgentDisplayName(userId.toString());
    await this.appendSystemMessage(
      conversation,
      `Prioridade para *${agentName}* — aguardando aceite no painel.`,
      userId,
      clientId,
    );

    await this.pushPanelEvent(clientId, 'inbox:priority', 'Prioridade de atendimento', agentName, {
      conversationId: String(conversation._id),
    });

    logger.info('Round-robin sugeriu atendente', {
      clientId,
      conversationId: conversation._id,
      departmentId: department._id,
      userId: userId.toString(),
    });
    return userId;
  }

  private async resolveRoundRobinCandidates(
    clientId: string,
    department: IInboxDepartment,
  ): Promise<mongoose.Types.ObjectId[]> {
    if (department.memberUserIds.length > 0) {
      return department.memberUserIds;
    }

    const members = await CompanyMember.findByOrg(clientId);
    return members
      .filter(m => m.isActive && m.userId && m.companyRole !== CompanyRole.OWNER)
      .map(m => m.userId as mongoose.Types.ObjectId);
  }

  async listConversations(
    clientId: string,
    userId: string,
    filters: {
      status?: string;
      departmentId?: string;
      mine?: boolean;
      hasTicket?: boolean;
      search?: string;
      destinationIds?: mongoose.Types.ObjectId[];
    },
  ) {
    if (filters.destinationIds !== undefined && filters.destinationIds.length === 0) {
      return [];
    }
    const clientOid = new mongoose.Types.ObjectId(clientId);
    await this.ensureDepartments(clientId);

    const query: Record<string, unknown> = { clientId: clientOid };
    if (filters.status === 'closed') {
      query.status = { $in: [InboxConversationStatus.CLOSED, InboxConversationStatus.RESOLVED] };
    } else if (filters.status) {
      query.status = filters.status;
    }
    if (filters.departmentId) {
      query.departmentId = new mongoose.Types.ObjectId(filters.departmentId);
    }
    if (filters.hasTicket) {
      query.ticketRef = { $exists: true, $nin: [null, ''] };
    }
    if (filters.destinationIds?.length) {
      query.destinationId = { $in: filters.destinationIds };
    }

    const settings = await loadInboxSettings(clientId);
    const attendantTriageVisible = settings.attendantTriageVisible === true;

    const visibility = await this.departmentVisibility(clientId, userId);
    const userOid = new mongoose.Types.ObjectId(userId);
    applyRestrictedWaListVisibility(query, visibility, userOid, filters, { attendantTriageVisible });

    const andClauses: Record<string, unknown>[] = [];
    if (filters.mine) {
      const userOid = new mongoose.Types.ObjectId(userId);
      andClauses.push({ $or: [{ assignedUserId: userOid }, { suggestedUserId: userOid }] });
    }
    const q = filters.search?.trim();
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      andClauses.push({
        $or: [{ contactName: rx }, { contactIdentifier: rx }, { ticketRef: rx }],
      });
    }
    if (andClauses.length === 1) {
      Object.assign(query, andClauses[0]);
    } else if (andClauses.length > 1) {
      query.$and = andClauses;
    }

    const pullTimeoutSeconds = settings.roundRobinPullTimeoutSeconds ?? 120;
    const triageTotalMin = triageInactivityTotalMinutes(
      settings.triageWarningMinutes ?? DEFAULT_INBOX_TRIAGE_INACTIVITY.triageWarningMinutes,
      settings.triageCloseAfterWarningMinutes ??
        DEFAULT_INBOX_TRIAGE_INACTIVITY.triageCloseAfterWarningMinutes,
    );
    const inactivitySla = {
      inactivityAutoCloseEnabled: settings.inactivityAutoCloseEnabled,
      inactivityCloseMinutes: settings.inactivityCloseMinutes,
      inactivityWarningMinutes: settings.inactivityWarningMinutes,
      gracefulCloseAfterPromptMinutes: settings.gracefulCloseAfterPromptMinutes,
      closeQuickReplyGateEnabled: settings.closeQuickReplyGateEnabled,
    };

    const rows = await InboxConversation.find(query)
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .lean();

    const deptIds = [...new Set(rows.map(r => r.departmentId?.toString()).filter(Boolean))];
    const depts = await InboxDepartment.find({ _id: { $in: deptIds } })
      .select('name clientVisible internalRank menuKey')
      .lean();
    const deptMap = new Map(depts.map(d => [String(d._id), d]));

    const convOids = rows
      .map(r => r._id)
      .filter(Boolean)
      .map(id => new mongoose.Types.ObjectId(String(id)));
    const captures =
      convOids.length > 0
        ? await LeadCapture.find({
            clientId: clientOid,
            inboxConversationId: { $in: convOids },
          })
            .select('inboxConversationId')
            .lean()
        : [];
    const leadConvSet = new Set(captures.map(c => String(c.inboxConversationId)));

    const agentIds = [
      ...new Set(
        rows
          .flatMap(r => [r.assignedUserId?.toString(), r.suggestedUserId?.toString()])
          .filter(Boolean) as string[],
      ),
    ];
    const agents = await User.find({ _id: { $in: agentIds } }).select('displayName email').lean();
    const agentMap = new Map(
      agents.map(a => [
        String(a._id),
        a.displayName?.trim() || a.email?.split('@')[0] || 'Atendente',
      ]),
    );

    const rowsWithDept = this.attachDepartmentBadgeMeta(rows, deptMap, leadConvSet);

    const enriched = await Promise.all(
      rowsWithDept.map(r =>
        this.enrichConversationRow(
          r,
          userId,
          clientId,
          agentMap,
          pullTimeoutSeconds,
          triageTotalMin,
          inactivitySla,
        ),
      ),
    );
    return attachClassificationToConversationRows(
      clientId,
      enriched.map(r => {
        const raw = r as Record<string, unknown>;
        return {
          ...r,
          destinationId: raw.destinationId ? String(raw.destinationId) : undefined,
        };
      }),
    );
  }

  private generateTicketRef(): string {
    return generateInboxTicketRef();
  }

  /** Migra conversas antigas que tinham ticketRef sem documento inboxTickets */
  private async syncLegacyTickets(clientId: string): Promise<void> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const legacy = await InboxConversation.find({
      clientId: clientOid,
      ticketRef: { $exists: true, $nin: [null, ''] },
    }).lean();

    for (const conv of legacy) {
      const ref = conv.ticketRef!.trim().toUpperCase();
      const exists = await InboxTicket.findOne({ clientId: clientOid, ticketRef: ref });
      if (exists) continue;

      const opener = await this.resolveTicketOpenerUserId(clientId, conv);
      if (!opener) continue;

      await InboxTicket.create({
        clientId: clientOid,
        ticketRef: ref,
        conversationId: conv._id,
        destinationId: conv.destinationId,
        contactName: conv.contactName,
        contactIdentifier: conv.contactIdentifier,
        departmentId: conv.departmentId,
        assignedUserId: conv.assignedUserId,
        status: 'open',
        openedByUserId: opener,
      });
    }
  }

  private async resolveTicketOpenerUserId(
    clientId: string,
    conv?: Pick<IInboxConversation, 'assignedUserId'>,
  ): Promise<string | null> {
    if (conv?.assignedUserId) return String(conv.assignedUserId);

    const member = await CompanyMember.findOne({
      organizationId: new mongoose.Types.ObjectId(clientId),
      isActive: true,
      userId: { $exists: true, $ne: null },
    })
      .select('userId')
      .lean();

    return member?.userId ? String(member.userId) : null;
  }

  /** Cria ticket assíncrono quando a IA sinaliza shouldCreateTicket. */
  async createTicketFromAi(
    clientId: string,
    conv: IInboxConversation,
    opts: {
      subject?: string;
      initialClientBody?: string;
    },
  ): Promise<{ ticketRef: string; created: boolean } | null> {
    if (conv.ticketRef?.trim()) return null;

    const openerUserId = await this.resolveTicketOpenerUserId(clientId, conv);
    if (!openerUserId) {
      logger.warn('createTicketFromAi: sem usuário para abrir ticket', { clientId });
      return null;
    }

    const { ticket, created, publicAccessToken } = await this.ensureTicketRecord(conv, openerUserId);
    if (!created) {
      return { ticketRef: ticket.ticketRef, created: false };
    }

    const subject = opts.subject?.trim().slice(0, 200);
    if (subject) ticket.subject = subject;

    const initialBody = opts.initialClientBody?.trim();
    if (initialBody) {
      ticket.clientReplies.push({
        body: initialBody,
        createdAt: new Date(),
      });
      ticket.lastClientReplyAt = new Date();
      ticket.unreadClientReply = true;
      if (ticket.status !== 'closed') {
        ticket.status = 'client_replied';
      }
    }

    ticket.teamHasMessagedClient = true;
    await ticket.save();

    const ctx = await this.loadTicketMessageContext(ticket, clientId);
    const clientMsg = this.buildAiTicketOpenedClientMessage(ticket, ctx, publicAccessToken);
    await this.sendTicketMessageToClient(clientId, openerUserId, ticket, clientMsg);

    await this.appendSystemMessage(
      conv,
      `Ticket *${ticket.ticketRef}* criado pela IA — cliente notificado no WhatsApp.`,
      new mongoose.Types.ObjectId(openerUserId),
      clientId,
    );

    this.notifyConversation(clientId, conv);
    this.notifyTicketUpdated(clientId, ticket.ticketRef);
    return { ticketRef: ticket.ticketRef, created: true };
  }

  private async ensureTicketRecord(
    conv: IInboxConversation,
    openedByUserId: string,
  ): Promise<{ ticket: IInboxTicket; created: boolean; publicAccessToken?: string }> {
    const clientOid = conv.clientId;
    const ref = (conv.ticketRef ?? this.generateTicketRef()).trim().toUpperCase();

    if (!conv.ticketRef) {
      conv.ticketRef = ref;
      await conv.save();
    }

    let ticket = await InboxTicket.findOne({ clientId: clientOid, ticketRef: ref });
    if (!ticket) {
      const { assertCanCreateTicket } = await import('@/services/billing/plan-limit-enforcement');
      await assertCanCreateTicket(String(clientOid));

      ticket = await InboxTicket.create({
        clientId: clientOid,
        ticketRef: ref,
        conversationId: conv._id,
        destinationId: conv.destinationId,
        contactName: conv.contactName,
        contactIdentifier: conv.contactIdentifier,
        departmentId: conv.departmentId,
        assignedUserId: conv.assignedUserId,
        status: conv.assignedUserId ? 'in_progress' : 'open',
        openedByUserId: new mongoose.Types.ObjectId(openedByUserId),
      });
      const access = await ensureInboxTicketPublicAccessToken(ticket);
      WebhookDispatcherService.getInstance().emit(String(clientOid), 'ticket.created', {
        ticket_ref: ref,
        conversation_id: String(conv._id),
        status: ticket.status,
        contact_identifier: conv.contactIdentifier,
        contact_name: conv.contactName,
        assigned_user_id: conv.assignedUserId ? String(conv.assignedUserId) : null,
        opened_by_user_id: openedByUserId,
      });
      await recordAttendanceEvent({
        clientId: String(clientOid),
        kind: 'ticket.created',
        ticketRef: ref,
        conversationId: String(conv._id),
        actorUserId: openedByUserId,
        meta: {
          status: ticket.status,
          contact_identifier: conv.contactIdentifier,
        },
      });
      return { ticket, created: true, publicAccessToken: access.token || undefined };
    }
    return { ticket, created: false };
  }

  private async enrichTicketRows(tickets: TicketEnrichmentRow[], _clientId: string) {
    const deptIds = [...new Set(tickets.map(t => t.departmentId?.toString()).filter(Boolean))];
    const userIds = [
      ...new Set(
        tickets
          .flatMap(t => [
            t.assignedUserId?.toString(),
            t.openedByUserId?.toString(),
            t.closedByUserId?.toString(),
          ])
          .filter(Boolean) as string[],
      ),
    ];

    const [depts, users, convs, wcConvs] = await Promise.all([
      deptIds.length
        ? InboxDepartment.find({ _id: { $in: deptIds } }).select('name').lean()
        : [],
      userIds.length ? User.find({ _id: { $in: userIds } }).select('displayName email').lean() : [],
      InboxConversation.find({
        _id: { $in: tickets.map(t => t.conversationId).filter(Boolean) },
      })
        .select('status lastMessageAt')
        .lean(),
      WebChatConversation.find({
        _id: {
          $in: tickets.map(t => t.webChatConversationId).filter(Boolean),
        },
      })
        .select('status queueStatus lastMessageAt')
        .lean(),
    ]);

    const deptMap = new Map<string, string>(
      depts.map(d => [String(d._id), d.name ?? ''] as [string, string]),
    );
    const userMap = new Map<string, string>(
      users.map(
        u =>
          [String(u._id), u.displayName?.trim() || u.email?.split('@')[0] || 'Usuário'] as [
            string,
            string,
          ],
      ),
    );
    const convMap = new Map<string, (typeof convs)[number]>(
      convs.map(c => [String(c._id), c] as [string, (typeof convs)[number]]),
    );
    const wcMap = new Map<string, (typeof wcConvs)[number]>(
      wcConvs.map(c => [String(c._id), c] as [string, (typeof wcConvs)[number]]),
    );

    return tickets.map(t => {
      const conv = t.conversationId ? convMap.get(String(t.conversationId)) : undefined;
      const wc = t.webChatConversationId ? wcMap.get(String(t.webChatConversationId)) : undefined;
      const display = serializeTicketDisplayFields(t);
      return {
        _id: String(t._id),
        ticketRef: t.ticketRef,
        ticketStatus: t.status,
        ...display,
        conversationId: t.conversationId
          ? String(t.conversationId)
          : t.webChatConversationId
            ? `wc:${t.webChatConversationId}`
            : '',
        conversationStatus: conv?.status ?? (wc ? mapWebChatToInboxStatus(wc.status, wc.queueStatus) : undefined),
        channel: t.channel ?? (t.webChatConversationId ? 'webchat_site' : 'whatsapp'),
        contactName: t.contactName,
        contactIdentifier: t.contactIdentifier,
        departmentName: t.departmentId ? deptMap.get(String(t.departmentId)) : undefined,
        assignedUserName: t.assignedUserId ? userMap.get(String(t.assignedUserId)) : undefined,
        openedByUserName: userMap.get(String(t.openedByUserId)),
        closedByUserName: t.closedByUserId ? userMap.get(String(t.closedByUserId)) : undefined,
        lastMessageAt: conv?.lastMessageAt ?? wc?.lastMessageAt ?? t.updatedAt,
        unreadClientReply: Boolean(t.unreadClientReply),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        closedAt: t.closedAt,
      };
    });
  }

  async listTickets(
    clientId: string,
    userId: string,
    filters: {
      status?: InboxTicketStatus | string;
      departmentId?: string;
      mine?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    await this.syncLegacyTickets(clientId);
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const query: Record<string, unknown> = { clientId: clientOid, ...TICKET_NOT_DELETED };

    const limit = Math.min(Math.max(filters.limit ?? 15, 1), 100);
    const page = Math.max(filters.page ?? 1, 1);
    const skip = (page - 1) * limit;

    if (filters.status && ['open', 'in_progress', 'client_replied', 'closed'].includes(filters.status)) {
      query.status = filters.status;
    }

    if (filters.departmentId) {
      query.departmentId = new mongoose.Types.ObjectId(filters.departmentId);
    }

    const visibility = await this.departmentVisibility(clientId, userId);
    if (visibility.restricted) {
      if (visibility.departmentIds.length === 0) {
        return { items: [], total: 0, page, limit };
      }
      if (!filters.departmentId) {
        query.departmentId = { $in: visibility.departmentIds };
      }
    }

    if (filters.mine) {
      query.assignedUserId = new mongoose.Types.ObjectId(userId);
    }

    const q = filters.search?.trim();
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ contactName: rx }, { contactIdentifier: rx }, { ticketRef: rx }];
    }

    const [total, rows] = await Promise.all([
      InboxTicket.countDocuments(query),
      InboxTicket.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    ]);
    const items = await this.enrichTicketRows(rows, clientId);
    return { items, total, page, limit };
  }

  async getTicketStats(clientId: string, userId: string) {
    await this.syncLegacyTickets(clientId);
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const base: Record<string, unknown> = { clientId: clientOid };

    const visibility = await this.departmentVisibility(clientId, userId);
    if (visibility.restricted) {
      if (visibility.departmentIds.length === 0) {
        return { total: 0, open: 0, inProgress: 0, clientReplied: 0, closed: 0, slaBreached: 0, waitingTeam: 0 };
      }
      base.departmentId = { $in: visibility.departmentIds };
    }

    const [total, open, inProgress, clientReplied, closed, slaBreached, waitingTeam] =
      await Promise.all([
      InboxTicket.countDocuments(base),
      InboxTicket.countDocuments({ ...base, status: 'open' }),
      InboxTicket.countDocuments({ ...base, status: 'in_progress' }),
      InboxTicket.countDocuments({ ...base, status: 'client_replied' }),
      InboxTicket.countDocuments({ ...base, status: 'closed' }),
      InboxTicket.countDocuments({
        ...base,
        teamSlaBreachedAt: { $exists: true, $ne: null },
        status: { $ne: 'closed' },
      }),
      InboxTicket.countDocuments({
        ...base,
        unreadClientReply: true,
        status: { $ne: 'closed' },
      }),
    ]);
    return { total, open, inProgress, clientReplied, closed, slaBreached, waitingTeam };
  }

  async getTicketByRef(clientId: string, userId: string, ticketRef: string) {
    await this.syncLegacyTickets(clientId);
    const normalized = ticketRef.trim().toUpperCase();
    const ticket = await InboxTicket.findOne({
      clientId: new mongoose.Types.ObjectId(clientId),
      ticketRef: normalized,
    });
    if (!ticket) throw new Error('Ticket não encontrado');

    await this.migrateLegacyInternalNotes(ticket);

    let detail: Awaited<ReturnType<InboxService['getConversationDetail']>>;
    if (ticket.webChatConversationId) {
      const { WebChatService } = await import('../webchat/WebChatService');
      const wcDetail = await WebChatService.getInstance().getDetailForInbox(
        clientId,
        userId,
        String(ticket.webChatConversationId),
      );
      if (!wcDetail) throw new Error('Conversa do site não encontrada');
      detail = {
        ...wcDetail,
        conversation: {
          ...wcDetail.conversation,
          ticketRef: ticket.ticketRef,
          channel: 'webchat_site',
        },
      } as unknown as typeof detail;
    } else if (ticket.conversationId) {
      detail = await this.getConversationDetail(clientId, userId, String(ticket.conversationId));
    } else {
      throw new Error('Chamado sem conversa vinculada');
    }

    const commentUserIds = ticket.comments.flatMap(c => [
      String(c.userId),
      ...(c.mentionedUserIds ?? []).map(id => String(id)),
    ]);
    const noteUserIds = (ticket.internalNotesList ?? []).map(n => String(n.userId));
    const extraUserIds = [
      String(ticket.openedByUserId),
      ticket.closedByUserId ? String(ticket.closedByUserId) : '',
      ticket.assignedUserId ? String(ticket.assignedUserId) : '',
      ...commentUserIds,
      ...noteUserIds,
    ].filter(Boolean);
    const users = await User.find({ _id: { $in: extraUserIds } })
      .select('displayName email')
      .lean();
    const userMap = new Map(
      users.map(u => [String(u._id), u.displayName?.trim() || u.email?.split('@')[0] || 'Usuário']),
    );

    let deptName: string | undefined;
    if (ticket.departmentId) {
      const dept = await InboxDepartment.findById(ticket.departmentId).select('name').lean();
      deptName = dept?.name;
    }

    return {
      ...detail,
      ticket: {
        _id: String(ticket._id),
        ticketRef: ticket.ticketRef,
        status: ticket.status,
        channel: ticket.channel ?? (ticket.webChatConversationId ? 'webchat_site' : 'whatsapp'),
        subject: ticket.subject,
        internalNotesList: (ticket.internalNotesList ?? []).map(n => ({
          _id: String(n._id),
          body: n.body,
          createdAt: n.createdAt,
          authorUserName: userMap.get(String(n.userId)) ?? 'Equipe',
        })),
        departmentName: deptName,
        assignedUserId: ticket.assignedUserId ? String(ticket.assignedUserId) : undefined,
        assignedUserName: ticket.assignedUserId
          ? userMap.get(String(ticket.assignedUserId))
          : undefined,
        openedByUserName: userMap.get(String(ticket.openedByUserId)),
        closedByUserName: ticket.closedByUserId
          ? userMap.get(String(ticket.closedByUserId))
          : undefined,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        closedAt: ticket.closedAt,
        comments: ticket.comments.map(c => ({
          _id: String(c._id),
          body: c.body,
          createdAt: c.createdAt,
          authorUserName: userMap.get(String(c.userId)) ?? 'Equipe',
          mentionedUserIds: (c.mentionedUserIds ?? []).map(id => String(id)),
          mentionedUserNames: (c.mentionedUserIds ?? [])
            .map(id => userMap.get(String(id)))
            .filter(Boolean) as string[],
        })),
        clientReplies: (ticket.clientReplies ?? []).map(r => ({
          _id: String(r._id),
          body: r.body,
          createdAt: r.createdAt,
          mediaType: r.mediaType,
          mediaUrl: r.mediaUrl,
        })),
        teamHasMessagedClient: Boolean(ticket.teamHasMessagedClient),
        clientReplyPaused: Boolean(ticket.clientReplyPaused),
        clientReplyExpiresAt: ticket.clientReplyExpiresAt,
        clientCanReply: this.canClientReplyToTicket(ticket),
        unreadClientReply: Boolean(ticket.unreadClientReply),
        lastClientReplyAt: ticket.lastClientReplyAt,
        lastTeamMessageAt: ticket.lastTeamMessageAt,
        ...serializeTicketDisplayFields(ticket),
      },
      teamMembers: await this.listTeamMembersForAssignment(clientId),
    };
  }

  async closeTicket(clientId: string, userId: string, ticketRef: string) {
    const ticket = await this.getTicketForUser(clientId, userId, ticketRef);
    if (ticket.status === 'closed') throw new Error('Ticket já está fechado');

    ticket.status = 'closed';
    ticket.closedByUserId = new mongoose.Types.ObjectId(userId);
    ticket.closedAt = new Date();
    ticket.clientReplyPaused = false;
    ticket.ticketInboundMode = 'ticket';
    await ticket.save();

    WebhookDispatcherService.getInstance().emit(clientId, 'ticket.closed', {
      ticket_ref: ticket.ticketRef,
      conversation_id: String(ticket.conversationId),
      closed_at: ticket.closedAt!.toISOString(),
      closed_by_user_id: userId,
    });
    await recordAttendanceEvent({
      clientId,
      kind: 'ticket.closed',
      ticketRef: ticket.ticketRef,
      conversationId: String(ticket.conversationId),
      actorUserId: userId,
    });

    const ctx = await this.loadTicketMessageContext(ticket, clientId);
    const clientMsg = this.buildTicketClosedClientMessage(ticket, ctx);
    await this.sendTicketMessageToClient(clientId, userId, ticket, clientMsg);

    const conv = await InboxConversation.findById(ticket.conversationId);
    if (conv) {
      const agentName = await this.resolveAgentDisplayName(userId);
      await this.appendSystemMessage(
        conv,
        `Ticket *${ticket.ticketRef}* fechado por ${agentName}. Cliente notificado no WhatsApp.`,
        new mongoose.Types.ObjectId(userId),
        clientId,
      );
    }

    return { ticketRef: ticket.ticketRef, status: ticket.status, closedAt: ticket.closedAt };
  }

  async reopenTicket(clientId: string, userId: string, ticketRef: string) {
    const ticket = await this.getTicketForUser(clientId, userId, ticketRef);
    if (ticket.status !== 'closed') throw new Error('Ticket já está aberto');

    ticket.status = ticket.assignedUserId ? 'in_progress' : 'open';
    ticket.closedByUserId = undefined;
    ticket.closedAt = undefined;
    ticket.clientReplyExpiresAt = undefined;
    ticket.clientReplyPaused = false;
    await ticket.save();

    await recordAttendanceEvent({
      clientId,
      kind: 'ticket.reopened',
      ticketRef: ticket.ticketRef,
      conversationId: ticket.conversationId ? String(ticket.conversationId) : undefined,
      actorUserId: userId,
    });

    const conv = await InboxConversation.findById(ticket.conversationId);
    if (conv) {
      const agentName = await this.resolveAgentDisplayName(userId);
      await this.appendSystemMessage(
        conv,
        `Ticket *${ticket.ticketRef}* reaberto por ${agentName}.`,
        new mongoose.Types.ObjectId(userId),
        clientId,
      );
    }

    return { ticketRef: ticket.ticketRef, status: ticket.status };
  }

  async deleteTicket(clientId: string, userId: string, ticketRef: string, reason?: string) {
    const ticket = await this.getTicketForUser(clientId, userId, ticketRef);
    const ref = ticket.ticketRef;
    const convId = ticket.conversationId;

    ticket.deletedAt = new Date();
    ticket.deletedBy = new mongoose.Types.ObjectId(userId);
    ticket.deleteReason = reason?.trim() || 'Excluído pelo painel';
    await ticket.save();

    const conv = await InboxConversation.findById(convId);
    if (conv?.ticketRef === ref) {
      conv.ticketRef = undefined;
      await conv.save();
      this.notifyConversation(clientId, conv);
    }

    return { ok: true, ticketRef: ref };
  }

  /** Envia resumo do ticket + histórico de acompanhamento até o momento (WhatsApp). */
  async sendClientUpdate(clientId: string, userId: string, ticketRef: string) {
    const ticket = await this.getTicketForUser(clientId, userId, ticketRef);
    if (!ticketIsActive(ticket.status)) {
      throw new Error('Ticket fechado — reabra para enviar atualização ao cliente');
    }

    const body = await this.buildTicketSnapshotClientMessage(ticket, clientId);
    if (!body.trim()) {
      throw new Error('Nenhum dado para enviar');
    }

    ticket.teamHasMessagedClient = true;
    ticket.unreadClientReply = false;
    this.clearClientReplyGraceState(ticket, clientId);
    await ticket.save();

    await this.sendTicketMessageToClient(clientId, userId, ticket, body);

    const conv = await InboxConversation.findById(ticket.conversationId);
    if (conv) {
      const agentName = await this.resolveAgentDisplayName(userId);
      await this.appendSystemMessage(
        conv,
        `Resumo do ticket *${ticket.ticketRef}* enviado ao cliente por ${agentName}.`,
        new mongoose.Types.ObjectId(userId),
        clientId,
      );
    }

    this.notifyTicketUpdated(clientId, ticket.ticketRef);
    return { ok: true, ticketRef: ticket.ticketRef };
  }

  /** @deprecated */
  async sendTicketStatusToClient(clientId: string, userId: string, ticketRef: string) {
    return this.sendClientUpdate(clientId, userId, ticketRef);
  }

  async forwardTicketWhatsApp(
    clientId: string,
    userId: string,
    ticketRef: string,
    opts: { targetUserId?: string; phone?: string; note?: string },
  ) {
    const ticket = await this.getTicketForUser(clientId, userId, ticketRef);
    const ctx = await this.loadTicketMessageContext(ticket, clientId);

    let phone = opts.phone?.trim();
    let targetName: string | undefined;

    if (opts.targetUserId) {
      const member = await CompanyMember.findOne({
        organizationId: new mongoose.Types.ObjectId(clientId),
        userId: new mongoose.Types.ObjectId(opts.targetUserId),
        isActive: true,
      });
      phone = member?.whatsappPhone?.trim() || phone;
      targetName = await this.resolveAgentDisplayName(opts.targetUserId);
    }

    const normalized = this.normalizeWhatsappPhone(phone);
    if (!normalized) {
      throw new Error(
        'Informe o WhatsApp do funcionário ou cadastre em Equipe → editar membro → WhatsApp.',
      );
    }

    const fromName = await this.resolveAgentDisplayName(userId);
    const lines = [
      `*Encaminhamento — Ticket ${ticket.ticketRef}*`,
      '',
      `Cliente: ${ticket.contactName}`,
      `Status: ${INBOX_TICKET_STATUS_LABEL[ticket.status]}`,
      ctx.deptName ? `Setor: ${ctx.deptName}` : null,
      ctx.assignedName ? `Responsável: ${ctx.assignedName}` : null,
      `Encaminhado por: ${fromName}`,
      opts.note?.trim() ? `\n${opts.note.trim()}` : null,
      '',
      'Acesse o painel → Inbox → Tickets para detalhes.',
    ].filter((l): l is string => l !== null && l !== undefined);

    const wa = WhatsAppService.getInstance();
    const result = await wa.sendManualMessage(clientId, normalized, lines.join('\n'), undefined, {
      skipConsentCheck: true,
      skipRateLimit: true,
      consentOrigin: 'inbox-ticket-forward',
    });

    if (!result.success) throw new Error('Falha ao enviar WhatsApp para o funcionário');

    const conv = await InboxConversation.findById(ticket.conversationId);
    if (conv) {
      const label = targetName ?? normalized;
      await this.appendSystemMessage(
        conv,
        `Ticket *${ticket.ticketRef}* encaminhado para *${label}* via WhatsApp.`,
        new mongoose.Types.ObjectId(userId),
        clientId,
      );
    }

    return { ok: true, phone: normalized, targetName };
  }

  async updateTicket(
    clientId: string,
    userId: string,
    ticketRef: string,
    patch: { assignedUserId?: string; status?: InboxTicketStatus },
  ) {
    const ticket = await this.getTicketForUser(clientId, userId, ticketRef);
    if (!ticketIsActive(ticket.status)) {
      throw new Error('Ticket fechado — reabra antes de editar');
    }

    let assignedAuditUserId: string | undefined;
    if (patch.assignedUserId !== undefined) {
      if (patch.assignedUserId) {
        await this.resolveMemberUserIds(clientId, [patch.assignedUserId]);
        ticket.assignedUserId = new mongoose.Types.ObjectId(patch.assignedUserId);
        if (ticket.status === 'open') ticket.status = 'in_progress';
        assignedAuditUserId = patch.assignedUserId;
      } else {
        ticket.assignedUserId = undefined;
      }
    }
    if (patch.status && patch.status !== 'closed') {
      ticket.status = patch.status;
      ticket.lastStatusChangeAt = new Date();
      if (patch.status === 'in_progress') {
        ticket.unreadClientReply = false;
      }
    }
    ticket.updatedAt = new Date();
    await ticket.save();

    if (assignedAuditUserId) {
      await recordAttendanceEvent({
        clientId,
        kind: 'ticket.assigned',
        ticketRef: ticket.ticketRef,
        conversationId: ticket.conversationId ? String(ticket.conversationId) : undefined,
        actorUserId: userId,
        meta: { assignedUserId: assignedAuditUserId },
      });
    }

    return {
      ...ticket.toObject(),
      ...serializeTicketDisplayFields(ticket),
    };
  }

  async addTicketComment(
    clientId: string,
    userId: string,
    ticketRef: string,
    body: string,
    mentionedUserIds: string[] = [],
  ) {
    const text = body.trim();
    if (!text) throw new Error('Comentário vazio');

    const ticket = await this.getTicketForUser(clientId, userId, ticketRef);
    if (!ticketIsActive(ticket.status)) {
      throw new Error('Chamado fechado — reabra para enviar mensagem ao cliente');
    }

    const mentionIds = [...new Set(mentionedUserIds.filter(Boolean))].map(
      id => new mongoose.Types.ObjectId(id),
    );
    if (mentionIds.length) {
      await this.resolveMemberUserIds(clientId, mentionIds.map(String));
    }

    const newComment = await this.appendClientVisibleTicketComment(ticket, userId, text, {
      mentionedUserIds: mentionIds.length ? mentionIds : undefined,
    });

    const authorName = await this.resolveAgentDisplayName(userId);

    await this.publishWebChatTicketCommentToVisitor(clientId, userId, ticket, text, authorName);

    if (mentionIds.length) {
      await this.notifyTicketMentions(clientId, userId, ticket, text, mentionIds);
    }

    const mentionedNames = await Promise.all(
      mentionIds.map(id => this.resolveAgentDisplayName(String(id))),
    );

    this.notifyTicketUpdated(clientId, ticket.ticketRef);

    return {
      _id: String(newComment._id),
      body: text,
      createdAt: newComment.createdAt,
      authorUserName: authorName,
      mentionedUserIds: mentionIds.map(String),
      mentionedUserNames: mentionedNames,
    };
  }

  /**
   * Registra mensagem da equipe visível ao cliente no chamado (painel / WhatsApp TK-…).
   * Não publica no WebChat — use quando a mensagem já foi enviada pelo chat.
   */
  async recordTicketClientVisibleCommentFromBridge(
    clientId: string,
    userId: string,
    ticketRef: string,
    body: string,
  ): Promise<void> {
    const text = body.trim();
    if (!text) return;

    const normalized = ticketRef.trim().toUpperCase();
    const ticket = await InboxTicket.findOne({
      clientId: new mongoose.Types.ObjectId(clientId),
      ticketRef: normalized,
      deletedAt: { $exists: false },
    });
    if (!ticket || !ticketIsActive(ticket.status)) return;

    await this.appendClientVisibleTicketComment(ticket, userId, text);
    ticket.teamHasMessagedClient = true;
    ticket.lastTeamMessageAt = new Date();
    ticket.unreadClientReply = false;
    clearTeamSlaOnTeamReply(ticket);
    if (ticket.status === 'client_replied') {
      ticket.status = 'in_progress';
      ticket.lastStatusChangeAt = new Date();
    }
    await ticket.save();
    this.notifyTicketUpdated(clientId, ticket.ticketRef);
  }

  /** Sincroniza mensagem do visitante no WebChat para o chamado formal aberto. */
  async syncWebChatVisitorMessageToTicket(
    clientId: string,
    ticketRef: string | undefined,
    body: string,
  ): Promise<void> {
    const text = body.trim();
    const ref = ticketRef?.trim().toUpperCase();
    if (!text || !ref) return;

    const ticket = await InboxTicket.findOne({
      clientId: new mongoose.Types.ObjectId(clientId),
      ticketRef: ref,
      deletedAt: { $exists: false },
    });
    if (!ticket || !ticketIsActive(ticket.status)) return;

    const duplicate = (ticket.clientReplies ?? []).some(
      r => r.body.trim() === text && Date.now() - new Date(r.createdAt).getTime() < 5000,
    );
    if (duplicate) return;

    if (!ticket.clientReplies) ticket.clientReplies = [];
    ticket.clientReplies.push({ body: text, createdAt: new Date() });
    ticket.unreadClientReply = true;
    ticket.lastClientReplyAt = new Date();
    if (ticket.status !== 'closed') ticket.status = 'client_replied';
    ticket.updatedAt = new Date();
    await ticket.save();
    this.notifyTicketUpdated(clientId, ticket.ticketRef);
  }

  private async appendClientVisibleTicketComment(
    ticket: IInboxTicket,
    userId: string,
    body: string,
    opts?: { mentionedUserIds?: mongoose.Types.ObjectId[] },
  ) {
    ticket.comments.push({
      userId: new mongoose.Types.ObjectId(userId),
      body,
      mentionedUserIds: opts?.mentionedUserIds,
      createdAt: new Date(),
    });
    if (ticket.status === 'open') ticket.status = 'in_progress';
    else if (ticket.status === 'client_replied') ticket.status = 'in_progress';
    ticket.updatedAt = new Date();
    await ticket.save();
    return ticket.comments[ticket.comments.length - 1];
  }

  private async publishWebChatTicketCommentToVisitor(
    clientId: string,
    userId: string,
    ticket: IInboxTicket,
    body: string,
    authorName: string,
  ): Promise<void> {
    const isWebChat =
      ticket.channel === 'webchat_site' ||
      Boolean(ticket.webChatConversationId && !ticket.conversationId);
    if (!isWebChat || !ticket.webChatConversationId) return;

    const conversation = await WebChatConversation.findById(ticket.webChatConversationId).select(
      'status',
    );
    if (!conversation || conversation.status === 'closed') return;

    try {
      const { WebChatService } = await import('../webchat/WebChatService');
      await WebChatService.getInstance().sendAgentMessage(
        clientId,
        userId,
        String(ticket.webChatConversationId),
        body,
        authorName,
      );
      ticket.teamHasMessagedClient = true;
      ticket.lastTeamMessageAt = new Date();
      ticket.unreadClientReply = false;
      clearTeamSlaOnTeamReply(ticket);
      await ticket.save();
    } catch (err) {
      logger.warn('publishWebChatTicketCommentToVisitor failed', {
        clientId,
        ticketRef: ticket.ticketRef,
        err: (err as Error).message,
      });
    }
  }

  async addTicketInternalNote(
    clientId: string,
    userId: string,
    ticketRef: string,
    body: string,
  ) {
    const text = body.trim();
    if (!text) throw new Error('Nota vazia');

    const ticket = await this.getTicketForUser(clientId, userId, ticketRef);
    if (!ticketIsActive(ticket.status)) {
      throw new Error('Ticket fechado — reabra para adicionar nota');
    }

    if (!ticket.internalNotesList) ticket.internalNotesList = [];

    ticket.internalNotesList.push({
      userId: new mongoose.Types.ObjectId(userId),
      body: text,
      createdAt: new Date(),
    });
    ticket.updatedAt = new Date();
    await ticket.save();

    const authorName = await this.resolveAgentDisplayName(userId);
    const newNote = ticket.internalNotesList[ticket.internalNotesList.length - 1];

    this.notifyTicketUpdated(clientId, ticket.ticketRef);

    return {
      _id: String(newNote._id),
      body: text,
      createdAt: newNote.createdAt,
      authorUserName: authorName,
    };
  }

  private async migrateLegacyInternalNotes(ticket: IInboxTicket): Promise<void> {
    const legacy = ticket.internalNotes?.trim();
    if (!legacy) return;
    if ((ticket.internalNotesList?.length ?? 0) > 0) {
      ticket.internalNotes = undefined;
      await ticket.save();
      return;
    }
    if (!ticket.internalNotesList) ticket.internalNotesList = [];
    ticket.internalNotesList.push({
      userId: ticket.openedByUserId,
      body: legacy,
      createdAt: ticket.updatedAt ?? ticket.createdAt,
    });
    ticket.internalNotes = undefined;
    await ticket.save();
  }

  private async getTicketForUser(
    clientId: string,
    userId: string,
    ticketRef: string,
  ): Promise<IInboxTicket> {
    const normalized = ticketRef.trim().toUpperCase();
    const ticket = await InboxTicket.findOne({
      clientId: new mongoose.Types.ObjectId(clientId),
      ticketRef: normalized,
      ...TICKET_NOT_DELETED,
    });
    if (!ticket) throw new Error('Ticket não encontrado');
    if (ticket.webChatConversationId) {
      const wc = await WebChatConversation.findOne({
        _id: ticket.webChatConversationId,
        clientId: new mongoose.Types.ObjectId(clientId),
      });
      if (!wc) throw new Error('Conversa do site não encontrada');
    } else if (ticket.conversationId) {
      await this.getConversationIfAllowed(clientId, userId, String(ticket.conversationId));
    } else {
      throw new Error('Chamado sem conversa vinculada');
    }
    return ticket;
  }

  private async loadTicketMessageContext(ticket: IInboxTicket, clientId: string) {
    let deptName: string | undefined;
    if (ticket.departmentId) {
      const dept = await InboxDepartment.findById(ticket.departmentId).select('name').lean();
      deptName = dept?.name;
    }
    let assignedName: string | undefined;
    if (ticket.assignedUserId) {
      assignedName = await this.resolveAgentDisplayName(String(ticket.assignedUserId));
    }
    let openedByName: string | undefined;
    if (ticket.openedByUserId) {
      openedByName = await this.resolveAgentDisplayName(String(ticket.openedByUserId));
    }
    return { deptName, assignedName, openedByName };
  }

  private formatTicketDate(d: Date | string | undefined): string {
    if (!d) return '—';
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatTicketTime(d: Date | string | undefined): string {
    if (!d) return '—';
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private async buildTicketSnapshotClientMessage(
    ticket: IInboxTicket,
    clientId: string,
  ): Promise<string> {
    const ctx = await this.loadTicketMessageContext(ticket, clientId);

    const commentUserIds = ticket.comments.map(c => String(c.userId));
    const users = commentUserIds.length
      ? await User.find({ _id: { $in: commentUserIds } }).select('displayName email').lean()
      : [];
    const userMap = new Map(
      users.map(u => [
        String(u._id),
        u.displayName?.trim() || u.email?.split('@')[0] || 'Equipe',
      ]),
    );

    type TimelineEntry = { at: Date; block: string };
    const timeline: TimelineEntry[] = [];

    for (const c of ticket.comments) {
      const name = userMap.get(String(c.userId)) ?? 'Equipe';
      timeline.push({
        at: new Date(c.createdAt),
        block: `*${name}* · ${this.formatTicketTime(c.createdAt)}\n${c.body.trim()}`,
      });
    }

    for (const r of ticket.clientReplies ?? []) {
      timeline.push({
        at: new Date(r.createdAt),
        block: `*${ticket.contactName}* · ${this.formatTicketTime(r.createdAt)}\n${r.body.trim()}`,
      });
    }

    timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

    const headerLines = [
      `*Atualização do ticket ${ticket.ticketRef}*`,
      '',
      `Status: ${INBOX_TICKET_STATUS_LABEL[ticket.status]}`,
      `Cliente: ${ticket.contactName}`,
      ctx.deptName ? `Setor: ${ctx.deptName}` : null,
      ctx.assignedName ? `Responsável: ${ctx.assignedName}` : null,
      `Aberto em: ${this.formatTicketDate(ticket.createdAt)}`,
      ticket.subject?.trim() ? `Assunto: ${ticket.subject.trim()}` : null,
      '',
      timeline.length > 0
        ? '*Acompanhamento até agora:*'
        : '*Ainda sem mensagens no acompanhamento.*',
    ].filter((l): l is string => l !== null && l !== undefined);

    const footer = ['', TICKET_CLIENT_REPLY_FOOTER];

    let message = [...headerLines, ...timeline.map(t => t.block), ...footer].join('\n\n');

    const maxLen = 3900;
    if (message.length > maxLen) {
      message =
        message.slice(0, maxLen) +
        '\n\n_(Histórico truncado — mensagens mais antigas omitidas por limite do WhatsApp.)_';
    }

    return message;
  }

  private buildTicketStatusClientMessage(ticket: IInboxTicket, ctx: Awaited<ReturnType<InboxService['loadTicketMessageContext']>>) {
    const lines = [
      `*Atualização do ticket ${ticket.ticketRef}*`,
      '',
      `Status: ${INBOX_TICKET_STATUS_LABEL[ticket.status]}`,
      `Cliente: ${ticket.contactName}`,
      ctx.deptName ? `Setor: ${ctx.deptName}` : null,
      ctx.assignedName ? `Responsável: ${ctx.assignedName}` : null,
      `Aberto em: ${this.formatTicketDate(ticket.createdAt)}`,
      ticket.subject?.trim() ? `Assunto: ${ticket.subject.trim()}` : null,
      '',
      TICKET_CLIENT_REPLY_FOOTER,
    ].filter((l): l is string => l !== null && l !== undefined);
    return lines.join('\n');
  }

  private buildAiTicketOpenedClientMessage(
    ticket: IInboxTicket,
    ctx: Awaited<ReturnType<InboxService['loadTicketMessageContext']>>,
    publicAccessToken?: string,
  ): string {
    const lines = [
      `*Chamado registrado — ${ticket.ticketRef}*`,
      '',
      `Olá *${ticket.contactName}*!`,
      '',
      `Registramos sua solicitação para acompanhamento assíncrono. Guarde a referência *${ticket.ticketRef}*.`,
      publicAccessToken
        ? `Token de consulta no chat do site: *${publicAccessToken}*`
        : null,
      ticket.subject?.trim() ? `Assunto: ${ticket.subject.trim()}` : null,
      ctx.deptName ? `Setor: ${ctx.deptName}` : null,
      '',
      TICKET_CLIENT_REPLY_FOOTER,
    ].filter((l): l is string => l !== null && l !== undefined);
    return lines.join('\n');
  }

  private buildTicketOpenedClientMessage(
    ticket: IInboxTicket,
    ctx: Awaited<ReturnType<InboxService['loadTicketMessageContext']>>,
    openedByName: string,
    publicAccessToken?: string,
  ): string {
    const lines = [
      `*Chamado aberto — ${ticket.ticketRef}*`,
      '',
      `Olá *${ticket.contactName}*!`,
      '',
      `Registramos sua solicitação. Guarde a referência *${ticket.ticketRef}* para acompanhar.`,
      publicAccessToken
        ? `Token de consulta no chat do site: *${publicAccessToken}*`
        : null,
      ctx.deptName ? `Setor: ${ctx.deptName}` : null,
      ctx.assignedName ? `Responsável: ${ctx.assignedName}` : null,
      `Aberto por: ${openedByName}`,
      '',
      TICKET_CLIENT_REPLY_FOOTER,
    ].filter((l): l is string => l !== null && l !== undefined);
    return lines.join('\n');
  }

  private buildTicketClosedClientMessage(ticket: IInboxTicket, ctx: Awaited<ReturnType<InboxService['loadTicketMessageContext']>>) {
    const who = ctx.assignedName ? `\nAtendimento: *${ctx.assignedName}*.` : '';
    return (
      `Olá *${ticket.contactName}*!\n\n` +
      `Ticket *${ticket.ticketRef}*\n` +
      `Status: *${INBOX_TICKET_STATUS_LABEL.closed}*\n\n` +
      `Nossa equipe encerrou este chamado.${who}\n\n` +
      TICKET_CLOSE_REPLY_HINT
    );
  }

  private normalizeWhatsappPhone(phone?: string): string | null {
    if (!phone?.trim()) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return null;
    return digits.startsWith('55') ? digits : `55${digits}`;
  }

  private async sendTicketMessageToClient(
    clientId: string,
    userId: string,
    ticket: IInboxTicket,
    body: string,
  ): Promise<void> {
    this.renewTeamClientReplyWindow(ticket, 'ticket');
    ticket.lastTeamMessageAt = new Date();
    ticket.teamHasMessagedClient = true;
    ticket.unreadClientReply = false;
    clearTeamSlaOnTeamReply(ticket);
    if (ticket.status === 'client_replied') {
      ticket.status = 'in_progress';
      ticket.lastStatusChangeAt = new Date();
    }

    const isWebChat =
      ticket.channel === 'webchat_site' ||
      Boolean(ticket.webChatConversationId && !ticket.conversationId);

    if (isWebChat && ticket.webChatConversationId) {
      const { WebChatService } = await import('../webchat/WebChatService');
      await WebChatService.getInstance().sendTicketClientNotification(
        clientId,
        userId,
        String(ticket.webChatConversationId),
        body,
      );
      await ticket.save();
      return;
    }

    const conv = await InboxConversation.findById(ticket.conversationId);
    if (!conv) throw new Error('Conversa vinculada não encontrada');

    const result = await this.sendToContact(clientId, ticket.contactIdentifier, body);
    await ticket.save();
    await InboxMessage.create({
      clientId: conv.clientId,
      conversationId: conv._id,
      direction: 'outbound',
      body,
      authorUserId: new mongoose.Types.ObjectId(userId),
      ...(result.messageId?.trim() ? { whatsappMessageId: result.messageId.trim() } : {}),
    });
    conv.lastMessageAt = new Date();
    await conv.save();
    this.notifyMessage(clientId, String(conv._id));
    this.notifyConversation(clientId, conv);
  }

  private async notifyTicketMentions(
    clientId: string,
    authorUserId: string,
    ticket: IInboxTicket,
    commentBody: string,
    mentionIds: mongoose.Types.ObjectId[],
  ): Promise<void> {
    const authorName = await this.resolveAgentDisplayName(authorUserId);
    const preview = commentBody.length > 120 ? `${commentBody.slice(0, 117)}…` : commentBody;

    for (const uid of mentionIds) {
      if (String(uid) === authorUserId) continue;

      emitPanelEvent(clientId, {
        id: crypto.randomUUID(),
        type: 'inbox:priority',
        title: `Menção no ticket ${ticket.ticketRef}`,
        body: `${authorName}: ${preview}`,
        href: `/platform/inbox/tickets/${ticket.ticketRef}`,
        createdAt: new Date().toISOString(),
      });

      const member = await CompanyMember.findOne({
        organizationId: new mongoose.Types.ObjectId(clientId),
        userId: uid,
        isActive: true,
      });
      const phone = this.normalizeWhatsappPhone(member?.whatsappPhone);
      if (!phone) continue;

      const wa = WhatsAppService.getInstance();
      await wa.sendManualMessage(
        clientId,
        phone,
        `*Menção — Ticket ${ticket.ticketRef}*\n${authorName} mencionou você:\n"${preview}"\n\nPainel → Inbox → Tickets`,
        undefined,
        { skipConsentCheck: true, skipRateLimit: true, consentOrigin: 'inbox-ticket-mention' },
      );
    }
  }

  async getConversationDetail(clientId: string, userId: string, conversationId: string) {
    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    const settings = await loadInboxSettings(clientId);
    const pullTimeoutSeconds = settings.roundRobinPullTimeoutSeconds ?? 120;

    const agentIds = [conv.assignedUserId, conv.suggestedUserId]
      .filter(Boolean)
      .map(id => String(id));
    const agents = await User.find({ _id: { $in: agentIds } }).select('displayName email').lean();
    const agentMap = new Map(
      agents.map(a => [
        String(a._id),
        a.displayName?.trim() || a.email?.split('@')[0] || 'Atendente',
      ]),
    );

    const messagesRaw = await InboxMessage.find({
      conversationId: conv._id,
    })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();

    const internalAuthorIds = messagesRaw
      .filter(m => m.direction === 'internal' && m.authorUserId)
      .map(m => String(m.authorUserId));
    const internalAuthors =
      internalAuthorIds.length > 0
        ? await User.find({ _id: { $in: internalAuthorIds } }).select('displayName email').lean()
        : [];
    const internalAuthorMap = new Map(
      internalAuthors.map(a => [
        String(a._id),
        a.displayName?.trim() || a.email?.split('@')[0] || 'Equipe',
      ]),
    );
    const messages = messagesRaw.map(m => ({
      ...m,
      _id: String(m._id),
      authorUserName:
        m.direction === 'internal' && m.authorUserId
          ? internalAuthorMap.get(String(m.authorUserId))
          : undefined,
    }));
    const transfers = await InboxTransfer.find({ conversationId: conv._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    let departmentMeta: Record<string, unknown> = {};
    if (conv.departmentId) {
      const dept = await InboxDepartment.findById(conv.departmentId)
        .select('name clientVisible internalRank menuKey')
        .lean();
      if (dept) {
        departmentMeta = departmentBadgeFieldsFrom(dept);
      }
    }

    const leadLinked = await LeadCapture.findOne({
      clientId: conv.clientId,
      inboxConversationId: conv._id,
    })
      .select('_id')
      .lean();

    const convWithDept = {
      ...(conv.toObject() as Record<string, unknown>),
      ...departmentMeta,
      ...(leadLinked ? { isLeadEntry: true } : {}),
    };

    const [conversation, contactContext, destination] = await Promise.all([
      this.enrichConversationRow(
        convWithDept,
        userId,
        clientId,
        agentMap,
        pullTimeoutSeconds,
        triageInactivityTotalMinutes(
          settings.triageWarningMinutes ?? DEFAULT_INBOX_TRIAGE_INACTIVITY.triageWarningMinutes,
          settings.triageCloseAfterWarningMinutes ??
            DEFAULT_INBOX_TRIAGE_INACTIVITY.triageCloseAfterWarningMinutes,
        ),
        {
          inactivityAutoCloseEnabled: settings.inactivityAutoCloseEnabled,
          inactivityCloseMinutes: settings.inactivityCloseMinutes,
          inactivityWarningMinutes: settings.inactivityWarningMinutes,
        },
      ),
      this.buildContactContext(clientId, conv.destinationId, conv._id as mongoose.Types.ObjectId),
      Destination.findOne({ _id: conv.destinationId, clientId: conv.clientId })
        .select(
          'name email notes organization identifier contactGroupIds tags lastMessageSent consentStatus consent pendingOutboundCount contactKind contactOrigin commercialStatus temperature phoneQuality phoneType profilePictureMime type',
        )
        .lean(),
    ]);

    const classificationCtx = destination
      ? await loadCampaignClassificationContext(clientId)
      : null;

    const quickReplies = normalizeQuickReplies(settings.quickReplies);

    return {
      conversation: {
        ...conversation,
        destinationId: String(conv.destinationId),
        ticketRef: conv.ticketRef,
        createdAt: conv.createdAt,
        resolvedAt: conv.resolvedAt,
        acceptedAt: conv.acceptedAt,
        lastMessageAt: conv.lastMessageAt,
        lastInboundAt: conv.lastInboundAt,
        lastOutboundAt: conv.lastOutboundAt,
      },
      messages,
      transfers,
      contactStats: contactContext.contactStats,
      previousConversations: contactContext.previousConversations,
      contact: destination
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
        : null,
      quickReplies,
      inactivitySla: {
        inactivityAutoCloseEnabled: settings.inactivityAutoCloseEnabled,
        inactivityCloseMinutes: settings.inactivityCloseMinutes,
        inactivityWarningMinutes: settings.inactivityWarningMinutes,
        inactivityWarningQuickCode: resolveInactivityWarningQuickCode(settings),
        inactivityCloseQuickCode: resolveInactivityCloseQuickCode(settings),
        gracefulCloseQuickCode: resolveGracefulCloseQuickCode(settings),
        gracefulCloseAfterPromptMinutes: settings.gracefulCloseAfterPromptMinutes,
        gracefulCloseDetectPhrases: settings.gracefulCloseDetectPhrases,
        inactivityCloseGracefulQuickCode: resolveInactivityCloseGracefulQuickCode(settings),
        closeQuickReplyGateEnabled: settings.closeQuickReplyGateEnabled !== false,
        inactivityCloseAfterWarningMinutes: inactivityCloseAfterWarningMinutes(
          settings.inactivityCloseMinutes ?? DEFAULT_INBOX_SLA.inactivityCloseMinutes,
          settings.inactivityWarningMinutes ?? DEFAULT_INBOX_SLA.inactivityWarningMinutes,
        ),
      },
    };
  }

  async getConversationMessages(
    clientId: string,
    userId: string,
    conversationId: string,
  ) {
    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    const messages = await InboxMessage.find({ conversationId: conv._id })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();
    return {
      conversationId: String(conv._id),
      status: conv.status,
      ticketRef: conv.ticketRef,
      createdAt: conv.createdAt,
      resolvedAt: conv.resolvedAt,
      messages,
    };
  }

  async assignConversation(clientId: string, userId: string, conversationId: string) {
    await assertInboxOrganizationMember(clientId, userId);
    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    if (TERMINAL_STATUSES.has(conv.status)) {
      throw new Error('Conversa já finalizada');
    }

    if (conv.status === InboxConversationStatus.IN_PROGRESS) {
      if (conv.assignedUserId?.toString() === userId) {
        return conv.toObject();
      }
      throw new Error('Conversa em atendimento por outro agente');
    }

    if (conv.status === InboxConversationStatus.WAITING_QUEUE) {
      await this.assertCanTakeQueueConversation(clientId, userId, conv);
      const maxConcurrent = await this.resolveMaxConcurrentForClient(clientId);
      const canTake = await canAgentManuallyAssumeConversation(clientId, userId, maxConcurrent, {
        inboxConversationId: String(conv._id),
      });
      if (canTake.ok === false) {
        throw new Error(formatManualAssumeBlockMessage(canTake.reason, maxConcurrent));
      }
    }

    const prevAssigned = conv.assignedUserId?.toString();
    const pulledFrom = conv.suggestedUserId?.toString();
    const wasPull = pulledFrom && pulledFrom !== userId;

    conv.suggestedUserId = undefined;
    conv.suggestedAt = undefined;
    conv.assignedUserId = new mongoose.Types.ObjectId(userId);
    conv.acceptedAt = new Date();
    conv.status = InboxConversationStatus.IN_PROGRESS;
    conv.lastMessageAt = new Date();
    await conv.save();
    try {
      await this.syncHumanAssignedAiState(clientId, String(conv._id));
    } catch (e) {
      logger.warn('Falha ao sincronizar status IA (human_assigned)', {
        clientId,
        conversationId: String(conv._id),
        error: (e as Error).message,
      });
    }

    if (wasPull) {
      const pullerName = await this.resolveAgentDisplayName(userId);
      await this.appendSystemMessage(
        conv,
        `${pullerName} assumiu a conversa (prioridade anterior expirada ou atendente ocupado).`,
        new mongoose.Types.ObjectId(userId),
        clientId,
      );
    }

    if (!prevAssigned || prevAssigned !== userId) {
      await this.announceAgentJoin(clientId, conv, userId);
    }
    void recordAttendanceEvent({
      clientId,
      kind: 'inbox.assigned',
      conversationId: String(conv._id),
      actorUserId: userId,
      meta: {
        channel: conv.channel,
        departmentId: conv.departmentId ? String(conv.departmentId) : null,
        wasPull: Boolean(wasPull),
        previousAssignedUserId: prevAssigned ?? null,
      },
    });
    await this.pushPanelEvent(clientId, 'inbox:assigned', 'Conversa assumida', conv.contactName, {
      conversationId: String(conv._id),
      targetUserId: userId,
    });
    this.notifyConversation(clientId, conv);
    return conv.toObject();
  }

  /** Abre ou reutiliza conversa Inbox para lead de formulário e atribui ao atendente. */
  async openConversationFromLead(
    clientId: string,
    userId: string,
    opts: {
      destinationId: string;
      contactName: string;
      formName: string;
      message?: string;
      email?: string;
      sourceUrl?: string;
      captureId?: string;
      leadOrigin?: LeadCaptureOrigin;
      /** Operador abriu pela Central de Leads — cria conversa ativa com setor Lead/Comercial. */
      employeeInitiated?: boolean;
    },
  ): Promise<{ conversationId: string; created: boolean; assigned: boolean }> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const dest = await Destination.findOne({
      _id: new mongoose.Types.ObjectId(opts.destinationId),
      clientId: clientOid,
      type: 'contact',
    });
    if (!dest) throw new Error('Contato não encontrado');

    const leadDept = opts.employeeInitiated
      ? await this.resolveLeadDepartmentForUser(clientId, userId)
      : null;

    let conv = await this.findOpenConversation(clientId, dest._id as mongoose.Types.ObjectId);
    let created = false;

    if (
      opts.employeeInitiated &&
      conv &&
      conv.status === InboxConversationStatus.BOT_TRIAGE &&
      !conv.assignedUserId
    ) {
      await this.closeConversationForInactivity(clientId, conv, {
        byUserId: userId,
        reason: 'agent_enc',
        skipMessage: true,
      });
      conv = null;
    }

    const leadLines = this.buildLeadOpenSystemMessage({
      ...opts,
      departmentName: leadDept?.name,
    });

    if (!conv) {
      conv = opts.employeeInitiated
        ? await this.createEmployeeLeadConversation(
            clientId,
            dest,
            userId,
            leadDept?._id as mongoose.Types.ObjectId | undefined,
          )
        : await this.createConversation(clientId, dest);
      created = true;

      await this.appendSystemMessage(
        conv,
        leadLines,
        new mongoose.Types.ObjectId(userId),
        clientId,
      );
      this.notifyConversation(clientId, conv);
      await this.pushPanelEvent(
        clientId,
        'inbox:new_chat',
        opts.employeeInitiated ? 'Lead — atendimento aberto' : 'Lead do formulário',
        dest.name || dest.identifier,
        { conversationId: String(conv._id) },
      );
    } else if (opts.employeeInitiated) {
      if (leadDept) {
        conv.departmentId = leadDept._id as mongoose.Types.ObjectId;
        await ContactAutoSegmentService.getInstance().tagLeadFromInboxDepartment(
          clientId,
          dest,
          leadDept.name,
        );
      }
      await this.appendSystemMessage(
        conv,
        leadLines,
        new mongoose.Types.ObjectId(userId),
        clientId,
      );
      await conv.save();
      this.notifyConversation(clientId, conv);
    }

    const alreadyMine =
      conv.status === InboxConversationStatus.IN_PROGRESS &&
      conv.assignedUserId?.toString() === userId;

    if (!alreadyMine) {
      if (
        conv.status === InboxConversationStatus.IN_PROGRESS &&
        conv.assignedUserId?.toString() !== userId
      ) {
        throw new Error('Conversa em atendimento por outro agente');
      }
      await this.assignConversation(clientId, userId, String(conv._id));
    } else if (opts.employeeInitiated && leadDept && !conv.departmentId) {
      conv.departmentId = leadDept._id as mongoose.Types.ObjectId;
      await conv.save();
      this.notifyConversation(clientId, conv);
    }

    if (opts.employeeInitiated && leadDept) {
      await ContactAutoSegmentService.getInstance().tagLeadFromInboxDepartment(
        clientId,
        dest,
        leadDept.name,
      );
    }

    return {
      conversationId: String(conv._id),
      created,
      assigned: !alreadyMine,
    };
  }

  /** Conversa iniciada pelo operador na Central de Leads — já em atendimento humano. */
  private async createEmployeeLeadConversation(
    clientId: string,
    dest: IDestination,
    userId: string,
    departmentId?: mongoose.Types.ObjectId,
  ): Promise<IInboxConversation> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const userOid = new mongoose.Types.ObjectId(userId);
    const now = new Date();
    return InboxConversation.create({
      clientId: clientOid,
      destinationId: dest._id,
      contactIdentifier: dest.identifier,
      contactName: dest.name || dest.identifier,
      status: InboxConversationStatus.IN_PROGRESS,
      assignedUserId: userOid,
      acceptedAt: now,
      departmentId,
      channel: 'whatsapp_qr',
      lastMessageAt: now,
      lastOutboundAt: now,
    });
  }

  private buildLeadOpenSystemMessage(opts: {
    formName: string;
    message?: string;
    email?: string;
    sourceUrl?: string;
    captureId?: string;
    leadOrigin?: LeadCaptureOrigin;
    employeeInitiated?: boolean;
    departmentName?: string;
  }): string {
    const originLabel = opts.leadOrigin ? LEAD_CAPTURE_ORIGIN_LABEL[opts.leadOrigin] : null;
    const lines = [
      opts.employeeInitiated
        ? '📋 *Central de Leads* — atendimento aberto pelo operador'
        : `📋 Lead capturado via formulário *${opts.formName}*`,
      opts.departmentName ? `Setor: ${opts.departmentName}` : null,
      originLabel ? `Origem: ${originLabel}` : null,
      opts.captureId ? `Captura: ${opts.captureId}` : null,
      opts.message ? `Mensagem: ${opts.message}` : null,
      opts.email ? `E-mail: ${opts.email}` : null,
      opts.sourceUrl ? `Página: ${opts.sourceUrl}` : null,
      opts.employeeInitiated ? 'Categoria: Lead / Comercial' : null,
    ].filter(Boolean);
    return lines.join('\n');
  }

  /** Setor comercial/lead que o atendente pode ver (evita bloquear acesso à conversa). */
  private async resolveLeadDepartmentForUser(
    clientId: string,
    userId: string,
  ): Promise<IInboxDepartment | null> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const depts = await InboxDepartment.find({ clientId: clientOid, isActive: true })
      .sort({ name: 1 })
      .exec();
    const leadDepts = depts.filter(d => isLeadInboxDepartment(d.name));
    if (!leadDepts.length) return null;

    const visibility = await this.departmentVisibility(clientId, userId);
    if (!visibility.restricted) return leadDepts[0];

    const allowed = leadDepts.find(d =>
      visibility.departmentIds.some(id => id.equals(d._id as mongoose.Types.ObjectId)),
    );
    return allowed ?? null;
  }

  private async assertCanTakeQueueConversation(
    clientId: string,
    userId: string,
    conv: IInboxConversation,
  ): Promise<void> {
    const suggestedId = conv.suggestedUserId?.toString();
    if (!suggestedId) return;

    if (suggestedId === userId) return;

    const settings = await loadInboxSettings(clientId);
    const maxConcurrent = await this.resolveMaxConcurrentForClient(clientId);
    const busy = await isAgentAtCapacity(
      clientId,
      suggestedId,
      maxConcurrent,
      { inboxConversationId: String(conv._id) },
    );
    const { pullAllowedByTimeout } = getQueuePriorityState(
      conv.suggestedAt,
      settings.roundRobinPullTimeoutSeconds ?? 120,
    );

    if (!busy && !pullAllowedByTimeout && isAgentAvailableForQueue(clientId, suggestedId)) {
      throw new Error(
        'Esta conversa está em prioridade para outro atendente. Aguarde o tempo ou até ele ficar ocupado.',
      );
    }
  }

  async replyToConversation(
    clientId: string,
    userId: string,
    conversationId: string,
    text: string,
  ) {
    const raw = text.trim();
    if (!raw) throw new Error('Mensagem vazia');

    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    if (TERMINAL_STATUSES.has(conv.status)) {
      throw new Error('Conversa já finalizada');
    }

    const settings = await loadInboxSettings(clientId);
    const quickReplies = normalizeQuickReplies(settings.quickReplies);
    const quickCode = parseQuickReplyCode(raw);
    const body = expandQuickReply(raw, quickReplies, conv.contactName);
    const warnCode = resolveInactivityWarningQuickCode(settings);
    const closeCode = resolveInactivityCloseQuickCode(settings);
    const maisCode = resolveGracefulCloseQuickCode(settings);
    const encOkCode = resolveInactivityCloseGracefulQuickCode(settings);

    if (isInactivityCloseQuickCode(quickCode, settings)) {
      const gateEnabled = settings.closeQuickReplyGateEnabled !== false;
      const encAllowed = isEncInactivityCloseQuickReplyAllowed(
        {
          lastInboundAt: conv.lastInboundAt,
          lastOutboundAt: conv.lastOutboundAt,
          inactivityWarnedAt: conv.inactivityWarnedAt,
          gracefulClosePromptAt: conv.gracefulClosePromptAt,
          gracefulCloseAckAt: conv.gracefulCloseAckAt,
          closeGateSource: conv.closeGateSource,
        },
        {
          inactivityCloseMinutes:
            settings.inactivityCloseMinutes ?? DEFAULT_INBOX_SLA.inactivityCloseMinutes,
          inactivityWarningMinutes:
            settings.inactivityWarningMinutes ?? DEFAULT_INBOX_SLA.inactivityWarningMinutes,
        },
      );
      if (gateEnabled && !encAllowed) {
        const afterAus = inactivityCloseAfterWarningMinutes(
          settings.inactivityCloseMinutes ?? DEFAULT_INBOX_SLA.inactivityCloseMinutes,
          settings.inactivityWarningMinutes ?? DEFAULT_INBOX_SLA.inactivityWarningMinutes,
        );
        throw new Error(
          `O atalho /${closeCode} só libera após enviar /${warnCode} e aguardar ${afterAus} min.`,
        );
      }
    }

    if (isInactivityCloseGracefulQuickCode(quickCode, settings)) {
      const gateEnabled = settings.closeQuickReplyGateEnabled !== false;
      const encOkAllowed = isEncOkCloseQuickReplyAllowed(
        {
          lastInboundAt: conv.lastInboundAt,
          lastOutboundAt: conv.lastOutboundAt,
          inactivityWarnedAt: conv.inactivityWarnedAt,
          gracefulClosePromptAt: conv.gracefulClosePromptAt,
          gracefulCloseAckAt: conv.gracefulCloseAckAt,
          closeGateSource: conv.closeGateSource,
        },
        {
          gracefulCloseAfterPromptMinutes:
            settings.gracefulCloseAfterPromptMinutes ??
            DEFAULT_INBOX_SLA.gracefulCloseAfterPromptMinutes,
        },
      );
      if (gateEnabled && !encOkAllowed) {
        const afterMais =
          settings.gracefulCloseAfterPromptMinutes ??
          DEFAULT_INBOX_SLA.gracefulCloseAfterPromptMinutes;
        throw new Error(
          `O atalho /${encOkCode} só libera após enviar /${maisCode} (${afterMais} min ou resposta do cliente).`,
        );
      }
    }

    if (conv.status === InboxConversationStatus.WAITING_QUEUE) {
      if (conv.suggestedUserId && conv.suggestedUserId.toString() !== userId) {
        throw new Error('Aceite ou aguarde a prioridade desta conversa antes de responder');
      }
      if (!conv.assignedUserId) {
        throw new Error('Assuma a conversa antes de responder');
      }
    }

    const prevAssigned = conv.assignedUserId?.toString();
    if (!conv.assignedUserId || prevAssigned !== userId) {
      if (conv.assignedUserId && prevAssigned !== userId) {
        throw new Error('Conversa em atendimento por outro agente');
      }
      conv.assignedUserId = new mongoose.Types.ObjectId(userId);
      conv.status = InboxConversationStatus.IN_PROGRESS;
      conv.suggestedUserId = undefined;
      conv.suggestedAt = undefined;
      await conv.save();
      if (prevAssigned !== userId) {
        await this.announceAgentJoin(clientId, conv, userId);
      }
    }

    const result = await this.sendToContact(clientId, conv.contactIdentifier, body);
    await InboxMessage.create({
      clientId: conv.clientId,
      conversationId: conv._id,
      direction: 'outbound',
      body,
      authorUserId: new mongoose.Types.ObjectId(userId),
      ...(result.messageId?.trim() ? { whatsappMessageId: result.messageId.trim() } : {}),
    });
    conv.lastMessageAt = new Date();
    conv.lastOutboundAt = new Date();
    applyOutboundCloseGate(conv, quickCode, settings, warnCode, closeCode, maisCode, encOkCode);
    await conv.save();
    this.notifyMessage(clientId, String(conv._id));
    this.notifyConversation(clientId, conv);

    if (
      isInactivityCloseQuickCode(quickCode, settings) ||
      isInactivityCloseGracefulQuickCode(quickCode, settings)
    ) {
      await this.closeConversationForInactivity(clientId, conv, {
        byUserId: userId,
        reason: 'agent_enc',
        skipMessage: true,
      });
    }

    return { ok: true, messageId: result.messageId };
  }

  async sendInternalChatMessage(
    clientId: string,
    userId: string,
    conversationId: string,
    text: string,
    opts?: { canSupervise?: boolean },
  ) {
    const raw = text.trim();
    if (!raw) throw new Error('Mensagem vazia');

    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    if (TERMINAL_STATUSES.has(conv.status)) {
      throw new Error('Conversa encerrada');
    }

    const canSupervise = opts?.canSupervise === true;
    const assignedId = conv.assignedUserId?.toString();
    if (!canSupervise) {
      if (conv.status !== InboxConversationStatus.IN_PROGRESS) {
        throw new Error('Assuma a conversa para usar o chat interno');
      }
      if (!assignedId || assignedId !== userId) {
        throw new Error('Somente o atendente responsável ou supervisor pode enviar no chat interno');
      }
    }

    const authorName = await this.resolveAgentDisplayName(userId);
    const msg = await InboxMessage.create({
      clientId: conv.clientId,
      conversationId: conv._id,
      direction: 'internal',
      body: raw,
      authorUserId: new mongoose.Types.ObjectId(userId),
    });

    conv.lastMessageAt = new Date();
    await conv.save();
    this.notifyMessage(clientId, String(conv._id));

    void notifySupervisorInternalChatMention({
      clientId,
      authorUserId: userId,
      authorName,
      conversationId: String(conv._id),
      contactName: conv.contactName,
      body: raw,
    }).catch(() => {});

    return {
      _id: String(msg._id),
      direction: 'internal' as const,
      body: raw,
      createdAt: msg.createdAt.toISOString(),
      authorUserName: authorName,
    };
  }

  async transferConversation(
    clientId: string,
    userId: string,
    conversationId: string,
    departmentId: string,
    reason?: string,
  ) {
    const member = await assertInboxOrganizationMember(clientId, userId);
    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    this.assertCanModifyAssignedConversation(conv, userId, member);
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const target = await InboxDepartment.findOne({
      _id: new mongoose.Types.ObjectId(departmentId),
      clientId: clientOid,
      isActive: true,
    });
    if (!target) throw new Error('Setor inválido');

    await this.assertUserCanTransferToDepartment(clientId, userId, target);

    const fromDept = conv.departmentId;
    await InboxTransfer.create({
      clientId: clientOid,
      conversationId: conv._id,
      fromDepartmentId: fromDept,
      toDepartmentId: target._id,
      fromUserId: new mongoose.Types.ObjectId(userId),
      reason: reason?.trim() || undefined,
    });

    conv.departmentId = target._id as mongoose.Types.ObjectId;
    conv.assignedUserId = undefined;
    conv.suggestedUserId = undefined;
    conv.suggestedAt = undefined;
    conv.status = InboxConversationStatus.WAITING_QUEUE;
    conv.queueEnteredAt = new Date();
    conv.queueSlaNotifiedAt = undefined;
    conv.priorityPullNotifiedAt = undefined;
    conv.lastMessageAt = new Date();

    await this.tryRoundRobinSuggest(clientId, conv, target);
    await conv.save();
    void recordAttendanceEvent({
      clientId,
      kind: 'inbox.transferred',
      conversationId: String(conv._id),
      actorUserId: userId,
      meta: {
        fromDepartmentId: fromDept ? String(fromDept) : null,
        toDepartmentId: String(target._id),
        reason: reason?.trim() || null,
        channel: conv.channel,
      },
    });
    await this.pushPanelEvent(
      clientId,
      'inbox:transferred',
      'Conversa transferida',
      target.name,
      { conversationId: String(conv._id) },
    );
    this.notifyConversation(clientId, conv);

    if (target.clientVisible !== false) {
      const notify = await buildTransferMessage(clientId, target.name);
      await this.sendToContact(clientId, conv.contactIdentifier, notify);
      await this.appendSystemMessage(conv, notify, new mongoose.Types.ObjectId(userId), clientId);
    } else {
      const agentName = await this.resolveAgentDisplayName(userId);
      await this.appendSystemMessage(
        conv,
        `Transferência interna para *${target.name}* (${formatInternalRankLabel(this.getDepartmentRank(target))}) por ${agentName} — invisível ao cliente.`,
        new mongoose.Types.ObjectId(userId),
        clientId,
      );
    }

    return conv.toObject();
  }

  private quickReplyBody(
    code: string,
    quickReplies: InboxQuickReply[],
    contactName: string,
  ): string | null {
    const qr = quickReplies.find(q => q.code.toLowerCase() === code.toLowerCase());
    if (!qr) return null;
    return applyQuickReplyTemplate(qr.template, contactName);
  }

  /** Encerra conversa resolvida pela IA (sem mensagem de inatividade). */
  async closeAiResolvedConversation(
    clientId: string,
    conv: IInboxConversation,
  ): Promise<void> {
    await this.closeConversationForInactivity(clientId, conv, {
      reason: 'auto',
      skipMessage: true,
    });
    await this.clearConversationAi(clientId, String(conv._id));
  }

  /** Encerra conversa por inatividade (automático ou `/enc` do atendente). */
  async closeConversationForInactivity(
    clientId: string,
    conv: IInboxConversation,
    opts: {
      byUserId?: string;
      reason: 'auto' | 'agent_enc';
      skipMessage?: boolean;
      closingMessage?: string;
    },
  ): Promise<void> {
    if (TERMINAL_STATUSES.has(conv.status)) return;

    const settings = await loadInboxSettings(clientId);
    const quickReplies = normalizeQuickReplies(settings.quickReplies);

    if (!opts.skipMessage) {
      const closeCode = resolveInactivityCloseQuickCode(settings);
      const gracefulCloseCode = resolveInactivityCloseGracefulQuickCode(settings);
      const templateCode =
        conv.closeGateSource === 'graceful' ? gracefulCloseCode : closeCode;
      const closing =
        opts.closingMessage?.trim() ||
        this.quickReplyBody(templateCode, quickReplies, conv.contactName) ||
        this.quickReplyBody(closeCode, quickReplies, conv.contactName) ||
        'Como não houve interação, encerraremos este atendimento.';
      if (opts.reason === 'auto' && !opts.byUserId) {
        await this.sendAiReply(clientId, conv, conv.contactIdentifier, closing);
      } else {
        await this.sendToContact(clientId, conv.contactIdentifier, closing);
        await this.appendSystemMessage(
          conv,
          closing,
          opts.byUserId ? new mongoose.Types.ObjectId(opts.byUserId) : undefined,
          clientId,
        );
      }
    }

    conv.status = InboxConversationStatus.CLOSED;
    conv.resolvedAt = new Date();
    conv.lastMessageAt = new Date();
    conv.assignedUserId = undefined;
    conv.suggestedUserId = undefined;
    conv.suggestedAt = undefined;
    clearCloseGateFields(conv);
    await conv.save();

    this.notifyConversation(clientId, conv);
    WebhookDispatcherService.getInstance().emit(clientId, 'inbox.conversation.closed', {
      conversation_id: String(conv._id),
      contact_identifier: conv.contactIdentifier,
      reason: opts.reason,
      closed_by_user_id: opts.byUserId ?? null,
      closed_at: conv.resolvedAt?.toISOString() ?? new Date().toISOString(),
    });

    await this.maybeSendCsatSurvey(clientId, conv, settings, opts.byUserId);

    const { LeadFormService } = await import('@/services/leads/LeadFormService');
    void LeadFormService.getInstance().syncCaptureAfterConversationClosed(clientId, {
      inboxConversationId: String(conv._id),
      closedByUserId: opts.byUserId,
    });
  }

  private async maybeSendCsatSurvey(
    clientId: string,
    conv: IInboxConversation,
    settings: IInboxSettings,
    closedByUserId?: string,
  ): Promise<void> {
    if (!settings.csatEnabled) return;

    await InboxConversation.updateMany(
      {
        clientId: conv.clientId,
        destinationId: conv.destinationId,
        csatPending: true,
        _id: { $ne: conv._id },
      },
      { $set: { csatPending: false } },
    );

    conv.csatPending = true;
    conv.csatScore = undefined;
    conv.csatRatedAt = undefined;
    if (closedByUserId) {
      conv.csatAssignedUserId = new mongoose.Types.ObjectId(closedByUserId);
    } else if (conv.assignedUserId) {
      conv.csatAssignedUserId = conv.assignedUserId;
    }
    await conv.save();

    const prompt = settings.csatPrompt?.trim() || 'De 1 a 5, como foi nosso atendimento?';
    await this.sendToContact(clientId, conv.contactIdentifier, prompt);
    await this.appendSystemMessage(conv, prompt, undefined, clientId);
  }

  private async tryHandleCsatReply(
    clientId: string,
    dest: IDestination,
    text: string,
  ): Promise<boolean> {
    const destinationId = dest._id as mongoose.Types.ObjectId;
    const clientOid = new mongoose.Types.ObjectId(clientId);

    const openConversation = await InboxConversation.exists({
      clientId: clientOid,
      destinationId,
      status: { $nin: [...TERMINAL_STATUSES] },
    });
    if (openConversation) return false;

    if (await this.inboxTriageContextActive(clientId, destinationId)) return false;

    const csatTerminalStatuses = [
      InboxConversationStatus.CLOSED,
      InboxConversationStatus.RESOLVED,
    ];

    const pendingConv = await InboxConversation.findOne({
      clientId: clientOid,
      destinationId,
      csatPending: true,
      status: { $in: csatTerminalStatuses },
    })
      .sort({ resolvedAt: -1 })
      .exec();

    const settings = await loadInboxSettings(clientId);
    const score = parseCsatScore(text);

    if (pendingConv && shouldBypassCsatForNewService(text)) {
      await InboxConversation.updateMany(
        { clientId: clientOid, destinationId, csatPending: true },
        { $set: { csatPending: false } },
      );
      return false;
    }

    if (pendingConv) {
      if (score) {
        pendingConv.csatPending = false;
        pendingConv.csatScore = score;
        pendingConv.csatRatedAt = new Date();
        await pendingConv.save();

        await InboxConversation.updateMany(
          {
            clientId: clientOid,
            destinationId,
            csatPending: true,
            _id: { $ne: pendingConv._id },
          },
          { $set: { csatPending: false } },
        );

        const thanks = settings.csatThankYou?.trim() || 'Obrigado pela sua avaliação!';
        await this.sendToContact(clientId, dest.identifier, thanks);
        await this.appendSystemMessage(pendingConv, thanks, undefined, clientId);

        WebhookDispatcherService.getInstance().emit(clientId, 'inbox.csat.rated', {
          conversation_id: String(pendingConv._id),
          contact_identifier: pendingConv.contactIdentifier,
          score,
          assigned_user_id: pendingConv.csatAssignedUserId
            ? String(pendingConv.csatAssignedUserId)
            : null,
          rated_at: pendingConv.csatRatedAt!.toISOString(),
        });
        return true;
      }

      const prompt = settings.csatPrompt?.trim() || DEFAULT_CSAT_PROMPT;
      const outbound = isCsatIntent(text)
        ? prompt
        : 'Para avaliar o atendimento, responda só com um número de *1* a *5*.';
      await this.sendToContact(clientId, dest.identifier, outbound);
      await this.appendSystemMessage(pendingConv, outbound, undefined, clientId);
      return true;
    }

    if (isCsatIntent(text) && settings.csatEnabled) {
      const recent = await InboxConversation.findOne({
        clientId: clientOid,
        destinationId,
        status: { $in: csatTerminalStatuses },
        csatScore: { $exists: false },
        resolvedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      })
        .sort({ resolvedAt: -1 })
        .exec();
      if (recent) {
        await this.maybeSendCsatSurvey(clientId, recent, settings, recent.assignedUserId?.toString());
        return true;
      }
    }

    return false;
  }

  private async processInactivityAndQueueSla(): Promise<void> {
    try {
      const rows = await InboxSettings.find({})
        .select(
          'clientId inactivityAutoCloseEnabled inactivityCloseMinutes inactivityWarningMinutes inactivityWarningQuickCode inactivityCloseQuickCode triageInactivityEnabled triageWarningMinutes triageCloseAfterWarningMinutes triageWarningMessage triageCloseMessage queueSlaAlertMinutes ticketTeamResponseHours quickReplies',
        )
        .lean();

      const nowMs = Date.now();
      for (const row of rows) {
        const clientId = String(row.clientId);
        const closeMinutes = row.inactivityCloseMinutes ?? DEFAULT_INBOX_SLA.inactivityCloseMinutes;
        const warningMinutes =
          row.inactivityWarningMinutes ?? DEFAULT_INBOX_SLA.inactivityWarningMinutes;
        const queueMinutes = row.queueSlaAlertMinutes ?? DEFAULT_INBOX_SLA.queueSlaAlertMinutes;
        const enabled = row.inactivityAutoCloseEnabled !== false;
        const triageEnabled = row.triageInactivityEnabled !== false;

        if (triageEnabled) {
          await this.processTriageInactivity(clientId, row, nowMs);
        }
        if (enabled && closeMinutes > 0) {
          await this.processInProgressInactivity(
            clientId,
            { ...row, inactivityCloseMinutes: closeMinutes, inactivityWarningMinutes: warningMinutes },
            nowMs,
            enabled,
          );
        }
        if (queueMinutes > 0) {
          await this.processClientQueueSla(clientId, queueMinutes, nowMs);
        }
        await this.processRoundRobinPriorityExpiry(clientId, nowMs);
        await this.processOfflineSuggestedPriority(clientId);
        await this.processBusySuggestedPriority(clientId);
        await AiConversationService.getInstance().recoverStuckPromisedHandoffs(clientId, this);
        await this.processTicketTeamSla(clientId, row.ticketTeamResponseHours, nowMs);
      }
      const { WebChatService } = await import('../webchat/WebChatService');
      await WebChatService.getInstance().processWebChatFallbackAcceptTimeouts();
      await WebChatService.getInstance().processWebChatQueueMaxWait();
      await WebChatService.getInstance().processWebChatTriageInactivity();
      const { PanelCriticalAlertsService } = await import('./panel-critical-alerts.service');
      await PanelCriticalAlertsService.getInstance().scanAll();
    } catch (err) {
      logger.error('Falha no scan de SLA do Inbox', { err });
    }
  }

  private async processTicketTeamSla(
    clientId: string,
    hours: number | undefined,
    nowMs: number,
  ): Promise<void> {
    const slaHours = hours ?? DEFAULT_INBOX_SLA.ticketTeamResponseHours;
    if (slaHours <= 0) return;

    const overdue = await InboxTicket.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      ...TICKET_NOT_DELETED,
      status: { $in: ['open', 'in_progress', 'client_replied'] },
      teamSlaDueAt: { $lte: new Date(nowMs) },
      teamSlaBreachedAt: { $exists: false },
      unreadClientReply: true,
    })
      .limit(30)
      .exec();

    for (const ticket of overdue) {
      ticket.teamSlaBreachedAt = new Date(nowMs);
      ticket.updatedAt = new Date();
      await ticket.save();
      this.notifyTicketUpdated(clientId, ticket.ticketRef);
      emitPanelEvent(clientId, {
        id: crypto.randomUUID(),
        type: 'inbox:ticket_sla',
        title: 'SLA ticket estourado',
        body: `${ticket.ticketRef} — cliente aguardando equipe`,
        href: `/platform/inbox/tickets/${ticket.ticketRef}`,
        createdAt: new Date(nowMs).toISOString(),
      });
    }
  }

  private async processInProgressInactivity(
    clientId: string,
    settings: {
      inactivityCloseMinutes?: number;
      inactivityWarningMinutes?: number;
      inactivityWarningQuickCode?: string;
      quickReplies?: InboxQuickReply[];
    },
    nowMs: number,
    enabled: boolean,
  ): Promise<void> {
    const closeMinutes = settings.inactivityCloseMinutes ?? DEFAULT_INBOX_SLA.inactivityCloseMinutes;
    const warningMinutes =
      settings.inactivityWarningMinutes ?? DEFAULT_INBOX_SLA.inactivityWarningMinutes;
    if (closeMinutes <= 0) return;

    const quickReplies = normalizeQuickReplies(settings.quickReplies);
    const clientOid = new mongoose.Types.ObjectId(clientId);

    const convs = await InboxConversation.find({
      clientId: clientOid,
      status: InboxConversationStatus.IN_PROGRESS,
      assignedUserId: { $exists: true, $ne: null },
      lastOutboundAt: { $exists: true },
    })
      .limit(80)
      .exec();

    for (const conv of convs) {
      if (TERMINAL_STATUSES.has(conv.status)) continue;

      const ts = {
        lastInboundAt: conv.lastInboundAt,
        lastOutboundAt: conv.lastOutboundAt,
        inactivityWarnedAt: conv.inactivityWarnedAt,
      };

      if (
        shouldSendInactivityWarning(ts, warningMinutes, closeMinutes, nowMs) &&
        enabled
      ) {
        const warnCode = resolveInactivityWarningQuickCode(settings);
        const warnBody =
          this.quickReplyBody(warnCode, quickReplies, conv.contactName) ?? 'Você está aí?';
        try {
          await this.sendAiReply(clientId, conv, conv.contactIdentifier, warnBody);
          conv.inactivityWarnedAt = new Date();
          await conv.save();
        } catch (err) {
          logger.warn('Falha ao enviar aviso de inatividade', {
            clientId,
            conversationId: String(conv._id),
            err,
          });
        }
      }

      if (shouldAutoCloseForInactivity(ts, closeMinutes, enabled, nowMs)) {
        try {
          await this.closeConversationForInactivity(clientId, conv, { reason: 'auto' });
        } catch (err) {
          logger.warn('Falha ao encerrar conversa por inatividade', {
            clientId,
            conversationId: String(conv._id),
            err,
          });
        }
      }
    }
  }

  private async processTriageInactivity(
    clientId: string,
    row: {
      triageWarningMinutes?: number;
      triageCloseAfterWarningMinutes?: number;
      triageWarningMessage?: string;
      triageCloseMessage?: string;
    },
    nowMs: number,
  ): Promise<void> {
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

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const convs = await InboxConversation.find({
      clientId: clientOid,
      status: InboxConversationStatus.BOT_TRIAGE,
      $or: [{ assignedUserId: { $exists: false } }, { assignedUserId: null }],
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

      const warnBody = applyQuickReplyTemplate(warnTemplate, conv.contactName);

      if (
        shouldSendTriageInactivityWarning(ts, config, nowMs) ||
        shouldSendTriageStallWarning(ts, warningMinutes, true, nowMs)
      ) {
        try {
          await this.sendAiReply(clientId, conv, conv.contactIdentifier, warnBody);
          conv.inactivityWarnedAt = new Date();
          await conv.save();
        } catch (err) {
          logger.warn('Falha ao enviar aviso de inatividade na triagem', {
            clientId,
            conversationId: String(conv._id),
            err,
          });
        }
        continue;
      }

      const closeBody = applyQuickReplyTemplate(closeTemplate, conv.contactName);
      if (
        shouldCloseTriageInactivity(ts, config, nowMs) ||
        shouldAutoCloseTriageStalled(ts, warningMinutes, true, nowMs)
      ) {
        try {
          await this.closeConversationForInactivity(clientId, conv, {
            reason: 'auto',
            closingMessage: closeBody,
          });
        } catch (err) {
          logger.warn('Falha ao encerrar triagem por inatividade', {
            clientId,
            conversationId: String(conv._id),
            err,
          });
        }
      }
    }
  }

  private async processRoundRobinPriorityExpiry(clientId: string, nowMs: number): Promise<void> {
    const settings = await loadInboxSettings(clientId);
    if (!settings.roundRobinEnabled) return;

    const timeoutSec = settings.roundRobinPullTimeoutSeconds ?? 120;
    const convs = await InboxConversation.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      status: InboxConversationStatus.WAITING_QUEUE,
      suggestedUserId: { $exists: true, $ne: null },
      suggestedAt: { $exists: true },
    })
      .limit(50)
      .exec();

    for (const conv of convs) {
      if (!conv.suggestedAt || !conv.suggestedUserId) continue;

      const { pullAllowedByTimeout } = getQueuePriorityState(conv.suggestedAt, timeoutSec);
      if (!pullAllowedByTimeout) continue;

      const notifiedAt = conv.priorityPullNotifiedAt?.getTime() ?? 0;
      const suggestedAtMs = conv.suggestedAt.getTime();
      if (notifiedAt >= suggestedAtMs) continue;

      conv.priorityPullNotifiedAt = new Date(nowMs);
      await conv.save();

      const agentName = await this.resolveAgentDisplayName(String(conv.suggestedUserId));
      await this.pushPanelEvent(
        clientId,
        'inbox:priority_expired',
        'Prioridade expirada — pode puxar',
        `${conv.contactName}: ${agentName} não aceitou a tempo`,
        { conversationId: String(conv._id) },
      );
      this.notifyConversation(clientId, conv);
    }
  }

  /** Remove prioridade de atendente que atingiu capacidade — re-sugere ou abre fila. */
  private async processBusySuggestedPriority(clientId: string): Promise<void> {
    const maxConcurrent = await this.resolveMaxConcurrentForClient(clientId);

    const convs = await InboxConversation.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      status: InboxConversationStatus.WAITING_QUEUE,
      suggestedUserId: { $exists: true, $ne: null },
    })
      .limit(50)
      .exec();

    for (const conv of convs) {
      const suggestedId = conv.suggestedUserId?.toString();
      if (!suggestedId) continue;
      if (!isAgentAvailableForQueue(clientId, suggestedId)) continue;

      const atCapacity = await isAgentAtCapacity(clientId, suggestedId, maxConcurrent, {
        inboxConversationId: String(conv._id),
      });
      if (!atCapacity) continue;

      const agentName = await this.resolveAgentDisplayName(suggestedId);
      conv.suggestedUserId = undefined;
      conv.suggestedAt = undefined;
      conv.priorityPullNotifiedAt = new Date();
      await conv.save();

      const department = conv.departmentId
        ? await InboxDepartment.findById(conv.departmentId)
        : null;

      await this.appendSystemMessage(
        conv,
        `Prioridade de *${agentName}* removida (atendente ocupado) — reencaminhando fila.`,
        undefined,
        clientId,
      );

      if (department) {
        await this.tryRoundRobinSuggest(clientId, conv, department);
      }

      await this.pushPanelEvent(
        clientId,
        'inbox:priority_expired',
        'Fila — atendente ocupado',
        `${conv.contactName}: ${agentName} em atendimento`,
        { conversationId: String(conv._id) },
      );
      this.notifyConversation(clientId, conv);
    }
  }

  /** Remove prioridade de atendente offline — fila fica aberta para qualquer um. */
  private async processOfflineSuggestedPriority(clientId: string): Promise<void> {
    const convs = await InboxConversation.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      status: InboxConversationStatus.WAITING_QUEUE,
      suggestedUserId: { $exists: true, $ne: null },
    })
      .limit(50)
      .exec();

    for (const conv of convs) {
      const suggestedId = conv.suggestedUserId?.toString();
      if (!suggestedId || isAgentAvailableForQueue(clientId, suggestedId)) continue;

      const agentName = await this.resolveAgentDisplayName(suggestedId);
      conv.suggestedUserId = undefined;
      conv.suggestedAt = undefined;
      conv.priorityPullNotifiedAt = new Date();
      await conv.save();

      await this.appendSystemMessage(
        conv,
        `Prioridade de *${agentName}* removida (indisponível no painel) — qualquer atendente pode assumir.`,
        undefined,
        clientId,
      );
      await this.pushPanelEvent(
        clientId,
        'inbox:priority_expired',
        'Fila aberta — assumir',
        `${conv.contactName}: ${agentName} offline — pode assumir`,
        { conversationId: String(conv._id) },
      );
      this.notifyConversation(clientId, conv);
    }
  }

  private async processClientQueueSla(
    clientId: string,
    alertMinutes: number,
    nowMs: number,
  ): Promise<void> {
    if (alertMinutes <= 0) return;

    const convs = await InboxConversation.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      status: InboxConversationStatus.WAITING_QUEUE,
      queueEnteredAt: { $exists: true },
    })
      .limit(50)
      .exec();

    for (const conv of convs) {
      if (
        !shouldAlertQueueStall(conv.queueEnteredAt, alertMinutes, conv.queueSlaNotifiedAt, nowMs)
      ) {
        continue;
      }
      conv.queueSlaNotifiedAt = new Date();
      await conv.save();
      const waitMin = Math.floor((nowMs - (conv.queueEnteredAt?.getTime() ?? nowMs)) / 60_000);
      await this.pushPanelEvent(
        clientId,
        'inbox:queue_sla',
        'Fila parada',
        `${conv.contactName} aguarda há ${waitMin} min`,
        { conversationId: String(conv._id) },
      );
    }
  }

  async resolveConversation(clientId: string, userId: string, conversationId: string) {
    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    conv.status = InboxConversationStatus.RESOLVED;
    conv.resolvedAt = new Date();
    conv.lastMessageAt = new Date();
    conv.suggestedUserId = undefined;
    conv.suggestedAt = undefined;
    conv.aiStatus = null;
    conv.aiFallbackUntil = undefined;
    await conv.save();
    await this.clearConversationAi(clientId, conversationId);
    await setContactMenuContext(conv.destinationId as mongoose.Types.ObjectId, 'none');

    const closing = await buildResolvedMessage(clientId);
    await this.sendToContact(clientId, conv.contactIdentifier, closing);
    await this.appendSystemMessage(conv, closing, new mongoose.Types.ObjectId(userId), clientId);
    this.notifyConversation(clientId, conv);
    WebhookDispatcherService.getInstance().emit(clientId, 'inbox.conversation.resolved', {
      conversation_id: String(conv._id),
      contact_identifier: conv.contactIdentifier,
      resolved_by_user_id: userId,
      resolved_at: conv.resolvedAt?.toISOString() ?? new Date().toISOString(),
    });

    const settings = await loadInboxSettings(clientId);
    await this.maybeSendCsatSurvey(clientId, conv, settings, userId);
    return conv.toObject();
  }

  async convertToTicket(clientId: string, userId: string, conversationId: string) {
    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    const { ticket, created, publicAccessToken } = await this.ensureTicketRecord(conv, userId);
    const agentName = await this.resolveAgentDisplayName(userId);

    if (created) {
      const ctx = await this.loadTicketMessageContext(ticket, clientId);
      const clientMsg = this.buildTicketOpenedClientMessage(ticket, ctx, agentName, publicAccessToken);

      ticket.teamHasMessagedClient = true;
      await ticket.save();

      await this.sendTicketMessageToClient(clientId, userId, ticket, clientMsg);

      await this.appendSystemMessage(
        conv,
        `Ticket *${ticket.ticketRef}* aberto por ${agentName} — cliente notificado no WhatsApp.`,
        new mongoose.Types.ObjectId(userId),
        clientId,
      );
    } else {
      await this.appendSystemMessage(
        conv,
        `Ticket *${ticket.ticketRef}* já estava aberto — acompanhe em Tickets (independente do chat).`,
        new mongoose.Types.ObjectId(userId),
        clientId,
      );
    }

    this.notifyConversation(clientId, conv);
    this.notifyTicketUpdated(clientId, ticket.ticketRef);
    return {
      ticketRef: ticket.ticketRef,
      ticketStatus: ticket.status,
      notifiedClient: created,
      ok: true,
    };
  }

  private async getConversationIfAllowed(
    clientId: string,
    userId: string,
    conversationId: string,
  ): Promise<IInboxConversation> {
    await assertInboxOrganizationMember(clientId, userId);

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const conv = await InboxConversation.findOne({
      _id: new mongoose.Types.ObjectId(conversationId),
      clientId: clientOid,
    });
    if (!conv) throw new Error('Conversa não encontrada');

    const visibility = await this.departmentVisibility(clientId, userId);
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
        status: conv.status,
        assignedUserId: conv.assignedUserId,
        suggestedUserId: conv.suggestedUserId,
        departmentId: conv.departmentId,
      })
    ) {
      throw new Error('Triagem restrita — habilite em Triagem e Bot');
    }
    return conv;
  }

  private assertCanModifyAssignedConversation(
    conv: IInboxConversation,
    userId: string,
    member: { companyRole: CompanyRole },
  ): void {
    const assigned = conv.assignedUserId?.toString();
    if (!assigned || assigned === userId) return;
    if (canOverrideAssignedConversation(member)) return;
    throw new Error('Conversa em atendimento por outro agente');
  }

  /** Visibilidade de filas por setor (atendentes só veem setores com atribuição explícita). */
  async getDepartmentVisibility(
    clientId: string,
    userId: string,
  ): Promise<{ restricted: boolean; departmentIds: mongoose.Types.ObjectId[] }> {
    return this.departmentVisibility(clientId, userId);
  }

  private async departmentVisibility(
    clientId: string,
    userId: string,
  ): Promise<{ restricted: boolean; departmentIds: mongoose.Types.ObjectId[] }> {
    const member = await CompanyMember.findActiveByUserId(userId);
    if (!member || String(member.organizationId) !== clientId) {
      return { restricted: false, departmentIds: [] };
    }
    if (member.companyRole === CompanyRole.OWNER || member.companyRole === CompanyRole.ADMIN) {
      return { restricted: false, departmentIds: [] };
    }

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const userOid = new mongoose.Types.ObjectId(userId);
    const depts = await InboxDepartment.find({
      clientId: clientOid,
      isActive: true,
      memberUserIds: userOid,
    }).select('_id');

    return {
      restricted: true,
      departmentIds: depts.map(d => d._id as mongoose.Types.ObjectId),
    };
  }

  private async appendSystemMessage(
    conversation: IInboxConversation,
    body: string,
    authorUserId?: mongoose.Types.ObjectId,
    clientId?: string,
  ): Promise<void> {
    await InboxMessage.create({
      clientId: conversation.clientId,
      conversationId: conversation._id,
      direction: 'system',
      body,
      authorUserId,
    });
    conversation.lastMessageAt = new Date();
    await conversation.save();
    const cid = clientId ?? String(conversation.clientId);
    this.notifyMessage(cid, String(conversation._id));
    this.notifyConversation(cid, conversation);
  }

  async listSupervisorQueue(clientId: string, userId: string) {
    await this.assertSupervisor(clientId, userId);
    return this.listConversations(clientId, userId, {});
  }

  async reassignConversation(
    clientId: string,
    supervisorUserId: string,
    conversationId: string,
    targetUserId: string,
    mode: 'suggest' | 'assign' = 'suggest',
  ) {
    await this.assertSupervisor(clientId, supervisorUserId);
    await assertInboxOrganizationMember(clientId, supervisorUserId);
    const conv = await this.getConversationIfAllowed(clientId, supervisorUserId, conversationId);
    if (TERMINAL_STATUSES.has(conv.status)) {
      throw new Error('Conversa já finalizada');
    }

    await this.resolveMemberUserIds(clientId, [targetUserId]);

    const targetOid = new mongoose.Types.ObjectId(targetUserId);
    const agentName = await this.resolveAgentDisplayName(targetUserId);

    if (mode === 'assign') {
      conv.assignedUserId = targetOid;
      conv.acceptedAt = new Date();
      conv.suggestedUserId = undefined;
      conv.suggestedAt = undefined;
      conv.status = InboxConversationStatus.IN_PROGRESS;
      conv.lastMessageAt = new Date();
      await conv.save();
      await this.announceAgentJoin(clientId, conv, targetUserId);
      await this.appendSystemMessage(
        conv,
        `Supervisor reatribuiu o atendimento para *${agentName}*.`,
        new mongoose.Types.ObjectId(supervisorUserId),
        clientId,
      );
    } else {
      conv.suggestedUserId = targetOid;
      conv.suggestedAt = new Date();
      conv.assignedUserId = undefined;
      conv.status = InboxConversationStatus.WAITING_QUEUE;
      conv.lastMessageAt = new Date();
      await conv.save();
      await this.appendSystemMessage(
        conv,
        `Supervisor indicou prioridade para *${agentName}*.`,
        new mongoose.Types.ObjectId(supervisorUserId),
        clientId,
      );
      await this.pushPanelEvent(clientId, 'inbox:priority', 'Prioridade (supervisor)', agentName, {
        conversationId: String(conv._id),
      });
    }

    this.notifyConversation(clientId, conv);
    void recordAttendanceEvent({
      clientId,
      kind: 'inbox.reassigned',
      conversationId: String(conv._id),
      actorUserId: supervisorUserId,
      meta: {
        targetUserId,
        mode,
        channel: conv.channel,
      },
    });
    return conv.toObject();
  }

  private async assertSupervisor(clientId: string, userId: string): Promise<void> {
    const member = await CompanyMember.findOne({
      userId,
      organizationId: new mongoose.Types.ObjectId(clientId),
      isActive: true,
    });
    if (
      !member ||
      (member.companyRole !== CompanyRole.OWNER && member.companyRole !== CompanyRole.ADMIN)
    ) {
      throw new Error('Apenas dono ou administrador pode supervisionar');
    }
  }

  private async sendToContact(
    clientId: string,
    identifier: string,
    text: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    const wa = WhatsAppService.getInstance();
    return wa.sendManualMessage(clientId, identifier, text, undefined, {
      skipConsentCheck: true,
      consentOrigin: 'inbox-reply',
      sendKind: 'conversation',
    });
  }

  async getConversationRaw(
    clientId: string,
    conversationId: string,
  ): Promise<IInboxConversation | null> {
    return InboxConversation.findOne({
      _id: conversationId,
      clientId: new mongoose.Types.ObjectId(clientId),
    });
  }

  async sendAiReply(
    clientId: string,
    conversation: IInboxConversation,
    contactIdentifier: string,
    text: string,
  ): Promise<void> {
    const safeText = sanitizePremiumAiResponse(text, 'whatsapp');
    try {
      await this.sendToContact(clientId, contactIdentifier, safeText);
    } catch (err) {
      logger.warn('Falha ao enviar mensagem automática do bot ao WhatsApp', {
        clientId,
        conversationId: String(conversation._id),
        err,
      });
    }
    await InboxMessage.create({
      clientId: conversation.clientId,
      conversationId: conversation._id,
      direction: 'outbound',
      body: safeText,
    });
    conversation.lastMessageAt = new Date();
    conversation.lastOutboundAt = new Date();
    await conversation.save();
    this.notifyMessage(clientId, String(conversation._id));
    this.notifyConversation(clientId, conversation);
  }

  async escalateFromAi(
    clientId: string,
    conversation: IInboxConversation,
    dest: IDestination,
    department: IInboxDepartment | null,
    opts: { reason: string; internalNote?: string; clientMessage?: string },
  ): Promise<void> {
    if (!department) {
      const fallback = await buildInboxTriageMenu(clientId);
      await this.sendToContact(clientId, dest.identifier, fallback);
      await this.appendSystemMessage(conversation, opts.internalNote ?? opts.reason, undefined, clientId);
      return;
    }

    await ContactAutoSegmentService.getInstance().tagLeadFromInboxDepartment(
      clientId,
      dest,
      department.name,
    );

    conversation.departmentId = department._id as mongoose.Types.ObjectId;
    conversation.assignedUserId = undefined;
    conversation.suggestedUserId = undefined;
    conversation.suggestedAt = undefined;
    conversation.status = InboxConversationStatus.WAITING_QUEUE;
    conversation.queueEnteredAt = new Date();
    conversation.queueSlaNotifiedAt = undefined;
    conversation.priorityPullNotifiedAt = undefined;
    conversation.lastMessageAt = new Date();

    const suggested = await this.tryRoundRobinSuggest(clientId, conversation, department);
    await this.pushPanelEvent(clientId, 'inbox:new_chat', 'Triagem IA — fila', department.name, {
      conversationId: String(conversation._id),
    });
    await conversation.save();
    this.notifyConversation(clientId, conversation);

    if (opts.internalNote) {
      await this.appendSystemMessage(
        conversation,
        `[IA] ${opts.internalNote}`,
        undefined,
        clientId,
      );
    }

    if (opts.clientMessage !== '') {
      const clientMsg =
        opts.clientMessage ?? (await buildQueueConfirmation(clientId, department.name));
      await this.sendToContact(clientId, dest.identifier, clientMsg);
      await this.appendSystemMessage(conversation, clientMsg, undefined, clientId);
    }
    logger.info('IA escalonou conversa para fila', {
      clientId,
      conversationId: conversation._id,
      department: department.name,
      reason: opts.reason,
      suggestedUserId: suggested?.toString(),
    });
  }
}
