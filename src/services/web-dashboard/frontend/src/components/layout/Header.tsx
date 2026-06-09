import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { logout, type AuthUser } from '../../lib/auth'
import { pageTitleFor } from '../../lib/navConfig'
import { Wifi, WifiOff, LogOut, Menu } from 'lucide-react'
import OrganizationSwitcher from './OrganizationSwitcher'
import EventNotificationBell from './EventNotificationBell'

interface Props {
  user: AuthUser
  onLogout: () => void
  onUserUpdate: (user: AuthUser) => void
  onMenuClick?: () => void
}

export default function Header({ user, onLogout, onUserUpdate, onMenuClick }: Props) {
  const { pathname, hash, search } = useLocation()
  const title = pageTitleFor(pathname, hash, search)

  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<{ healthy: boolean }>('/services/health'),
    refetchInterval: 15_000,
  })

  const healthy = (data as any)?.healthy ?? null

  const handleLogout = async () => {
    await logout()
    onLogout()
  }

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 sm:px-6 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden shrink-0 touch-target flex items-center justify-center p-2 -ml-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 active:bg-gray-700"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
        )}
        <h1 className="font-semibold text-base truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <OrganizationSwitcher user={user} onOrganizationChange={onUserUpdate} />

        <EventNotificationBell />

        {/* Health indicator */}
        <div className="flex items-center gap-1.5 text-sm">
          {healthy === null ? (
            <span className="text-gray-500 text-xs">verificando...</span>
          ) : healthy ? (
            <>
              <Wifi size={13} className="text-brand-500" />
              <span className="text-brand-400 text-xs">online</span>
            </>
          ) : (
            <>
              <WifiOff size={13} className="text-red-400" />
              <span className="text-red-400 text-xs">offline</span>
            </>
          )}
        </div>

        {/* User info */}
        <div className="flex items-center gap-2">
          {user.avatar ? (
            <img src={user.avatar} alt={user.username}
              className="w-7 h-7 rounded-full border border-gray-700" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
              {user.username[0].toUpperCase()}
            </div>
          )}
          <span className="text-sm text-gray-300 hidden sm:block">{user.username}</span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="text-gray-500 hover:text-red-400 transition-colors"
          title="Sair"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
