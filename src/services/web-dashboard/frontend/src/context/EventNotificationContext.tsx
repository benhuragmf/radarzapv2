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
import { isUrgentPanelEventType, resolvePanelEventUrgency } from '../lib/panelEventPriority'

export interface PanelEvent {
  id: string
  type: string
  title: string
  body: string
  href?: string
  conversationId?: string
  targetUserId?: string
  ownerOnly?: boolean
  urgent?: boolean
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
  urgentUnreadCount: number
  markAllRead: () => void
  markRead: (id: string) => void
  clearAll: () => void
}

const EventNotificationContext = createContext<Ctx | null>(null)

function shouldShowPanelEvent(ev: PanelEvent, user: AuthUser): boolean {
  if (ev.targetUserId && ev.targetUserId !== user.userId) return false
  if (ev.ownerOnly && !can(user, 'billing:view')) return false
  return true
}

function normalizePanelEvent(ev: PanelEvent): PanelEvent {
  return {
    ...ev,
    urgent: resolvePanelEventUrgency(ev.type, ev.urgent),
  }
}

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
      if (!shouldShowPanelEvent(ev, user)) return

      const normalized = normalizePanelEvent(ev)
      setEvents(prev => [{ ...normalized, read: false }, ...prev].slice(0, 40))

      if (!settings?.alertSoundEnabled) return

      if (normalized.urgent || isUrgentPanelEventType(normalized.type)) {
        playAlertSound('urgent')
        return
      }

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

      if (ev.type === 'inbox:new_message') {
        playAlertSound('message')
      } else {
        playAlertSound('chat')
      }
    },
    [settings, user],
  )

  usePanelSocket(Boolean(user), handlePanelEvent)

  const unreadCount = events.filter(e => !e.read).length
  const urgentUnreadCount = events.filter(e => !e.read && e.urgent).length

  const value = useMemo<Ctx>(
    () => ({
      events,
      unreadCount,
      urgentUnreadCount,
      markAllRead: () => setEvents(prev => prev.map(e => ({ ...e, read: true }))),
      markRead: (id: string) =>
        setEvents(prev => prev.map(e => (e.id === id ? { ...e, read: true } : e))),
      clearAll: () => setEvents([]),
    }),
    [events, unreadCount, urgentUnreadCount],
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
      urgentUnreadCount: 0,
      markAllRead: () => {},
      markRead: () => {},
      clearAll: () => {},
    }
  }
  return ctx
}
