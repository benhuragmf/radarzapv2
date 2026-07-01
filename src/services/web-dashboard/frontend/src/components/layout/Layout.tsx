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
import { PwaInstallBanner } from './PwaInstallBanner'
import { BrowserNotifyPermissionBanner } from './BrowserNotifyPermissionBanner'
import { BusinessVerticalOnboardingGate } from '../onboarding/BusinessVerticalOnboardingGate'

import { cn } from '@/lib/utils'

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
  /** Mobile/tablet: false = faixa estreita (ícones); true = menu expandido com labels */
  const [mobileMenuExpanded, setMobileMenuExpanded] = useState(false)

  useEffect(() => {
    setMobileMenuExpanded(false)
  }, [pathname, hash])

  useEffect(() => {
    if (!mobileMenuExpanded) return
    const mq = window.matchMedia('(min-width: 1024px)')
    if (mq.matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileMenuExpanded])

  const inboxViewport = pathname === '/platform/inbox'

  useEffect(() => {
    document.documentElement.classList.toggle('rz-inbox-shell', inboxViewport)
    return () => document.documentElement.classList.remove('rz-inbox-shell')
  }, [inboxViewport])

  return (
    <EventNotificationProvider user={user}>
      <AgentPresenceRuntime user={user} />
      <WebChatGlobalListener user={user} />
      <BusinessVerticalOnboardingGate user={user} />
      <NavModeContext.Provider value={navMode}>
        <GuildContext.Provider value={{ guildId: guild?.id ?? null, guildName: guild?.name ?? null }}>
          {mobileMenuExpanded && (
            <button
              type="button"
              aria-label="Recolher menu"
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              style={{ left: '4.5rem' }}
              onClick={() => setMobileMenuExpanded(false)}
            />
          )}
          <div
            className={cn(
              'w-full min-w-0 max-w-none bg-[var(--rz-background)] pl-[4.5rem] lg:pl-0',
              inboxViewport
                ? 'grid h-[100dvh] max-h-[100dvh] overflow-hidden grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)]'
                : 'flex min-h-screen flex-col lg:flex-row',
            )}
          >
            <Sidebar
              user={user}
              mode={navMode}
              onModeChange={setNavMode}
              guild={guild}
              onGuildChange={setGuild}
              mobileExpanded={mobileMenuExpanded}
              onMobileExpandedChange={setMobileMenuExpanded}
            />
            <div
              className={cn(
                'flex min-w-0 w-full max-w-none flex-col',
                inboxViewport ? 'min-h-0 overflow-hidden' : 'flex-1',
              )}
            >
              <div className="sticky top-0 z-30 shrink-0 bg-[var(--rz-surface)]/95 backdrop-blur-sm border-b border-[var(--rz-border)]">
                <Header
                  user={user}
                  onLogout={onLogout}
                  onUserUpdate={onUserUpdate}
                  menuOpen={mobileMenuExpanded}
                  onMenuToggle={() => setMobileMenuExpanded(v => !v)}
                />
                <PwaInstallBanner />
                <BrowserNotifyPermissionBanner />
              </div>
              <main
                className={cn(
                  inboxViewport
                    ? 'flex flex-1 flex-col min-h-0 min-w-0 w-full max-w-none overflow-hidden px-2 pt-2 sm:px-3 sm:pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]'
                    : 'flex-1 p-3 sm:p-4 lg:p-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
                )}
              >
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

