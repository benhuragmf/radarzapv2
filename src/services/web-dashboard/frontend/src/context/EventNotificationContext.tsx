import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { can, type AuthUser } from '../lib/auth'
import { playAlertSound } from '../lib/alertSound'
import { usePanelSocket } from '../hooks/usePanelSocket'

export interface PanelEvent {
  id: string
  type: string
  title: string
  body: string
  href?: string
  conversationId?: string
  createdAt: string
  read?: boolean
}

interface AlertSettings {
  alertSoundEnabled: boolean
  alertOnNewChat: boolean
  alertOnNewMessage: boolean
}

interface Ctx {
  events: PanelEvent[]
  unreadCount: number
  markAllRead: () => void
  markRead: (id: string) => void
  clearAll: () => void
}

const EventNotificationContext = createContext<Ctx | null>(null)

export function EventNotificationProvider({
  user,
  children,
}: {
  user: AuthUser
  children: ReactNode
}) {
  const [events, setEvents] = useState<PanelEvent[]>([])
  const canReadSettings = can(user, 'inbox:department:manage')

  const { data: settingsRaw } = useQuery<AlertSettings>({
    queryKey: ['inbox-settings-alerts'],
    queryFn: () => api.get('/inbox/settings'),
    enabled: canReadSettings,
    staleTime: 60_000,
  })

  const settings: AlertSettings = settingsRaw ?? {
    alertSoundEnabled: true,
    alertOnNewChat: true,
    alertOnNewMessage: false,
  }

  const handlePanelEvent = useCallback(
    (ev: PanelEvent) => {
      setEvents(prev => [{ ...ev, read: false }, ...prev].slice(0, 40))

      if (!settings?.alertSoundEnabled) return
      if (ev.type === 'inbox:new_message' && !settings.alertOnNewMessage) return
      if (
        (ev.type === 'inbox:new_chat' ||
          ev.type === 'inbox:priority' ||
          ev.type === 'inbox:priority_expired' ||
          ev.type === 'webchat:escalated') &&
        !settings.alertOnNewChat
      ) {
        return
      }
      if (
        ev.type === 'whatsapp:disconnected' ||
        ev.type === 'inbox:priority' ||
        ev.type === 'inbox:priority_expired'
      ) {
        playAlertSound('urgent')
      } else if (ev.type === 'inbox:queue_sla') {
        playAlertSound('urgent')
      } else if (ev.type === 'inbox:new_message') {
        playAlertSound('message')
      } else {
        playAlertSound('chat')
      }
    },
    [settings],
  )

  usePanelSocket(Boolean(user), handlePanelEvent)

  const unreadCount = events.filter(e => !e.read).length

  const value = useMemo<Ctx>(
    () => ({
      events,
      unreadCount,
      markAllRead: () => setEvents(prev => prev.map(e => ({ ...e, read: true }))),
      markRead: (id: string) =>
        setEvents(prev => prev.map(e => (e.id === id ? { ...e, read: true } : e))),
      clearAll: () => setEvents([]),
    }),
    [events, unreadCount],
  )

  return (
    <EventNotificationContext.Provider value={value}>{children}</EventNotificationContext.Provider>
  )
}

export function useEventNotifications(): Ctx {
  const ctx = useContext(EventNotificationContext)
  if (!ctx) {
    return {
      events: [],
      unreadCount: 0,
      markAllRead: () => {},
      markRead: () => {},
      clearAll: () => {},
    }
  }
  return ctx
}
