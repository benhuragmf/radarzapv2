import { useEffect } from 'react'
import { getSocket } from '../lib/socket'

const HEARTBEAT_MS = 45_000

/** Mantém presença do atendente enquanto o painel está aberto (socket + heartbeat). */
export function useAgentPresenceHeartbeat(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const socket = getSocket()
    const ping = () => {
      if (socket.connected) socket.emit('agent:heartbeat')
    }

    ping()
    const timer = window.setInterval(ping, HEARTBEAT_MS)
    socket.on('connect', ping)

    return () => {
      window.clearInterval(timer)
      socket.off('connect', ping)
    }
  }, [enabled])
}
