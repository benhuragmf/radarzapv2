import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { NavAlertItem } from './navAlerts'

export const WEBCHAT_NAV_ID = 'webchat'
export const INBOX_NAV_ID = 'inbox'

type WebChatStats = {
  openCount: number
  unreadCount: number
  waitingQueueCount: number
  myWaitingQueueCount?: number
}

export function useWebChatNavAlerts(enabled: boolean) {
  return useQuery({
    queryKey: ['webchat-stats'],
    queryFn: () => api.get<WebChatStats>('/webchat/stats'),
    enabled,
    refetchInterval: 30_000,
    staleTime: 10_000,
    select: (data): NavAlertItem | null => {
      if (data.unreadCount) {
        return {
          severity: 'warn',
          count: data.unreadCount,
          summary: `${data.unreadCount} mensagem(ns) não lida(s) no chat do site — atenda na caixa de entrada`,
          code: 'webchat_unread',
        }
      }
      if (data.waitingQueueCount) {
        const queueCount = data.myWaitingQueueCount ?? data.waitingQueueCount
        return {
          severity: 'warn',
          count: queueCount,
          summary: `${queueCount} conversa(s) do site na fila — atenda na caixa de entrada`,
          code: 'webchat_queue',
        }
      }
      return null
    },
  })
}
