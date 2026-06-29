import mongoose from 'mongoose';

import { CompanyMember, ICompanyMember } from '@/models/CompanyMember';
import { Organization } from '@/models/Organization';
import { User } from '@/models/User';
import {
  CHAT_DISPLAY_NAME_MAX,
  ChatDisplayNamePolicy,
  normalizeChatDisplayNamePolicy,
} from '@/types/chat-display-name';

export interface ChatDisplayNameProfileFields {
  chatDisplayName: string | null;
  chatDisplayNamePending: string | null;
  chatDisplayNamePendingAt: string | null;
  chatDisplayNamePolicy: ChatDisplayNamePolicy;
  chatDisplayNameEffective: string;
  canEditChatDisplayName: boolean;
  chatDisplayNameAwaitingApproval: boolean;
}

function normalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, CHAT_DISPLAY_NAME_MAX);
}

export function sanitizeChatDisplayNameInput(raw: unknown): string {
  const trimmed = typeof raw === 'string' ? normalizeLabel(raw) : '';
  if (!trimmed) throw new Error('Informe um nome fantasia');
  if (trimmed.length < 2) throw new Error('Nome fantasia muito curto (mín. 2 caracteres)');
  return trimmed;
}

async function loadPolicy(organizationId: string): Promise<ChatDisplayNamePolicy> {
  const org = await Organization.findById(organizationId).select('teamSettings').lean();
  return normalizeChatDisplayNamePolicy(org?.teamSettings?.chatDisplayNamePolicy);
}

function fallbackFromMemberAndUser(
  member: Pick<ICompanyMember, 'displayName'>,
  user: { displayName?: string; email?: string } | null | undefined,
): string {
  return (
    member.displayName?.trim() ||
    user?.displayName?.trim() ||
    user?.email?.split('@')[0]?.trim() ||
    'Atendente'
  );
}

/** Nome exibido ao visitante (aprovado ou fallback interno). */
export function resolveChatDisplayNameFromMember(
  member: Pick<
    ICompanyMember,
    'chatDisplayName' | 'displayName' | 'chatDisplayNamePending'
  >,
  user: { displayName?: string; email?: string } | null | undefined,
): string {
  const approved = member.chatDisplayName?.trim();
  if (approved) return approved.slice(0, CHAT_DISPLAY_NAME_MAX);
  return fallbackFromMemberAndUser(member, user);
}

export async function resolveAgentChatDisplayName(
  organizationId: string,
  userId: string,
): Promise<string> {
  const member = await CompanyMember.findOne({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true,
  })
    .select('chatDisplayName displayName')
    .lean();
  if (!member) {
    const user = await User.findById(userId).select('displayName email').lean();
    return user?.displayName?.trim() || user?.email?.split('@')[0]?.trim() || 'Atendente';
  }
  const user = await User.findById(userId).select('displayName email').lean();
  return resolveChatDisplayNameFromMember(member, user);
}

export async function getChatDisplayNamePolicy(
  organizationId: string,
): Promise<ChatDisplayNamePolicy> {
  return loadPolicy(organizationId);
}

export function buildChatDisplayNameProfileFields(
  member: ICompanyMember,
  user: { displayName?: string; email?: string } | null | undefined,
  policy: ChatDisplayNamePolicy,
  opts?: { isOwnerOrAdmin?: boolean },
): ChatDisplayNameProfileFields {
  const isOwnerOrAdmin = opts?.isOwnerOrAdmin === true;
  const pending = member.chatDisplayNamePending?.trim() || null;
  const canEditChatDisplayName =
    isOwnerOrAdmin ||
    (member.companyRole !== 'OWNER' &&
      member.companyRole !== 'INTEGRATION' &&
      policy !== 'owner_only');

  return {
    chatDisplayName: member.chatDisplayName?.trim() || null,
    chatDisplayNamePending: pending,
    chatDisplayNamePendingAt: member.chatDisplayNamePendingAt?.toISOString() ?? null,
    chatDisplayNamePolicy: policy,
    chatDisplayNameEffective: resolveChatDisplayNameFromMember(member, user),
    canEditChatDisplayName,
    chatDisplayNameAwaitingApproval: Boolean(pending),
  };
}

export async function updateChatDisplayNameByAdmin(
  organizationId: string,
  memberId: string,
  rawName: string | null | undefined,
): Promise<ICompanyMember> {
  const member = await CompanyMember.findOne({
    _id: memberId,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    isActive: true,
  });
  if (!member) throw new Error('Membro não encontrado');

  if (rawName === null || rawName === undefined || rawName.trim() === '') {
    member.chatDisplayName = undefined;
    member.chatDisplayNamePending = undefined;
    member.chatDisplayNamePendingAt = undefined;
  } else {
    member.chatDisplayName = sanitizeChatDisplayNameInput(rawName);
    member.chatDisplayNamePending = undefined;
    member.chatDisplayNamePendingAt = undefined;
  }

  await member.save();
  return member;
}

