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

function maybeBrowserNotify(body?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  const onWebChatPage = window.location.pathname.startsWith('/platform/webchat')
  if (document.visibilityState === 'visible' && onWebChatPage) return

  const text = body?.trim().slice(0, 160) || 'Nova mensagem de um visitante'
  const show = () => {
    try {
      new Notification('Chat do site — RadarZap', { body: text })
    } catch {
      /* ignore */
    }
  }

  if (Notification.permission === 'granted') {
    show()
  } else if (Notification.permission !== 'denied') {
    void Notification.requestPermission().then(p => {
      if (p === 'granted') show()
    })
  }
}

export function useWebChatSocket(
  enabled: boolean,
  options?: { onInboundChime?: boolean; notifyBrowser?: boolean },
) {
  const qc = useQueryClient()
  const chime = options?.onInboundChime !== false
  const notifyBrowser = options?.notifyBrowser === true

  useEffect(() => {
    if (!enabled) return
    const socket = getSocket()

    const onMessage = (payload: {
      conversationId?: string
      message?: { direction?: string; body?: string }
    }) => {
      if (!payload?.conversationId) return
      if (payload.message?.direction === 'inbound') {
        if (chime) playInboundChime()
        if (notifyBrowser) maybeBrowserNotify(payload.message.body)
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
  }, [enabled, chime, notifyBrowser, qc])
}
