import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import type { AuthUser } from '../../lib/auth'
import type { Guild } from '../../lib/guild'
import { getSelectedGuild } from '../../lib/guild'
import { GuildContext } from '../../lib/guildContext'
import { NavModeContext } from '../../lib/navModeContext'
import { detectNavMode, type NavMode } from '../../lib/navConfig'
import { EventNotificationProvider } from '../../context/EventNotificationContext'
import { WebChatGlobalListener } from '../webchat/WebChatGlobalListener'
import { AgentPresenceProvider } from '../../lib/agentPresenceContext'
import { AgentPresenceRuntime } from './AgentPresenceRuntime'

interface Props {
  user: AuthUser
  onLogout: () => void
  onUserUpdate: (user: AuthUser) => void
}

function LayoutInner({ user, onLogout, onUserUpdate }: Props) {
  const { pathname, hash } = useLocation()
  const initial = getSelectedGuild()
  const [guild, setGuild] = useState<Guild | null>(initial)
  const [navMode, setNavMode] = useState<NavMode>(() => detectNavMode(pathname, hash))
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname, hash])

  return (
    <EventNotificationProvider user={user}>
      <AgentPresenceRuntime user={user} />
      <WebChatGlobalListener user={user} />
      <NavModeContext.Provider value={navMode}>
        <GuildContext.Provider value={{ guildId: guild?.id ?? null, guildName: guild?.name ?? null }}>
          {sidebarOpen && (
            <button
              type="button"
              aria-label="Fechar menu"
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <div className="flex flex-col lg:flex-row min-h-screen w-full bg-[var(--rz-background)]">
            <Sidebar
              user={user}
              mode={navMode}
              onModeChange={setNavMode}
              guild={guild}
              onGuildChange={setGuild}
              mobileOpen={sidebarOpen}
              onMobileClose={() => setSidebarOpen(false)}
            />
            <div className="flex flex-col flex-1 min-w-0">
              <div className="sticky top-0 z-30 shrink-0 bg-[var(--rz-surface)]/95 backdrop-blur-sm border-b border-[var(--rz-border)]">
                <Header
                  user={user}
                  onLogout={onLogout}
                  onUserUpdate={onUserUpdate}
                  onMenuClick={() => setSidebarOpen(true)}
                />
              </div>
              <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Outlet />
              </main>
            </div>
          </div>
        </GuildContext.Provider>
      </NavModeContext.Provider>
    </EventNotificationProvider>
  )
}

export default function Layout(props: Props) {
  return (
    <AgentPresenceProvider>
      <LayoutInner {...props} />
    </AgentPresenceProvider>
  )
}
