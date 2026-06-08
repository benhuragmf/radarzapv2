import mongoose from 'mongoose';
import { IDestination, Destination } from '@/models/Destination';
import { InboxTicket, IInboxTicket } from '@/models/InboxTicket';
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
import { InboxTicketStatus, INBOX_TICKET_STATUS_LABEL, parseTicketClientExit, TICKET_CLIENT_EXIT_ACK, TICKET_CLIENT_REPLY_FOOTER, TICKET_CLIENT_REPLY_GRACE_MS, TICKET_CLIENT_REPLY_GRACE_PROMPT, TICKET_CLOSE_REPLY_HINT, TICKET_POST_CLOSE_REPLY_HOURS, ticketIsActive } from '@/types/inbox-ticket';
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

  private graceTimers = new Map<string, NodeJS.Timeout>();
  private graceMonitorStarted = false;

  static getInstance(): InboxService {
    if (!InboxService.instance) InboxService.instance = new InboxService();
    return InboxService.instance;
  }

  /** Recupera timers de grace após restart e varre tickets expirados. */
  startClientReplyGraceMonitor(): void {
    if (this.graceMonitorStarted) return;
    this.graceMonitorStarted = true;
    setInterval(() => void this.processExpiredClientReplyGrace(), 60_000);
    void this.bootstrapClientReplyGraceTimers();
    void this.processExpiredClientReplyGrace();
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
        whatsappPhone: m.whatsappPhone?.trim() || undefined,
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

    const ticket = await this.findTicketForClientReply(clientId, dest._id as mongoose.Types.ObjectId);
    if (!ticket) return false;

    const trimmed = text.trim();
    const displayBody =
      trimmed || (media ? INBOX_MEDIA_LABEL[media.mediaType] ?? 'Mídia recebida' : '');
    if (!displayBody) return false;

    const inReplyWindow = this.canClientReplyToTicket(ticket);

    if (parseTicketClientExit(trimmed) && (inReplyWindow || ticket.teamHasMessagedClient || ticket.clientReplyExpiresAt)) {
      ticket.clientReplyPaused = true;
      ticket.clientReplyGraceUntil = undefined;
      ticket.updatedAt = new Date();
      await ticket.save();
      this.cancelClientReplyGrace(clientId, ticket.ticketRef);
      await this.sendToContact(clientId, dest.identifier, TICKET_CLIENT_EXIT_ACK);
      const conv = await InboxConversation.findById(ticket.conversationId);
      if (conv) {
        await this.appendSystemMessage(
          conv,
          `Cliente enviou *sair* no ticket *${ticket.ticketRef}* (pausa respostas neste chamado).`,
          undefined,
          clientId,
        );
      }
      this.notifyTicketUpdated(clientId, ticket.ticketRef);
      return true;
    }

    if (!inReplyWindow) return false;

    const wasInActiveGrace = Boolean(
      ticket.clientReplyGraceUntil && new Date() < new Date(ticket.clientReplyGraceUntil),
    );

    ticket.clientReplies.push({
      body: displayBody,
      createdAt: new Date(),
      mediaType: media?.mediaType,
      mediaUrl: media?.mediaUrl,
    });
    ticket.lastClientReplyAt = new Date();
    ticket.unreadClientReply = true;
    ticket.clientReplyGraceUntil = new Date(Date.now() + TICKET_CLIENT_REPLY_GRACE_MS);
    if (ticket.status !== 'closed') {
      ticket.status = 'client_replied';
    }
    ticket.updatedAt = new Date();
    await ticket.save();

    const conv = await InboxConversation.findById(ticket.conversationId);

    if (!wasInActiveGrace) {
      await this.sendToContact(clientId, dest.identifier, TICKET_CLIENT_REPLY_GRACE_PROMPT);
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

    this.scheduleClientReplyGrace(clientId, ticket);
    await this.notifyClientRepliedToAssignee(clientId, ticket, displayBody);
    this.notifyTicketUpdated(clientId, ticket.ticketRef);
    return true;
  }

  private graceTimerKey(clientId: string, ticketRef: string): string {
    return `${clientId}:${ticketRef}`;
  }

  private scheduleClientReplyGrace(clientId: string, ticket: IInboxTicket): void {
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
      this.scheduleClientReplyGrace(String(row.clientId), row as IInboxTicket);
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
    await ticket.save();
    this.cancelClientReplyGrace(clientId, ticket.ticketRef);

    await this.sendToContact(clientId, ticket.contactIdentifier, TICKET_CLIENT_EXIT_ACK);

    const conv = await InboxConversation.findById(ticket.conversationId);
    if (conv) {
      await InboxMessage.create({
        clientId: conv.clientId,
        conversationId: conv._id,
        direction: 'outbound',
        body: TICKET_CLIENT_EXIT_ACK,
      });
      await this.appendSystemMessage(
        conv,
        `Prazo de 30 min expirou no ticket *${ticket.ticketRef}* — cliente notificado.`,
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
      if (!ticket.clientReplyExpiresAt) return false;
      return new Date() < new Date(ticket.clientReplyExpiresAt);
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
      $or: [
        {
          status: { $in: ['open', 'in_progress', 'client_replied'] },
          teamHasMessagedClient: true,
        },
        {
          status: 'closed',
          clientReplyExpiresAt: { $gt: now },
        },
      ],
    }).sort({ updatedAt: -1 });
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
    filters: {
      status?: string;
      departmentId?: string;
      mine?: boolean;
      hasTicket?: boolean;
      search?: string;
    },
  ) {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    await this.ensureDepartments(clientId);

    const query: Record<string, unknown> = { clientId: clientOid };
    if (filters.status) query.status = filters.status;
    if (filters.departmentId) {
      query.departmentId = new mongoose.Types.ObjectId(filters.departmentId);
    }
    if (filters.hasTicket) {
      query.ticketRef = { $exists: true, $nin: [null, ''] };
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

  private generateTicketRef(): string {
    return `TK-${Date.now().toString(36).toUpperCase().slice(-6)}`;
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

      const opener =
        conv.assignedUserId ??
        (
          await CompanyMember.findOne({
            organizationId: clientOid,
            isActive: true,
            userId: { $exists: true, $ne: null },
          })
            .select('userId')
            .lean()
        )?.userId;

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

  private async ensureTicketRecord(
    conv: IInboxConversation,
    openedByUserId: string,
  ): Promise<{ ticket: IInboxTicket; created: boolean }> {
    const clientOid = conv.clientId;
    const ref = (conv.ticketRef ?? this.generateTicketRef()).trim().toUpperCase();

    if (!conv.ticketRef) {
      conv.ticketRef = ref;
      await conv.save();
    }

    let ticket = await InboxTicket.findOne({ clientId: clientOid, ticketRef: ref });
    if (!ticket) {
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
      return { ticket, created: true };
    }
    return { ticket, created: false };
  }

  private async enrichTicketRows(
    tickets: IInboxTicket[],
    clientId: string,
  ) {
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

    const [depts, users, convs] = await Promise.all([
      deptIds.length
        ? InboxDepartment.find({ _id: { $in: deptIds } }).select('name').lean()
        : [],
      userIds.length ? User.find({ _id: { $in: userIds } }).select('displayName email').lean() : [],
      InboxConversation.find({
        _id: { $in: tickets.map(t => t.conversationId) },
      })
        .select('status lastMessageAt')
        .lean(),
    ]);

    const deptMap = new Map(depts.map(d => [String(d._id), d.name]));
    const userMap = new Map(
      users.map(u => [String(u._id), u.displayName?.trim() || u.email?.split('@')[0] || 'Usuário']),
    );
    const convMap = new Map(convs.map(c => [String(c._id), c]));

    return tickets.map(t => {
      const conv = convMap.get(String(t.conversationId));
      return {
        _id: String(t._id),
        ticketRef: t.ticketRef,
        ticketStatus: t.status,
        conversationId: String(t.conversationId),
        conversationStatus: conv?.status,
        contactName: t.contactName,
        contactIdentifier: t.contactIdentifier,
        departmentName: t.departmentId ? deptMap.get(String(t.departmentId)) : undefined,
        assignedUserName: t.assignedUserId ? userMap.get(String(t.assignedUserId)) : undefined,
        openedByUserName: userMap.get(String(t.openedByUserId)),
        closedByUserName: t.closedByUserId ? userMap.get(String(t.closedByUserId)) : undefined,
        lastMessageAt: conv?.lastMessageAt ?? t.updatedAt,
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
    },
  ) {
    await this.syncLegacyTickets(clientId);
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const query: Record<string, unknown> = { clientId: clientOid };

    if (filters.status && ['open', 'in_progress', 'client_replied', 'closed'].includes(filters.status)) {
      query.status = filters.status;
    }

    if (filters.departmentId) {
      query.departmentId = new mongoose.Types.ObjectId(filters.departmentId);
    }

    const visibility = await this.departmentVisibility(clientId, userId);
    if (visibility.restricted) {
      if (visibility.departmentIds.length === 0) return [];
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

    const rows = await InboxTicket.find(query).sort({ updatedAt: -1 }).limit(100).lean();
    return this.enrichTicketRows(rows as IInboxTicket[], clientId);
  }

  async getTicketStats(clientId: string, userId: string) {
    await this.syncLegacyTickets(clientId);
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const base: Record<string, unknown> = { clientId: clientOid };

    const visibility = await this.departmentVisibility(clientId, userId);
    if (visibility.restricted) {
      if (visibility.departmentIds.length === 0) {
        return { total: 0, open: 0, inProgress: 0, clientReplied: 0, closed: 0 };
      }
      base.departmentId = { $in: visibility.departmentIds };
    }

    const [total, open, inProgress, clientReplied, closed] = await Promise.all([
      InboxTicket.countDocuments(base),
      InboxTicket.countDocuments({ ...base, status: 'open' }),
      InboxTicket.countDocuments({ ...base, status: 'in_progress' }),
      InboxTicket.countDocuments({ ...base, status: 'client_replied' }),
      InboxTicket.countDocuments({ ...base, status: 'closed' }),
    ]);
    return { total, open, inProgress, clientReplied, closed };
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

    const detail = await this.getConversationDetail(
      clientId,
      userId,
      String(ticket.conversationId),
    );

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
    ticket.clientReplyExpiresAt = new Date(Date.now() + TICKET_POST_CLOSE_REPLY_HOURS * 60 * 60 * 1000);
    ticket.clientReplyPaused = false;
    await ticket.save();

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

  async deleteTicket(clientId: string, userId: string, ticketRef: string) {
    const ticket = await this.getTicketForUser(clientId, userId, ticketRef);
    const ref = ticket.ticketRef;
    const convId = ticket.conversationId;

    await InboxTicket.deleteOne({ _id: ticket._id });

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
    ticket.clientReplyPaused = false;
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

    if (patch.assignedUserId !== undefined) {
      if (patch.assignedUserId) {
        await this.resolveMemberUserIds(clientId, [patch.assignedUserId]);
        ticket.assignedUserId = new mongoose.Types.ObjectId(patch.assignedUserId);
        if (ticket.status === 'open') ticket.status = 'in_progress';
      } else {
        ticket.assignedUserId = undefined;
      }
    }
    if (patch.status && patch.status !== 'closed') {
      ticket.status = patch.status;
    }
    await ticket.save();
    return ticket.toObject();
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
      throw new Error('Ticket fechado — reabra para adicionar acompanhamento');
    }

    const mentionIds = [...new Set(mentionedUserIds.filter(Boolean))].map(
      id => new mongoose.Types.ObjectId(id),
    );
    if (mentionIds.length) {
      await this.resolveMemberUserIds(clientId, mentionIds.map(String));
    }

    ticket.comments.push({
      userId: new mongoose.Types.ObjectId(userId),
      body: text,
      mentionedUserIds: mentionIds.length ? mentionIds : undefined,
      createdAt: new Date(),
    });
    if (ticket.status === 'open') ticket.status = 'in_progress';
    else if (ticket.status === 'client_replied') ticket.status = 'in_progress';
    ticket.updatedAt = new Date();
    await ticket.save();

    const authorName = await this.resolveAgentDisplayName(userId);

    const newComment = ticket.comments[ticket.comments.length - 1];

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
    });
    if (!ticket) throw new Error('Ticket não encontrado');
    await this.getConversationIfAllowed(clientId, userId, String(ticket.conversationId));
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

  private buildTicketOpenedClientMessage(
    ticket: IInboxTicket,
    ctx: Awaited<ReturnType<InboxService['loadTicketMessageContext']>>,
    openedByName: string,
  ): string {
    const lines = [
      `*Chamado aberto — ${ticket.ticketRef}*`,
      '',
      `Olá *${ticket.contactName}*!`,
      '',
      `Registramos sua solicitação. Guarde a referência *${ticket.ticketRef}* para acompanhar.`,
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
      `Ticket *${ticket.ticketRef}* *finalizado* pela nossa equipe.${who}\n\n` +
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
    const conv = await InboxConversation.findById(ticket.conversationId);
    if (!conv) throw new Error('Conversa vinculada não encontrada');

    const result = await this.sendToContact(clientId, ticket.contactIdentifier, body);
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
        createdAt: conv.createdAt,
        resolvedAt: conv.resolvedAt,
        acceptedAt: conv.acceptedAt,
        lastMessageAt: conv.lastMessageAt,
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
    const { ticket, created } = await this.ensureTicketRecord(conv, userId);
    const agentName = await this.resolveAgentDisplayName(userId);

    if (created) {
      const ctx = await this.loadTicketMessageContext(ticket, clientId);
      const clientMsg = this.buildTicketOpenedClientMessage(ticket, ctx, agentName);

      ticket.teamHasMessagedClient = true;
      ticket.clientReplyPaused = false;
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
