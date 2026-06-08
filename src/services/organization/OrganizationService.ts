import mongoose from 'mongoose';
import { User, IUser } from '@/models/User';
import { Organization, IOrganization } from '@/models/Organization';
import { CompanyMember, ICompanyMember } from '@/models/CompanyMember';
import { CompanyRole } from '@/auth/rbac/roles';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('OrganizationService');

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
      m => m.companyRole === CompanyRole.ADMIN || m.companyRole === CompanyRole.ATTENDANT,
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
      companyRole: { $in: [CompanyRole.ADMIN, CompanyRole.ATTENDANT] },
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
      companyRole: { $in: [CompanyRole.ADMIN, CompanyRole.ATTENDANT] },
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

  async listMembersEnriched(organizationId: string) {
    const members = await this.listMembers(organizationId);
    const userIds = members.map(m => m.userId).filter(Boolean) as mongoose.Types.ObjectId[];
    const users = await User.find({ _id: { $in: userIds } }).select('email displayName').lean();
    const userMap = new Map(users.map(u => [String(u._id), u]));

    return members.map(m => {
      const u = m.userId ? userMap.get(String(m.userId)) : undefined;
      const displayEmail =
        m.email?.trim() ||
        u?.email?.trim() ||
        u?.displayName?.trim() ||
        (m.companyRole === CompanyRole.OWNER ? 'Dono da conta' : undefined);
      return {
        ...m.toObject(),
        displayEmail: displayEmail ?? '—',
        linked: Boolean(m.userId),
      };
    });
  }

  async inviteMember(
    organizationId: string,
    email: string,
    role: CompanyRole,
    invitedByUserId: string,
  ): Promise<ICompanyMember> {
    if (role === CompanyRole.OWNER) {
      throw new Error('Não é possível convidar outro dono');
    }
    const normalized = email.trim().toLowerCase();
    const dup = await CompanyMember.findOne({
      organizationId,
      email: normalized,
      isActive: true,
    });
    if (dup) throw new Error('Este e-mail já está na equipe');

    const user = await User.findOne({ email: normalized });
    return CompanyMember.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      userId: user?._id,
      email: normalized,
      companyRole: role,
      invitedByUserId: new mongoose.Types.ObjectId(invitedByUserId),
      isActive: true,
    });
  }

  async removeMember(organizationId: string, memberId: string, requesterRole: CompanyRole): Promise<void> {
    if (requesterRole !== CompanyRole.OWNER) {
      throw new Error('Apenas o dono da empresa pode remover membros');
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
