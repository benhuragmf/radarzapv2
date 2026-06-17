import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Smartphone, Hash, Users, BookOpen, FileText,
  ListOrdered, ScrollText, Send, Crown, Settings, Shield, Server, History,
  CreditCard, Key, Activity, Calendar, Webhook, FileCode, Gauge, Zap, Phone,
  Megaphone, Upload, ShieldCheck, UserX, Ban, Repeat, Workflow,
  UserCog, Lock, Database, Building2, Circle, MessageSquare, Bot, Eye, BarChart3, Ticket, Clock, Sparkles, Globe,
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

/** Menu Plataforma — uso diário do cliente (tenant). Staff vê o mesmo menu nesta aba. */
export const TENANT_PLATFORM_NAV: NavEntry[] = [
  section('sec-inicio', 'Início'),
  link('dash-visao', 'Visão geral', LayoutDashboard, '/dashboard', 'dashboard:view'),
  link('plat-reports', 'Relatórios', ScrollText, '/platform/reports', 'platform:reports:view'),
  link('plat-audit', 'Auditoria', ShieldCheck, '/platform/audit', 'platform:audit:view'),

  section('sec-msg', 'Mensagens'),
  group('grp-msg', 'Mensagens', Send, [
    link('send-now', 'Enviar agora', Send, '/send', 'send:test'),
    link('wa-stories', 'Publicar status', Circle, '/platform/wa-stories', 'send:test'),
    link('send-campaigns', 'Campanhas', Megaphone, '/platform/campanhas', 'send:test'),
    link('send-sched', 'Agendamentos', Calendar, '/send/agendamentos', 'send:schedule:manage'),
    link('send-history', 'Histórico de envios', History, '/send/historico', 'send:test'),
    link('plat-templates', 'Modelos', FileText, '/platform/templates', 'send:templates:manage'),
  ]),

  section('sec-atendimento', 'Atendimento'),
  link('inbox', 'Inbox', MessageSquare, '/platform/inbox', 'inbox:view'),
  link('inbox-tickets', 'Tickets', Ticket, '/platform/inbox/tickets', 'inbox:view'),
  link('inbox-sectors', 'Setores do Inbox', Building2, '/platform/inbox/setores', 'inbox:department:manage'),
  link('inbox-bot', 'Bot do Inbox', Bot, '/platform/inbox/bot', 'inbox:department:manage'),
  link('inbox-ai', 'IA Atendimento', Sparkles, '/platform/inbox/ia', 'inbox:ai:manage'),
  link('inbox-quick-replies', 'Respostas rápidas', Zap, '/platform/inbox/respostas', 'inbox:department:manage'),
  link('inbox-supervisor', 'Supervisor', Eye, '/platform/inbox/supervisor', 'inbox:supervise'),
  link('inbox-reports', 'Relatórios Inbox', BarChart3, '/platform/inbox/relatorios', 'inbox:reports:view'),
  link('webchat', 'Site — histórico', Globe, '/platform/webchat', 'webchat:view'),

  section('sec-contatos', 'Contatos'),
  group('grp-contatos', 'Contatos', Users, [
    link('wa-contacts', 'Contatos', Phone, '/contact', 'consent:view'),
    link('wa-segments', 'Segmentos / Listas', ListOrdered, '/platform/segmentos', 'send:destination:manage'),
    link('wa-groups', 'Grupos WhatsApp', Users, '/grupos', 'send:destination:manage'),
    link('wa-import', 'Importar / Exportar', Upload, '/platform/contacts', 'send:destination:manage'),
  ], 'consent:view'),
  group('grp-consent', 'Consentimento', ShieldCheck, [
    link('consent-pending', 'Pendentes', ShieldCheck, '/contact', 'consent:view', false, {
      search: '?consent=pending',
    }),
    link('consent-waiting', 'Aguardando aprovação', Clock, '/contact', 'consent:approve-renewal', false, {
      search: '?consent=waiting',
    }),
    link('consent-accepted', 'Aceitos', ShieldCheck, '/contact', 'consent:view', false, {
      search: '?consent=accepted',
    }),
    link('consent-refused', 'Recusados', UserX, '/contact', 'consent:view', false, {
      search: '?consent=refused',
    }),
    link('consent-blocked', 'Bloqueados', Ban, '/contact', 'consent:view', false, {
      search: '?consent=blocked',
    }),
  ], 'consent:view'),

  section('sec-auto', 'Automações'),
  group('grp-auto', 'Automações', Repeat, [
    link('auto-rules', 'Regras automáticas', Workflow, '/platform/automacoes', 'send:schedule:manage'),
    link('auto-sched', 'Agend. automação', Calendar, '/send/autoagendamentos', 'send:schedule:manage'),
    link('auto-triggers', 'Gatilhos', Zap, '/platform/gatilhos', 'send:schedule:manage'),
  ]),

  section('sec-wa', 'WhatsApp'),
  group('grp-wa', 'WhatsApp', Smartphone, [
    link('wa-sessions', 'Sessões e QR Code', Smartphone, '/sessions', 'whatsapp:session:view'),
    link('wa-status', 'Status das conexões', Activity, '/platform/wa-status', 'whatsapp:session:view'),
    link('wa-queue', 'Fila de envio', ListOrdered, '/platform/fila', 'queue:view'),
    link('wa-logs', 'Logs', ScrollText, '/platform/wa-logs', 'logs:view'),
  ], 'whatsapp:session:view'),

  section('sec-api', 'Integrações'),
  group('grp-api', 'Integrações', Key, [
    link('api-keys', 'Chaves de API', Key, '/settings#api-chaves', 'api:key:create'),
    link('api-webhooks', 'Webhooks', Webhook, '/settings#api-webhooks', 'api:key:create'),
    link('api-play', 'Playground', Zap, '/integrations/playground', 'send:test'),
    link('api-docs', 'Documentação', FileCode, '/settings#api-docs', 'api:logs:view'),
    link('api-rate', 'Limites da API', Gauge, '/settings#api-rate', 'billing:view'),
  ]),

  section('sec-empresa', 'Empresa'),
  group('grp-empresa', 'Empresa', Building2, [
    link('empresa-home', 'Minha empresa', Settings, '/settings', 'account:settings'),
    link('empresa-team', 'Equipe e cargos', UserCog, '/settings/team', 'company:members:manage'),
    link('empresa-plans', 'Plano e limites', Crown, '/plans', 'billing:view'),
    link('empresa-perms', 'Permissões', Lock, '/settings/permissions', 'company:members:manage'),
    link('empresa-security', 'Segurança', Shield, '/settings/security', 'account:settings'),
    link('empresa-backup', 'Backup', Database, '/settings/backup', 'account:settings'),
  ]),
]

