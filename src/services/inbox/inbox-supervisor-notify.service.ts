import crypto from 'crypto';
import mongoose from 'mongoose';
import { Cap, type Capability } from '@/auth/rbac/capabilities';
import { buildCapabilities } from '@/auth/rbac/can';
import {
  findCustomRoleCapabilities,
  parseOrgRoleCapabilities,
} from '@/auth/rbac/companyRolePresets';
import { CompanyRole, SystemRole } from '@/auth/rbac/roles';
import { CompanyMember } from '@/models/CompanyMember';
import { Organization } from '@/models/Organization';
import { User } from '@/models/User';
import { emitPanelEvent } from '@/services/inbox/PanelNotifications';
import { mentionsSupervisor } from '@/utils/internal-chat-supervisor-mention';

export async function listSupervisorUserIds(clientId: string): Promise<string[]> {
  const members = await CompanyMember.findByOrg(clientId);
  const org = await Organization.findById(clientId)
    .select('roleCapabilities customRoles ownerUserId plan')
    .lean();
  if (!org) return [];

  const active = members.filter(m => m.isActive && m.userId);
  const userIds = active.map(m => m.userId!) as mongoose.Types.ObjectId[];
  const users = await User.find({ _id: { $in: userIds } }).select('systemRole plan').lean();
  const userMap = new Map(users.map(u => [String(u._id), u]));

  const supervisorIds: string[] = [];
  const orgRoleCapabilities = parseOrgRoleCapabilities(org.roleCapabilities);
  const customRoles = org.customRoles ?? [];

  for (const member of active) {
    const user = userMap.get(String(member.userId));
    if (!user) continue;

    let companyRole = member.companyRole;
    if (!companyRole && org.ownerUserId?.toString() === String(member.userId)) {
      companyRole = CompanyRole.OWNER;
    }

    const customRoleCaps = findCustomRoleCapabilities(
      member.customRoleId,
      customRoles as Parameters<typeof findCustomRoleCapabilities>[1],
    );

    const caps = buildCapabilities(
      (user.systemRole as SystemRole) ?? SystemRole.USER,
      companyRole,
      [],
      org.plan ?? user.plan ?? 'free',
      [],
      {
        extra: (member.extraCapabilities ?? []) as Capability[],
        denied: (member.deniedCapabilities ?? []) as Capability[],
        customRoleCapabilities: customRoleCaps ?? undefined,
      },
      orgRoleCapabilities,
    );

    if (caps.includes(Cap.INBOX_SUPERVISE)) {
      supervisorIds.push(String(member.userId));
    }
  }

  return supervisorIds;
}

export async function notifySupervisorInternalChatMention(input: {
  clientId: string;
  authorUserId: string;
  authorName: string;
  conversationId: string;
  contactName: string;
  body: string;
}): Promise<void> {
  if (!mentionsSupervisor(input.body)) return;

  const supervisorIds = await listSupervisorUserIds(input.clientId);
  if (!supervisorIds.length) return;

  const preview =
    input.body.length > 120 ? `${input.body.slice(0, 117)}…` : input.body;
  const href = `/platform/inbox?conv=${encodeURIComponent(input.conversationId)}`;
  const createdAt = new Date().toISOString();

  for (const supervisorId of supervisorIds) {
    if (supervisorId === input.authorUserId) continue;

    emitPanelEvent(input.clientId, {
      id: crypto.randomUUID(),
      type: 'inbox:supervisor_help',
      title: 'Pedido de ajuda — chat interno',
      body: `${input.authorName} · ${input.contactName}: ${preview}`,
      href,
      conversationId: input.conversationId,
      targetUserId: supervisorId,
      createdAt,
    });
  }
}
