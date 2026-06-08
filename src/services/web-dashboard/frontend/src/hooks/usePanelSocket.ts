import { useEffect } from 'react'
import { getSocket } from '../lib/socket'
import type { PanelEvent } from '../context/EventNotificationContext'

export function usePanelSocket(
  enabled: boolean,
  onPanelEvent?: (event: PanelEvent) => void,
) {
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
      if (payload.status === 'disconnected') {
        onPanelEvent?.({
          id: `sess-${Date.now()}`,
          type: 'whatsapp:disconnected',
          title: 'WhatsApp desconectado',
          body:
            payload.statusReason === 401
              ? 'Sessão encerrada (logout). Escaneie o QR novamente.'
              : 'Conexão perdida. Tentando reconectar…',
          href: '/sessions',
          createdAt: new Date().toISOString(),
        })
      }
      if (payload.status === 'connected') {
        onPanelEvent?.({
          id: `sess-up-${Date.now()}`,
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
  }, [enabled, onPanelEvent])
}