/** Admin RadarZap — somente staff interno (aba separada). */
export const ADMIN_RADARZAP_NAV: NavEntry[] = [
  section('sec-admin-inicio', 'Início'),
  link('admin-dash', 'Dashboard global', LayoutDashboard, '/admin/dashboard', 'dashboard:global'),

  section('sec-admin-ops', 'Operação'),
  group('grp-ops', 'Operação', ListOrdered, [
    link('admin-sessions', 'Sessões WhatsApp', Smartphone, '/admin/sessions', 'whatsapp:session:view'),
    link('admin-queue', 'Fila global', ListOrdered, '/admin/queue', 'queue:global'),
    link('admin-logs', 'Logs globais', ScrollText, '/admin/logs', 'logs:global'),
    link('ops-monitor', 'Monitoramento', Activity, '/admin/monitoring', 'logs:global'),
    link('ops-errors', 'Erros do sistema', Ban, '/admin/errors', 'logs:global'),
    link('admin-api', 'API global', Key, '/admin/api', 'api:global'),
  ]),

  section('sec-admin-gestao', 'Clientes e planos'),
  group('grp-gestao', 'Clientes e planos', Users, [
    link('admin-clients', 'Clientes', Users, '/admin/clients', 'system:users:view'),
    link('admin-servers', 'Servidores', Server, '/admin/servers', 'system:servers:view'),
    link('admin-plans', 'Planos', Crown, '/admin/plans', 'system:plans:manage'),
    link('admin-payments', 'Pagamentos', CreditCard, '/admin/payments', 'system:payments:view'),
    link('admin-mod', 'Moderação', Shield, '/admin/moderation', 'system:moderation:action'),
  ]),

  section('sec-admin-sys', 'Sistema'),
  group('grp-sys', 'Sistema', Settings, [
    link('admin-settings', 'Configurações gerais', Settings, '/admin/settings', 'system:settings:manage'),
    link('admin-ai-blueprint', 'Blueprint IA', Sparkles, '/admin/ai-blueprint', 'system:settings:manage'),
    link('admin-perms', 'Permissões', Lock, '/admin/permissions', 'system:settings:manage'),
    link('admin-security', 'Segurança', Shield, '/admin/security', 'system:settings:manage'),
    link('admin-backup', 'Backup', Database, '/admin/backup', 'system:settings:manage'),
    link('admin-audit', 'Auditoria', Activity, '/admin/audit', 'system:audit:view'),
  ]),
]

