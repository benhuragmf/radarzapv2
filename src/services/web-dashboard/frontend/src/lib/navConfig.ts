import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Smartphone, Hash, Users, BookOpen, FileText,
  ListOrdered, ScrollText, Send, Crown, Settings, Shield, Server, History,
  CreditCard, Key, Activity, Calendar, Webhook, FileCode, Gauge, Zap, Phone,
} from 'lucide-react'
import type { AuthUser } from './auth'
import { can } from './auth'

export type NavLink = {
  kind: 'link'
  id: string
  label: string
  icon: LucideIcon
  to: string
  permission?: string
  requiresGuild?: boolean
}

export type NavEntry =
  | { kind: 'section'; id: string; label: string; hint?: string }
  | NavLink
  | {
      kind: 'group'
      id: string
      label: string
      icon: LucideIcon
      permission?: string
      children: NavLink[]
    }

function link(
  id: string,
  label: string,
  icon: LucideIcon,
  to: string,
  permission?: string,
  requiresGuild = false,
): NavLink {
  return { kind: 'link', id, label, icon, to, permission, requiresGuild }
}

function section(id: string, label: string, hint?: string): NavEntry {
  return { kind: 'section', id, label, hint }
}

function group(
  id: string,
  label: string,
  icon: LucideIcon,
  children: NavLink[],
  permission?: string,
): NavEntry {
  return { kind: 'group', id, label, icon, permission, children }
}

/** WhatsApp, envio manual, API — tudo que não é Discord */
export const PLATFORM_TOOLS_NAV: NavEntry[] = [
  link('wa', 'Conexão WhatsApp', Smartphone, '/sessions', 'whatsapp:session:view'),
  group('grp-send', 'Enviar mensagens', Send, [
    link('send-now', 'Enviar agora', Send, '/send', 'send:test'),
    link('send-sched', 'Agendamentos', Calendar, '/send/agendamentos', 'send:schedule:manage'),
    link('send-history', 'Histórico', History, '/send/historico', 'send:test'),
  ]),
  group('grp-wa-dest', 'Destinos WhatsApp', Users, [
    link('wa-contacts', 'Contatos', Phone, '/destinations', 'send:destination:manage'),
    link('wa-groups', 'Grupos', Users, '/grupos', 'send:destination:manage'),
  ], 'send:destination:manage'),
  group('grp-api', 'Integrações', Key, [
    link('api-keys', 'Chaves de API', Key, '/settings#api-chaves', 'api:key:create'),
    link('api-webhooks', 'Webhooks', Webhook, '/settings#api-webhooks', 'api:key:create'),
    link('api-docs', 'Documentação', FileCode, '/settings#api-docs', 'api:logs:view'),
    link('api-play', 'Playground', Zap, '/send#playground', 'send:test'),
    link('api-rate', 'Rate Limit', Gauge, '/settings#api-rate', 'api:logs:view'),
  ], 'api:key:create'),
]

/** Usuário sem Discord — só painel + API */
export const USER_PLATFORM_NAV: NavEntry[] = [
  link('home', 'Dashboard', LayoutDashboard, '/dashboard', 'dashboard:view'),
  ...PLATFORM_TOOLS_NAV,
  group('grp-account', 'Conta', Settings, [
    link('plans', 'Planos', Crown, '/plans', 'billing:view'),
    link('settings', 'Configurações', Settings, '/settings', 'account:settings'),
  ]),
]

/** Dono/admin Discord — aba Plataforma */
export const CLIENT_PLATFORM_NAV: NavEntry[] = [
  link('home', 'Dashboard', LayoutDashboard, '/dashboard', 'dashboard:view'),
  ...PLATFORM_TOOLS_NAV,
  group('grp-account', 'Conta', Settings, [
    link('plans', 'Planos', Crown, '/plans', 'billing:view'),
    link('settings', 'Configurações', Settings, '/settings', 'account:settings'),
  ]),
]

