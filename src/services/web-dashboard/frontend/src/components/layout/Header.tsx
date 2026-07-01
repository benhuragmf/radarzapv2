import { Link, useLocation } from 'react-router-dom'
import { logout, type AuthUser } from '../../lib/auth'
import { pageTitleFor } from '../../lib/navConfig'
import { LogOut, Menu, Sun, Moon } from 'lucide-react'
import OrganizationSwitcher from './OrganizationSwitcher'
import EventNotificationBell from './EventNotificationBell'
import { OperationalLockIndicator } from './OperationalLockIndicator'
import { AgentStatusSelector } from './AgentStatusSelector'
import { HeaderStatusPills } from './HeaderStatusPills'
import { useTheme } from '../../context/ThemeContext'

interface Props {
  user: AuthUser
  onLogout: () => void
  onUserUpdate: (user: AuthUser) => void
  menuOpen?: boolean
  onMenuToggle?: () => void
}

export default function Header({ user, onLogout, onUserUpdate, menuOpen, onMenuToggle }: Props) {
  const { pathname, hash, search } = useLocation()
  const { theme, toggleTheme } = useTheme()
  const title = pageTitleFor(pathname, hash, search)

  const handleLogout = async () => {
    await logout()
    onLogout()
  }

  return (
    <header className="h-14 bg-[var(--rz-surface)] border-b border-[var(--rz-border)] flex items-center justify-between px-3 sm:px-4 lg:px-6 gap-2 sm:gap-3">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="lg:hidden shrink-0 touch-target flex items-center justify-center p-2 -ml-1 text-[var(--rz-text-secondary)] hover:text-[var(--rz-text-primary)] rounded-lg hover:bg-[var(--rz-surface-muted)]"
            aria-label={menuOpen ? 'Recolher menu' : 'Expandir menu'}
            aria-expanded={menuOpen ?? false}
          >
            <Menu size={20} />
          </button>
        )}
        <h1 className="font-semibold text-base truncate text-[var(--rz-text-primary)] min-w-0">
          {title}
        </h1>
      </div>

      <div className="flex items-center justify-end gap-1.5 sm:gap-2 lg:gap-3 min-w-0 shrink-0">
        <OrganizationSwitcher user={user} onOrganizationChange={onUserUpdate} />

        <OperationalLockIndicator user={user} />
        <EventNotificationBell />

        <AgentStatusSelector user={user} />

        <HeaderStatusPills user={user} className="hidden lg:flex" />

        <button
          type="button"
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center text-[var(--rz-text-muted)] hover:text-[var(--rz-primary)] transition-colors rounded-lg hover:bg-[var(--rz-surface-muted)] shrink-0"
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* User info */}
        <Link
          to="/settings#perfil"
          className="flex items-center gap-2 rounded-lg hover:bg-[var(--rz-surface-muted)] px-1.5 py-1 transition-colors shrink-0"
          title="Meu perfil"
          aria-label="Meu perfil"
        >
          {user.avatar ? (
            <img src={user.avatar} alt={user.username}
              className="w-7 h-7 rounded-full border border-[var(--rz-border)]" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[var(--rz-primary)] flex items-center justify-center text-xs font-bold text-white rz-on-primary">
              {user.username[0].toUpperCase()}
            </div>
          )}
          <span className="text-sm text-[var(--rz-text-secondary)] hidden sm:block truncate max-w-[120px] lg:max-w-[160px]">
            {user.username}
          </span>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="w-8 h-8 flex items-center justify-center text-[var(--rz-text-muted)] hover:text-[var(--rz-danger-text)] transition-colors rounded-lg hover:bg-[var(--rz-surface-muted)] shrink-0"
          title="Sair"
          aria-label="Sair"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
