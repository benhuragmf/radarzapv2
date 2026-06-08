import mongoose from 'mongoose';
import { IDestination } from '@/models/Destination';
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
  loadInboxSettings,
  parseInboxMenuChoice,
} from '@/constants/inbox-triage';
import { InboxSettings, IInboxSettings } from '@/models/InboxSettings';
import { User } from '@/models/User';
import { InboxConversationStatus, InboxMessageMediaType } from '@/types/inbox';
import { INBOX_WEEKDAYS, InboxWeeklySchedule } from '@/types/inbox-settings';
import {
  applyQuickReplyTemplate,
  expandQuickReply,
  normalizeQuickReplies,
  InboxQuickReply,
} from '@/types/inbox-quick-replies';
import { INBOX_MEDIA_LABEL } from '@/utils/inbox-media-storage';
import { Destination } from '@/models/Destination';
import { isWithinBusinessHours } from '@/services/inbox/inbox-business-hours';
import { emitInboxEvent } from '@/services/inbox/InboxRealtime';
import { emitPanelEvent, PanelEventType } from '@/services/inbox/PanelNotifications';
import crypto from 'crypto';
import {
  getQueuePriorityState,
  isSuggestedUserBusy,
} from '@/services/inbox/inbox-queue-priority';
import { createServiceLogger } from '@/utils/logger';
import { ContactAutoSegmentService } from '@/services/contacts/ContactAutoSegmentService';

const logger = createServiceLogger('InboxService');

export interface InboxInboundPayload {
  text?: string;
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

export class InboxService {
  private static instance: InboxService;

  static getInstance(): InboxService {
    if (!InboxService.instance) InboxService.instance = new InboxService();
    return InboxService.instance;
  }

