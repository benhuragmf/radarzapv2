import {
  Capability,
  applyPlanCapabilities,
  capabilitiesForCompanyRole,
  capabilitiesForGuildRole,
  capabilitiesForRole,
} from './capabilities';
import { AuthContext, AuthContextOptions, GuildAccess } from './types';
import { CompanyRole, GuildRole, SystemRole, UserRole, guildRoleToUserRole } from './roles';

export function hasRole(ctx: AuthContext, role: UserRole): boolean {
  if (ctx.primaryRole === UserRole.SYSTEM_ADMIN) return true;
  if (role === UserRole.SYSTEM_ADMIN) return ctx.systemRole === SystemRole.SYSTEM_ADMIN;
  if (role === UserRole.SYSTEM_MODERATOR) {
    return ctx.systemRole === SystemRole.SYSTEM_MODERATOR || ctx.systemRole === SystemRole.SYSTEM_ADMIN;
  }
  if (role === UserRole.DISCORD_OWNER) {
    return ctx.guilds.some(g => g.roleInGuild === GuildRole.OWNER);
  }
  if (role === UserRole.DISCORD_ADMIN) {
    return ctx.guilds.some(g => g.roleInGuild === GuildRole.ADMIN || g.roleInGuild === GuildRole.OWNER);
  }
  return ctx.primaryRole === role;
}

export function hasCompanyRole(ctx: AuthContext, role: CompanyRole): boolean {
  return ctx.companyRole === role;
}

export function canAccessServer(ctx: AuthContext, serverId: string): boolean {
  if (ctx.systemRole === SystemRole.SYSTEM_ADMIN || ctx.systemRole === SystemRole.SYSTEM_MODERATOR) {
    return true;
  }
  const access = ctx.guilds.find(g => g.guildId === serverId);
  if (!access) return false;
  if (!ctx.linkedGuildIds.includes(serverId)) return false;
  return (
    access.roleInGuild === GuildRole.OWNER ||
    access.roleInGuild === GuildRole.ADMIN ||
    access.roleInGuild === GuildRole.MEMBER
  );
}

export function getGuildAccess(ctx: AuthContext, serverId: string): GuildAccess | undefined {
  return ctx.guilds.find(g => g.guildId === serverId);
}

export function effectiveRoleForGuild(ctx: AuthContext, serverId?: string): UserRole {
  if (ctx.systemRole === SystemRole.SYSTEM_ADMIN) return UserRole.SYSTEM_ADMIN;
  if (ctx.systemRole === SystemRole.SYSTEM_MODERATOR) return UserRole.SYSTEM_MODERATOR;

  if (serverId) {
    const g = getGuildAccess(ctx, serverId);
    if (g) return g.effectiveRole;
  }

  const best = ctx.guilds.reduce<UserRole | null>((acc, g) => {
    const rank = roleRank(g.effectiveRole);
    if (acc === null || rank < roleRank(acc)) return g.effectiveRole;
    return acc;
  }, null);

  return best ?? UserRole.USER;
}

function roleRank(role: UserRole): number {
  const order: Record<UserRole, number> = {
    [UserRole.SYSTEM_ADMIN]: 0,
    [UserRole.SYSTEM_MODERATOR]: 1,
    [UserRole.DISCORD_OWNER]: 2,
    [UserRole.DISCORD_ADMIN]: 3,
    [UserRole.DISCORD_ATTENDANT]: 4,
    [UserRole.USER]: 5,
  };
  return order[role];
}

export function buildCapabilities(
  systemRole: SystemRole,
  companyRole: CompanyRole | null,
  guilds: GuildAccess[],
  plan: string,
  linkedGuildIds: string[],
): Capability[] {
  const capSet = new Set<Capability>();

  if (systemRole === SystemRole.SYSTEM_ADMIN) {
    capabilitiesForRole(UserRole.SYSTEM_ADMIN).forEach(c => capSet.add(c));
  } else if (systemRole === SystemRole.SYSTEM_MODERATOR) {
    capabilitiesForRole(UserRole.SYSTEM_MODERATOR).forEach(c => capSet.add(c));
  }

  if (companyRole) {
    for (const c of capabilitiesForCompanyRole(companyRole)) {
      capSet.add(c);
    }
  }

  for (const g of guilds) {
    if (!linkedGuildIds.includes(g.guildId)) continue;
    for (const c of capabilitiesForGuildRole(g.roleInGuild)) {
      capSet.add(c);
    }
    if (g.roleInGuild === GuildRole.ADMIN && g.apiAccessEnabled) {
      capSet.add('api:key:create' as Capability);
      capSet.add('api:logs:view' as Capability);
    }
  }

  if (capSet.size === 0) {
    capabilitiesForRole(UserRole.USER).forEach(c => capSet.add(c));
  }

  applyPlanCapabilities(capSet, plan);
  return Array.from(capSet);
}

export function resolvePrimaryRole(systemRole: SystemRole, guilds: GuildAccess[]): UserRole {
  if (systemRole === SystemRole.SYSTEM_ADMIN) return UserRole.SYSTEM_ADMIN;
  if (systemRole === SystemRole.SYSTEM_MODERATOR) return UserRole.SYSTEM_MODERATOR;
  if (guilds.some(g => g.roleInGuild === GuildRole.OWNER)) return UserRole.DISCORD_OWNER;
  if (guilds.some(g => g.roleInGuild === GuildRole.ADMIN)) return UserRole.DISCORD_ADMIN;
  return UserRole.USER;
}

export function can(
  ctx: AuthContext,
  permission: Capability,
  options?: AuthContextOptions,
): boolean {
  if (ctx.systemRole === SystemRole.SYSTEM_ADMIN) return true;

  if (!ctx.capabilities.includes(permission)) return false;

  const discordScoped = permission.startsWith('discord:');
  const serverScoped =
    discordScoped ||
    permission.startsWith('send:') ||
    permission.startsWith('whatsapp:') ||
    permission === 'queue:view' ||
    permission === 'queue:retry' ||
    permission === 'logs:view';

  if (discordScoped && !ctx.hasDiscordAccess) return false;

  if (serverScoped && options?.guildId) {
    return canAccessServer(ctx, options.guildId);
  }

  if (permission.startsWith('system:') && ctx.systemRole === SystemRole.USER) {
    return false;
  }

  if (permission.startsWith('company:') && ctx.companyRole !== CompanyRole.OWNER) {
    return false;
  }

  return true;
}
