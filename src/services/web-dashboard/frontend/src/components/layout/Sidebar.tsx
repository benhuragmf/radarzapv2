import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Building2, ChevronDown, ChevronLeft, ChevronRight, Radio, Shield, Star } from 'lucide-react'
import { BrandLogo } from '../brand/BrandLogo'
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
import { INBOX_NAV_ID, useWebChatNavAlerts } from '../../lib/useWebChatNavAlerts'
import { collectNavLinks, quickAccessInsertIndex, useNavFavorites } from '../../lib/navFavorites'
import { can } from '../../lib/auth'
import DiscordGuildPicker from '../discord/DiscordGuildPicker'
import type { Guild } from '../../lib/guild'
import { SidebarQuickAccess } from './SidebarQuickAccess'

const SIDEBAR_COLLAPSED_KEY = 'rz-sidebar-collapsed'

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1',
  )

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  return [collapsed, setCollapsed] as const
}

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
  collapsed,
  isFavorite,
  onToggleFavorite,
}: {
  entry: NavLink
  depth: number
  guildReady: boolean
  alert?: NavAlertItem
  collapsed?: boolean
  isFavorite?: boolean
  onToggleFavorite?: (id: string) => void
}) {
  const { pathname, hash, search } = useLocation()
  const blocked = entry.requiresGuild && !guildReady
  const to = entry.search ? `${entry.to}${entry.search}` : entry.to
  const active = isNavItemActive(entry.to, pathname, hash, search, entry.search)
  const Icon = entry.icon
  const pad = collapsed ? 'px-0 justify-center' : depth > 0 ? 'pl-9 pr-3' : 'px-3'

  if (blocked) {
    return (
      <div
        className={`flex items-center gap-3 ${pad} py-2 rounded-lg text-sm text-[var(--rz-text-muted)] cursor-not-allowed`}
        title="Selecione um servidor Discord acima"
      >
        <Icon size={16} className="shrink-0 opacity-40" />
        {!collapsed && <span className="opacity-60">{entry.label}</span>}
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
    <div className={`group/navitem flex items-center min-w-0 ${collapsed ? '' : 'pr-0.5'}`}>
      <Link
        to={to}
        title={collapsed ? entry.label : alert?.summary}
        className={`flex items-center gap-3 ${pad} py-2 touch-target-nav rounded-lg text-sm transition-colors active:scale-[0.98] flex-1 min-w-0 ${alertRing} ${
          active
            ? 'rz-nav-item-active'
            : alert
              ? alert.severity === 'error'
                ? 'rz-nav-item text-red-300 hover:text-[var(--rz-text-primary)]'
                : 'rz-nav-item text-amber-200/90 hover:text-[var(--rz-text-primary)]'
              : 'rz-nav-item'
        }`}
      >
        <span className="relative shrink-0">
          <Icon size={16} />
          {collapsed && alert && (
            <span className="absolute -top-0.5 -right-0.5">
              <NavAlertDot alert={alert} active={active} />
            </span>
          )}
        </span>
        {!collapsed && <span className="flex-1 truncate">{entry.label}</span>}
        {!collapsed && alert && <NavAlertDot alert={alert} active={active} />}
        {!collapsed && entry.badge && (
          <span
            className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium ${
              active ? 'bg-white/20 text-white' : 'bg-white/10 rz-sidebar-muted'
            }`}
          >
            {entry.badge}
          </span>
        )}
      </Link>
      {!collapsed && onToggleFavorite && (
        <button
          type="button"
          onClick={() => onToggleFavorite(entry.id)}
          title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          className={`shrink-0 p-1 rounded-md transition-all ${
            isFavorite
              ? 'text-amber-400 opacity-100'
              : 'text-white/30 opacity-0 group-hover/navitem:opacity-100 hover:text-amber-300'
          }`}
          aria-label={isFavorite ? `Remover ${entry.label} dos favoritos` : `Favoritar ${entry.label}`}
        >
          <Star size={12} className={isFavorite ? 'fill-current' : ''} />
        </button>
      )}
    </div>
  )
}

function NavGroupItem({
  entry,
  guildReady,
  navAlerts,
  collapsed,
  isFavorite,
  onToggleFavorite,
}: {
  entry: Extract<NavEntry, { kind: 'group' }>
  guildReady: boolean
  navAlerts?: Record<string, NavAlertItem>
  collapsed?: boolean
  isFavorite?: (id: string) => boolean
  onToggleFavorite?: (id: string) => void
}) {
  const { pathname, hash, search } = useLocation()
  const isActive = isNavGroupActive(entry, pathname, hash, search)
  const [open, setOpen] = useState(isActive)
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const flyoutRef = useRef<HTMLDivElement>(null)
  const Icon = entry.icon
  const childAlerts = entry.children
    .map(c => navAlerts?.[c.id])
    .filter((a): a is NavAlertItem => Boolean(a))
  const groupAlert = childAlerts.find(a => a.severity === 'error') ?? childAlerts[0]

  useEffect(() => {
    if (isActive) setOpen(true)
  }, [isActive, pathname, hash])

  useEffect(() => {
    setFlyoutOpen(false)
  }, [pathname, hash, search])

  useEffect(() => {
    if (!flyoutOpen) return
    const handler = (e: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        setFlyoutOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [flyoutOpen])

  if (collapsed) {
    return (
      <div className="relative" ref={flyoutRef}>
        <button
          type="button"
          title={entry.label}
          onClick={() => setFlyoutOpen(v => !v)}
          className={`w-full flex items-center justify-center py-2 rounded-lg text-sm transition-colors ${
            isActive || flyoutOpen
              ? 'text-[var(--rz-sidebar-icon-active)] bg-[var(--rz-sidebar-item-active)]'
              : 'rz-nav-item'
          }`}
        >
          <span className="relative">
            <Icon size={16} className="shrink-0" />
            {groupAlert && (
              <span className="absolute -top-0.5 -right-0.5">
                <NavAlertDot alert={groupAlert} active={isActive} />
              </span>
            )}
          </span>
        </button>
        {flyoutOpen && (
          <div className="absolute left-full top-0 ml-2 z-[60] min-w-[12rem] py-1 rounded-xl border rz-sidebar-border bg-[var(--rz-sidebar-bg)] shadow-xl">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider rz-sidebar-muted">
              {entry.label}
            </p>
            <div className="space-y-0.5 px-1">
              {entry.children.map(child => (
                <NavLinkItem
                  key={child.id}
                  entry={child}
                  depth={0}
                  guildReady={guildReady}
                  alert={navAlerts?.[child.id]}
                  collapsed={false}
                  isFavorite={isFavorite?.(child.id)}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

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
              isFavorite={isFavorite?.(child.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function NavSection({
  entry,
  collapsed,
}: {
  entry: Extract<NavEntry, { kind: 'section' }>
  collapsed?: boolean
}) {
  if (collapsed) return null

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
  collapsed,
  isFavorite,
  onToggleFavorite,
  favoriteIds = [],
}: {
  entries: NavEntry[]
  guildReady: boolean
  navAlerts?: Record<string, NavAlertItem>
  collapsed?: boolean
  isFavorite?: (id: string) => boolean
  onToggleFavorite?: (id: string) => void
  favoriteIds?: string[]
}) {
  const insertAt = quickAccessInsertIndex(entries)

  const renderEntry = (entry: NavEntry) => {
    if (entry.kind === 'section') {
      return <NavSection key={entry.id} entry={entry} collapsed={collapsed} />
    }
    if (entry.kind === 'group') {
      return (
        <NavGroupItem
          key={entry.id}
          entry={entry}
          guildReady={guildReady}
          navAlerts={navAlerts}
          collapsed={collapsed}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
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
        collapsed={collapsed}
        isFavorite={isFavorite?.(entry.id)}
        onToggleFavorite={onToggleFavorite}
      />
    )
  }

  if (insertAt === null || !onToggleFavorite) {
    return <>{entries.map(renderEntry)}</>
  }

  return (
    <>
      {entries.slice(0, insertAt).map(renderEntry)}
      <SidebarQuickAccess
        entries={entries}
        favoriteIds={favoriteIds}
        collapsed={collapsed}
        guildReady={guildReady}
        navAlerts={navAlerts}
        onToggleFavorite={onToggleFavorite}
      />
      {entries.slice(insertAt).map(renderEntry)}
    </>
  )
}

function ModeSwitcher({
  mode,
  onModeChange,
  showDiscord,
  showAdmin,
  collapsed,
}: {
  mode: NavMode
  onModeChange: (mode: NavMode) => void
  showDiscord: boolean
  showAdmin: boolean
  collapsed?: boolean
}) {
  const tabs: { id: NavMode; icon: typeof Building2; label: string }[] = [
    { id: 'platform', icon: Building2, label: 'Plataforma' },
  ]
  if (showDiscord) tabs.push({ id: 'discord', icon: Radio, label: 'Discord' })
  if (showAdmin) tabs.push({ id: 'admin', icon: Shield, label: 'Admin' })

  return (
    <div
      className={`flex rounded-xl bg-[var(--rz-sidebar-bg-alt)] border border-white/10 p-1 gap-0.5 ${
        collapsed ? 'flex-col' : ''
      }`}
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
            title={id === 'admin' ? 'Admin Radar Chat' : label}
            onClick={() => onModeChange(id)}
            className={`flex-1 flex items-center justify-center rounded-lg min-w-0 transition-all ${
              collapsed ? 'py-2.5 px-1' : 'flex-col gap-1 py-2 px-1'
            } ${
              active
                ? 'bg-[var(--rz-sidebar-item-active)] text-[var(--rz-sidebar-icon-active)] shadow-sm'
                : 'rz-sidebar-muted hover:text-[var(--rz-sidebar-text)] hover:bg-[var(--rz-sidebar-item-hover)]'
            }`}
          >
            <Icon size={15} className="shrink-0" strokeWidth={active ? 2.25 : 2} />
            {!collapsed && (
              <span className="text-[10px] font-semibold leading-none tracking-tight">{label}</span>
            )}
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
  const webchatNavEnabled = mode !== 'discord' && mode !== 'admin' && can(user, 'inbox:view')
  const { data: webchatAlert } = useWebChatNavAlerts(webchatNavEnabled)

  const navAlerts =
    mode === 'discord'
      ? navAlertsData?.items
      : webchatAlert
        ? { [INBOX_NAV_ID]: webchatAlert }
        : undefined

  const [collapsed, setCollapsed] = useSidebarCollapsed()
  const { favoriteIds, isFavorite, toggleFavorite, pruneInvalid } = useNavFavorites(user, mode)

  useEffect(() => {
    const valid = new Set(collectNavLinks(nav).map(l => l.id))
    pruneInvalid(valid)
  }, [nav, pruneInvalid])

  useEffect(() => {
    onModeChange(detectNavMode(pathname, hash))
  }, [pathname, hash, onModeChange])

  return (
    <aside
      className={`rz-sidebar fixed inset-y-0 left-0 z-50 w-[min(100vw,280px)] border-r flex flex-col shrink-0 overscroll-contain transition-[transform,width] duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:overflow-hidden ${
        collapsed ? 'lg:w-[4.5rem]' : 'lg:w-60'
      } ${
        mobileOpen ? 'translate-x-0 overflow-y-auto' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div
        className={`shrink-0 border-b rz-sidebar-border ${
          collapsed ? 'flex flex-col items-center gap-1 py-2' : 'flex items-center'
        }`}
      >
        <Link
          to="/"
          className={`flex items-center rz-sidebar-brand group hover:bg-white/[0.04] transition-colors min-w-0 ${
            collapsed ? 'justify-center px-2 py-1' : 'gap-3 px-4 py-4 flex-1'
          }`}
          aria-label="Radar Chat — início"
          title="Radar Chat"
        >
          <span className="rz-sidebar-brand-icon-wrap shrink-0">
            <BrandLogo
              height={collapsed ? 32 : 40}
              tone="dark"
              animated
              className="rz-sidebar-brand-logo"
            />
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <span className="font-bold text-[1.05rem] tracking-tight block leading-none">
                <span className="text-[var(--rz-sidebar-text)]">Radar</span>
                <span className="text-[#00D4FF] rz-sidebar-brand-chat">Chat</span>
              </span>
              <span className="text-[10px] rz-sidebar-muted uppercase tracking-[0.18em] mt-1.5 block">
                {mode === 'admin' ? 'Admin' : mode === 'discord' ? 'Discord' : 'Plataforma'}
              </span>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed(v => !v)}
          className={`hidden lg:flex shrink-0 items-center justify-center rounded-lg border transition-colors ${
            collapsed ? 'w-8 h-8' : 'w-8 h-8 mr-2'
          } border-[var(--rz-sidebar-icon-active)]/35 bg-[var(--rz-sidebar-item-active)] text-[var(--rz-sidebar-icon-active)] hover:bg-[var(--rz-sidebar-icon-active)]/25 hover:border-[var(--rz-sidebar-icon-active)]/60 shadow-sm`}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {tabCount > 1 && (
        <div className={collapsed ? 'px-1.5 pt-2 pb-1' : 'px-3 pt-3 pb-2'}>
          <ModeSwitcher
            mode={mode}
            onModeChange={onModeChange}
            showDiscord={showDiscord}
            showAdmin={showAdmin}
            collapsed={collapsed}
          />
        </div>
      )}

      {showDiscord && mode === 'discord' && (
        <DiscordGuildPicker
          user={user}
          selected={guild}
          onChange={onGuildChange}
          collapsed={collapsed}
        />
      )}

      <nav className={`flex-1 min-h-0 py-3 space-y-0.5 overflow-y-auto overscroll-contain ${collapsed ? 'px-1' : 'px-2'}`}>
        {!collapsed && !navGuildReady && mode === 'discord' && (
          <p className="px-3 py-2 text-[11px] text-amber-500/90 leading-snug">
            Escolha o servidor para liberar o menu de automação.
          </p>
        )}
        <NavTree
          entries={nav}
          guildReady={navGuildReady}
          navAlerts={navAlerts}
          collapsed={collapsed}
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavorite}
          favoriteIds={favoriteIds}
        />
      </nav>

      {!collapsed && (
        <div className="px-5 py-4 border-t rz-sidebar-border text-xs rz-sidebar-muted">
          (v{import.meta.env.VITE_RADARZAP_VERSION}) · {user.plan}
        </div>
      )}
    </aside>
  )
}