/** Aba Discord — automação Discord → WhatsApp */
export const DISCORD_NAV: NavEntry[] = [
  section('sec-discord', 'Automação', 'Canais do Discord para o WhatsApp'),
  link('auto-ch', 'Canais', Hash, '/discord/channels', 'discord:channels:manage', true),
  link('auto-rules', 'Regras', BookOpen, '/discord/rules', 'send:rules:manage', true),
  link('auto-format', 'Formato no WhatsApp', FileText, '/discord/templates', 'send:templates:manage', true),
  group('grp-discord-dest', 'Destinos WhatsApp', Users, [
    link('d-contacts', 'Contatos', Phone, '/discord/destinations', 'send:destination:manage', true),
    link('d-groups', 'Grupos', Users, '/discord/grupos', 'send:destination:manage', true),
    link('d-hist', 'Histórico', History, '/discord/destinations/historico', 'send:destination:manage', true),
  ], 'send:destination:manage'),
  section('sec-watch', 'Monitoramento'),
  link('watch-queue', 'Fila', ListOrdered, '/discord/fila', 'queue:view', true),
  link('watch-logs', 'Logs', ScrollText, '/discord/logs', 'logs:view', true),
  section('sec-discord-account', 'Servidor'),
  link('discord-settings', 'Configurações', Settings, '/discord/settings', 'account:settings', true),
]

/** @deprecated use DISCORD_NAV */
export const SERVER_DISCORD_NAV = DISCORD_NAV

/** Admin — aba Plataforma com 3 grupos + ferramentas pessoais */
export const ADMIN_PLATFORM_NAV: NavEntry[] = [
  link('admin-dash', 'Dashboard global', LayoutDashboard, '/admin/dashboard', 'dashboard:global'),
  group('grp-gestao', 'Gestão', Users, [
    link('admin-clients', 'Clientes', Users, '/admin/clients', 'system:users:view'),
    link('admin-servers', 'Servidores', Server, '/admin/servers', 'system:servers:view'),
    link('admin-plans', 'Planos', Crown, '/admin/plans', 'system:plans:manage'),
    link('admin-payments', 'Pagamentos', CreditCard, '/admin/payments', 'system:payments:view'),
    link('admin-mod', 'Moderação', Shield, '/admin/moderation', 'system:moderation:action'),
    link('admin-audit', 'Auditoria', Activity, '/admin/audit', 'system:audit:view'),
  ]),
  group('grp-ops', 'Operação', ListOrdered, [
    link('admin-sessions', 'Sessões WhatsApp', Smartphone, '/admin/sessions', 'whatsapp:session:view'),
    link('admin-queue', 'Fila global', ListOrdered, '/admin/queue', 'queue:global'),
    link('admin-logs', 'Logs globais', ScrollText, '/admin/logs', 'logs:global'),
    link('admin-api', 'API global', Key, '/admin/api', 'api:global'),
  ]),
  group('grp-sys', 'Sistema', Settings, [
    link('admin-settings', 'Configurações', Settings, '/admin/settings', 'system:settings:manage'),
  ]),
  section('sec-my-platform', 'Minha plataforma', 'WhatsApp, envios e API'),
  ...PLATFORM_TOOLS_NAV,
]

export const MODERATOR_PLATFORM_NAV: NavEntry[] = [
  link('mod-dash', 'Dashboard suporte', LayoutDashboard, '/admin/dashboard', 'dashboard:global'),
  group('grp-mod-gestao', 'Gestão', Users, [
    link('mod-clients', 'Clientes', Users, '/admin/clients', 'system:users:view'),
    link('mod-servers', 'Servidores', Server, '/admin/servers', 'system:servers:view'),
  ]),
  group('grp-mod-ops', 'Operação', ListOrdered, [
    link('mod-sessions', 'Sessões WhatsApp', Smartphone, '/admin/sessions', 'whatsapp:session:view'),
    link('mod-queue', 'Fila', ListOrdered, '/admin/queue', 'queue:global'),
    link('mod-logs', 'Logs limitados', ScrollText, '/admin/logs', 'logs:limited'),
    link('mod-mod', 'Moderação', Shield, '/admin/moderation', 'system:moderation:action'),
    link('mod-audit', 'Auditoria', Activity, '/admin/audit', 'system:audit:limited'),
  ]),
  section('sec-my-platform', 'Minha plataforma'),
  ...PLATFORM_TOOLS_NAV,
]