export const MODERATOR_ADMIN_NAV: NavEntry[] = [
  section('sec-admin-inicio', 'Início'),
  link('mod-dash', 'Dashboard global', LayoutDashboard, '/admin/dashboard', 'dashboard:global'),
  section('sec-admin-ops', 'Operação'),
  group('grp-mod-ops', 'Operação', ListOrdered, [
    link('mod-sessions', 'Sessões WhatsApp', Smartphone, '/admin/sessions', 'whatsapp:session:view'),
    link('mod-queue', 'Fila global', ListOrdered, '/admin/queue', 'queue:global'),
    link('mod-logs', 'Logs limitados', ScrollText, '/admin/logs', 'logs:limited'),
    link('mod-mod', 'Moderação', Shield, '/admin/moderation', 'system:moderation:action'),
    link('mod-audit', 'Auditoria', Activity, '/admin/audit', 'system:audit:limited'),
  ]),
  section('sec-admin-gestao', 'Clientes e planos'),
  group('grp-mod-gestao', 'Clientes e planos', Users, [
    link('mod-clients', 'Clientes', Users, '/admin/clients', 'system:users:view'),
    link('mod-servers', 'Servidores', Server, '/admin/servers', 'system:servers:view'),
  ]),
]

export const USER_PLATFORM_NAV: NavEntry[] = TENANT_PLATFORM_NAV
export const CLIENT_PLATFORM_NAV: NavEntry[] = TENANT_PLATFORM_NAV

/** @deprecated */
export const PLATFORM_AREA_NAV: NavEntry[] = []
export const PLATFORM_TOOLS_NAV: NavEntry[] = []

/** Aba Discord — automação Discord → WhatsApp */
export const DISCORD_NAV: NavEntry[] = [
  section('sec-discord-inicio', 'Início Discord'),
  link('discord-home', 'Início Discord', LayoutDashboard, '/discord', 'discord:channels:manage', true),

  section('sec-discord-auto', 'Automação Discord'),
  link('auto-ch', 'Canais monitorados', Hash, '/discord/channels', 'discord:channels:manage', true),
  link('auto-rules', 'Regras e filtros', BookOpen, '/discord/rules', 'send:rules:manage', true),
  link('auto-format', 'Formato da mensagem', FileText, '/discord/templates', 'send:templates:manage', true),

  section('sec-discord-dest', 'Destinos WhatsApp'),
  group('grp-discord-dest', 'Destinos WhatsApp', Users, [
    link('d-contacts', 'Contatos', Phone, '/discord/contact', 'consent:view', true),
    link('d-groups', 'Grupos WhatsApp', Users, '/discord/grupos', 'send:destination:manage', true),
  ], 'send:destination:manage'),

  section('sec-discord-watch', 'Monitoramento'),
  group('grp-discord-watch', 'Monitoramento', ListOrdered, [
    link('watch-queue', 'Fila', ListOrdered, '/discord/fila', 'queue:view', true),
    link('d-hist', 'Histórico', History, '/discord/contact/historico', 'send:destination:manage', true),
    link('watch-logs', 'Logs', ScrollText, '/discord/logs', 'logs:view', true),
  ], 'queue:view'),

  section('sec-discord-account', 'Servidor'),
  link('discord-settings', 'Configurações do servidor', Settings, '/discord/settings', 'account:settings', true),
]

export const SERVER_DISCORD_NAV = DISCORD_NAV

const LEGACY_DISCORD_ROUTES = new Set([
  '/channels', '/rules', '/templates', '/queue', '/logs',
])

const PLATFORM_ROUTES = new Set([
  '/dashboard', '/platform', '/platform/templates', '/platform/reports', '/platform/contacts',
  '/platform/audit', '/platform/campanhas', '/platform/segmentos', '/platform/gatilhos',
  '/platform/wa-logs', '/platform/wa-stories', '/platform/wa-status', '/platform/fila',
  '/integrations/playground',
  '/sessions', '/contact', '/destinations', '/grupos', '/send', '/send/agendamentos', '/send/autoagendamentos', '/platform/automacoes',
  '/send/historico', '/plans', '/settings', '/settings/team', '/settings/permissions', '/settings/security', '/settings/backup',
  '/em-breve',
])

