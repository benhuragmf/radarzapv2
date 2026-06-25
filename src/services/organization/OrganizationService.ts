import mongoose from 'mongoose';
import { User, IUser } from '@/models/User';
import { Organization, IOrganization } from '@/models/Organization';
import { CompanyMember, ICompanyMember } from '@/models/CompanyMember';
import { CompanyRole } from '@/auth/rbac/roles';
import { Cap, type Capability } from '@/auth/rbac/capabilities';
import {
  assignableCapabilitiesForOrg,
  buildAllPresetsForOrg,
  buildPresetsForOrg,
  INVITEABLE_ROLES,
  parseOrgRoleCapabilities,
  resolveMemberCapabilities,
} from '@/auth/rbac/companyRolePresets';
import {
  customRoleIdFromKey,
  customRoleKey,
  defaultOrgCustomRoles,
  isCustomRoleKey,
  OrgCustomRole,
} from '@/types/org-custom-role';
import crypto from 'crypto';
import { createServiceLogger } from '@/utils/logger';
import { config } from '@/config/environment';
import { EmailService } from '@/services/email/EmailService';
import {
  buildTeamInviteEmail,
  resolveInviteRoleLabel,
} from '@/services/email/team-invite-email';
import { assertCanAssignTeamRole } from '@/services/team/team-plan-limits';
import { writeAuditLog } from '@/models/AuditLog';

const logger = createServiceLogger('OrganizationService');

export interface InviteEmailDeliveryResult {
  sent: boolean;
  transport: 'resend' | 'smtp' | 'console' | 'none';
  error?: string;
}

