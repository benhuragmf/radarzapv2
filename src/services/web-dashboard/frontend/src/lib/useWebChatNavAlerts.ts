import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { NavAlertItem } from './navAlerts'

export const WEBCHAT_NAV_ID = 'webchat'

export function useWebChatNavAlerts(enabled: boolean) {
  return useQuery({
    queryKey: ['webchat-stats'],
    queryFn: () => api.get<{ openCount: number; unreadCount: number }>('/webchat/stats'),
    enabled,
    refetchInterval: 30_000,
    staleTime: 10_000,
    select: (data): NavAlertItem | null => {
      if (!data.unreadCount) return null
      return {
        severity: 'warn',
        count: data.unreadCount,
        summary: `${data.unreadCount} mensagem(ns) não lida(s) no chat do site`,
        code: 'webchat_unread',
      }
    },
  })
}
