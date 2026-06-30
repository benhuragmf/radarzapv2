import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '../lib/socket'
import { showBrowserNotification } from '../lib/browserNotify'
import { applyReceiptsToInboxMessages, type WebChatReceiptPayload } from '../lib/webchatReceipts'
import type { InboxMessageView } from '../components/inbox/InboxMessageBubble'

interface ConversationDetail {
  conversation: Record<string, unknown>
  messages: InboxMessageView[]
}

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

function maybeBrowserNotify(body?: string, conversationId?: string) {
  const text = body?.trim().slice(0, 160) || 'Nova mensagem de um visitante'
  const convKey = conversationId ? `wc:${conversationId}` : undefined
  showBrowserNotification({
    title: 'Chat do site — Radar Chat',
    body: text,
    href: convKey ? `/platform/inbox?conv=${encodeURIComponent(convKey)}` : '/platform/webchat',
    tag: convKey ? `webchat:${conversationId}` : 'webchat:message',
    skipWhenViewingConversationId: convKey,
    viewingConversationId:
      typeof window !== 'undefined' && window.location.pathname.startsWith('/platform/inbox')
        ? new URLSearchParams(window.location.search).get('conv') ?? convKey ?? null
        : null,
  })
}

export function useWebChatSocket(
  enabled: boolean,
  options?: { onInboundChime?: boolean; notifyBrowser?: boolean; syncInbox?: boolean },
) {
  const qc = useQueryClient()
  const chime = options?.onInboundChime !== false
  const notifyBrowser = options?.notifyBrowser === true
  const syncInbox = options?.syncInbox === true

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
        if (notifyBrowser) maybeBrowserNotify(payload.message.body, payload.conversationId)
      }
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
      qc.invalidateQueries({ queryKey: ['webchat-stats'] })
      qc.invalidateQueries({ queryKey: ['webchat-conversation', payload.conversationId] })
      if (syncInbox) {
        qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
        qc.invalidateQueries({
          queryKey: ['inbox-conversation', `wc:${payload.conversationId}`],
        })
      }
    }

    const onConversation = (payload?: { conversationId?: string }) => {
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
      qc.invalidateQueries({ queryKey: ['webchat-stats'] })
      if (syncInbox) {
        qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
        if (payload?.conversationId) {
          qc.invalidateQueries({
            queryKey: ['inbox-conversation', `wc:${payload.conversationId}`],
          })
        }
      }
    }

    const onPresence = () => {
      qc.invalidateQueries({ queryKey: ['webchat-live-visitors'] })
    }

    const onReceipt = (payload: WebChatReceiptPayload) => {
      if (!payload?.conversationId) return
      const convKey = `wc:${payload.conversationId}`

      const patchMessages = (queryKey: readonly unknown[]) => {
        qc.setQueryData<ConversationDetail>(queryKey, old => {
          if (!old?.messages?.length) return old
          return {
            ...old,
            messages: applyReceiptsToInboxMessages(old.messages, payload),
          }
        })
      }

      patchMessages(['webchat-conversation', payload.conversationId])
      if (syncInbox) {
        patchMessages(['inbox-conversation', convKey])
      }
    }

    socket.on('webchat:message', onMessage)
    socket.on('webchat:conversation', onConversation)
    socket.on('webchat:presence', onPresence)
    socket.on('webchat:message-receipt', onReceipt)

    return () => {
      socket.off('webchat:message', onMessage)
      socket.off('webchat:conversation', onConversation)
      socket.off('webchat:presence', onPresence)
      socket.off('webchat:message-receipt', onReceipt)
    }
  }, [enabled, chime, notifyBrowser, syncInbox, qc])
}
