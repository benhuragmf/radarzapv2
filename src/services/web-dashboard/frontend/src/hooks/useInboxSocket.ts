import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '../lib/socket'

interface InboxSocketPayload {
  conversationId: string
  clientId: string
}

export function useInboxSocket(enabled = true) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!enabled) return

    const socket = getSocket()

    const onConversation = (payload: InboxSocketPayload) => {
      qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
      if (payload.conversationId) {
        qc.invalidateQueries({ queryKey: ['inbox-conversation', payload.conversationId] })
      }
    }

    const onMessage = (payload: InboxSocketPayload) => {
      qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
      if (payload.conversationId) {
        qc.invalidateQueries({ queryKey: ['inbox-conversation', payload.conversationId] })
      }
    }

    socket.on('inbox:conversation', onConversation)
    socket.on('inbox:message', onMessage)

    return () => {
      socket.off('inbox:conversation', onConversation)
      socket.off('inbox:message', onMessage)
    }
  }, [enabled, qc])
}
