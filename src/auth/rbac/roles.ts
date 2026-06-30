/** Papéis globais do sistema (equipe interna Radar Chat) */
export enum SystemRole {
  USER = 'USER',
  SYSTEM_MODERATOR = 'SYSTEM_MODERATOR',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

/** Papel do usuário dentro da empresa (tenant) */
export enum CompanyRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  ATTENDANT = 'ATTENDANT',
  INTEGRATION = 'INTEGRATION',
  /** Papel base mínimo — dono define todas as permissões manualmente */
  CUSTOM = 'CUSTOM',
}

/** Papel do usuário dentro de um servidor Discord */
export enum GuildRole {
  MEMBER = 'MEMBER',
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
}

/** Papel efetivo usado na UI e autorização */
export enum UserRole {
  USER = 'USER',
  DISCORD_OWNER = 'DISCORD_OWNER',
  DISCORD_ADMIN = 'DISCORD_ADMIN',
  DISCORD_ATTENDANT = 'DISCORD_ATTENDANT',
  SYSTEM_MODERATOR = 'SYSTEM_MODERATOR',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

export function guildRoleToUserRole(guildRole: GuildRole): UserRole {
  switch (guildRole) {
    case GuildRole.OWNER:
      return UserRole.DISCORD_OWNER;
    case GuildRole.ADMIN:
      return UserRole.DISCORD_ADMIN;
    case GuildRole.MEMBER:
      return UserRole.DISCORD_ATTENDANT;
    default:
      return UserRole.USER;
  }
}
