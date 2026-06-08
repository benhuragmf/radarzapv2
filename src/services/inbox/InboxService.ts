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
  buildQueueConfirmation,
  loadActiveDepartments,
  parseInboxMenuChoice,
} from '@/constants/inbox-triage';
import { User } from '@/models/User';
import { InboxConversationStatus } from '@/types/inbox';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('InboxService');

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
    text: string,
    altJid?: string,
  ): Promise<void> {
    const consentSvc = ConsentService.getInstance();
    const dest = await consentSvc.findOrCreateContactFromInbound(clientId, fromJid, altJid);
    if (!dest) return;

    const channelOpen = await consentSvc.acceptInboundInitiated(clientId, dest);
    if (!channelOpen) return;
    if (dest.optOutConfirmPendingAt) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    let conversation = await this.findOpenConversation(clientId, dest._id as mongoose.Types.ObjectId);
    const isNew = !conversation;
    if (!conversation) {
      conversation = await this.createConversation(clientId, dest);
    }

    await this.recordInbound(conversation, trimmed);

    if (conversation.status === InboxConversationStatus.BOT_TRIAGE) {
      const choice = await parseInboxMenuChoice(clientId, trimmed);
      if (isNew && !choice) {
        const menu = await buildInboxTriageMenu(clientId);
        await this.sendToContact(clientId, dest.identifier, menu);
        await this.appendSystemMessage(conversation, menu);
        return;
      }
      await this.handleTriageReply(clientId, conversation, trimmed, dest);
    }
  }

  private async recordInbound(conversation: IInboxConversation, body: string): Promise<void> {
    await InboxMessage.create({
      clientId: conversation.clientId,
      conversationId: conversation._id,
      direction: 'inbound',
      body,
    });
    conversation.lastInboundAt = new Date();
    conversation.lastMessageAt = new Date();
    await conversation.save();
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

    conversation.departmentId = department._id as mongoose.Types.ObjectId;
    conversation.status = InboxConversationStatus.WAITING_QUEUE;
    conversation.assignedUserId = undefined;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const confirm = buildQueueConfirmation(department.name);
    await this.sendToContact(clientId, dest.identifier, confirm);
    await this.appendSystemMessage(conversation, confirm);
    logger.info('Conversa direcionada para fila', {
      clientId,
      conversationId: conversation._id,
      department: department.name,
    });
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
      query.assignedUserId = new mongoose.Types.ObjectId(userId);
    }

    const rows = await InboxConversation.find(query)
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .lean();

    const deptIds = [...new Set(rows.map(r => r.departmentId?.toString()).filter(Boolean))];
    const depts = await InboxDepartment.find({ _id: { $in: deptIds } }).lean();
    const deptMap = new Map(depts.map(d => [String(d._id), d.name]));

    const agentIds = [...new Set(rows.map(r => r.assignedUserId?.toString()).filter(Boolean))];
    const agents = await User.find({ _id: { $in: agentIds } }).select('displayName email').lean();
    const agentMap = new Map(
      agents.map(a => [
        String(a._id),
        a.displayName?.trim() || a.email?.split('@')[0] || 'Atendente',
      ]),
    );

    return rows.map(r => ({
      ...r,
      departmentName: r.departmentId ? deptMap.get(String(r.departmentId)) : undefined,
      assignedUserName: r.assignedUserId
        ? agentMap.get(String(r.assignedUserId))
        : undefined,
    }));
  }

  async getConversationDetail(clientId: string, userId: string, conversationId: string) {
    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    const messages = await InboxMessage.find({
      conversationId: conv._id,
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();
    const transfers = await InboxTransfer.find({ conversationId: conv._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return { conversation: conv.toObject(), messages, transfers };
  }

  async assignConversation(clientId: string, userId: string, conversationId: string) {
    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    if (TERMINAL_STATUSES.has(conv.status)) {
      throw new Error('Conversa já finalizada');
    }
    const prevAssigned = conv.assignedUserId?.toString();
    conv.assignedUserId = new mongoose.Types.ObjectId(userId);
    conv.status = InboxConversationStatus.IN_PROGRESS;
    conv.lastMessageAt = new Date();
    await conv.save();

    if (prevAssigned !== userId) {
      await this.announceAgentJoin(clientId, conv, userId);
    }
    return conv.toObject();
  }

  async replyToConversation(
    clientId: string,
    userId: string,
    conversationId: string,
    text: string,
  ) {
    const body = text.trim();
    if (!body) throw new Error('Mensagem vazia');

    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    if (TERMINAL_STATUSES.has(conv.status)) {
      throw new Error('Conversa já finalizada');
    }

    const prevAssigned = conv.assignedUserId?.toString();
    if (!conv.assignedUserId || prevAssigned !== userId) {
      conv.assignedUserId = new mongoose.Types.ObjectId(userId);
      conv.status = InboxConversationStatus.IN_PROGRESS;
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
    conv.status = InboxConversationStatus.WAITING_QUEUE;
    conv.lastMessageAt = new Date();
    await conv.save();

    const notify = `Sua conversa foi transferida para *${target.name}*. Aguarde um atendente.`;
    await this.sendToContact(clientId, conv.contactIdentifier, notify);
    await this.appendSystemMessage(conv, notify, new mongoose.Types.ObjectId(userId));

    return conv.toObject();
  }

  async resolveConversation(clientId: string, userId: string, conversationId: string) {
    const conv = await this.getConversationIfAllowed(clientId, userId, conversationId);
    conv.status = InboxConversationStatus.RESOLVED;
    conv.resolvedAt = new Date();
    conv.lastMessageAt = new Date();
    await conv.save();

    const closing = 'Atendimento finalizado. Se precisar de algo, envie uma nova mensagem.';
    await this.sendToContact(clientId, conv.contactIdentifier, closing);
    await this.appendSystemMessage(conv, closing, new mongoose.Types.ObjectId(userId));
    return conv.toObject();
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
