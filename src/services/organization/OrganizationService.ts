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

  /** Tenant id usado em clientId (Destination, WhatsApp, etc.) */
  async resolveClientId(userId: string): Promise<string> {
    const member = await CompanyMember.findActiveByUserId(userId);
    if (member) return member.organizationId.toString();

    const user = await User.findById(userId);
    if (!user) throw new Error('Usuário não encontrado');

    const org = await this.ensureOrganization(user);
    return org._id.toString();
  }

  async getOrganizationForUser(userId: string): Promise<IOrganization | null> {
    const clientId = await this.resolveClientId(userId);
    return Organization.findById(clientId);
  }

  async getMemberRole(userId: string): Promise<CompanyRole | null> {
    const member = await CompanyMember.findActiveByUserId(userId);
    return member?.companyRole ?? null;
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
    let user = await User.findOne({ googleId: profile.sub });
    if (!user && profile.email) {
      user = await User.findOne({ email: profile.email.toLowerCase() });
    }

    if (user) {
      if (!user.googleId) {
        user.googleId = profile.sub;
        if (!user.authProviders.includes('google')) user.authProviders.push('google');
        if (profile.email && !user.email) user.email = profile.email.toLowerCase();
        if (profile.name && !user.displayName) user.displayName = profile.name;
        await user.save();
      }
      const pending = profile.email
        ? await CompanyMember.findOne({
            email: profile.email.toLowerCase(),
            userId: { $exists: false },
            isActive: true,
          })
        : null;
      if (pending && !await CompanyMember.findActiveByUserId(user._id as mongoose.Types.ObjectId)) {
        pending.userId = user._id as mongoose.Types.ObjectId;
        await pending.save();
      }
      const org = await this.ensureOrganization(user);
      return { user, org };
    }

    const userId = new mongoose.Types.ObjectId();
    user = await User.create({
      _id: userId,
      googleId: profile.sub,
      email: profile.email?.toLowerCase(),
      displayName: profile.name ?? profile.email,
      authProviders: ['google'],
      plan: 'free',
    });

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
      email: profile.email?.toLowerCase(),
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

  async listMembers(organizationId: string): Promise<ICompanyMember[]> {
    return CompanyMember.findByOrg(organizationId);
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
