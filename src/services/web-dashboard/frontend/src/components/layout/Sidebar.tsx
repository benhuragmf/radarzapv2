import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, Zap } from 'lucide-react'
import type { AuthUser } from '../../lib/auth'
import { collectRoutes, navForUser, type NavItem } from '../../lib/navConfig'

interface Props {
  user: AuthUser
}

function NavGroup({ entry, depth = 0 }: { entry: NavItem; depth?: number }) {
  const location = useLocation()
  const childRoutes = collectRoutes(entry)
  const isActive = childRoutes.some(r => location.pathname === r || location.pathname.startsWith(`${r}/`))
  const [open, setOpen] = useState(isActive)

  useEffect(() => {
    if (isActive) setOpen(true)
  }, [isActive, location.pathname])

  const Icon = entry.icon
  const pad = depth === 0 ? 'px-3' : 'pl-9 pr-3'

  if (entry.children?.length) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`w-full flex items-center gap-3 ${pad} py-2 rounded-lg text-sm transition-colors ${
            isActive
              ? 'text-brand-400 font-medium'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Icon size={16} className="shrink-0" />
          <span className="flex-1 text-left">{entry.label}</span>
          {open ? <ChevronDown size={14} className="shrink-0 opacity-60" /> : <ChevronRight size={14} className="shrink-0 opacity-60" />}
        </button>
        {open && (
          <div className="mt-0.5 space-y-0.5">
            {entry.children.map(child => (
              <NavEntry key={child.id} entry={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!entry.to) return null

  return (
    <NavLink
      to={entry.to}
      end
      className={({ isActive: active }) =>
        `flex items-center gap-3 ${pad} py-2 rounded-lg text-sm transition-colors ${
          active
            ? 'bg-brand-600 text-white font-medium'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`
      }
    >
      <Icon size={16} className="shrink-0" />
      {entry.label}
    </NavLink>
  )
}

function NavEntry({ entry, depth = 0 }: { entry: NavItem; depth?: number }) {
  if (entry.children?.length) {
    return <NavGroup entry={entry} depth={depth} />
  }
  return <NavGroup entry={entry} depth={depth} />
}

export default function Sidebar({ user }: Props) {
  const nav = navForUser(user)

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
        <Zap className="text-brand-500" size={22} />
        <div>
          <span className="font-bold text-lg tracking-tight block">RadarZap</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">
            {user.isInternalStaff ? 'Admin' : user.primaryRole.replace('_', ' ')}
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(entry => (
          <NavEntry key={entry.id} entry={entry} />
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-600">
        v2.0 · {user.plan}
      </div>
    </aside>
  )
}
