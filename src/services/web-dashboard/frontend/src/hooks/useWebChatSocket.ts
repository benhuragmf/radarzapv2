import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '../lib/socket'

function playInboundChime() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.value = 0.04
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    osc.onended = () => void ctx.close()
  } catch {
    /* ignore */
  }
}

export function useWebChatSocket(enabled: boolean, options?: { onInbound?: boolean }) {
  const qc = useQueryClient()
  const notifyInbound = options?.onInbound !== false

  useEffect(() => {
    if (!enabled) return
    const socket = getSocket()

    const onMessage = (payload: {
      conversationId?: string
      message?: { direction?: string }
    }) => {
      if (!payload?.conversationId) return
      if (notifyInbound && payload.message?.direction === 'inbound') {
        playInboundChime()
      }
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
      qc.invalidateQueries({ queryKey: ['webchat-stats'] })
      qc.invalidateQueries({ queryKey: ['webchat-conversation', payload.conversationId] })
    }

    const onConversation = () => {
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
      qc.invalidateQueries({ queryKey: ['webchat-stats'] })
    }

    socket.on('webchat:message', onMessage)
    socket.on('webchat:conversation', onConversation)

    return () => {
      socket.off('webchat:message', onMessage)
      socket.off('webchat:conversation', onConversation)
    }
  }, [enabled, notifyInbound, qc])
}
