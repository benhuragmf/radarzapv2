import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Smartphone, Hash, Users, BookOpen, FileText,
  ListOrdered, ScrollText, Send, Crown, Settings, Shield, Server,
  CreditCard, Key, Activity, QrCode, MonitorSmartphone, Webhook,
  Lock, Calendar, History, FileCode, Gauge,
} from 'lucide-react'
import type { AuthUser } from './auth'
import { can } from './auth'

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  to?: string
  permission?: string
  children?: NavItem[]
}

function item(id: string, label: string, icon: LucideIcon, to?: string, permission?: string): NavItem {
  return { id, label, icon, to, permission }
}

function group(id: string, label: string, icon: LucideIcon, children: NavItem[], permission?: string): NavItem {
  return { id, label, icon, permission, children }
}

/** Menu Cliente — usuários Discord / donos / admins */
export const CLIENT_NAV: NavItem[] = [
  item('dashboard', 'Dashboard', LayoutDashboard, '/dashboard', 'dashboard:view'),
  group('whatsapp', 'WhatsApp', Smartphone, [
    item('wa-sessions', 'Sessões', Smartphone, '/sessions', 'whatsapp:session:view'),
    item('wa-qr', 'QR Code', QrCode, '/sessions', 'whatsapp:session:manage'),
    item('wa-devices', 'Dispositivos', MonitorSmartphone, '/sessions', 'whatsapp:session:view'),
  ], 'whatsapp:session:view'),
  group('discord', 'Discord', Hash, [
    item('dc-channels', 'Canais', Hash, '/channels', 'discord:channels:manage'),
    item('dc-webhooks', 'Webhooks', Webhook, '/channels', 'discord:webhooks:manage'),
    item('dc-perms', 'Permissões', Lock, '/settings', 'discord:members:manage'),
  ], 'discord:server:view'),
  group('envios', 'Envios', Send, [
    item('send-dest', 'Destinos', Users, '/destinations', 'send:destination:manage'),
    item('send-rules', 'Regras', BookOpen, '/rules', 'send:rules:manage'),
    item('send-tpl', 'Templates', FileText, '/templates', 'send:templates:manage'),
    item('send-sched', 'Agendamentos', Calendar, '/rules', 'send:schedule:manage'),
    item('send-test', 'Teste de Envio', Send, '/test-send', 'send:test'),
    item('send-hist', 'Histórico', History, '/logs', 'logs:view'),
  ]),
  item('queue', 'Fila', ListOrdered, '/queue', 'queue:view'),
  item('logs', 'Logs do Servidor', ScrollText, '/logs', 'logs:view'),
  group('api', 'API', Key, [
    item('api-keys', 'Chaves de API', Key, '/settings', 'api:key:create'),
    item('api-webhooks', 'Webhooks', Webhook, '/settings', 'api:key:create'),
    item('api-docs', 'Documentação', FileCode, '/settings', 'api:logs:view'),
    item('api-play', 'Playground', Send, '/test-send', 'send:test'),
    item('api-rate', 'Rate Limit', Gauge, '/settings', 'api:logs:view'),
  ], 'api:key:create'),
  item('plans', 'Planos', Crown, '/plans', 'billing:view'),
  item('settings', 'Configurações', Settings, '/settings', 'account:settings'),
]

