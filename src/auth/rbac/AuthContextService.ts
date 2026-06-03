import mongoose from 'mongoose';
import { IUser } from '@/models/User';
import { GuildMembership } from '@/models/GuildMembership';
import { OrganizationService } from '@/services/organization/OrganizationService';
import { AuthContext, GuildAccess } from './types';
import { SystemRole, GuildRole, UserRole, guildRoleToUserRole, CompanyRole } from './roles';
import { buildCapabilities, resolvePrimaryRole } from './can';
import { resolveSystemRole } from './GuildMembershipSync';
import { CompanyMember } from '@/models/CompanyMember';

export async function buildAuthContext(params: {
  user: IUser;
  userId: string;
  discordUserId?: string;
  username: string;
  avatar: string | null;
  authProvider?: 'google' | 'discord';
  email?: string;
}): Promise<AuthContext> {
  const { user, userId, discordUserId, username, avatar, authProvider, email } = params;
  const orgSvc = OrganizationService.getInstance();

  const organizationId = await orgSvc.resolveClientId(userId);
  const org = await orgSvc.getOrganizationForUser(userId);

  let member = await CompanyMember.findActiveByUserId(userId);
  if (!member && user.discordUserId) {
    await orgSvc.ensureOrganization(user);
    member = await CompanyMember.findActiveByUserId(userId);
  }
  let companyRole: CompanyRole | null = member?.companyRole ?? null;
  if (!companyRole && org && org.ownerUserId.toString() === userId) {
    companyRole = CompanyRole.OWNER;
  }

  const systemRole: SystemRole =
    user.systemRole === SystemRole.SYSTEM_ADMIN
      ? SystemRole.SYSTEM_ADMIN
      : user.systemRole === SystemRole.SYSTEM_MODERATOR
        ? SystemRole.SYSTEM_MODERATOR
        : discordUserId
          ? resolveSystemRole(discordUserId)
          : SystemRole.USER;

  const memberships = discordUserId
    ? await GuildMembership.findActiveByUserId(user._id as mongoose.Types.ObjectId)
    : [];

  const linkedGuildIds = org?.linkedGuildIds ?? [];

  const guilds: GuildAccess[] = memberships
    .filter(m => linkedGuildIds.includes(m.discordGuildId))
    .map(m => ({
      guildId: m.discordGuildId,
      guildName: m.guildName,
      roleInGuild: m.roleInGuild as GuildRole,
      effectiveRole: guildRoleToUserRole(m.roleInGuild as GuildRole),
      apiAccessEnabled: m.apiAccessEnabled,
    }));

  const hasDiscordAccess = guilds.length > 0;
  const plan = org?.plan ?? user.plan;
  const primaryRole = resolvePrimaryRole(systemRole, guilds);
  const capabilities = buildCapabilities(systemRole, companyRole, guilds, plan, linkedGuildIds);

  return {
    userId,
    clientId: organizationId,
    organizationId,
    organizationName: org?.name,
    companyRole,
    discordUserId,
    authProvider,
    email: email ?? user.email,
    username,
    avatar,
    plan,
    systemRole,
    primaryRole,
    capabilities,
    guilds,
    linkedGuildIds,
    hasDiscordAccess,
    isInternalStaff:
      systemRole === SystemRole.SYSTEM_ADMIN || systemRole === SystemRole.SYSTEM_MODERATOR,
  };
}

export function authContextToJson(ctx: AuthContext) {
  return {
    userId: ctx.userId,
    discordId: ctx.discordUserId ?? null,
    username: ctx.username,
    avatar: ctx.avatar,
    email: ctx.email ?? null,
    authProvider: ctx.authProvider ?? null,
    plan: ctx.plan,
    systemRole: ctx.systemRole,
    primaryRole: ctx.primaryRole,
    companyRole: ctx.companyRole,
    organizationId: ctx.organizationId,
    organizationName: ctx.organizationName ?? null,
    hasDiscordAccess: ctx.hasDiscordAccess,
    capabilities: ctx.capabilities,
    guilds: ctx.guilds.map(g => ({
      id: g.guildId,
      name: g.guildName,
      role: g.roleInGuild,
      effectiveRole: g.effectiveRole,
      apiAccessEnabled: g.apiAccessEnabled,
    })),
    isInternalStaff: ctx.isInternalStaff,
    menuType: ctx.isInternalStaff ? 'admin' : 'client',
  };
}
