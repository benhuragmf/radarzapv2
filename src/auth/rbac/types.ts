import { Capability } from './capabilities';
import { CompanyRole, GuildRole, SystemRole, UserRole } from './roles';

export interface GuildAccess {
  guildId: string;
  guildName?: string;
  roleInGuild: GuildRole;
  effectiveRole: UserRole;
  apiAccessEnabled: boolean;
}

export interface UserOrganizationSummary {
  organizationId: string;
  organizationName: string;
  companyRole: CompanyRole;
  ownerEmail: string | null;
  ownerName: string | null;
}

export interface AuthContext {
  userId: string;
  /** Tenant id (Organization._id) */
  clientId: string;
  organizationId: string | null;
  organizationName?: string;
  companyRole: CompanyRole | null;
  organizations: UserOrganizationSummary[];
  needsOrganizationChoice: boolean;
  discordUserId?: string;
  authProvider?: 'google' | 'discord';
  email?: string;
  username: string;
  avatar: string | null;
  plan: string;
  systemRole: SystemRole;
  primaryRole: UserRole;
  capabilities: Capability[];
  guilds: GuildAccess[];
  linkedGuildIds: string[];
  hasDiscordAccess: boolean;
  isInternalStaff: boolean;
}

export interface AuthContextOptions {
  guildId?: string;
}