export type NavMode = 'platform' | 'discord' | 'admin'
export type ServerNavMode = NavMode

export function detectNavMode(pathname: string, hash = ''): NavMode {
  if (pathname === '/rules' && hash === '#agendamentos') return 'platform'
  if (pathname.startsWith('/admin/')) return 'admin'
  if (pathname === '/discord' || pathname.startsWith('/discord/') || LEGACY_DISCORD_ROUTES.has(pathname)) {
    return 'discord'
  }
  if (pathname.startsWith('/em-breve')) return 'platform'
  if (PLATFORM_ROUTES.has(pathname) || pathname.startsWith('/platform')) return 'platform'
  return 'platform'
}

export function userHasDiscordMode(user: AuthUser): boolean {
  if (user.isInternalStaff) return true
  return user.hasDiscordAccess === true
}

export function userHasAdminMode(user: AuthUser): boolean {
  return user.isInternalStaff === true
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

/** Menu tenant — igual para cliente e staff na aba Plataforma. */
export function navForPlatform(user: AuthUser): NavEntry[] {
  return filterNavTree(TENANT_PLATFORM_NAV, user)
}

export function navForAdmin(user: AuthUser): NavEntry[] {
  if (!user.isInternalStaff) return []
  const base =
    user.primaryRole === 'SYSTEM_MODERATOR' ? MODERATOR_ADMIN_NAV : ADMIN_RADARZAP_NAV
  return filterNavTree(base, user)
}

export function navForDiscord(user: AuthUser): NavEntry[] {
  if (!userHasDiscordMode(user)) return []
  return filterNavTree(DISCORD_NAV, user)
}

export const navForServer = navForDiscord

export function navForUser(user: AuthUser, mode: NavMode): NavEntry[] {
  if (mode === 'admin') return navForAdmin(user)
  if (mode === 'discord') return navForDiscord(user)
  return navForPlatform(user)
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
  '/platform/reports': 'platform:reports:view',
  '/platform/audit': 'platform:audit:view',
  '/platform/campanhas': 'send:test',
  '/platform/segmentos': 'send:destination:manage',
  '/platform/gatilhos': 'send:schedule:manage',
  '/platform/wa-logs': 'logs:view',
  '/platform/wa-stories': 'send:test',
  '/platform/wa-status': 'whatsapp:session:view',
  '/platform/fila': 'queue:view',
  '/platform/inbox': 'inbox:view',
  '/platform/inbox/tickets': 'inbox:view',
  '/platform/inbox/setores': 'inbox:department:manage',
  '/platform/inbox/bot': 'inbox:department:manage',
  '/platform/inbox/ia': 'inbox:ai:manage',
  '/platform/inbox/respostas': 'inbox:department:manage',
  '/platform/inbox/supervisor': 'inbox:supervise',
  '/platform/inbox/relatorios': 'inbox:reports:view',
  '/platform/webchat': 'webchat:view',
  '/platform/contacts': 'consent:view',
  '/integrations/playground': 'send:test',
  '/sessions': 'whatsapp:session:view',
  '/channels': 'discord:channels:manage',
  '/discord': 'discord:channels:manage',
  '/discord/channels': 'discord:channels:manage',
  '/contact': 'consent:view',
  '/destinations': 'consent:view',
  '/grupos': 'send:destination:manage',
  '/discord/contact': 'consent:view',
  '/discord/destinations': 'consent:view',
  '/discord/grupos': 'send:destination:manage',
  '/discord/contact/historico': 'send:destination:manage',
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
  '/send/autoagendamentos': 'send:schedule:manage',
  '/platform/automacoes': 'send:schedule:manage',
  '/send/historico': 'send:test',
  '/plans': 'billing:view',
  '/settings': 'account:settings',
  '/settings/team': 'company:members:manage',
  '/settings/permissions': 'company:members:manage',
  '/settings/security': 'account:settings',
  '/settings/backup': 'account:settings',
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
  '/admin/monitoring': 'logs:global',
  '/admin/errors': 'logs:global',
  '/admin/api': 'api:global',
  '/admin/settings': 'system:settings:manage',
  '/admin/ai-blueprint': 'system:settings:manage',
  '/admin/permissions': 'system:settings:manage',
  '/admin/security': 'system:settings:manage',
  '/admin/backup': 'system:settings:manage',
}

export const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Visão geral',
  '/platform': 'Visão geral',
  '/platform/templates': 'Modelos',
  '/platform/reports': 'Relatórios',
  '/platform/audit': 'Auditoria',
  '/platform/campanhas': 'Campanhas',
  '/platform/segmentos': 'Segmentos / Listas',
  '/platform/gatilhos': 'Gatilhos',
  '/platform/wa-logs': 'Logs',
  '/platform/wa-stories': 'Publicar status WhatsApp',
  '/platform/wa-status': 'Status das conexões',
  '/platform/fila': 'Fila de envio',
  '/platform/inbox': 'Inbox',
  '/platform/inbox/tickets': 'Tickets de atendimento',
  '/platform/inbox/setores': 'Setores do Inbox',
  '/platform/inbox/bot': 'Bot do Inbox',
  '/platform/inbox/ia': 'IA Atendimento',
  '/platform/inbox/respostas': 'Respostas rápidas',
  '/platform/inbox/supervisor': 'Supervisor',
  '/platform/inbox/relatorios': 'Relatórios de atendimento',
  '/platform/webchat': 'Site — histórico',
  '/platform/contacts': 'Importar / Exportar',
  '/integrations/playground': 'Playground',
  '/sessions': 'Sessões e QR Code',
  '/channels': 'Canais monitorados',
  '/discord': 'Início Discord',
  '/discord/channels': 'Canais monitorados',
  '/contact': 'Contatos',
  '/destinations': 'Contatos',
  '/grupos': 'Grupos WhatsApp',
  '/discord/contact': 'Contatos',
  '/discord/destinations': 'Contatos',
  '/discord/grupos': 'Grupos WhatsApp',
  '/discord/contact/historico': 'Histórico',
  '/discord/destinations/historico': 'Histórico',
  '/rules': 'Regras e filtros',
  '/discord/rules': 'Regras e filtros',
  '/templates': 'Formato da mensagem',
  '/discord/templates': 'Formato da mensagem',
  '/queue': 'Fila',
  '/discord/fila': 'Fila',
  '/logs': 'Logs',
  '/discord/logs': 'Logs',
  '/discord/settings': 'Configurações do servidor',
  '/send': 'Enviar agora',
  '/send/agendamentos': 'Agendamentos',
  '/send/autoagendamentos': 'Agend. automação',
  '/platform/automacoes': 'Regras automáticas',
  '/send/historico': 'Histórico de envios',
  '/plans': 'Plano e limites',
  '/settings': 'Minha empresa',
  '/settings/team': 'Equipe e cargos',
  '/settings/permissions': 'Permissões',
  '/settings/security': 'Segurança',
  '/settings/backup': 'Backup',
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
  '/admin/monitoring': 'Monitoramento',
  '/admin/errors': 'Erros do sistema',
  '/admin/api': 'API global',
  '/admin/settings': 'Configurações gerais',
  '/admin/ai-blueprint': 'Blueprint IA',
  '/admin/permissions': 'Permissões',
  '/admin/security': 'Segurança',
  '/admin/backup': 'Backup',
}

const HASH_PAGE_TITLES: Record<string, string> = {
  '/rules#agendamentos': 'Agendamentos',
  '/settings#api-chaves': 'Chaves de API',
  '/settings#api-webhooks': 'Webhooks',
  '/settings#api-docs': 'Documentação',
  '/settings#api-rate': 'Limites da API',
  '/send#playground': 'Playground',
  '/send#agendados': 'Agendamentos',
}

const CONSENT_PAGE_TITLES: Record<string, string> = {
  '?consent=pending': 'Pendentes',
  '?consent=waiting': 'Aguardando aprovação',
  '?consent=accepted': 'Aceitos',
  '?consent=refused': 'Recusados',
  '?consent=blocked': 'Bloqueados',
}

export function pageTitleFor(pathname: string, hash: string, search = ''): string {
  if ((pathname === '/contact' || pathname === '/destinations') && search) {
    return CONSENT_PAGE_TITLES[search] ?? PAGE_TITLES[pathname] ?? 'Contatos'
  }
  const key = hash ? `${pathname}${hash}` : pathname
  return HASH_PAGE_TITLES[key] ?? PAGE_TITLES[pathname] ?? 'RadarZap'
}