const INVITED_MEMBER_ROLES: CompanyRole[] = [
  CompanyRole.ADMIN,
  CompanyRole.MANAGER,
  CompanyRole.ATTENDANT,
  CompanyRole.INTEGRATION,
  CompanyRole.CUSTOM,
];

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export class OrganizationService {
  private static instance: OrganizationService;

  static getInstance(): OrganizationService {
    if (!OrganizationService.instance) {
      OrganizationService.instance = new OrganizationService();
    }
    return OrganizationService.instance;
  }

  /** Membro ativo — prioriza convite (ADMIN/ATTENDANT) sobre org solo criada por engano no login. */
  async getActiveMemberForUser(userId: string): Promise<ICompanyMember | null> {
    const user = await User.findById(userId);
    if (user?.primaryOrganizationId) {
      const preferred = await CompanyMember.findOne({
        userId,
        organizationId: user.primaryOrganizationId,
        isActive: true,
      });
      if (preferred) return preferred;
    }

    const members = await CompanyMember.find({ userId, isActive: true });
    const invited = members.find(
      m => INVITED_MEMBER_ROLES.includes(m.companyRole),
    );
    return invited ?? members[0] ?? null;
  }

  async listOrganizationsForUser(userId: string) {
    const members = await CompanyMember.find({ userId, isActive: true });
    if (!members.length) return [];

    const orgIds = members.map(m => m.organizationId);
    const orgs = await Organization.find({ _id: { $in: orgIds } })
      .select('name ownerUserId')
      .lean();
    const orgMap = new Map(
      orgs.map(o => [
        String(o._id),
        { name: o.name, ownerUserId: o.ownerUserId },
      ]),
    );

    const ownerIds = [...new Set(orgs.map(o => o.ownerUserId.toString()))];
    const owners = await User.find({ _id: { $in: ownerIds } })
      .select('email displayName discordUserId')
      .lean();
    const ownerMap = new Map(owners.map(u => [String(u._id), u]));

    const ownerMembers = await CompanyMember.find({
      organizationId: { $in: orgIds },
      companyRole: CompanyRole.OWNER,
      isActive: true,
    })
      .select('organizationId email userId')
      .lean();
    const ownerMemberEmailByOrg = new Map(
      ownerMembers.map(om => [String(om.organizationId), om.email?.trim() || null]),
    );

    return members
      .map(m => {
        const org = orgMap.get(String(m.organizationId));
        const owner = org ? ownerMap.get(org.ownerUserId.toString()) : undefined;
        const ownerMemberEmail = ownerMemberEmailByOrg.get(String(m.organizationId)) ?? null;
        const ownerEmail =
          owner?.email?.trim() ||
          ownerMemberEmail ||
          (owner?.displayName?.trim() ? `${owner.displayName} (Discord)` : null) ||
          (owner?.discordUserId ? `Discord ${owner.discordUserId}` : null);
        const ownerName = owner?.displayName?.trim() || null;
        return {
          organizationId: m.organizationId.toString(),
          organizationName: org?.name ?? 'Empresa',
          companyRole: m.companyRole,
          ownerEmail,
          ownerName,
        };
      })
      .sort((a, b) => a.organizationName.localeCompare(b.organizationName, 'pt-BR'));
  }

  async getMemberInOrganization(
    userId: string,
    organizationId: string,
  ): Promise<ICompanyMember | null> {
    return CompanyMember.findOne({ userId, organizationId, isActive: true });
  }

  async setPrimaryOrganization(userId: string, organizationId: string): Promise<void> {
    const member = await this.getMemberInOrganization(userId, organizationId);
    if (!member) throw new Error('Você não pertence a esta empresa');

    const user = await User.findById(userId);
    if (!user) throw new Error('Usuário não encontrado');

    user.primaryOrganizationId = new mongoose.Types.ObjectId(organizationId);
    await user.save();
  }

  /** Tenant id usado em clientId (Destination, WhatsApp, etc.) */
  async resolveClientId(userId: string, sessionOrganizationId?: string): Promise<string | null> {
    if (sessionOrganizationId) {
      const sessionMember = await this.getMemberInOrganization(userId, sessionOrganizationId);
      if (sessionMember) return sessionMember.organizationId.toString();
    }

    const organizations = await this.listOrganizationsForUser(userId);
    if (organizations.length === 1) {
      return organizations[0].organizationId;
    }
    if (organizations.length > 1) {
      return null;
    }

    const member = await this.getActiveMemberForUser(userId);
    if (member) return member.organizationId.toString();

    const user = await User.findById(userId);
    if (!user) throw new Error('Usuário não encontrado');

    const org = await this.ensureOrganization(user);
    return org._id.toString();
  }

  async getOrganizationForUser(
    userId: string,
    sessionOrganizationId?: string,
  ): Promise<IOrganization | null> {
    const clientId = await this.resolveClientId(userId, sessionOrganizationId);
    if (!clientId) return null;
    return Organization.findById(clientId);
  }

  async getMemberRole(userId: string): Promise<CompanyRole | null> {
    const member = await this.getActiveMemberForUser(userId);
    return member?.companyRole ?? null;
  }

  private async findPendingInvitesByEmail(email: string): Promise<ICompanyMember[]> {
    const normalized = email.toLowerCase().trim();
    return CompanyMember.find({
      email: normalized,
      isActive: true,
      $or: [{ userId: { $exists: false } }, { userId: null }],
      companyRole: { $in: INVITED_MEMBER_ROLES },
    });
  }

  /** @deprecated use findPendingInvitesByEmail — mantido para compatibilidade interna */
  private async findInviteByEmail(email: string): Promise<ICompanyMember | null> {
    const invites = await this.findPendingInvitesByEmail(email);
    return invites[0] ?? null;
  }

  /** Vincula todos os convites pendentes do e-mail à conta (multi-empresa). */
  async linkAllPendingInvitesForUser(user: IUser, email?: string): Promise<number> {
    const normalized = (email ?? user.email)?.trim().toLowerCase();
    if (!normalized) return 0;

    const invites = await this.findPendingInvitesByEmail(normalized);
    if (!invites.length) return 0;

    const userId = user._id as mongoose.Types.ObjectId;
    for (const invite of invites) {
      if (invite.userId?.toString() === userId.toString()) continue;
      invite.userId = userId;
      if (!invite.email) invite.email = normalized;
      await invite.save();
    }

    if (!user.primaryOrganizationId) {
      user.primaryOrganizationId = invites[0].organizationId;
      await user.save();
    }

    await this.cleanupSoloOwnerOrgIfInvitedElsewhere(user);
    return invites.length;
  }

  /** Vincula usuário ao convite e usa a organização do dono (não cria empresa nova). */
  private async joinOrganizationViaInvite(
    user: IUser,
    invite: ICompanyMember,
  ): Promise<IOrganization> {
    invite.userId = user._id as mongoose.Types.ObjectId;
    if (!invite.email && user.email) invite.email = user.email.toLowerCase();
    await invite.save();

    user.primaryOrganizationId = invite.organizationId;
    await user.save();

    await this.cleanupSoloOwnerOrgIfInvitedElsewhere(user);

    const org = await Organization.findById(invite.organizationId);
    if (!org) throw new Error('Organização do convite não encontrada');
    return org;
  }

  /** Remove membership OWNER órfã quando o usuário entrou por convite em outra empresa. */
  private async cleanupSoloOwnerOrgIfInvitedElsewhere(user: IUser): Promise<void> {
    const userId = user._id as mongoose.Types.ObjectId;
    const invitedElsewhere = await CompanyMember.findOne({
      userId,
      isActive: true,
      companyRole: { $in: INVITED_MEMBER_ROLES },
    });
    if (!invitedElsewhere) return;

    const soloOwner = await CompanyMember.findOne({
      userId,
      organizationId: userId,
      companyRole: CompanyRole.OWNER,
      isActive: true,
    });
    if (!soloOwner) return;

    soloOwner.isActive = false;
    await soloOwner.save();
    logger.info('Membership OWNER solo desativada após aceitar convite', {
      userId: userId.toString(),
      joinedOrg: invitedElsewhere.organizationId.toString(),
    });
  }

  private applyGoogleProfileToUser(user: IUser, profile: GoogleProfile): void {
    if (!user.googleId) user.googleId = profile.sub;
    if (!user.authProviders.includes('google')) user.authProviders.push('google');
    if (profile.email && !user.email) user.email = profile.email.toLowerCase();
    if (profile.name && !user.displayName) user.displayName = profile.name;
  }

  /** Migração: usuários legados (Discord /setup) — org._id = user._id */
  async ensureOrganization(user: IUser): Promise<IOrganization> {
    const userId = user._id as mongoose.Types.ObjectId;
    const existingById = await Organization.findById(userId);
    if (existingById) return existingById;

    const existingByOwner = await Organization.findByOwner(userId);
    if (existingByOwner) return existingByOwner;

    const org = await Organization.create({
      _id: userId,
      ownerUserId: userId,
      name: user.displayName ?? user.email ?? `Empresa ${userId.toString().slice(-6)}`,
      plan: user.plan,
      limits: { ...user.limits },
      usage: { ...user.usage },
      linkedGuildIds: [],
    });

    await CompanyMember.create({
      organizationId: org._id,
      userId,
      email: user.email,
      companyRole: CompanyRole.OWNER,
      isActive: true,
    });

    user.primaryOrganizationId = userId;
    await user.save();

    logger.info('Legacy organization ensured', { userId: userId.toString(), orgId: org._id.toString() });
    return org;
  }

  async getOrCreateForGoogle(profile: GoogleProfile): Promise<{ user: IUser; org: IOrganization }> {
    const email = profile.email?.toLowerCase().trim();

    let user = await User.findOne({ googleId: profile.sub });
    if (!user && email) {
      user = await User.findOne({ email });
    }

    if (user) {
      this.applyGoogleProfileToUser(user, profile);
      await user.save();

      const linkedInvites = email ? await this.linkAllPendingInvitesForUser(user, email) : 0;
      if (linkedInvites > 0) {
        const preferredOrgId = user.primaryOrganizationId;
        const org = preferredOrgId
          ? await Organization.findById(preferredOrgId)
          : null;
        if (org) {
          logger.info('Google login — convites de equipe vinculados', {
            userId: user._id.toString(),
            email,
            linkedInvites,
            organizationId: org._id.toString(),
          });
          return { user, org };
        }
      }

      const org = await this.ensureOrganization(user);
      return { user, org };
    }

    const userId = new mongoose.Types.ObjectId();
    user = await User.create({
      _id: userId,
      googleId: profile.sub,
      email,
      displayName: profile.name ?? profile.email,
      authProviders: ['google'],
      plan: 'free',
    });

    const linkedInvites = email ? await this.linkAllPendingInvitesForUser(user, email) : 0;
    if (linkedInvites > 0) {
      const org = await Organization.findById(user.primaryOrganizationId);
      if (org) {
        logger.info('Novo usuário Google entrou por convite', {
          userId: userId.toString(),
          email,
          linkedInvites,
          organizationId: org._id.toString(),
        });
        return { user, org };
      }
    }

    const org = await Organization.create({
      _id: userId,
      ownerUserId: userId,
      name: profile.name ?? profile.email ?? 'Minha empresa',
      plan: 'free',
      limits: User.getPlanLimits('free'),
      usage: { messagesUsed: 0, lastReset: new Date() },
      linkedGuildIds: [],
    });

    await CompanyMember.create({
      organizationId: org._id,
      userId,
      email,
      companyRole: CompanyRole.OWNER,
      isActive: true,
    });

    user.primaryOrganizationId = userId;
    await user.save();

    logger.info('New Google organization created', { userId: userId.toString() });
    return { user, org };
  }

  async getOrCreateForDiscord(discordUserId: string, email?: string): Promise<IUser> {
    let user = await User.findByDiscordId(discordUserId);
    if (user) {
      await this.ensureOrganization(user);
      return user;
    }

    user = await User.createUser(discordUserId, email);
    await this.ensureOrganization(user);
    return user;
  }

  async linkGuildToOrganization(organizationId: string, guildId: string): Promise<void> {
    const org = await Organization.findById(organizationId);
    if (!org) return;
    await org.linkGuild(guildId);
  }

  /**
   * IDs de tenant para buscar regras, canais e destinos (org + dono + membros).
   * Evita falha quando regras foram criadas com user._id e o canal usa organizationId.
   */
  async getRelatedClientIds(clientId: string): Promise<mongoose.Types.ObjectId[]> {
    const ids = new Set<string>([clientId]);

    const oid = new mongoose.Types.ObjectId(clientId);
    const org = await Organization.findById(oid).lean();
    if (org) {
      ids.add(org.ownerUserId.toString());
      const members = await CompanyMember.find({ organizationId: org._id, isActive: true })
        .select('userId')
        .lean();
      for (const m of members) {
        if (m.userId) ids.add(m.userId.toString());
      }
    }

    const user = await User.findById(oid).select('primaryOrganizationId').lean();
    if (user?.primaryOrganizationId) {
      ids.add(user.primaryOrganizationId.toString());
    }

    const member = await CompanyMember.findActiveByUserId(oid);
    if (member) {
      ids.add(member.organizationId.toString());
    }

    return [...ids].map(id => new mongoose.Types.ObjectId(id));
  }

  async listMembers(organizationId: string): Promise<ICompanyMember[]> {
    return CompanyMember.findByOrg(organizationId);
  }

  async assignableCapabilitiesForOrg(organizationId: string): Promise<Capability[]> {
    const org = await Organization.findById(organizationId).select('linkedGuildIds').lean();
    const hasDiscordIntegration = (org?.linkedGuildIds?.length ?? 0) > 0;
    return assignableCapabilitiesForOrg(hasDiscordIntegration);
  }

  async ensureOrgCustomRoles(org: IOrganization): Promise<OrgCustomRole[]> {
    const existing = (org.customRoles ?? []) as OrgCustomRole[];
    if (existing.length > 0) return existing;

    const defaults = defaultOrgCustomRoles();
    org.customRoles = defaults;
    org.markModified('customRoles');
    await org.save();
    return defaults;
  }

  async getOrgRolePresets(organizationId: string) {
    const org = await Organization.findById(organizationId).select(
      'linkedGuildIds roleCapabilities customRoles',
    );
    if (!org) throw new Error('Organização não encontrada');

    const customRoles = await this.ensureOrgCustomRoles(org);
    const hasDiscordIntegration = (org.linkedGuildIds?.length ?? 0) > 0;
    const orgRoleCapabilities = parseOrgRoleCapabilities(org.roleCapabilities);
    return {
      presets: buildAllPresetsForOrg(orgRoleCapabilities, customRoles),
      hasDiscordIntegration,
      orgRoleCapabilities,
      customRoles,
    };
  }

  async updateOrgRolePreset(
    organizationId: string,
    role: CompanyRole,
    capabilities: Capability[],
    requesterRole: CompanyRole,
  ): Promise<{ role: CompanyRole; capabilities: Capability[] }> {
    if (requesterRole !== CompanyRole.OWNER) {
      throw new Error('Apenas o dono pode editar papéis do sistema');
    }
    if (role === CompanyRole.OWNER) {
      throw new Error('O papel Dono não pode ser alterado');
    }
    if (!INVITEABLE_ROLES.includes(role)) {
      throw new Error('Papel inválido');
    }

    const assignable = new Set(await this.assignableCapabilitiesForOrg(organizationId));
    const selected = capabilities.filter(c => assignable.has(c));

    const org = await Organization.findById(organizationId);
    if (!org) throw new Error('Organização não encontrada');

    const roleCapabilities = { ...(org.roleCapabilities ?? {}) };
    roleCapabilities[role] = selected;
    org.roleCapabilities = roleCapabilities;
    org.markModified('roleCapabilities');
    await org.save();

    return { role, capabilities: selected };
  }

  async resetOrgRolePreset(
    organizationId: string,
    role: CompanyRole,
    requesterRole: CompanyRole,
  ): Promise<void> {
    if (requesterRole !== CompanyRole.OWNER) {
      throw new Error('Apenas o dono pode editar papéis do sistema');
    }
    if (role === CompanyRole.OWNER) {
      throw new Error('O papel Dono não pode ser alterado');
    }

    const org = await Organization.findById(organizationId);
    if (!org) throw new Error('Organização não encontrada');

    const roleCapabilities = { ...(org.roleCapabilities ?? {}) };
    delete roleCapabilities[role];
    org.roleCapabilities = roleCapabilities;
    org.markModified('roleCapabilities');
    await org.save();
  }

  async createCustomRole(
    organizationId: string,
    requesterRole: CompanyRole,
    data: { name: string; description?: string; capabilities?: Capability[] },
  ): Promise<OrgCustomRole> {
    if (requesterRole !== CompanyRole.OWNER) {
      throw new Error('Apenas o dono pode criar papéis personalizados');
    }
    const name = data.name?.trim();
    if (!name) throw new Error('Nome do papel é obrigatório');

    const org = await Organization.findById(organizationId);
    if (!org) throw new Error('Organização não encontrada');

    const assignable = new Set(await this.assignableCapabilitiesForOrg(organizationId));
    const capabilities = (data.capabilities ?? []).filter(c => assignable.has(c));

    const role: OrgCustomRole = {
      id: crypto.randomUUID(),
      name,
      description: data.description?.trim() || undefined,
      capabilities,
    };

    const roles = [...((org.customRoles ?? []) as OrgCustomRole[]), role];
    org.customRoles = roles;
    org.markModified('customRoles');
    await org.save();
    return role;
  }

  async updateCustomRole(
    organizationId: string,
    roleId: string,
    requesterRole: CompanyRole,
    data: { name?: string; description?: string; capabilities?: Capability[] },
  ): Promise<OrgCustomRole> {
    if (requesterRole !== CompanyRole.OWNER) {
      throw new Error('Apenas o dono pode editar papéis personalizados');
    }

    const org = await Organization.findById(organizationId);
    if (!org) throw new Error('Organização não encontrada');

    const roles = [...((org.customRoles ?? []) as OrgCustomRole[])];
    const idx = roles.findIndex(r => r.id === roleId);
    if (idx < 0) throw new Error('Papel personalizado não encontrado');

    if (data.name?.trim()) roles[idx].name = data.name.trim();
    if (data.description !== undefined) {
      roles[idx].description = data.description.trim() || undefined;
    }
    if (data.capabilities) {
      const assignable = new Set(await this.assignableCapabilitiesForOrg(organizationId));
      roles[idx].capabilities = data.capabilities.filter(c => assignable.has(c));
    }

    org.customRoles = roles;
    org.markModified('customRoles');
    await org.save();
    return roles[idx];
  }

  async deleteCustomRole(
    organizationId: string,
    roleId: string,
    requesterRole: CompanyRole,
  ): Promise<void> {
    if (requesterRole !== CompanyRole.OWNER) {
      throw new Error('Apenas o dono pode excluir papéis personalizados');
    }

    const inUse = await CompanyMember.countDocuments({
      organizationId,
      isActive: true,
      customRoleId: roleId,
    });
    if (inUse > 0) {
      throw new Error('Este papel está em uso — altere os membros antes de excluir');
    }

    const org = await Organization.findById(organizationId);
    if (!org) throw new Error('Organização não encontrada');

    const roles = ((org.customRoles ?? []) as OrgCustomRole[]).filter(r => r.id !== roleId);
    org.customRoles = roles;
    org.markModified('customRoles');
    await org.save();
  }

  private parseMemberRoleSelection(roleKey: string): {
    companyRole: CompanyRole;
    customRoleId?: string;
  } {
    const customId = customRoleIdFromKey(roleKey);
    if (customId) {
      return { companyRole: CompanyRole.CUSTOM, customRoleId: customId };
    }
    if (!INVITEABLE_ROLES.includes(roleKey as CompanyRole)) {
      throw new Error('Papel inválido');
    }
    return { companyRole: roleKey as CompanyRole, customRoleId: undefined };
  }

  private async assertCustomRoleExists(orgId: string, customRoleId: string): Promise<void> {
    const org = await Organization.findById(orgId).select('customRoles').lean();
    const roles = (org?.customRoles ?? []) as OrgCustomRole[];
    if (!roles.some(r => r.id === customRoleId)) {
      throw new Error('Papel personalizado não encontrado');
    }
  }

  async listMembersEnriched(organizationId: string) {
    const members = await this.listMembers(organizationId);
    const org = await Organization.findById(organizationId)
      .select('roleCapabilities customRoles')
      .lean();
    const orgRoleCapabilities = parseOrgRoleCapabilities(org?.roleCapabilities);
    const customRoles = (org?.customRoles ?? []) as OrgCustomRole[];
    const userIds = members.map(m => m.userId).filter(Boolean) as mongoose.Types.ObjectId[];
    const users = await User.find({ _id: { $in: userIds } }).select('email displayName').lean();
    const userMap = new Map(users.map(u => [String(u._id), u]));

    return members.map(m => {
      const u = m.userId ? userMap.get(String(m.userId)) : undefined;
      const resolvedEmail = m.email?.trim() || u?.email?.trim() || null;
      const displayEmail =
        resolvedEmail ||
        (m.companyRole === CompanyRole.OWNER && u?.displayName?.trim()
          ? `${u.displayName} (Discord — vincule em Configurações)`
          : u?.displayName?.trim()) ||
        (m.companyRole === CompanyRole.OWNER ? 'Dono da conta (vincule em Configurações)' : undefined);
      const effectiveCapabilities = resolveMemberCapabilities(
        m.companyRole,
        (m.extraCapabilities ?? []) as Capability[],
        (m.deniedCapabilities ?? []) as Capability[],
        orgRoleCapabilities,
        m.customRoleId
          ? customRoles.find(r => r.id === m.customRoleId)?.capabilities ?? null
          : null,
      );
      const customRoleName = m.customRoleId
        ? customRoles.find(r => r.id === m.customRoleId)?.name
        : undefined;
      return {
        ...m.toObject(),
        displayEmail: displayEmail ?? '—',
        resolvedEmail,
        linked: Boolean(m.userId),
        effectiveCapabilities,
        customRoleName,
      };
    });
  }

  async updateMember(
    organizationId: string,
    memberId: string,
    requesterRole: CompanyRole,
    patch: {
      companyRole?: CompanyRole;
      customRoleId?: string | null;
      whatsappPhone?: string | null;
      roleKey?: string;
    },
  ): Promise<ICompanyMember> {
    const member = await CompanyMember.findOne({ _id: memberId, organizationId, isActive: true });
    if (!member) throw new Error('Membro não encontrado');
    if (member.companyRole === CompanyRole.OWNER) {
      throw new Error('Não é possível alterar o dono da empresa');
    }

    if (patch.roleKey !== undefined) {
      const parsed = this.parseMemberRoleSelection(patch.roleKey);
      if (parsed.companyRole === CompanyRole.ADMIN && requesterRole !== CompanyRole.OWNER) {
        throw new Error('Apenas o dono pode promover a administrador');
      }
      if (parsed.customRoleId) {
        await this.assertCustomRoleExists(organizationId, parsed.customRoleId);
      }
      await assertCanAssignTeamRole(organizationId, {
        companyRole: parsed.companyRole,
        customRoleId: parsed.customRoleId,
        excludeMemberId: member._id.toString(),
        addsUserSeat: true,
      });
      const previousRoleKey =
        member.companyRole === CompanyRole.CUSTOM && member.customRoleId
          ? customRoleKey(member.customRoleId)
          : member.companyRole;
      member.companyRole = parsed.companyRole;
      member.customRoleId = parsed.customRoleId;
      await writeAuditLog({
        action: 'team:member:role_change',
        details: {
          organizationId,
          memberId: member._id.toString(),
          fromRoleKey: previousRoleKey,
          toRoleKey: patch.roleKey,
        },
      });
    } else if (patch.companyRole !== undefined) {
      if (!INVITEABLE_ROLES.includes(patch.companyRole)) {
        throw new Error('Papel inválido');
      }
      if (requesterRole !== CompanyRole.OWNER && patch.companyRole === CompanyRole.ADMIN) {
        throw new Error('Apenas o dono pode promover a administrador');
      }
      member.companyRole = patch.companyRole;
      if (patch.customRoleId === null) member.customRoleId = undefined;
      else if (patch.customRoleId) {
        await this.assertCustomRoleExists(organizationId, patch.customRoleId);
        member.customRoleId = patch.customRoleId;
        member.companyRole = CompanyRole.CUSTOM;
      } else if (patch.companyRole !== CompanyRole.CUSTOM) {
        member.customRoleId = undefined;
      }
    }

    if (patch.whatsappPhone !== undefined) {
      throw new Error(
        'WhatsApp só é salvo após verificação por código enviado ao número informado. Use a verificação na equipe ou em Meu perfil.',
      );
    }

    await member.save();
    return member;
  }

  /** Atualiza e-mail do usuário e sincroniza registros OWNER na equipe. */
  async linkAccountEmail(userId: string, email: string): Promise<{ email: string }> {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) throw new Error('E-mail inválido');

    const conflictUser = await User.findOne({ email: normalized, _id: { $ne: userId } });
    if (conflictUser) throw new Error('Este e-mail já está em uso por outra conta');

    const user = await User.findById(userId);
    if (!user) throw new Error('Usuário não encontrado');

    user.email = normalized;
    await user.save();
    await this.syncOwnerMemberEmailForUser(user);
    await this.linkAllPendingInvitesForUser(user, normalized);

    logger.info('E-mail da conta vinculado', { userId, email: normalized });
    return { email: normalized };
  }

  async syncOwnerMemberEmailForUser(user: IUser): Promise<void> {
    const email = user.email?.trim().toLowerCase();
    if (!email) return;

    const ownerMembers = await CompanyMember.find({
      userId: user._id,
      companyRole: CompanyRole.OWNER,
      isActive: true,
    });

    for (const ownerMember of ownerMembers) {
      const conflict = await CompanyMember.findOne({
        organizationId: ownerMember.organizationId,
        email,
        isActive: true,
        companyRole: { $ne: CompanyRole.OWNER },
      });
      if (conflict) {
        throw new Error('Este e-mail já pertence a outro membro da equipe');
      }

      await CompanyMember.updateMany(
        {
          organizationId: ownerMember.organizationId,
          email,
          companyRole: { $ne: CompanyRole.OWNER },
        },
        { $unset: { email: '' } },
      );

      ownerMember.email = email;
      await ownerMember.save();
    }
  }

  async linkGoogleToUser(userId: string, profile: GoogleProfile): Promise<IUser> {
    const byGoogle = await User.findOne({ googleId: profile.sub });
    if (byGoogle && byGoogle._id.toString() !== userId) {
      throw new Error('Esta conta Google já está vinculada a outro usuário');
    }

    const email = profile.email?.toLowerCase().trim();
    if (email) {
      const byEmail = await User.findOne({ email, _id: { $ne: userId } });
      if (byEmail) throw new Error('Este e-mail Google já está em uso por outra conta');
    }

    const user = await User.findById(userId);
    if (!user) throw new Error('Usuário não encontrado');

    this.applyGoogleProfileToUser(user, profile);
    await user.save();
    await this.syncOwnerMemberEmailForUser(user);
    if (email) await this.linkAllPendingInvitesForUser(user, email);

    logger.info('Google vinculado à conta', { userId, email });
    return user;
  }

  async linkDiscordToUser(
    userId: string,
    discordUser: { id: string; username?: string; global_name?: string | null; avatar?: string | null },
  ): Promise<IUser> {
    const existing = await User.findOne({ discordUserId: discordUser.id });
    if (existing && existing._id.toString() !== userId) {
      throw new Error('Esta conta Discord já está vinculada a outro usuário');
    }

    const user = await User.findById(userId);
    if (!user) throw new Error('Usuário não encontrado');

    user.discordUserId = discordUser.id;
    if (!user.authProviders.includes('discord')) user.authProviders.push('discord');

    const panelName =
      (discordUser.global_name as string | null)?.trim() ||
      (discordUser.username as string | undefined)?.trim();
    if (panelName) user.displayName = panelName;

    await user.save();
    logger.info('Discord vinculado à conta', { userId, discordUserId: discordUser.id });
    return user;
  }

  async inviteMember(
    organizationId: string,
    email: string,
    roleKey: string,
    invitedByUserId: string,
    options?: { extraCapabilities?: Capability[]; deniedCapabilities?: Capability[] },
  ): Promise<{
    member: ICompanyMember;
    inviteEmail: InviteEmailDeliveryResult;
    linkedAccount: boolean;
  }> {
    const { companyRole: role, customRoleId } = this.parseMemberRoleSelection(roleKey);
    if (customRoleId) {
      await this.assertCustomRoleExists(organizationId, customRoleId);
    }
    const normalized = email.trim().toLowerCase();
    const orgOid = new mongoose.Types.ObjectId(organizationId);

    const org = await Organization.findById(organizationId).select('ownerUserId').lean();
    if (org) {
      const ownerUser = await User.findById(org.ownerUserId).select('email').lean();
      if (ownerUser?.email?.toLowerCase() === normalized) {
        throw new Error(
          'Este e-mail é o seu (dono). Vincule em Configurações → Conta — não envie convite.',
        );
      }
      const existingUser = await User.findOne({ email: normalized }).select('_id').lean();
      if (existingUser && existingUser._id.toString() === org.ownerUserId.toString()) {
        throw new Error(
          'Este e-mail é o seu (dono). Vincule em Configurações → Conta — não envie convite.',
        );
      }
    }

    const registeredUser = await User.findOne({ email: normalized }).select('_id').lean();

    const applyInviteFields = (member: ICompanyMember): void => {
      member.isActive = true;
      member.companyRole = role;
      member.customRoleId = customRoleId;
      member.extraCapabilities = options?.extraCapabilities ?? [];
      member.deniedCapabilities = options?.deniedCapabilities ?? [];
      member.invitedByUserId = new mongoose.Types.ObjectId(invitedByUserId);
      member.email = normalized;
      member.emailVerifiedAt = undefined;
      if (registeredUser) {
        member.userId = registeredUser._id as mongoose.Types.ObjectId;
      }
    };

    const existingByEmail = await CompanyMember.findOne({ organizationId: orgOid, email: normalized });
    if (existingByEmail) {
      if (existingByEmail.companyRole === CompanyRole.OWNER) {
        throw new Error('Este e-mail pertence ao dono da empresa');
      }
      if (existingByEmail.isActive && existingByEmail.userId) {
        throw new Error('Este e-mail já está na equipe');
      }
      const addsSeat = !existingByEmail.isActive;
      await assertCanAssignTeamRole(organizationId, {
        companyRole: role,
        customRoleId,
        excludeMemberId: addsSeat ? undefined : existingByEmail._id.toString(),
        addsUserSeat: addsSeat,
      });
      applyInviteFields(existingByEmail);
      const saved = await existingByEmail.save();
      const inviteEmail = await this.deliverMemberInviteEmail(
        organizationId,
        saved,
        invitedByUserId,
      );
      await writeAuditLog({
        action: 'team:member:invite',
        actorUserId: invitedByUserId,
        details: {
          organizationId,
          memberId: saved._id.toString(),
          email: normalized,
          roleKey,
          reactivated: true,
        },
      });
      return { member: saved, inviteEmail, linkedAccount: Boolean(registeredUser) };
    }

    if (registeredUser) {
      const existingByUser = await CompanyMember.findOne({
        organizationId: orgOid,
        userId: registeredUser._id,
      });
      if (existingByUser) {
        if (existingByUser.companyRole === CompanyRole.OWNER) {
          throw new Error('Este e-mail pertence ao dono da empresa');
        }
        if (existingByUser.isActive) {
          throw new Error('Este e-mail já está na equipe');
        }
        await assertCanAssignTeamRole(organizationId, {
          companyRole: role,
          customRoleId,
          addsUserSeat: true,
        });
        applyInviteFields(existingByUser);
        const saved = await existingByUser.save();
        const inviteEmail = await this.deliverMemberInviteEmail(
          organizationId,
          saved,
          invitedByUserId,
        );
        await writeAuditLog({
          action: 'team:member:invite',
          actorUserId: invitedByUserId,
          details: {
            organizationId,
            memberId: saved._id.toString(),
            email: normalized,
            roleKey,
            reactivated: true,
          },
        });
        return { member: saved, inviteEmail, linkedAccount: true };
      }
    }

    try {
      await assertCanAssignTeamRole(organizationId, {
        companyRole: role,
        customRoleId,
      });
      const payload: Record<string, unknown> = {
        organizationId: orgOid,
        email: normalized,
        companyRole: role,
        customRoleId,
        extraCapabilities: options?.extraCapabilities ?? [],
        deniedCapabilities: options?.deniedCapabilities ?? [],
        invitedByUserId: new mongoose.Types.ObjectId(invitedByUserId),
        isActive: true,
      };
      if (registeredUser) payload.userId = registeredUser._id;

      const created = await CompanyMember.create(payload);
      const inviteEmail = await this.deliverMemberInviteEmail(
        organizationId,
        created,
        invitedByUserId,
      );
      await writeAuditLog({
        action: 'team:member:invite',
        actorUserId: invitedByUserId,
        details: {
          organizationId,
          memberId: created._id.toString(),
          email: normalized,
          roleKey,
        },
      });
      return { member: created, inviteEmail, linkedAccount: Boolean(registeredUser) };
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('E11000')) {
        if (msg.includes('email')) {
          throw new Error('Este e-mail já está cadastrado nesta empresa');
        }
        if (msg.includes('userId')) {
          throw new Error('Este usuário já faz parte desta empresa');
        }
        throw new Error('Este e-mail já está na equipe desta empresa');
      }
      throw err;
    }
  }

  async resendMemberInvite(
    organizationId: string,
    memberId: string,
    requesterUserId: string,
  ): Promise<{ member: ICompanyMember; inviteEmail: InviteEmailDeliveryResult }> {
    const member = await CompanyMember.findOne({
      _id: memberId,
      organizationId,
      isActive: true,
    });
    if (!member) throw new Error('Membro não encontrado');
    if (member.companyRole === CompanyRole.OWNER) {
      throw new Error('Não é possível reenviar convite ao dono');
    }
    if (member.userId) {
      throw new Error('Este membro já aceitou o convite');
    }
    if (!member.email?.trim()) {
      throw new Error('Membro sem e-mail para convite');
    }
    const inviteEmail = await this.deliverMemberInviteEmail(
      organizationId,
      member,
      requesterUserId,
    );
    return { member, inviteEmail };
  }

  private async deliverMemberInviteEmail(
    organizationId: string,
    member: ICompanyMember,
    invitedByUserId: string,
  ): Promise<InviteEmailDeliveryResult> {
    const email = member.email?.trim().toLowerCase();
    if (!email) {
      return { sent: false, transport: 'none', error: 'Membro sem e-mail' };
    }

    const org = await Organization.findById(organizationId).select('name customRoles').lean();
    if (!org) {
      return { sent: false, transport: 'none', error: 'Organização não encontrada' };
    }

    const inviter = await User.findById(invitedByUserId).select('displayName email').lean();
    const inviterName =
      inviter?.displayName?.trim() ||
      inviter?.email?.split('@')[0] ||
      'Um administrador';

    const customRoleName = member.customRoleId
      ? (org.customRoles as OrgCustomRole[] | undefined)?.find(r => r.id === member.customRoleId)
          ?.name
      : undefined;

    const loginUrl = `${config.DASHBOARD.FRONTEND_URL}/auth/google`;
    const { subject, text, html } = buildTeamInviteEmail({
      organizationName: org.name?.trim() || 'sua empresa',
      inviteeEmail: email,
      roleLabel: resolveInviteRoleLabel(member.companyRole, customRoleName),
      inviterName,
      loginUrl,
    });

    const result = await EmailService.getInstance().send({
      to: email,
      subject,
      text,
      html,
    });

    if (result.ok) {
      member.inviteEmailSentAt = new Date();
      member.inviteEmailLastError = undefined;
    } else {
      member.inviteEmailLastError = result.error?.slice(0, 240);
    }
    await member.save();

    return {
      sent: result.ok,
      transport: result.transport,
      error: result.error,
    };
  }

  async removeMember(
    organizationId: string,
    memberId: string,
    requester: { companyRole: CompanyRole; capabilities: Capability[] },
  ): Promise<void> {
    const canRemove =
      requester.companyRole === CompanyRole.OWNER ||
      requester.capabilities.includes(Cap.COMPANY_MEMBERS_REMOVE);
    if (!canRemove) {
      throw new Error('Sem permissão para remover membros da equipe');
    }
    const member = await CompanyMember.findOne({ _id: memberId, organizationId });
    if (!member) throw new Error('Membro não encontrado');
    if (member.companyRole === CompanyRole.OWNER) {
      throw new Error('Não é possível remover o dono');
    }
    member.isActive = false;
    await member.save();
    await writeAuditLog({
      action: 'team:member:remove',
      details: {
        organizationId,
        memberId: member._id.toString(),
        companyRole: member.companyRole,
      },
    });
  }
}
