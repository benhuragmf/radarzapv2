import { createContext, useContext } from 'react'

export interface GuildContextValue {
  guildId: string | null
  guildName: string | null
}

export const GuildContext = createContext<GuildContextValue>({ guildId: null, guildName: null })

export function useGuild() {
  return useContext(GuildContext)
}