const LEGACY_DISCORD_ROUTES = new Set([
  '/channels', '/rules', '/templates', '/queue', '/logs',
])

const PLATFORM_ROUTES = new Set([
  '/dashboard', '/sessions', '/destinations', '/grupos', '/send', '/send/agendamentos', '/send/historico', '/plans', '/settings',
])

export type NavMode = 'platform' | 'discord'

/** @deprecated use NavMode 'discord' */
export type ServerNavMode = NavMode

export function detectNavMode(pathname: string, hash = ''): NavMode {
  if (pathname === '/rules' && hash === '#agendamentos') return 'platform'
  if (pathname.startsWith('/discord') || LEGACY_DISCORD_ROUTES.has(pathname)) return 'discord'
  if (pathname === '/grupos') return 'platform'
  if (pathname.startsWith('/admin/')) return 'platform'
  if (PLATFORM_ROUTES.has(pathname)) return 'platform'
  return 'platform'
}

/** Pode usar aba Discord (tem servidor configurado) */
export function userHasDiscordMode(user: AuthUser): boolean {
  if (user.isInternalStaff) return true
  if (can(user, 'discord:channels:manage') || can(user, 'discord:server:view')) return true
  return user.guilds.some(g => g.role === 'OWNER' || g.role === 'ADMIN')
}

function linkAllowed(entry: NavLink, user: AuthUser | null): boolean {
  return !entry.permission || can(user, entry.permission)
}

function filterEntry(entry: NavEntry, user: AuthUser | null): NavEntry | null {
  if (entry.kind === 'section') return entry
  if (entry.kind === 'link') return linkAllowed(entry, user) ? entry : null
  if (entry.permission && !can(user, entry.permission)) return null
  const children = entry.children.filter(c => linkAllowed(c, user))
  return children.length ? { ...entry, children } : null
}

export function filterNavTree(items: NavEntry[], user: AuthUser | null): NavEntry[] {
  const out: NavEntry[] = []
  let pendingSection: NavEntry | null = null

  for (const entry of items) {
    const filtered = filterEntry(entry, user)
    if (!filtered) continue
    if (filtered.kind === 'section') {
      pendingSection = filtered
      continue
    }
    if (pendingSection) {
      out.push(pendingSection)
      pendingSection = null
    }
    out.push(filtered)
  }

  return out
}

export function navForPlatform(user: AuthUser): NavEntry[] {
  if (user.isInternalStaff) {
    const base =
      user.primaryRole === 'SYSTEM_MODERATOR' ? MODERATOR_PLATFORM_NAV : ADMIN_PLATFORM_NAV
    return filterNavTree(base, user)
  }
  if (userHasDiscordMode(user)) {
    return filterNavTree(CLIENT_PLATFORM_NAV, user)
  }
  return filterNavTree(USER_PLATFORM_NAV, user)
}

export function navForDiscord(user: AuthUser): NavEntry[] {
  if (!userHasDiscordMode(user)) return []
  return filterNavTree(
    [section('sec-discord-nav', 'Discord', 'Selecione o servidor acima'), ...DISCORD_NAV],
    user,
  )
}

/** @deprecated use navForDiscord */
export const navForServer = navForDiscord

export function navForUser(user: AuthUser, mode: NavMode): NavEntry[] {
  return mode === 'discord' ? navForDiscord(user) : navForPlatform(user)
}

/** @deprecated use userHasDiscordMode */
export const userHasServerMode = userHasDiscordMode

export function isNavItemActive(itemTo: string, pathname: string, hash: string): boolean {
  const hashIdx = itemTo.indexOf('#')
  const itemPath = hashIdx === -1 ? itemTo : itemTo.slice(0, hashIdx)
  const itemHash = hashIdx === -1 ? '' : itemTo.slice(hashIdx)
  if (pathname !== itemPath) return false
  if (itemHash) return hash === itemHash
  return !hash
}

