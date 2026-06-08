import mongoose from 'mongoose';
import { User, IUser } from '@/models/User';
import { Organization, IOrganization } from '@/models/Organization';
import { CompanyMember, ICompanyMember } from '@/models/CompanyMember';
import { CompanyRole } from '@/auth/rbac/roles';
import { Cap, type Capability } from '@/auth/rbac/capabilities';
import {
  assignableCapabilitiesForOrg,
  buildPresetsForOrg,
  INVITEABLE_ROLES,
  parseOrgRoleCapabilities,
  resolveMemberCapabilities,
} from '@/auth/rbac/companyRolePresets';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('OrganizationService');

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

  private async findInviteByEmail(email: string): Promise<ICompanyMember | null> {
    return CompanyMember.findOne({
      email: email.toLowerCase().trim(),
      isActive: true,
      companyRole: { $in: INVITED_MEMBER_ROLES },
    });
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
    const invite = email ? await this.findInviteByEmail(email) : null;

    let user = await User.findOne({ googleId: profile.sub });
    if (!user && email) {
      user = await User.findOne({ email });
    }

    if (user) {
      this.applyGoogleProfileToUser(user, profile);
      await user.save();

      if (invite) {
        const org = await this.joinOrganizationViaInvite(user, invite);
        logger.info('Google login via convite de equipe', {
          userId: user._id.toString(),
          email,
          organizationId: org._id.toString(),
          role: invite.companyRole,
        });
        return { user, org };
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

    if (invite) {
      const org = await this.joinOrganizationViaInvite(user, invite);
      logger.info('Novo usuário Google entrou por convite', {
        userId: userId.toString(),
        email,
        organizationId: org._id.toString(),
        role: invite.companyRole,
      });
      return { user, org };
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

  async getOrgRolePresets(organizationId: string) {
    const org = await Organization.findById(organizationId).select('linkedGuildIds roleCapabilities').lean();
    const hasDiscordIntegration = (org?.linkedGuildIds?.length ?? 0) > 0;
    const orgRoleCapabilities = parseOrgRoleCapabilities(org?.roleCapabilities);
    return {
      presets: buildPresetsForOrg(orgRoleCapabilities),
      hasDiscordIntegration,
      orgRoleCapabilities,
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

  async listMembersEnriched(organizationId: string) {
    const members = await this.listMembers(organizationId);
    const org = await Organization.findById(organizationId).select('roleCapabilities').lean();
    const orgRoleCapabilities = parseOrgRoleCapabilities(org?.roleCapabilities);
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
      );
      return {
        ...m.toObject(),
        displayEmail: displayEmail ?? '—',
        resolvedEmail,
        linked: Boolean(m.userId),
        effectiveCapabilities,
      };
    });
  }

  async updateMember(
    organizationId: string,
    memberId: string,
    requesterRole: CompanyRole,
    patch: {
      companyRole?: CompanyRole;
    },
  ): Promise<ICompanyMember> {
    const member = await CompanyMember.findOne({ _id: memberId, organizationId, isActive: true });
    if (!member) throw new Error('Membro não encontrado');
    if (member.companyRole === CompanyRole.OWNER) {
      throw new Error('Não é possível alterar o dono da empresa');
    }

    if (patch.companyRole !== undefined) {
      if (!INVITEABLE_ROLES.includes(patch.companyRole)) {
        throw new Error('Papel inválido');
      }
      if (requesterRole !== CompanyRole.OWNER && patch.companyRole === CompanyRole.ADMIN) {
        throw new Error('Apenas o dono pode promover a administrador');
      }
      member.companyRole = patch.companyRole;
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
    role: CompanyRole,
    invitedByUserId: string,
    options?: { extraCapabilities?: Capability[]; deniedCapabilities?: Capability[] },
  ): Promise<ICompanyMember> {
    if (!INVITEABLE_ROLES.includes(role)) {
      throw new Error('Papel inválido para convite');
    }
    const normalized = email.trim().toLowerCase();

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

    const existing = await CompanyMember.findOne({ organizationId, email: normalized });
    if (existing) {
      if (existing.companyRole === CompanyRole.OWNER) {
        throw new Error('Este e-mail pertence ao dono da empresa');
      }
      if (existing.isActive) {
        throw new Error('Este e-mail já está na equipe');
      }
      existing.isActive = true;
      existing.companyRole = role;
      existing.extraCapabilities = options?.extraCapabilities ?? [];
      existing.deniedCapabilities = options?.deniedCapabilities ?? [];
      existing.invitedByUserId = new mongoose.Types.ObjectId(invitedByUserId);
      const linked = await User.findOne({ email: normalized }).select('_id').lean();
      if (linked) existing.userId = linked._id as mongoose.Types.ObjectId;
      return existing.save();
    }

    const user = await User.findOne({ email: normalized });
    try {
      return await CompanyMember.create({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        userId: user?._id,
        email: normalized,
        companyRole: role,
        extraCapabilities: options?.extraCapabilities ?? [],
        deniedCapabilities: options?.deniedCapabilities ?? [],
        invitedByUserId: new mongoose.Types.ObjectId(invitedByUserId),
        isActive: true,
      });
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('E11000') && msg.includes('email')) {
        throw new Error('Este e-mail já está cadastrado nesta empresa');
      }
      throw err;
    }
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
  }
}
