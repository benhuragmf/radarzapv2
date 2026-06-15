import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Building2, ChevronDown, ChevronRight, Radio, Shield, Zap } from 'lucide-react'
import type { AuthUser } from '../../lib/auth'
import {
  detectNavMode,
  isNavGroupActive,
  isNavItemActive,
  navForUser,
  userHasAdminMode,
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
  mobileOpen?: boolean
  onMobileClose?: () => void
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
        className={`flex items-center gap-3 ${pad} py-2 rounded-lg text-sm text-[var(--rz-text-muted)] cursor-not-allowed`}
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
      className={`flex items-center gap-3 ${pad} py-2 touch-target-nav rounded-lg text-sm transition-colors active:scale-[0.98] ${alertRing} ${
        active
          ? 'rz-nav-item-active'
          : alert
            ? alert.severity === 'error'
              ? 'rz-nav-item text-red-300 hover:text-white'
              : 'rz-nav-item text-amber-200/90 hover:text-white'
            : 'rz-nav-item'
      }`}
    >
      <Icon size={16} className="shrink-0" />
      <span className="flex-1 truncate">{entry.label}</span>
      {alert && <NavAlertDot alert={alert} active={active} />}
      {entry.badge && (
        <span
          className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium ${
            active ? 'bg-white/20 text-white' : 'bg-white/10 rz-sidebar-muted'
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
            ? 'text-[var(--rz-sidebar-icon-active)] font-medium'
            : 'rz-nav-item'
        }`}
      >
        <Icon size={16} className="shrink-0" />
        <span className="flex-1 text-left truncate">{entry.label}</span>
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
      <p className="text-[10px] font-semibold uppercase tracking-wider rz-sidebar-muted">
        {entry.label}
      </p>
      {entry.hint && (
        <p className="text-[10px] text-white/40 mt-0.5 leading-snug">{entry.hint}</p>
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

function ModeSwitcher({
  mode,
  onModeChange,
  showDiscord,
  showAdmin,
}: {
  mode: NavMode
  onModeChange: (mode: NavMode) => void
  showDiscord: boolean
  showAdmin: boolean
}) {
  const tabs: { id: NavMode; icon: typeof Building2; label: string }[] = [
    { id: 'platform', icon: Building2, label: 'Plataforma' },
  ]
  if (showDiscord) tabs.push({ id: 'discord', icon: Radio, label: 'Discord' })
  if (showAdmin) tabs.push({ id: 'admin', icon: Shield, label: 'Admin' })

  return (
    <div
      className="flex rounded-xl bg-[var(--rz-sidebar-bg-alt)] border border-white/10 p-1 gap-0.5"
      role="tablist"
      aria-label="Área do painel"
    >
      {tabs.map(({ id, icon: Icon, label }) => {
        const active = mode === id
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={label}
            title={id === 'admin' ? 'Admin RadarZap' : label}
            onClick={() => onModeChange(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg min-w-0 transition-all ${
              active
                ? 'bg-[var(--rz-sidebar-item-active)] text-[var(--rz-sidebar-icon-active)] shadow-sm'
                : 'rz-sidebar-muted hover:text-[var(--rz-sidebar-text)] hover:bg-[var(--rz-sidebar-item-hover)]'
            }`}
          >
            <Icon size={15} className="shrink-0" strokeWidth={active ? 2.25 : 2} />
            <span className="text-[10px] font-semibold leading-none tracking-tight">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function Sidebar({
  user,
  mode,
  onModeChange,
  guild,
  onGuildChange,
  mobileOpen = false,
  onMobileClose,
}: Props) {
  const { pathname, hash } = useLocation()
  const guildReady = Boolean(guild?.id)
  const navGuildReady = mode !== 'discord' || guildReady
  const showDiscord = userHasDiscordMode(user)
  const showAdmin = userHasAdminMode(user)
  const tabCount = 1 + (showDiscord ? 1 : 0) + (showAdmin ? 1 : 0)
  const nav = navForUser(user, mode)
  const { data: navAlertsData } = useDiscordNavAlerts(
    guild?.id,
    mode === 'discord' && guildReady,
  )
  const navAlerts = mode === 'discord' ? navAlertsData?.items : undefined

  useEffect(() => {
    onModeChange(detectNavMode(pathname, hash))
  }, [pathname, hash, onModeChange])

  return (
    <aside
      className={`rz-sidebar fixed inset-y-0 left-0 z-50 w-[min(100vw,280px)] border-r flex flex-col shrink-0 overflow-y-auto overscroll-contain transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-60 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="flex items-center gap-2 px-5 py-5 border-b rz-sidebar-border">
        <Zap className="text-[var(--rz-sidebar-icon-active)]" size={22} />
        <div className="min-w-0">
          <span className="font-bold text-lg tracking-tight block text-[var(--rz-sidebar-text)]">RadarZap</span>
          <span className="text-[10px] rz-sidebar-muted uppercase tracking-wider">
            {mode === 'admin' ? 'Admin RadarZap' : mode === 'discord' ? 'Discord' : 'Plataforma'}
          </span>
        </div>
      </div>

      {tabCount > 1 && (
        <div className="px-3 pt-3 pb-2">
          <ModeSwitcher
            mode={mode}
            onModeChange={onModeChange}
            showDiscord={showDiscord}
            showAdmin={showAdmin}
          />
        </div>
      )}

      {showDiscord && mode === 'discord' && (
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

      <div className="px-5 py-4 border-t rz-sidebar-border text-xs rz-sidebar-muted">
        v2.0 · {user.plan}
      </div>
    </aside>
  )
}
