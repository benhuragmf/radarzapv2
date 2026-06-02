import mongoose from 'mongoose';
import { IUser } from '@/models/User';
import { GuildMembership } from '@/models/GuildMembership';
import { AuthContext, GuildAccess } from './types';
import { SystemRole, GuildRole, UserRole, guildRoleToUserRole } from './roles';
import { buildCapabilities, resolvePrimaryRole } from './can';
import { resolveSystemRole } from './GuildMembershipSync';

export async function buildAuthContext(params: {
  user: IUser;
  userId: string;
  discordUserId: string;
  username: string;
  avatar: string | null;
}): Promise<AuthContext> {
  const { user, userId, discordUserId, username, avatar } = params;
  const clientId = (user._id as mongoose.Types.ObjectId).toString();

  const systemRole: SystemRole =
    user.systemRole === SystemRole.SYSTEM_ADMIN
      ? SystemRole.SYSTEM_ADMIN
      : user.systemRole === SystemRole.SYSTEM_MODERATOR
        ? SystemRole.SYSTEM_MODERATOR
        : resolveSystemRole(discordUserId);

  const memberships = await GuildMembership.findActiveByUserId(user._id as mongoose.Types.ObjectId);

  const guilds: GuildAccess[] = memberships.map(m => ({
    guildId: m.discordGuildId,
    guildName: m.guildName,
    roleInGuild: m.roleInGuild as GuildRole,
    effectiveRole: guildRoleToUserRole(m.roleInGuild as GuildRole),
    apiAccessEnabled: m.apiAccessEnabled,
  }));

  const primaryRole = resolvePrimaryRole(systemRole, guilds);
  const capabilities = buildCapabilities(systemRole, guilds, user.plan);

  return {
    userId,
    clientId,
    discordUserId,
    username,
    avatar,
    plan: user.plan,
    systemRole,
    primaryRole,
    capabilities,
    guilds,
    isInternalStaff:
      systemRole === SystemRole.SYSTEM_ADMIN || systemRole === SystemRole.SYSTEM_MODERATOR,
  };
}

export function authContextToJson(ctx: AuthContext) {
  return {
    userId: ctx.userId,
    discordId: ctx.discordUserId,
    username: ctx.username,
    avatar: ctx.avatar,
    plan: ctx.plan,
    systemRole: ctx.systemRole,
    primaryRole: ctx.primaryRole,
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
