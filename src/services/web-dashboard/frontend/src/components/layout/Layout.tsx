import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import GuildBar from './GuildBar'
import type { AuthUser } from '../../lib/auth'
import type { Guild } from '../../lib/guild'
import { getSelectedGuild } from '../../lib/guild'
import { GuildContext } from '../../lib/guildContext'
import { can } from '../../lib/auth'

interface Props {
  user: AuthUser
  onLogout: () => void
}

export default function Layout({ user, onLogout }: Props) {
  const initial = getSelectedGuild()
  const [guild, setGuild] = useState<Guild | null>(initial)

  return (
    <GuildContext.Provider value={{ guildId: guild?.id ?? null, guildName: guild?.name ?? null }}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar user={user} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header user={user} onLogout={onLogout} />
          {can(user, 'discord:server:view') && (
            <GuildBar onGuildChange={setGuild} />
          )}
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </GuildContext.Provider>
  )
}