  async ensureDepartments(clientId: string) {
    return loadActiveDepartments(clientId);
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
      alertSoundEnabled: boolean;
      alertOnNewChat: boolean;
      alertOnNewMessage: boolean;
      quickReplies: InboxQuickReply[];
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
    if (patch.alertSoundEnabled !== undefined) {
      settings.alertSoundEnabled = Boolean(patch.alertSoundEnabled);
    }
    if (patch.alertOnNewChat !== undefined) {
      settings.alertOnNewChat = Boolean(patch.alertOnNewChat);
    }
    if (patch.alertOnNewMessage !== undefined) {
      settings.alertOnNewMessage = Boolean(patch.alertOnNewMessage);
    }
    if (patch.quickReplies !== undefined) {
      settings.quickReplies = normalizeQuickReplies(patch.quickReplies);
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

    if (status === InboxConversationStatus.WAITING_QUEUE && suggestedId) {
      priorityForMe = suggestedId === userId;
      canAccept = priorityForMe;
      if (!priorityForMe) {
        suggestedUserBusy = await isSuggestedUserBusy(clientId, suggestedId, convId);
        const { pullAllowedByTimeout } = getQueuePriorityState(
          row.suggestedAt as Date | string | undefined,
          pullTimeoutSeconds,
        );
        canPull = suggestedUserBusy || pullAllowedByTimeout;
      }
    } else if (status === InboxConversationStatus.WAITING_QUEUE && !assignedId) {
      canAccept = true;
      canPull = true;
    }

    const priority = getQueuePriorityState(
      row.suggestedAt as Date | string | undefined,
      pullTimeoutSeconds,
    );

    return {
      ...row,
      assignedUserName: assignedId ? agentMap.get(assignedId) : undefined,
      suggestedUserName: suggestedId ? agentMap.get(suggestedId) : undefined,
      priorityForMe,
      canAccept,
      canPull,
      suggestedUserBusy,
      pullTimeoutSeconds,
      queueElapsedSec: suggestedId ? priority.elapsedSec : 0,
      queueUrgency: suggestedId ? priority.urgency : 0,
    };
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
    opts?: { conversationId?: string },
  ): Promise<void> {
    const settings = await loadInboxSettings(clientId);
    if (!settings.alertSoundEnabled) return;
    if (type === 'inbox:new_chat' && !settings.alertOnNewChat) return;
    if (type === 'inbox:new_message' && !settings.alertOnNewMessage) return;
    if (type === 'inbox:priority' && !settings.alertOnNewChat) return;

    emitPanelEvent(clientId, {
      id: crypto.randomUUID(),
      type,
      title,
      body,
      href: '/platform/inbox',
      conversationId: opts?.conversationId,
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
      return {
        memberId: String(m._id),
        userId: m.userId ? String(m.userId) : null,
        email: m.email,
        companyRole: m.companyRole,
        displayName: u?.displayName?.trim() || m.email?.split('@')[0] || 'Sem nome',
        linked: Boolean(m.userId),
      };
    });
  }

  async createDepartment(
    clientId: string,
    data: { name: string; description?: string; memberUserIds?: string[] },
  ): Promise<IInboxDepartment> {
    const name = data.name?.trim();
    if (!name) throw new Error('Nome do setor é obrigatório');

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const menuKey = await this.nextMenuKey(clientOid);
    const sortOrder = await InboxDepartment.countDocuments({ clientId: clientOid });
    const memberUserIds = await this.resolveMemberUserIds(clientId, data.memberUserIds ?? []);

    return InboxDepartment.create({
      clientId: clientOid,
      name,
      description: data.description?.trim() || undefined,
      menuKey,
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
    await dept.save();
    return dept;
  }

  private async nextMenuKey(clientOid: mongoose.Types.ObjectId): Promise<string> {
    const depts = await InboxDepartment.find({ clientId: clientOid }).select('menuKey').lean();
    const nums = depts
      .map(d => parseInt(d.menuKey, 10))
      .filter(n => !Number.isNaN(n));
    return String((nums.length ? Math.max(...nums) : 0) + 1);
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
    const dest = await consentSvc.findOrCreateContactFromInbound(clientId, fromJid, altJid);
    if (!dest) return;

    const channelOpen = await consentSvc.acceptInboundInitiated(clientId, dest);
    if (!channelOpen) return;
    if (dest.optOutConfirmPendingAt) return;

    const trimmed = (normalized.text ?? '').trim();
    const media = normalized.media;
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
      whatsappMessageId: media?.whatsappMessageId,
    });

    if (!openHours) {
      const outsideMsg = await buildOutsideHoursMessage(clientId);
      await this.sendToContact(clientId, dest.identifier, outsideMsg);
      await this.appendSystemMessage(conversation, outsideMsg);
      return;
    }

    if (conversation.status === InboxConversationStatus.BOT_TRIAGE) {
      const choice = trimmed ? await parseInboxMenuChoice(clientId, trimmed) : null;
      if (isNew && !choice) {
        const menu = await buildInboxTriageMenu(clientId);
        await this.sendToContact(clientId, dest.identifier, menu);
        await this.appendSystemMessage(conversation, menu);
        return;
      }
      if (trimmed) {
        await this.handleTriageReply(clientId, conversation, trimmed, dest);
      }
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
    await InboxMessage.create({
      clientId: conversation.clientId,
      conversationId: conversation._id,
      direction: 'inbound',
      body,
      mediaType: opts?.mediaType,
      mediaUrl: opts?.mediaUrl,
      mediaMime: opts?.mediaMime,
      whatsappMessageId: opts?.whatsappMessageId,
    });
    conversation.lastInboundAt = new Date();
    conversation.lastMessageAt = new Date();
    await conversation.save();
    const cid = clientId ?? String(conversation.clientId);
    this.notifyMessage(cid, String(conversation._id));
    this.notifyConversation(cid, conversation);

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
      return;
    }

    const clientOid = new mongoose.Types.ObjectId(clientId);
    const department = await InboxDepartment.findOne({
      clientId: clientOid,
      menuKey: choice,
      isActive: true,
    });
    if (!department) {
      const hint = await buildInvalidMenuHint(clientId);
      await this.sendToContact(clientId, dest.identifier, hint);
      await this.appendSystemMessage(conversation, hint);
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
    conversation.lastMessageAt = new Date();

    const suggested = await this.tryRoundRobinSuggest(clientId, conversation, department);
    await this.pushPanelEvent(clientId, 'inbox:new_chat', 'Nova conversa na fila', department.name, {
      conversationId: String(conversation._id),
    });
    await conversation.save();
    this.notifyConversation(clientId, conversation);

    const confirm = await buildQueueConfirmation(clientId, department.name);
    await this.sendToContact(clientId, dest.identifier, confirm);
    await this.appendSystemMessage(conversation, confirm, undefined, clientId);
    logger.info('Conversa direcionada para fila', {
      clientId,
      conversationId: conversation._id,
      department: department.name,
      suggestedUserId: suggested?.toString(),
    });
  }

  /** Indica prioridade ao próximo atendente — não assume automaticamente. */
  private async tryRoundRobinSuggest(
    clientId: string,
    conversation: IInboxConversation,
    department: IInboxDepartment,
  ): Promise<mongoose.Types.ObjectId | null> {
    const settings = await loadInboxSettings(clientId);
    if (!settings.roundRobinEnabled) return null;

    const candidates = await this.resolveRoundRobinCandidates(clientId, department);
    if (!candidates.length) return null;

    const lastIdx = department.lastRoundRobinIndex ?? -1;
    const nextIdx = (lastIdx + 1) % candidates.length;
    const userId = candidates[nextIdx];

    department.lastRoundRobinIndex = nextIdx;
    await department.save();

    conversation.suggestedUserId = userId;
    conversation.suggestedAt = new Date();
    conversation.assignedUserId = undefined;

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
    filters: { status?: string; departmentId?: string; mine?: boolean },
  ) {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    await this.ensureDepartments(clientId);

    const query: Record<string, unknown> = { clientId: clientOid };
    if (filters.status) query.status = filters.status;
    if (filters.departmentId) {
      query.departmentId = new mongoose.Types.ObjectId(filters.departmentId);
    }

    const visibility = await this.departmentVisibility(clientId, userId);
    if (visibility.restricted) {
      if (visibility.departmentIds.length === 0) {
        return [];
      }
      if (!filters.departmentId) {
        query.departmentId = { $in: visibility.departmentIds };
      }
    }

    if (filters.mine) {
      const userOid = new mongoose.Types.ObjectId(userId);
      query.$or = [{ assignedUserId: userOid }, { suggestedUserId: userOid }];
    }

    const settings = await loadInboxSettings(clientId);
    const pullTimeoutSeconds = settings.roundRobinPullTimeoutSeconds ?? 120;

    const rows = await InboxConversation.find(query)
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .lean();

    const deptIds = [...new Set(rows.map(r => r.departmentId?.toString()).filter(Boolean))];
    const depts = await InboxDepartment.find({ _id: { $in: deptIds } }).lean();
    const deptMap = new Map(depts.map(d => [String(d._id), d.name]));

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

    const enriched = await Promise.all(
      rows.map(r =>
        this.enrichConversationRow(
          { ...r, departmentName: r.departmentId ? deptMap.get(String(r.departmentId)) : undefined },
          userId,
          clientId,
          agentMap,
          pullTimeoutSeconds,
        ),
      ),
    );
    return enriched;
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

    const messages = await InboxMessage.find({
      conversationId: conv._id,
    })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();
    const transfers = await InboxTransfer.find({ conversationId: conv._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const [conversation, contactContext, destination] = await Promise.all([
      this.enrichConversationRow(
        conv.toObject() as Record<string, unknown>,
        userId,
        clientId,
        agentMap,
        pullTimeoutSeconds,
      ),
      this.buildContactContext(clientId, conv.destinationId, conv._id as mongoose.Types.ObjectId),
      Destination.findOne({ _id: conv.destinationId, clientId: conv.clientId })
        .select('name email notes organization identifier contactGroupIds')
        .lean(),
    ]);

    const quickReplies = normalizeQuickReplies(settings.quickReplies);

    return {
      conversation: {
        ...conversation,
        destinationId: String(conv.destinationId),
        ticketRef: conv.ticketRef,
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
          }
        : null,
      quickReplies,
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
    this.notifyConversation(clientId, conv);
    return conv.toObject();
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
    const busy = await isSuggestedUserBusy(clientId, suggestedId, String(conv._id));
    const { pullAllowedByTimeout } = getQueuePriorityState(
      conv.suggestedAt,
      settings.roundRobinPullTimeoutSeconds ?? 120,
    );

    if (!busy && !pullAllowedByTimeout) {
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
    const body = expandQuickReply(raw, quickReplies, conv.contactName);

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
      whatsappMessageId: result.messageId,
    });
    conv.lastMessageAt = new Date();
    await conv.save();
    this.notifyMessage(clientId, String(conv._id));
    this.notifyConversation(clientId, conv);
    return { ok: true, messageId: result.messageId };
  }

  async transferConversation(
    clientId: string,
    userId: string,
    conversationId: string,
    departmentId: string,
    reason?: string,
  ) {
    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const target = await InboxDepartment.findOne({
      _id: new mongoose.Types.ObjectId(departmentId),
      clientId: clientOid,
      isActive: true,
    });
    if (!target) throw new Error('Setor inválido');

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
    conv.lastMessageAt = new Date();

    await this.tryRoundRobinSuggest(clientId, conv, target);
    await conv.save();
    this.notifyConversation(clientId, conv);

    const notify = await buildTransferMessage(clientId, target.name);
    await this.sendToContact(clientId, conv.contactIdentifier, notify);
    await this.appendSystemMessage(conv, notify, new mongoose.Types.ObjectId(userId), clientId);

    return conv.toObject();
  }

  async resolveConversation(clientId: string, userId: string, conversationId: string) {
    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    conv.status = InboxConversationStatus.RESOLVED;
    conv.resolvedAt = new Date();
    conv.lastMessageAt = new Date();
    conv.suggestedUserId = undefined;
    conv.suggestedAt = undefined;
    await conv.save();

    const closing = await buildResolvedMessage(clientId);
    await this.sendToContact(clientId, conv.contactIdentifier, closing);
    await this.appendSystemMessage(conv, closing, new mongoose.Types.ObjectId(userId), clientId);
    this.notifyConversation(clientId, conv);
    return conv.toObject();
  }

  async convertToTicket(clientId: string, userId: string, conversationId: string) {
    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    if (TERMINAL_STATUSES.has(conv.status)) {
      throw new Error('Conversa já finalizada');
    }

    const settings = await loadInboxSettings(clientId);
    const quickReplies = normalizeQuickReplies(settings.quickReplies);
    const ticketQr = quickReplies.find(q => q.code === 'ticket');
    const text = ticketQr
      ? applyQuickReplyTemplate(ticketQr.template, conv.contactName)
      : 'Estarei abrindo um ticket com sua solicitação.';

    if (!conv.ticketRef) {
      conv.ticketRef = `TK-${Date.now().toString(36).toUpperCase().slice(-6)}`;
      await conv.save();
    }

    await this.replyToConversation(clientId, userId, conversationId, text);
    await this.appendSystemMessage(
      conv,
      `Ticket *${conv.ticketRef}* registrado por ${await this.resolveAgentDisplayName(userId)}.`,
      new mongoose.Types.ObjectId(userId),
      clientId,
    );
    this.notifyConversation(clientId, conv);
    return { ticketRef: conv.ticketRef, ok: true };
  }

  private async getConversationIfAllowed(
    clientId: string,
    userId: string,
    conversationId: string,
  ): Promise<IInboxConversation> {
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
    return conv;
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
      $or: [{ memberUserIds: userOid }, { memberUserIds: { $size: 0 } }],
    }).select('_id memberUserIds');

    const allowed = depts
      .filter(d => d.memberUserIds.length === 0 || d.memberUserIds.some(id => id.equals(userOid)))
      .map(d => d._id as mongoose.Types.ObjectId);

    return { restricted: true, departmentIds: allowed };
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
      skipRateLimit: true,
      consentOrigin: 'inbox-reply',
    });
  }
}
