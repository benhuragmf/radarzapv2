import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Building2, ChevronDown, ChevronRight, Radio, Zap } from 'lucide-react'
import type { AuthUser } from '../../lib/auth'
import {
  detectNavMode,
  isNavGroupActive,
  isNavItemActive,
  navForUser,
  userHasDiscordMode,
  type NavEntry,
  type NavLink,
  type NavMode,
} from '../../lib/navConfig'
import type { NavAlertItem } from '../../lib/navAlerts'
import { useDiscordNavAlerts } from '../../lib/useDiscordNavAlerts'
import DiscordGuildPicker from '../discord/DiscordGuildPicker'
import type { Guild } from '../../lib/guild'

interface Props {
  user: AuthUser
  mode: NavMode
  onModeChange: (mode: NavMode) => void
  guild: Guild | null
  onGuildChange: (guild: Guild | null) => void
}

function NavAlertDot({ alert, active }: { alert: NavAlertItem; active: boolean }) {
  const isError = alert.severity === 'error'
  return (
    <span
      className={`shrink-0 w-2 h-2 rounded-full ${
        isError ? 'bg-red-500' : 'bg-amber-500'
      } ${active ? 'ring-2 ring-white/30' : ''}`}
      title={alert.summary}
      aria-label={alert.summary}
    />
  )
}

function NavLinkItem({
  entry,
  depth,
  guildReady,
  alert,
}: {
  entry: NavLink
  depth: number
  guildReady: boolean
  alert?: NavAlertItem
}) {
  const { pathname, hash, search } = useLocation()
  const blocked = entry.requiresGuild && !guildReady
  const to = entry.search ? `${entry.to}${entry.search}` : entry.to
  const active = isNavItemActive(entry.to, pathname, hash, search, entry.search)
  const Icon = entry.icon
  const pad = depth > 0 ? 'pl-9 pr-3' : 'px-3'

  if (blocked) {
    return (
      <div
        className={`flex items-center gap-3 ${pad} py-2 rounded-lg text-sm text-gray-600 cursor-not-allowed`}
        title="Selecione um servidor Discord acima"
      >
        <Icon size={16} className="shrink-0 opacity-40" />
        <span className="opacity-60">{entry.label}</span>
      </div>
    )
  }

  const alertRing =
    alert && !active
      ? alert.severity === 'error'
        ? 'ring-1 ring-red-500/40'
        : 'ring-1 ring-amber-500/40'
      : ''

  return (
    <Link
      to={to}
      title={alert?.summary}
      className={`flex items-center gap-3 ${pad} py-2 rounded-lg text-sm transition-colors ${alertRing} ${
        active
          ? 'bg-brand-600 text-white font-medium'
          : alert
            ? alert.severity === 'error'
              ? 'text-red-300 hover:text-white hover:bg-gray-800'
              : 'text-amber-200/90 hover:text-white hover:bg-gray-800'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      <Icon size={16} className="shrink-0" />
      <span className="flex-1 truncate">{entry.label}</span>
      {alert && <NavAlertDot alert={alert} active={active} />}
      {entry.badge && (
        <span
          className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium ${
            active ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-500'
          }`}
        >
          {entry.badge}
        </span>
      )}
    </Link>
  )
}

function NavGroupItem({
  entry,
  guildReady,
  navAlerts,
}: {
  entry: Extract<NavEntry, { kind: 'group' }>
  guildReady: boolean
  navAlerts?: Record<string, NavAlertItem>
}) {
  const { pathname, hash, search } = useLocation()
  const isActive = isNavGroupActive(entry, pathname, hash, search)
  const [open, setOpen] = useState(isActive)
  const Icon = entry.icon
  const childAlerts = entry.children
    .map(c => navAlerts?.[c.id])
    .filter((a): a is NavAlertItem => Boolean(a))
  const groupAlert = childAlerts.find(a => a.severity === 'error') ?? childAlerts[0]

  useEffect(() => {
    if (isActive) setOpen(true)
  }, [isActive, pathname, hash])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'text-brand-400 font-medium'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
      >
        <Icon size={16} className="shrink-0" />
        <span className="flex-1 text-left">{entry.label}</span>
        {groupAlert && <NavAlertDot alert={groupAlert} active={isActive} />}
        {open
          ? <ChevronDown size={14} className="shrink-0 opacity-60" />
          : <ChevronRight size={14} className="shrink-0 opacity-60" />}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {entry.children.map(child => (
            <NavLinkItem
              key={child.id}
              entry={child}
              depth={1}
              guildReady={guildReady}
              alert={navAlerts?.[child.id]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NavSection({ entry }: { entry: Extract<NavEntry, { kind: 'section' }> }) {
  return (
    <div className="px-3 pt-5 pb-1 first:pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {entry.label}
      </p>
      {entry.hint && (
        <p className="text-[10px] text-gray-600 mt-0.5 leading-snug">{entry.hint}</p>
      )}
    </div>
  )
}

function NavTree({
  entries,
  guildReady,
  navAlerts,
}: {
  entries: NavEntry[]
  guildReady: boolean
  navAlerts?: Record<string, NavAlertItem>
}) {
  return (
    <>
      {entries.map(entry => {
        if (entry.kind === 'section') {
          return <NavSection key={entry.id} entry={entry} />
        }
        if (entry.kind === 'group') {
          return (
            <NavGroupItem
              key={entry.id}
              entry={entry}
              guildReady={guildReady}
              navAlerts={navAlerts}
            />
          )
        }
        return (
          <NavLinkItem
            key={entry.id}
            entry={entry}
            depth={0}
            guildReady={guildReady}
            alert={navAlerts?.[entry.id]}
          />
        )
      })}
    </>
  )
}

export default function Sidebar({ user, mode, onModeChange, guild, onGuildChange }: Props) {
  const { pathname, hash } = useLocation()
  const guildReady = Boolean(guild?.id)
  const navGuildReady = mode !== 'discord' || guildReady
  const showToggle = userHasDiscordMode(user)
  const nav = navForUser(user, mode)
  const { data: navAlertsData } = useDiscordNavAlerts(
    guild?.id,
    mode === 'discord' && guildReady,
  )
  const navAlerts = mode === 'discord' ? navAlertsData?.items : undefined

  useEffect(() => {
    if (showToggle) onModeChange(detectNavMode(pathname, hash))
  }, [pathname, hash, showToggle, onModeChange])

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
        <Zap className="text-brand-500" size={22} />
        <div className="min-w-0">
          <span className="font-bold text-lg tracking-tight block">RadarZap</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">
            {user.isInternalStaff ? 'Administrador' : user.primaryRole.replace('_', ' ')}
          </span>
        </div>
      </div>

      {showToggle && (
        <div className="px-3 pt-3 pb-1 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => onModeChange('platform')}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
              mode === 'platform'
                ? 'bg-brand-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <Building2 size={13} />
            Plataforma
          </button>
          <button
            type="button"
            onClick={() => onModeChange('discord')}
            className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
              mode === 'discord'
                ? 'bg-brand-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <Radio size={13} />
            Discord
          </button>
        </div>
      )}

      {showToggle && mode === 'discord' && (
        <DiscordGuildPicker user={user} selected={guild} onChange={onGuildChange} />
      )}

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {!navGuildReady && mode === 'discord' && (
          <p className="px-3 py-2 text-[11px] text-amber-500/90 leading-snug">
            Escolha o servidor para liberar o menu de automação.
          </p>
        )}
        <NavTree entries={nav} guildReady={navGuildReady} navAlerts={navAlerts} />
      </nav>

      <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-600">
        v2.0 · {user.plan}
      </div>
    </aside>
  )
}
