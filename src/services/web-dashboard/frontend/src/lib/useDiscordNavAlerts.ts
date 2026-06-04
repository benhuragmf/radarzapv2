import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { NavAlertsResponse } from './navAlerts'

export function discordNavAlertsQueryKey(guildId: string | null | undefined) {
  return ['discord-nav-alerts', guildId ?? ''] as const
}

export function useDiscordNavAlerts(guildId: string | null | undefined, enabled = true) {
  return useQuery<NavAlertsResponse>({
    queryKey: discordNavAlertsQueryKey(guildId),
    queryFn: () => {
      const q = guildId ? `?guildId=${encodeURIComponent(guildId)}` : ''
      return api.get<NavAlertsResponse>(`/discord/nav-alerts${q}`)
    },
    enabled: enabled && Boolean(guildId),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}
