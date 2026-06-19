import type { InboxMessageView } from '../components/inbox/InboxMessageBubble'

export interface WebChatReceiptPayload {
  conversationId?: string
  messageIds?: string[]
  deliveredAt?: string
  readAt?: string
  inboundBatch?: boolean
  readThrough?: boolean
}

export function applyReceiptsToInboxMessages(
  messages: InboxMessageView[],
  payload: WebChatReceiptPayload,
): InboxMessageView[] {
  const { messageIds = [], deliveredAt, readAt, inboundBatch, readThrough } = payload
  if (!deliveredAt && !readAt) return messages

  if (inboundBatch && readAt) {
    return messages.map(m =>
      m.direction === 'inbound' && !m.readAt ? { ...m, readAt } : m,
    )
  }

  if (readThrough && readAt && messageIds.length === 1) {
    const anchor = messages.find(m => m._id === messageIds[0])
    const anchorTime = anchor ? new Date(anchor.createdAt).getTime() : null
    if (anchorTime == null) return messages
    return messages.map(m => {
      if (m.direction !== 'outbound') return m
      if (new Date(m.createdAt).getTime() > anchorTime) return m
      return {
        ...m,
        deliveredAt: deliveredAt ?? m.deliveredAt,
        readAt: readAt ?? m.readAt,
      }
    })
  }

  if (!messageIds.length) return messages

  const idSet = new Set(messageIds)
  return messages.map(m => {
    if (m.direction !== 'outbound' || !idSet.has(m._id)) return m
    return {
      ...m,
      deliveredAt: deliveredAt ?? m.deliveredAt,
      readAt: readAt ?? m.readAt,
    }
  })
}
