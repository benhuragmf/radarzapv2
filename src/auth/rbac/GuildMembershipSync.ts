import { config } from '@/config/environment';
import { GuildRole, SystemRole } from '@/auth/rbac/roles';
import { GuildMembership } from '@/models/GuildMembership';
import { OrganizationService } from '@/services/organization/OrganizationService';
import { writeAuditLog } from '@/models/AuditLog';
import { createServiceLogger } from '@/utils/logger';
import mongoose from 'mongoose';

const logger = createServiceLogger('GuildMembershipSync');

const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);

function parseSystemAdminIds(): Set<string> {
  const raw = process.env.RADARZAP_SYSTEM_ADMIN_DISCORD_IDS ?? '';
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
}

function parseSystemModeratorIds(): Set<string> {
  const raw = process.env.RADARZAP_SYSTEM_MODERATOR_DISCORD_IDS ?? '';
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
}

export function resolveSystemRole(discordUserId: string): SystemRole {
  if (parseSystemAdminIds().has(discordUserId)) return SystemRole.SYSTEM_ADMIN;
  if (parseSystemModeratorIds().has(discordUserId)) return SystemRole.SYSTEM_MODERATOR;
  return SystemRole.USER;
}

function permissionsToRole(isOwner: boolean, permissionBits: bigint): GuildRole {
  if (isOwner) return GuildRole.OWNER;
  if ((permissionBits & ADMINISTRATOR) === ADMINISTRATOR || (permissionBits & MANAGE_GUILD) === MANAGE_GUILD) {
    return GuildRole.ADMIN;
  }
  return GuildRole.MEMBER;
}

async function fetchMemberRole(
  token: string,
  guildId: string,
  discordUserId: string,
  ownerId?: string,
): Promise<GuildRole> {
  if (ownerId === discordUserId) return GuildRole.OWNER;

  const memberRes = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`,
    { headers: { Authorization: `Bot ${token}` } },
  );
  if (!memberRes.ok) return GuildRole.MEMBER;

  const member = await memberRes.json() as { roles?: string[] };
  if (!member.roles?.length) return GuildRole.MEMBER;

  const rolesRes = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/roles`,
    { headers: { Authorization: `Bot ${token}` } },
  );
  if (!rolesRes.ok) return GuildRole.MEMBER;

  const roles = await rolesRes.json() as Array<{ id: string; permissions: string }>;
  let bits = BigInt(0);
  for (const roleId of member.roles) {
    const role = roles.find(r => r.id === roleId);
    if (role) {
      try { bits |= BigInt(role.permissions); } catch { /* ignore */ }
    }
  }

  return permissionsToRole(false, bits);
}

/** Sincroniza vínculos Discord via API do bot (guilds onde o bot está presente) */
export async function syncGuildMemberships(
  userId: string,
  discordUserId: string,
): Promise<void> {
  const token = config.DISCORD.TOKEN;
  if (!token) {
    logger.warn('DISCORD_TOKEN ausente — sync de guilds ignorado');
    return;
  }

  const botGuildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!botGuildsRes.ok) {
    logger.warn(`Falha ao listar guilds do bot: ${botGuildsRes.status}`);
    return;
  }

  const botGuilds = await botGuildsRes.json() as Array<{ id: string; name: string }>;
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const orgSvc = OrganizationService.getInstance();
  let organizationId: mongoose.Types.ObjectId;
  try {
    organizationId = new mongoose.Types.ObjectId(await orgSvc.resolveClientId(userId));
  } catch {
    organizationId = userObjectId;
  }
  const now = new Date();
  const activeGuildIds = new Set<string>();

  for (const guild of botGuilds) {
    try {
      const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guild.id}`, {
        headers: { Authorization: `Bot ${token}` },
      });
      const guildData = guildRes.ok
        ? await guildRes.json() as { owner_id?: string; name?: string }
        : { owner_id: undefined, name: guild.name };

      const memberCheck = await fetch(
        `https://discord.com/api/v10/guilds/${guild.id}/members/${discordUserId}`,
        { headers: { Authorization: `Bot ${token}` } },
      );
      if (memberCheck.status === 404) continue;
      if (!memberCheck.ok) continue;

      const roleInGuild = await fetchMemberRole(
        token,
        guild.id,
        discordUserId,
        guildData.owner_id,
      );

      if (roleInGuild === GuildRole.MEMBER) continue;

      activeGuildIds.add(guild.id);

      const existing = await GuildMembership.findOne({
        userId: userObjectId,
        discordGuildId: guild.id,
      });

      const prevRole = existing?.roleInGuild;

      await GuildMembership.findOneAndUpdate(
        { userId: userObjectId, discordGuildId: guild.id },
        {
          userId: userObjectId,
          discordUserId,
          organizationId,
          discordGuildId: guild.id,
          guildName: guildData.name ?? guild.name,
          roleInGuild,
          lastCheckedAt: now,
          isActive: true,
          apiAccessEnabled: existing?.apiAccessEnabled ?? false,
        },
        { upsert: true, new: true },
      );

      if (roleInGuild === GuildRole.OWNER || roleInGuild === GuildRole.ADMIN) {
        await orgSvc.linkGuildToOrganization(organizationId.toString(), guild.id);
      }

      if (prevRole && prevRole !== roleInGuild) {
        await writeAuditLog({
          action: 'guild.role.changed',
          actorUserId: userId,
          actorDiscordId: discordUserId,
          targetGuildId: guild.id,
          details: { previousRole: prevRole, newRole: roleInGuild },
        });
      }
    } catch (err) {
      logger.debug(`Sync guild ${guild.id} falhou: ${(err as Error).message}`);
    }
  }

  const stale = await GuildMembership.find({
    userId: userObjectId,
    isActive: true,
    roleInGuild: { $in: [GuildRole.ADMIN, GuildRole.OWNER] },
    discordGuildId: { $nin: Array.from(activeGuildIds) },
  });

  for (const m of stale) {
    const previousRole = m.roleInGuild;
    m.isActive = false;
    m.roleInGuild = GuildRole.MEMBER;
    m.lastCheckedAt = now;
    await m.save();
    await writeAuditLog({
      action: 'guild.access.revoked',
      actorUserId: userId,
      actorDiscordId: discordUserId,
      targetGuildId: m.discordGuildId,
      details: { reason: 'discord_permission_lost', previousRole },
    });
  }
}
