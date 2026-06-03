export type UserRole =
  | 'USER'
  | 'DISCORD_OWNER'
  | 'DISCORD_ADMIN'
  | 'DISCORD_ATTENDANT'
  | 'SYSTEM_MODERATOR'
  | 'SYSTEM_ADMIN'

export type CompanyRole = 'OWNER' | 'ADMIN' | 'ATTENDANT'

export interface GuildAccess {
  id: string
  name?: string
  role: string
  effectiveRole: UserRole
  apiAccessEnabled: boolean
}

export interface AuthUser {
  userId: string
  discordId: string | null
  username: string
  avatar: string | null
  email: string | null
  authProvider: 'google' | 'discord' | null
  plan: string
  systemRole: string
  primaryRole: UserRole
  companyRole: CompanyRole | null
  organizationId: string | null
  organizationName: string | null
  hasDiscordAccess: boolean
  capabilities: string[]
  guilds: GuildAccess[]
  isInternalStaff: boolean
  menuType: 'admin' | 'client'
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/auth/me', { credentials: 'include' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export function loginWithDiscord() {
  window.location.href = '/auth/discord'
}

export function loginWithGoogle() {
  window.location.href = '/auth/google'
}

export async function logout() {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
  window.location.href = '/'
}

export function can(user: AuthUser | null, permission: string, guildId?: string): boolean {
  if (!user) return false
  if (user.primaryRole === 'SYSTEM_ADMIN') return true
  if (!user.capabilities.includes(permission)) return false

  const discordScoped = permission.startsWith('discord:')
  if (discordScoped && !user.hasDiscordAccess) return false

  const serverScoped =
    permission.startsWith('discord:') ||
    permission.startsWith('send:') ||
    permission.startsWith('whatsapp:') ||
    permission === 'queue:view' ||
    permission === 'queue:retry' ||
    permission === 'logs:view'

  if (serverScoped && guildId) {
    return user.guilds.some(
      g =>
        g.id === guildId &&
        (g.role === 'OWNER' || g.role === 'ADMIN' || g.role === 'MEMBER'),
    )
  }

  if (permission.startsWith('company:') && user.companyRole !== 'OWNER') {
    return false
  }

  return true
}

export function hasRole(user: AuthUser | null, role: UserRole): boolean {
  if (!user) return false
  if (user.primaryRole === 'SYSTEM_ADMIN') return true
  return user.primaryRole === role
}

export function isCompanyOwner(user: AuthUser | null): boolean {
  return user?.companyRole === 'OWNER'
}
