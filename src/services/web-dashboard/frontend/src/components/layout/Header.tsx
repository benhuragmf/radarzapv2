import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { logout, type AuthUser } from '../../lib/auth'
import { pageTitleFor } from '../../lib/navConfig'
import { Wifi, WifiOff, LogOut } from 'lucide-react'

interface Props {
  user: AuthUser
  onLogout: () => void
}

export default function Header({ user, onLogout }: Props) {
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
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      <h1 className="font-semibold text-base">{title}</h1>

      <div className="flex items-center gap-4">
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