export async function updateChatDisplayNameSelf(
  userId: string,
  organizationId: string,
  rawName: string,
): Promise<ICompanyMember> {
  const member = await CompanyMember.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    isActive: true,
  });
  if (!member) throw new Error('Membro não encontrado nesta empresa');
  if (member.companyRole === 'OWNER' || member.companyRole === 'INTEGRATION') {
    throw new Error('Use Configurações da conta para o nome do dono');
  }

  const policy = await loadPolicy(organizationId);
  const name = sanitizeChatDisplayNameInput(rawName);

  if (policy === 'owner_only') {
    throw new Error('Sua empresa só permite que o dono defina o nome fantasia');
  }

  if (policy === 'self_service') {
    member.chatDisplayName = name;
    member.chatDisplayNamePending = undefined;
    member.chatDisplayNamePendingAt = undefined;
  } else {
    member.chatDisplayNamePending = name;
    member.chatDisplayNamePendingAt = new Date();
  }

  await member.save();
  return member;
}

export async function approveChatDisplayNamePending(
  organizationId: string,
  memberId: string,
): Promise<ICompanyMember> {
  const member = await CompanyMember.findOne({
    _id: memberId,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    isActive: true,
  });
  if (!member) throw new Error('Membro não encontrado');
  const pending = member.chatDisplayNamePending?.trim();
  if (!pending) throw new Error('Nenhuma solicitação pendente para este membro');

  member.chatDisplayName = pending.slice(0, CHAT_DISPLAY_NAME_MAX);
  member.chatDisplayNamePending = undefined;
  member.chatDisplayNamePendingAt = undefined;
  await member.save();
  return member;
}

export async function rejectChatDisplayNamePending(
  organizationId: string,
  memberId: string,
): Promise<ICompanyMember> {
  const member = await CompanyMember.findOne({
    _id: memberId,
    organizationId: new mongoose.Types.ObjectId(organizationId),
    isActive: true,
  });
  if (!member) throw new Error('Membro não encontrado');
  if (!member.chatDisplayNamePending?.trim()) {
    throw new Error('Nenhuma solicitação pendente para este membro');
  }
  member.chatDisplayNamePending = undefined;
  member.chatDisplayNamePendingAt = undefined;
  await member.save();
  return member;
}

export async function listPendingChatDisplayNames(organizationId: string) {
  const rows = await CompanyMember.find({
    organizationId: new mongoose.Types.ObjectId(organizationId),
    isActive: true,
    chatDisplayNamePending: { $exists: true, $nin: [null, ''] },
  })
    .select('_id userId displayName chatDisplayName chatDisplayNamePending chatDisplayNamePendingAt companyRole')
    .lean();

  const userIds = rows.map(r => r.userId).filter(Boolean) as mongoose.Types.ObjectId[];
  const users = await User.find({ _id: { $in: userIds } })
    .select('displayName email')
    .lean();
  const userMap = new Map(users.map(u => [String(u._id), u]));

  return rows.map(r => {
    const u = r.userId ? userMap.get(String(r.userId)) : undefined;
    return {
      memberId: String(r._id),
      userId: r.userId ? String(r.userId) : null,
      companyRole: r.companyRole,
      displayName: r.displayName?.trim() || u?.displayName?.trim() || u?.email?.split('@')[0] || '—',
      currentChatDisplayName: r.chatDisplayName?.trim() || null,
      requestedChatDisplayName: r.chatDisplayNamePending?.trim() || '',
      requestedAt: r.chatDisplayNamePendingAt?.toISOString() ?? null,
    };
  });
}

/** Mapa userId → nome exibido ao visitante (batch para listas Inbox/WebChat). */
export async function resolveAgentChatDisplayNameMap(
  organizationId: string,
  userIds: Array<string | mongoose.Types.ObjectId | undefined | null>,
): Promise<Map<string, string>> {
  const unique = [
    ...new Set(
      userIds
        .filter(Boolean)
        .map(id => String(id))
        .filter(id => mongoose.Types.ObjectId.isValid(id)),
    ),
  ];
  const map = new Map<string, string>();
  if (!unique.length) return map;

  const oid = new mongoose.Types.ObjectId(organizationId);
  const members = await CompanyMember.find({
    organizationId: oid,
    userId: { $in: unique.map(id => new mongoose.Types.ObjectId(id)) },
    isActive: true,
  })
    .select('userId chatDisplayName displayName')
    .lean();

  const memberByUser = new Map(members.map(m => [String(m.userId), m]));
  const users = await User.find({ _id: { $in: unique.map(id => new mongoose.Types.ObjectId(id)) } })
    .select('displayName email')
    .lean();
  const userById = new Map(users.map(u => [String(u._id), u]));

  for (const uid of unique) {
    const member = memberByUser.get(uid);
    const user = userById.get(uid);
    map.set(uid, resolveChatDisplayNameFromMember(member ?? { displayName: undefined, chatDisplayName: undefined, chatDisplayNamePending: undefined }, user));
  }
  return map;
}