export function isNavGroupActive(entry: Extract<NavEntry, { kind: 'group' }>, pathname: string, hash: string): boolean {
  return entry.children.some(c => isNavItemActive(c.to, pathname, hash))
}

/** Permissão mínima por rota */
export const ROUTE_PERMISSIONS: Record<string, string> = {
  '/dashboard': 'dashboard:view',
  '/sessions': 'whatsapp:session:view',
  '/channels': 'discord:channels:manage',
  '/discord/channels': 'discord:channels:manage',
  '/destinations': 'send:destination:manage',
  '/grupos': 'send:destination:manage',
  '/discord/destinations': 'send:destination:manage',
  '/discord/grupos': 'send:destination:manage',
  '/discord/destinations/historico': 'send:destination:manage',
  '/rules': 'send:rules:manage',
  '/discord/rules': 'send:rules:manage',
  '/templates': 'send:templates:manage',
  '/discord/templates': 'send:templates:manage',
  '/queue': 'queue:view',
  '/discord/fila': 'queue:view',
  '/logs': 'logs:view',
  '/discord/logs': 'logs:view',
  '/discord/settings': 'account:settings',
  '/send': 'send:test',
  '/send/agendamentos': 'send:schedule:manage',
  '/send/historico': 'send:test',
  '/plans': 'billing:view',
  '/settings': 'account:settings',
  '/admin/dashboard': 'dashboard:global',
  '/admin/clients': 'system:users:view',
  '/admin/servers': 'system:servers:view',
  '/admin/sessions': 'whatsapp:session:view',
  '/admin/queue': 'queue:global',
  '/admin/logs': 'logs:global',
  '/admin/plans': 'system:plans:manage',
  '/admin/payments': 'system:payments:view',
  '/admin/moderation': 'system:moderation:action',
  '/admin/audit': 'system:audit:view',
  '/admin/api': 'api:global',
  '/admin/settings': 'system:settings:manage',
}

export const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/sessions': 'Conexão WhatsApp',
  '/channels': 'Canais do Discord',
  '/discord/channels': 'Canais do Discord',
  '/destinations': 'Contatos WhatsApp',
  '/grupos': 'Grupos WhatsApp',
  '/discord/destinations': 'Contatos WhatsApp',
  '/discord/grupos': 'Grupos WhatsApp',
  '/discord/destinations/historico': 'Histórico de envios',
  '/rules': 'Regras',
  '/discord/rules': 'Regras e filtros',
  '/templates': 'Formato no WhatsApp',
  '/discord/templates': 'Formato no WhatsApp',
  '/queue': 'Fila',
  '/discord/fila': 'Fila Discord',
  '/logs': 'Logs',
  '/discord/logs': 'Logs Discord',
  '/discord/settings': 'Configurações do servidor',
  '/send': 'Enviar agora',
  '/send/agendamentos': 'Agendamentos',
  '/send/historico': 'Histórico de envios',
  '/plans': 'Planos',
  '/settings': 'Configurações',
  '/admin/dashboard': 'Dashboard global',
  '/admin/clients': 'Clientes',
  '/admin/servers': 'Servidores',
  '/admin/sessions': 'Sessões WhatsApp',
  '/admin/queue': 'Fila global',
  '/admin/logs': 'Logs globais',
  '/admin/plans': 'Planos',
  '/admin/payments': 'Pagamentos',
  '/admin/moderation': 'Moderação',
  '/admin/audit': 'Auditoria',
  '/admin/api': 'API global',
  '/admin/settings': 'Configurações do sistema',
}

const HASH_PAGE_TITLES: Record<string, string> = {
  '/rules#agendamentos': 'Agendamentos',
  '/settings#api-chaves': 'Chaves de API',
  '/settings#api-webhooks': 'Webhooks',
  '/settings#api-docs': 'Documentação API',
  '/settings#api-rate': 'Rate Limit',
  '/send#playground': 'Playground API',
  '/send#agendados': 'Agendamentos',
}

export function pageTitleFor(pathname: string, hash: string): string {
  const key = hash ? `${pathname}${hash}` : pathname
  return HASH_PAGE_TITLES[key] ?? PAGE_TITLES[pathname] ?? 'RadarZap'
}
