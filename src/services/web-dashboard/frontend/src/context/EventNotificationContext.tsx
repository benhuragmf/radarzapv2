import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
const NOTIFICATIONS_QUERY_KEY = ['panel-notifications'] as const

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

function mergeEvents(a: PanelEvent[], b: PanelEvent[]): PanelEvent[] {
  const map = new Map<string, PanelEvent>()
  for (const ev of [...a, ...b]) {
    const prev = map.get(ev.id)
    map.set(ev.id, prev ? { ...prev, ...ev, read: Boolean(prev.read && ev.read) } : ev)
  }
  return [...map.values()]
    .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())
    .slice(0, 80)
}

function persistClientPanelEvent(ev: PanelEvent): void {
  if (ev.type !== 'whatsapp:connected' && ev.type !== 'whatsapp:disconnected') return
  void api
    .post('/panel/notifications/ingest', {
      id: ev.id,
      type: ev.type,
      title: ev.title,
      body: ev.body,
      href: ev.href,
      createdAt: ev.createdAt,
    })
    .catch(() => {})
}

export function EventNotificationProvider({
  user,
  children,
}: {
  user: AuthUser
  children: ReactNode
}) {
  const qc = useQueryClient()
  const [events, setEvents] = useState<PanelEvent[]>([])
  const hydratedRef = useRef(false)
  const canReadSettings = can(user, 'inbox:department:manage')

  const { data: persisted = [], isSuccess: persistedLoaded } = useQuery<PanelEvent[]>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => api.get('/panel/notifications?limit=80'),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!persistedLoaded) return
    const visible = persisted.filter(ev => shouldShowPanelEvent(ev, user)).map(normalizePanelEvent)
    setEvents(prev => {
      if (!hydratedRef.current) {
        hydratedRef.current = true
        return visible
      }
      return mergeEvents(visible, prev)
    })
  }, [persisted, persistedLoaded, user])

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
      setEvents(prev => {
        if (prev.some(e => e.id === normalized.id)) {
          return prev.map(e => (e.id === normalized.id ? { ...e, ...normalized } : e))
        }
        return [{ ...normalized, read: false }, ...prev].slice(0, 80)
      })

      persistClientPanelEvent(normalized)

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
          ev.type === 'inbox:supervisor_help' ||
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

  const markAllRead = useCallback(() => {
    setEvents(prev => prev.map(e => ({ ...e, read: true })))
    void api.post('/panel/notifications/read-all').then(() => {
      void qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
    })
  }, [qc])

  const markRead = useCallback(
    (id: string) => {
      setEvents(prev => prev.map(e => (e.id === id ? { ...e, read: true } : e)))
      void api.post(`/panel/notifications/${encodeURIComponent(id)}/read`).then(() => {
        void qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
      })
    },
    [qc],
  )

  const clearAll = useCallback(() => {
    markAllRead()
  }, [markAllRead])

  const value = useMemo<Ctx>(
    () => ({
      events,
      unreadCount,
      urgentUnreadCount,
      markAllRead,
      markRead,
      clearAll,
    }),
    [events, unreadCount, urgentUnreadCount, markAllRead, markRead, clearAll],
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
