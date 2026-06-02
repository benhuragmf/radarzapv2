/**
 * Persists the currently selected Discord guild (server) in localStorage.
 * All API queries are scoped to this guild.
 */

export interface Guild {
  id: string
  name: string
  icon: string | null
}

const KEY = 'radarzap:selectedGuild'

export function getSelectedGuild(): Guild | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSelectedGuild(guild: Guild | null): void {
  if (guild) {
    localStorage.setItem(KEY, JSON.stringify(guild))
  } else {
    localStorage.removeItem(KEY)
  }
}
