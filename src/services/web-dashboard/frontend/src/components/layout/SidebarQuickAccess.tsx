import { Link, useLocation } from 'react-router-dom'
import { Star } from 'lucide-react'
import { collectNavLinks } from '../../lib/navFavorites'
import { isNavItemActive, type NavEntry, type NavLink } from '../../lib/navConfig'
import type { NavAlertItem } from '../../lib/navAlerts'

interface Props {
  entries: NavEntry[]
  favoriteIds: string[]
  collapsed?: boolean
  guildReady: boolean
  navAlerts?: Record<string, NavAlertItem>
  onToggleFavorite: (id: string) => void
}

export function SidebarQuickAccess({
  entries,
  favoriteIds,
  collapsed,
  guildReady,
  navAlerts,
  onToggleFavorite,
}: Props) {
  const { pathname, hash, search } = useLocation()
  const linkMap = new Map(collectNavLinks(entries).map(l => [l.id, l]))

  const resolved = favoriteIds
    .map(id => linkMap.get(id))
    .filter((l): l is NavLink => Boolean(l))

  if (!resolved.length) {
    if (collapsed) return null
    return (
      <div className="mx-1 mb-2 px-2 py-2.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
        <p className="text-[10px] font-semibold uppercase tracking-wider rz-sidebar-muted mb-1">
          Acesso rápido
        </p>
        <p className="text-[10px] text-white/35 leading-snug flex items-center gap-1">
          <Star size={10} className="shrink-0 opacity-60" />
          Clique na estrela de um item do menu para fixar aqui.
        </p>
      </div>
    )
  }

  return (
    <div className={`mb-2 ${collapsed ? 'px-0.5' : 'mx-1 px-1.5 py-2 rounded-xl border border-white/10 bg-white/[0.03]'}`}>
      {!collapsed && (
        <p className="text-[10px] font-semibold uppercase tracking-wider rz-sidebar-muted mb-1.5 px-2">
          Acesso rápido
        </p>
      )}
      <div className={`flex flex-col gap-0.5 ${collapsed ? 'items-center' : ''}`}>
        {resolved.map(entry => {
          const blocked = entry.requiresGuild && !guildReady
          const to = entry.search ? `${entry.to}${entry.search}` : entry.to
          const active = isNavItemActive(entry.to, pathname, hash, search, entry.search)
          const Icon = entry.icon
          const alert = navAlerts?.[entry.id]

          if (blocked) return null

          return (
            <div
              key={entry.id}
              className={`group/qa flex items-center min-w-0 ${collapsed ? 'w-full' : 'w-full pr-0.5'}`}
            >
              <Link
                to={to}
                title={entry.label}
                className={`flex items-center gap-2 rounded-lg text-sm transition-colors flex-1 min-w-0 ${
                  collapsed ? 'justify-center py-2' : 'px-2 py-1.5'
                } ${active ? 'rz-nav-item-active' : 'rz-nav-item hover:bg-[var(--rz-sidebar-item-hover)]'}`}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && (
                  <span className="flex-1 min-w-0 leading-snug">{entry.label}</span>
                )}
                {alert && !collapsed && (
                  <span
                    className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                      alert.severity === 'error' ? 'bg-red-500' : 'bg-amber-500'
                    }`}
                  />
                )}
              </Link>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => onToggleFavorite(entry.id)}
                  title="Remover dos favoritos"
                  className="shrink-0 p-1 rounded-md text-amber-400 opacity-0 group-hover/qa:opacity-100 hover:text-amber-300 transition-opacity"
                  aria-label={`Remover ${entry.label} dos favoritos`}
                >
                  <Star size={12} className="fill-current" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
