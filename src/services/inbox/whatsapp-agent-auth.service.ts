import mongoose from 'mongoose';
import { jidNormalizedUser } from '@whiskeysockets/baileys';
import { Cap, type Capability } from '@/auth/rbac/capabilities';
import { buildCapabilities } from '@/auth/rbac/can';
import {
  findCustomRoleCapabilities,
  parseOrgRoleCapabilities,
} from '@/auth/rbac/companyRolePresets';
import { CompanyRole, SystemRole } from '@/auth/rbac/roles';
import { CompanyMember, ICompanyMember } from '@/models/CompanyMember';
import { Organization } from '@/models/Organization';
import { User } from '@/models/User';
import { brazilPhoneLookupVariants, resolvePhoneFromJids } from '@/utils/whatsapp-phone';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';

export interface WhatsappSenderContext {
  clientId: string;
  remoteJid: string;
  altJid?: string;
  participant?: string;
}

export function senderJidsFromContext(ctx: WhatsappSenderContext): string[] {
  const list = [ctx.participant, ctx.altJid, ctx.remoteJid]
    .filter(Boolean)
    .map(j => jidNormalizedUser(j!));
  return [...new Set(list)];
}

function normalizeMemberPhoneDigits(phone?: string): string[] {
  if (!phone?.trim()) return [];
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return [];
  const norm = digits.startsWith('55') ? digits : `55${digits}`;
  return brazilPhoneLookupVariants(norm);
}

async function memberHasInboxReply(clientId: string, member: ICompanyMember): Promise<boolean> {
  if (!member.userId) return false;
  const user = await User.findById(member.userId).select('systemRole plan').lean();
  if (!user) return false;

  const org = await Organization.findById(clientId)
    .select('roleCapabilities customRoles ownerUserId plan')
    .lean();
  if (!org) return false;

  let companyRole = member.companyRole;
  if (!companyRole && org.ownerUserId?.toString() === String(member.userId)) {
    companyRole = CompanyRole.OWNER;
  }

  const customRoleCaps = findCustomRoleCapabilities(
    member.customRoleId,
    (org.customRoles ?? []) as Parameters<typeof findCustomRoleCapabilities>[1],
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
    parseOrgRoleCapabilities(org.roleCapabilities),
  );

  return caps.includes(Cap.INBOX_REPLY);
}

/** Resolve atendente autorizado pelo número WhatsApp de origem. */
export async function resolveAuthorizedWhatsappAgent(
  clientId: string,
  jids: string[],
): Promise<{ userId: string; displayName: string; whatsappPhone: string } | null> {
  const phone = resolvePhoneFromJids(clientId, ...jids);
  if (!phone) return null;

  const senderVariants = new Set(brazilPhoneLookupVariants(phone.replace(/\D/g, '')));
  if (senderVariants.size === 0) return null;

  const members = await CompanyMember.find({
    organizationId: new mongoose.Types.ObjectId(clientId),
    isActive: true,
    userId: { $exists: true, $ne: null },
    whatsappPhone: { $exists: true, $nin: [null, ''] },
  }).lean();

  for (const member of members) {
    const memberVariants = normalizeMemberPhoneDigits(member.whatsappPhone);
    const match = memberVariants.some(v => senderVariants.has(v));
    if (!match || !member.userId) continue;
    if (!(await memberHasInboxReply(clientId, member as unknown as ICompanyMember))) continue;

    const user = await User.findById(member.userId).select('displayName email').lean();
    const displayName =
      user?.displayName?.trim() || user?.email?.split('@')[0] || 'Atendente';
    return {
      userId: String(member.userId),
      displayName,
      whatsappPhone: member.whatsappPhone!.trim(),
    };
  }

  return null;
}

export async function resolveAuthorizedWhatsappAgentFromContext(
  ctx: WhatsappSenderContext,
): Promise<{ userId: string; displayName: string; whatsappPhone: string } | null> {
  return resolveAuthorizedWhatsappAgent(ctx.clientId, senderJidsFromContext(ctx));
}

export async function sendWhatsappInternalReply(
  clientId: string,
  replyJid: string,
  body: string,
): Promise<void> {
  await WhatsAppService.getInstance().sendInternalAlert(clientId, replyJid, body);
}
