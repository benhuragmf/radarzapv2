import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import ContextBar from './ContextBar'
import type { AuthUser } from '../../lib/auth'
import type { Guild } from '../../lib/guild'
import { getSelectedGuild } from '../../lib/guild'
import { GuildContext } from '../../lib/guildContext'
import { NavModeContext } from '../../lib/navModeContext'
import { detectNavMode, type NavMode } from '../../lib/navConfig'
import { EventNotificationProvider } from '../../context/EventNotificationContext'

interface Props {
  user: AuthUser
  onLogout: () => void
  onUserUpdate: (user: AuthUser) => void
}

export default function Layout({ user, onLogout, onUserUpdate }: Props) {
  const { pathname, hash } = useLocation()
  const initial = getSelectedGuild()
  const [guild, setGuild] = useState<Guild | null>(initial)
  const [navMode, setNavMode] = useState<NavMode>(() => detectNavMode(pathname, hash))

  return (
    <EventNotificationProvider user={user}>
      <NavModeContext.Provider value={navMode}>
        <GuildContext.Provider value={{ guildId: guild?.id ?? null, guildName: guild?.name ?? null }}>
          <div className="flex h-screen overflow-hidden">
          <Sidebar
            user={user}
            mode={navMode}
            onModeChange={setNavMode}
            guild={guild}
            onGuildChange={setGuild}
          />
          <div className="flex flex-col flex-1 overflow-hidden">
            <Header user={user} onLogout={onLogout} onUserUpdate={onUserUpdate} />
            <ContextBar user={user} />
            <main className="flex-1 overflow-y-auto p-6">
              <Outlet />
            </main>
          </div>
          </div>
        </GuildContext.Provider>
      </NavModeContext.Provider>
    </EventNotificationProvider>
  )
}
