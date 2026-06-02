import { Capability } from './capabilities';
import { GuildRole, SystemRole, UserRole } from './roles';

export interface GuildAccess {
  guildId: string;
  guildName?: string;
  roleInGuild: GuildRole;
  effectiveRole: UserRole;
  apiAccessEnabled: boolean;
}

export interface AuthContext {
  userId: string;
  clientId: string;
  discordUserId: string;
  username: string;
  avatar: string | null;
  plan: string;
  systemRole: SystemRole;
  /** Papel efetivo global (maior privilégio) */
  primaryRole: UserRole;
  capabilities: Capability[];
  guilds: GuildAccess[];
  isInternalStaff: boolean;
}

export interface AuthContextOptions {
  guildId?: string;
}