/** Menu Admin — equipe interna RadarZap */
export const ADMIN_NAV: NavItem[] = [
  item('admin-dash', 'Dashboard Global', LayoutDashboard, '/admin/dashboard', 'dashboard:global'),
  group('gestao', 'Gestão', Users, [
    item('admin-clients', 'Clientes', Users, '/admin/clients', 'system:users:view'),
    item('admin-servers', 'Servidores', Server, '/admin/servers', 'system:servers:view'),
    item('admin-plans', 'Planos', Crown, '/admin/plans', 'system:plans:manage'),
    item('admin-payments', 'Pagamentos', CreditCard, '/admin/payments', 'system:payments:view'),
    item('admin-mod', 'Moderação', Shield, '/admin/moderation', 'system:moderation:action'),
    item('admin-audit', 'Auditoria', Activity, '/admin/audit', 'system:audit:view'),
  ]),
  group('whatsapp', 'WhatsApp', Smartphone, [
    item('admin-sessions', 'Sessões WhatsApp', Smartphone, '/admin/sessions', 'whatsapp:session:view'),
  ]),
  group('discord', 'Discord', Hash, [
    item('admin-dc-ch', 'Canais', Hash, '/channels', 'discord:channels:manage'),
    item('admin-dc-wh', 'Webhooks', Webhook, '/channels', 'discord:webhooks:manage'),
  ], 'discord:server:view'),
  group('envios', 'Envios', Send, [
    item('admin-send-dest', 'Destinos', Users, '/destinations', 'send:destination:manage'),
    item('admin-send-rules', 'Regras', BookOpen, '/rules', 'send:rules:manage'),
    item('admin-send-tpl', 'Templates', FileText, '/templates', 'send:templates:manage'),
    item('admin-send-test', 'Teste de Envio', Send, '/test-send', 'send:test'),
  ]),
  group('operacao', 'Operação', ListOrdered, [
    item('admin-queue', 'Fila Global', ListOrdered, '/admin/queue', 'queue:global'),
    item('admin-logs', 'Logs Globais', ScrollText, '/admin/logs', 'logs:global'),
  ]),
  group('sistema', 'Sistema', Settings, [
    item('admin-api', 'API Global', Key, '/admin/api', 'api:global'),
    item('admin-settings', 'Configurações', Settings, '/admin/settings', 'system:settings:manage'),
  ]),
]

/** Menu Moderador — suporte interno */
export const MODERATOR_NAV: NavItem[] = [
  item('mod-dash', 'Dashboard Suporte', LayoutDashboard, '/admin/dashboard', 'dashboard:global'),
  group('mod-gestao', 'Gestão', Users, [
    item('mod-clients', 'Clientes', Users, '/admin/clients', 'system:users:view'),
    item('mod-servers', 'Servidores', Server, '/admin/servers', 'system:servers:view'),
  ]),
  group('mod-ops', 'Operação', ListOrdered, [
    item('mod-sessions', 'Sessões', Smartphone, '/admin/sessions', 'whatsapp:session:view'),
    item('mod-queue', 'Fila', ListOrdered, '/admin/queue', 'queue:global'),
    item('mod-logs', 'Logs Limitados', ScrollText, '/admin/logs', 'logs:limited'),
    item('mod-mod', 'Moderação', Shield, '/admin/moderation', 'system:moderation:action'),
    item('mod-audit', 'Auditoria Limitada', Activity, '/admin/audit', 'system:audit:limited'),
  ]),
]

function itemAllowed(entry: NavItem, user: AuthUser | null): boolean {
  if (entry.children?.length) {
    return entry.children.some(child => itemAllowed(child, user))
  }
  return !entry.permission || can(user, entry.permission)
}

export function filterNav(items: NavItem[], user: AuthUser | null): NavItem[] {
  return items
    .filter(entry => itemAllowed(entry, user))
    .map(entry => {
      if (!entry.children?.length) return entry
      return { ...entry, children: filterNav(entry.children, user) }
    })
}

export function navForUser(user: AuthUser): NavItem[] {
  if (user.menuType === 'admin' && user.isInternalStaff) {
    if (user.primaryRole === 'SYSTEM_MODERATOR') {
      return filterNav(MODERATOR_NAV, user)
    }
    return filterNav(ADMIN_NAV, user)
  }
  return filterNav(CLIENT_NAV, user)
}

/** Permissão mínima por rota */
export const ROUTE_PERMISSIONS: Record<string, string> = {
  '/dashboard': 'dashboard:view',
  '/sessions': 'whatsapp:session:view',
  '/channels': 'discord:channels:manage',
  '/destinations': 'send:destination:manage',
  '/rules': 'send:rules:manage',
  '/templates': 'send:templates:manage',
  '/queue': 'queue:view',
  '/logs': 'logs:view',
  '/test-send': 'send:test',
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

/** Coleta rotas filhas para destacar grupo ativo */
export function collectRoutes(entry: NavItem): string[] {
  if (entry.to) return [entry.to]
  return (entry.children ?? []).flatMap(collectRoutes)
}
