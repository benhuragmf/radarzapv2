import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Smartphone, Hash, Users, BookOpen, FileText,
  ListOrdered, ScrollText, Send, Crown, Settings, Shield, Server, History,
  CreditCard, Key, Activity, Calendar, Webhook, FileCode, Gauge, Zap, Phone,
  Megaphone, Upload, ShieldCheck, UserX, Ban, Repeat, Workflow, QrCode,
  UserCog, Lock, Database, Building2,
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
  /** Ex.: ?consent=pending — destaca item em /destinations */
  search?: string
  badge?: string
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
  opts?: { search?: string; badge?: string },
): NavLink {
  return {
    kind: 'link',
    id,
    label,
    icon,
    to,
    permission,
    requiresGuild,
    search: opts?.search,
    badge: opts?.badge,
  }
}

function soon(id: string, label: string, icon: LucideIcon, slug: string, permission = 'dashboard:view'): NavLink {
  return link(id, label, icon, `/em-breve/${slug}`, permission, false, { badge: 'Em breve' })
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

/**
 * Menu Plataforma (tenant) — hierarquia oficial RadarZap.
 * Itens "Em breve" → /em-breve/:slug. Gestão/admin no final (ADMIN_PLATFORM_NAV).
 */
export const TENANT_PLATFORM_NAV: NavEntry[] = [
  section('sec-1', 'Dashboard', 'Resumo da sua conta'),
  link('dash-overview', 'Visão geral', LayoutDashboard, '/dashboard', 'dashboard:view'),
  link('plat-overview', 'Plataforma', Activity, '/platform', 'dashboard:view'),
  link('plat-reports', 'Relatórios', ScrollText, '/platform/reports', 'logs:view'),
  soon('plat-audit', 'Auditoria resumida', ShieldCheck, 'auditoria-resumida', 'logs:view'),

  section('sec-2', 'Mensagens', 'Envio manual e modelos'),
  group('grp-msg', 'Mensagens', Send, [
    link('send-now', 'Enviar agora', Send, '/send', 'send:test'),
    soon('send-campaigns', 'Campanhas', Megaphone, 'campanhas', 'send:test'),
    link('send-sched', 'Agendamentos', Calendar, '/send/agendamentos', 'send:schedule:manage'),
    link('send-history', 'Histórico de envios', History, '/send/historico', 'send:test'),
    link('plat-templates', 'Modelos de mensagem', FileText, '/platform/templates', 'send:templates:manage'),
  ]),

  section('sec-3', 'Contatos e destinos', 'WhatsApp e consentimento LGPD'),
  group('grp-dest', 'Contatos e destinos', Users, [
    link('wa-contacts', 'Contatos', Phone, '/destinations', 'consent:view'),
    link('wa-groups', 'Grupos', Users, '/grupos', 'send:destination:manage'),
    soon('wa-segments', 'Listas / Segmentos', ListOrdered, 'segmentos', 'send:destination:manage'),
    link('wa-import', 'Importar CSV / VCF', Upload, '/platform/contacts', 'send:destination:manage'),
  ], 'consent:view'),
  group('grp-consent', 'Consentimento', ShieldCheck, [
    link('consent-pending', 'Pendentes', ShieldCheck, '/destinations', 'consent:view', false, {
      search: '?consent=pending',
    }),
    link('consent-accepted', 'Aceitos', ShieldCheck, '/destinations', 'consent:view', false, {
      search: '?consent=accepted',
    }),
    link('consent-refused', 'Recusados', UserX, '/destinations', 'consent:view', false, {
      search: '?consent=refused',
    }),
    link('consent-blocked', 'Bloqueados manualmente', Ban, '/destinations', 'consent:view', false, {
      search: '?consent=blocked',
    }),
  ], 'consent:view'),

  section('sec-4', 'Automações', 'Regras recorrentes (gatilhos)'),
  group('grp-auto', 'Automações', Repeat, [
    link('auto-rules', 'Mensagens automáticas', Workflow, '/platform/automacoes', 'send:schedule:manage'),
    soon('auto-triggers', 'Gatilhos avançados', Zap, 'gatilhos', 'send:schedule:manage'),
  ]),

  section('sec-5', 'WhatsApp', 'Conexão e fila'),
  group('grp-wa', 'WhatsApp', Smartphone, [
    link('wa-connect', 'Conexões WhatsApp', Smartphone, '/sessions', 'whatsapp:session:view'),
    link('wa-sessions', 'Sessões WhatsApp', Smartphone, '/sessions', 'whatsapp:session:view'),
    link('wa-qr', 'QR Code', QrCode, '/sessions', 'whatsapp:session:view'),
    soon('wa-status', 'Status das conexões', Activity, 'wa-status', 'whatsapp:session:view'),
    link('wa-queue', 'Fila de envio', ListOrdered, '/admin/queue', 'queue:global'),
    soon('wa-logs', 'Logs WhatsApp', ScrollText, 'wa-logs', 'logs:view'),
  ], 'whatsapp:session:view'),

  section('sec-6', 'Integrações', 'API e webhooks'),
  group('grp-api', 'Integrações', Key, [
    link('api-keys', 'Chaves de API', Key, '/settings#api-chaves', 'api:key:create'),
    link('api-webhooks', 'Webhooks', Webhook, '/settings#api-webhooks', 'api:key:create'),
    link('api-play', 'Playground', Zap, '/send#playground', 'send:test'),
    link('api-docs', 'Documentação', FileCode, '/settings#api-docs', 'api:logs:view'),
    link('api-rate', 'Rate Limit', Gauge, '/settings#api-rate', 'api:logs:view'),
  ], 'api:key:create'),

  section('sec-empresa', 'Empresa', 'Dono: equipe, plano e configurações'),
  group('grp-empresa', 'Minha empresa', Building2, [
    link('empresa-team', 'Cargos e acessos', UserCog, '/settings/team', 'company:members:manage'),
    link('empresa-plans', 'Plano e limites', Crown, '/plans', 'billing:view'),
    link('empresa-settings', 'Configurações gerais', Settings, '/settings', 'account:settings'),
    soon('empresa-perms', 'Permissões', Lock, 'permissoes', 'company:members:manage'),
    soon('empresa-security', 'Segurança', Shield, 'seguranca', 'account:settings'),
    soon('empresa-backup', 'Backup', Database, 'backup', 'account:settings'),
  ]),
]

function buildAdminNav(): NavEntry[] {
  return [
    section('sec-admin-dash', 'Dashboard'),
    link('admin-dash', 'Dashboard global', LayoutDashboard, '/admin/dashboard', 'dashboard:global'),
    section('sec-1', 'Dashboard', 'Resumo do tenant ativo'),
    link('dash-overview', 'Visão geral', LayoutDashboard, '/dashboard', 'dashboard:view'),
    link('plat-overview', 'Plataforma', Activity, '/platform', 'dashboard:view'),
    link('plat-reports', 'Relatórios', ScrollText, '/platform/reports', 'logs:view'),
    soon('plat-audit', 'Auditoria resumida', ShieldCheck, 'auditoria-resumida', 'logs:view'),
    ...TENANT_PLATFORM_NAV.slice(4),
    section('sec-7', 'Operação', 'RadarZap interno'),
    group('grp-ops', 'Operação', ListOrdered, [
      link('admin-sessions', 'Sessões WhatsApp', Smartphone, '/admin/sessions', 'whatsapp:session:view'),
      link('admin-queue', 'Fila global', ListOrdered, '/admin/queue', 'queue:global'),
      link('admin-logs', 'Logs globais', ScrollText, '/admin/logs', 'logs:global'),
      link('admin-api', 'API global', Key, '/admin/api', 'api:global'),
      soon('ops-monitor', 'Monitoramento', Activity, 'monitoramento', 'logs:global'),
      soon('ops-errors', 'Erros do sistema', Ban, 'erros', 'logs:global'),
    ]),
    section('sec-8', 'Gestão', 'Por último — clientes e planos'),
    group('grp-gestao', 'Gestão', Users, [
      link('admin-clients', 'Clientes', Users, '/admin/clients', 'system:users:view'),
      link('admin-servers', 'Servidores', Server, '/admin/servers', 'system:servers:view'),
      link('admin-plans', 'Planos', Crown, '/admin/plans', 'system:plans:manage'),
      link('admin-payments', 'Pagamentos', CreditCard, '/admin/payments', 'system:payments:view'),
      link('admin-mod', 'Moderação', Shield, '/admin/moderation', 'system:moderation:action'),
      link('admin-audit', 'Auditoria', Activity, '/admin/audit', 'system:audit:view'),
    ]),
    section('sec-9', 'Sistema'),
    group('grp-sys', 'Sistema', Settings, [
      link('admin-settings', 'Configurações gerais', Settings, '/admin/settings', 'system:settings:manage'),
      soon('sys-perms', 'Permissões', Lock, 'permissoes', 'system:settings:manage'),
      soon('sys-security', 'Segurança', Shield, 'seguranca', 'system:settings:manage'),
      soon('sys-backup', 'Backup', Database, 'backup', 'system:settings:manage'),
    ]),
  ]
}

export const MODERATOR_PLATFORM_NAV: NavEntry[] = [
  link('mod-dash', 'Dashboard global', LayoutDashboard, '/admin/dashboard', 'dashboard:global'),
  ...TENANT_PLATFORM_NAV,
  section('sec-7', 'Operação'),
  group('grp-mod-ops', 'Operação', ListOrdered, [
    link('mod-sessions', 'Sessões WhatsApp', Smartphone, '/admin/sessions', 'whatsapp:session:view'),
    link('mod-queue', 'Fila global', ListOrdered, '/admin/queue', 'queue:global'),
    link('mod-logs', 'Logs limitados', ScrollText, '/admin/logs', 'logs:limited'),
    link('mod-mod', 'Moderação', Shield, '/admin/moderation', 'system:moderation:action'),
    link('mod-audit', 'Auditoria', Activity, '/admin/audit', 'system:audit:limited'),
  ]),
  section('sec-8', 'Gestão'),
  group('grp-mod-gestao', 'Gestão', Users, [
    link('mod-clients', 'Clientes', Users, '/admin/clients', 'system:users:view'),
    link('mod-servers', 'Servidores', Server, '/admin/servers', 'system:servers:view'),
  ]),
]

export const USER_PLATFORM_NAV: NavEntry[] = TENANT_PLATFORM_NAV

export const CLIENT_PLATFORM_NAV: NavEntry[] = TENANT_PLATFORM_NAV

/** @deprecated — mantido para imports antigos */
export const PLATFORM_AREA_NAV: NavEntry[] = []
export const PLATFORM_TOOLS_NAV: NavEntry[] = []

/** Aba Discord — automação Discord → WhatsApp */
export const DISCORD_NAV: NavEntry[] = [
  section('sec-discord', 'Automação Discord', 'Canais → WhatsApp'),
  link('auto-ch', 'Canais', Hash, '/discord/channels', 'discord:channels:manage', true),
  link('auto-rules', 'Regras e filtros', BookOpen, '/discord/rules', 'send:rules:manage', true),
  link('auto-format', 'Formato no WhatsApp', FileText, '/discord/templates', 'send:templates:manage', true),
  group('grp-discord-dest', 'Destinos WhatsApp', Users, [
    link('d-contacts', 'Contatos', Phone, '/discord/destinations', 'consent:view', true),
    link('d-groups', 'Grupos', Users, '/discord/grupos', 'send:destination:manage', true),
    link('d-hist', 'Histórico de envios', History, '/discord/destinations/historico', 'send:destination:manage', true),
  ], 'send:destination:manage'),
  section('sec-watch', 'Monitoramento'),
  link('watch-queue', 'Fila de envio', ListOrdered, '/discord/fila', 'queue:view', true),
  link('watch-logs', 'Logs', ScrollText, '/discord/logs', 'logs:view', true),
  section('sec-discord-account', 'Servidor'),
  link('discord-settings', 'Configurações', Settings, '/discord/settings', 'account:settings', true),
]

export const SERVER_DISCORD_NAV = DISCORD_NAV

const LEGACY_DISCORD_ROUTES = new Set([
  '/channels', '/rules', '/templates', '/queue', '/logs',
])

const PLATFORM_ROUTES = new Set([
  '/dashboard', '/platform', '/platform/templates', '/platform/reports', '/platform/contacts',
  '/sessions', '/destinations', '/grupos', '/send', '/send/agendamentos', '/platform/automacoes',
  '/send/historico', '/plans', '/settings', '/settings/team', '/em-breve',
])

export type NavMode = 'platform' | 'discord'
export type ServerNavMode = NavMode

export function detectNavMode(pathname: string, hash = ''): NavMode {
  if (pathname === '/rules' && hash === '#agendamentos') return 'platform'
  if (pathname.startsWith('/discord') || LEGACY_DISCORD_ROUTES.has(pathname)) return 'discord'
  if (pathname === '/grupos') return 'platform'
  if (pathname.startsWith('/admin/')) return 'platform'
  if (pathname.startsWith('/em-breve')) return 'platform'
  if (PLATFORM_ROUTES.has(pathname) || pathname.startsWith('/platform')) return 'platform'
  return 'platform'
}

export function userHasDiscordMode(user: AuthUser): boolean {
  if (user.isInternalStaff) return true
  return user.hasDiscordAccess === true
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
      user.primaryRole === 'SYSTEM_MODERATOR' ? MODERATOR_PLATFORM_NAV : buildAdminNav()
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

export const navForServer = navForDiscord

export function navForUser(user: AuthUser, mode: NavMode): NavEntry[] {
  return mode === 'discord' ? navForDiscord(user) : navForPlatform(user)
}

export const userHasServerMode = userHasDiscordMode

function splitNavTarget(itemTo: string): { path: string; search: string; hash: string } {
  const hashIdx = itemTo.indexOf('#')
  const beforeHash = hashIdx === -1 ? itemTo : itemTo.slice(0, hashIdx)
  const itemHash = hashIdx === -1 ? '' : itemTo.slice(hashIdx)
  const qIdx = beforeHash.indexOf('?')
  const path = qIdx === -1 ? beforeHash : beforeHash.slice(0, qIdx)
  const search = qIdx === -1 ? '' : beforeHash.slice(qIdx)
  return { path, search, hash: itemHash }
}

export function isNavItemActive(
  itemTo: string,
  pathname: string,
  hash: string,
  locationSearch = '',
  linkSearch?: string,
): boolean {
  const { path: itemPath, search: itemSearch, hash: itemHash } = splitNavTarget(itemTo)
  const search = linkSearch ?? itemSearch
  if (pathname !== itemPath) return false
  if (search) return locationSearch === search
  if (itemHash) return hash === itemHash
  if (locationSearch.startsWith('?consent=')) return false
  return !hash
}

export function isNavGroupActive(
  entry: Extract<NavEntry, { kind: 'group' }>,
  pathname: string,
  hash: string,
  locationSearch = '',
): boolean {
  return entry.children.some(c =>
    isNavItemActive(c.to, pathname, hash, locationSearch, c.search),
  )
}

export const ROUTE_PERMISSIONS: Record<string, string> = {
  '/dashboard': 'dashboard:view',
  '/platform': 'dashboard:view',
  '/platform/templates': 'send:templates:manage',
  '/platform/reports': 'logs:view',
  '/platform/contacts': 'consent:view',
  '/sessions': 'whatsapp:session:view',
  '/channels': 'discord:channels:manage',
  '/discord/channels': 'discord:channels:manage',
  '/destinations': 'consent:view',
  '/grupos': 'send:destination:manage',
  '/discord/destinations': 'consent:view',
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
  '/platform/automacoes': 'send:schedule:manage',
  '/send/historico': 'send:test',
  '/plans': 'billing:view',
  '/settings': 'account:settings',
  '/settings/team': 'company:members:manage',
  '/em-breve': 'dashboard:view',
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
  '/dashboard': 'Visão geral',
  '/platform': 'Plataforma',
  '/platform/templates': 'Modelos de mensagem',
  '/platform/reports': 'Relatórios',
  '/platform/contacts': 'Importar contatos',
  '/sessions': 'Conexões WhatsApp',
  '/channels': 'Canais do Discord',
  '/discord/channels': 'Canais do Discord',
  '/destinations': 'Contatos',
  '/grupos': 'Grupos WhatsApp',
  '/discord/destinations': 'Contatos WhatsApp',
  '/discord/grupos': 'Grupos WhatsApp',
  '/discord/destinations/historico': 'Histórico de envios',
  '/rules': 'Regras',
  '/discord/rules': 'Regras e filtros',
  '/templates': 'Formato no WhatsApp',
  '/discord/templates': 'Formato no WhatsApp',
  '/queue': 'Fila',
  '/discord/fila': 'Fila de envio',
  '/logs': 'Logs',
  '/discord/logs': 'Logs Discord',
  '/discord/settings': 'Configurações do servidor',
  '/send': 'Enviar agora',
  '/send/agendamentos': 'Agendamentos',
  '/platform/automacoes': 'Mensagens automáticas',
  '/send/historico': 'Histórico de envios',
  '/plans': 'Plano e limites',
  '/settings': 'Configurações gerais',
  '/settings/team': 'Cargos e acessos',
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

const CONSENT_PAGE_TITLES: Record<string, string> = {
  '?consent=pending': 'Consentimento — Pendentes',
  '?consent=accepted': 'Consentimento — Aceitos',
  '?consent=refused': 'Consentimento — Recusados',
  '?consent=blocked': 'Consentimento — Bloqueados',
}

export function pageTitleFor(pathname: string, hash: string, search = ''): string {
  if (pathname === '/destinations' && search) {
    return CONSENT_PAGE_TITLES[search] ?? PAGE_TITLES[pathname] ?? 'Contatos'
  }
  const key = hash ? `${pathname}${hash}` : pathname
  return HASH_PAGE_TITLES[key] ?? PAGE_TITLES[pathname] ?? 'RadarZap'
}
