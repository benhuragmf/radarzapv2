import { useEffect, useRef } from 'react'
import { getSocket } from '../lib/socket'
import type { PanelEvent } from '../context/EventNotificationContext'

const SESSION_ALERT_COOLDOWN_MS = 60_000

export function usePanelSocket(
  enabled: boolean,
  onPanelEvent?: (event: PanelEvent) => void,
  options?: { sessionAlerts?: boolean },
) {
  const sessionAlerts = options?.sessionAlerts !== false
  const lastSessionAlertAt = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!enabled) return

    const socket = getSocket()

    const onEvent = (payload: PanelEvent) => {
      onPanelEvent?.(payload)
    }

    const onSession = (payload: {
      status?: string
      statusReason?: number
    }) => {
      if (!sessionAlerts) return
      if (payload.status !== 'connected' && payload.status !== 'disconnected') return

      const now = Date.now()
      const key = payload.status
      const last = lastSessionAlertAt.current[key] ?? 0
      if (now - last < SESSION_ALERT_COOLDOWN_MS) return
      lastSessionAlertAt.current[key] = now

      if (payload.status === 'disconnected') {
        onPanelEvent?.({
          id: `sess-${now}`,
          type: 'whatsapp:disconnected',
          title: 'WhatsApp desconectado',
          body:
            payload.statusReason === 401
              ? 'Sessão encerrada (logout). Escaneie o QR novamente.'
              : payload.statusReason === 440
                ? 'Outra sessão WhatsApp Web substituiu esta. Feche outras abas/dispositivos e reconecte manualmente em Sessões.'
                : 'Conexão perdida. O sistema tentará reconectar com intervalo seguro.',
          href: '/sessions',
          createdAt: new Date().toISOString(),
        })
      }
      if (payload.status === 'connected') {
        onPanelEvent?.({
          id: `sess-up-${now}`,
          type: 'whatsapp:connected',
          title: 'WhatsApp conectado',
          body: 'Sessão ativa novamente.',
          href: '/sessions',
          createdAt: new Date().toISOString(),
        })
      }
    }

    socket.on('panel:event', onEvent)
    socket.on('session:update', onSession)

    return () => {
      socket.off('panel:event', onEvent)
      socket.off('session:update', onSession)
    }
  }, [enabled, onPanelEvent, sessionAlerts])
}
