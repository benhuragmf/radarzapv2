import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSocket } from '../lib/socket'

export function useWebChatSocket(enabled: boolean) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!enabled) return
    const socket = getSocket()

    const onMessage = (payload: { conversationId?: string }) => {
      if (!payload?.conversationId) return
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
      qc.invalidateQueries({ queryKey: ['webchat-conversation', payload.conversationId] })
    }

    const onConversation = () => {
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
    }

    socket.on('webchat:message', onMessage)
    socket.on('webchat:conversation', onConversation)

    return () => {
      socket.off('webchat:message', onMessage)
      socket.off('webchat:conversation', onConversation)
    }
  }, [enabled, qc])
}
