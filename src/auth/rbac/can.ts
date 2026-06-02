import { Capability, applyPlanCapabilities } from './capabilities';
import { AuthContext, AuthContextOptions, GuildAccess } from './types';
import { GuildRole, SystemRole, UserRole, guildRoleToUserRole } from './roles';
import { capabilitiesForRole } from './capabilities';

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

export function canAccessServer(ctx: AuthContext, serverId: string): boolean {
  if (ctx.systemRole === SystemRole.SYSTEM_ADMIN || ctx.systemRole === SystemRole.SYSTEM_MODERATOR) {
    return true;
  }
  const access = ctx.guilds.find(g => g.guildId === serverId);
  if (!access) return false;
  return access.roleInGuild === GuildRole.OWNER || access.roleInGuild === GuildRole.ADMIN;
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
    [UserRole.USER]: 4,
  };
  return order[role];
}

export function buildCapabilities(
  systemRole: SystemRole,
  guilds: GuildAccess[],
  plan: string,
): Capability[] {
  const capSet = new Set<Capability>();

  if (systemRole === SystemRole.SYSTEM_ADMIN) {
    capabilitiesForRole(UserRole.SYSTEM_ADMIN).forEach(c => capSet.add(c));
  } else if (systemRole === SystemRole.SYSTEM_MODERATOR) {
    capabilitiesForRole(UserRole.SYSTEM_MODERATOR).forEach(c => capSet.add(c));
  }

  for (const g of guilds) {
    if (g.roleInGuild === GuildRole.MEMBER) continue;
    const role = guildRoleToUserRole(g.roleInGuild);
    for (const c of capabilitiesForRole(role)) {
      capSet.add(c);
    }
    if (g.roleInGuild === GuildRole.ADMIN && g.apiAccessEnabled) {
      capSet.add('api:key:create' as Capability);
      capSet.add('api:logs:view' as Capability);
    }
  }

  if (capSet.size === 0 || (capSet.size === capabilitiesForRole(UserRole.USER).length)) {
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

/** Verifica capability com contexto opcional de servidor */
export function can(
  ctx: AuthContext,
  permission: Capability,
  options?: AuthContextOptions,
): boolean {
  if (ctx.systemRole === SystemRole.SYSTEM_ADMIN) return true;

  if (!ctx.capabilities.includes(permission)) return false;

  const serverScoped =
    permission.startsWith('discord:') ||
    permission.startsWith('send:') ||
    permission.startsWith('whatsapp:') ||
    permission === 'queue:view' ||
    permission === 'queue:retry' ||
    permission === 'logs:view';

  if (serverScoped && options?.guildId) {
    return canAccessServer(ctx, options.guildId);
  }

  if (permission.startsWith('system:') && ctx.systemRole === SystemRole.USER) {
    return false;
  }

  return true;
}
