import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { InboxComposer, type QuickReplyItem } from '../inbox/InboxComposer'
import { api } from '../../lib/api'
import { mutationError, notifySuccess } from '../../lib/notify'
import type { LeadCaptureListItem } from '@radarzap-types/lead-form'

type Props = {
  item: LeadCaptureListItem
  canReply: boolean
  onConversationReady: (conversationId: string) => void
  compact?: boolean
}

export function LeadWhatsAppComposer({ item, canReply, onConversationReady, compact }: Props) {
  const [text, setText] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(item.inboxConversationId ?? null)
  const [preparing, setPreparing] = useState(false)
  const [sending, setSending] = useState(false)

  const { data: quickReplies = [] } = useQuery({
    queryKey: ['inbox-quick-replies'],
    queryFn: () => api.get<QuickReplyItem[]>('/inbox/quick-replies'),
    enabled: canReply,
    staleTime: 60_000,
  })

  useEffect(() => {
    setConversationId(item.inboxConversationId ?? null)
    setText('')
  }, [item.id, item.inboxConversationId])

  const ensureConversation = async (): Promise<string> => {
    if (conversationId) return conversationId
    setPreparing(true)
    try {
      const result = await api.post<{ conversationId: string }>(`/leads/captures/${item.id}/open-inbox`, {})
      setConversationId(result.conversationId)
      onConversationReady(result.conversationId)
      return result.conversationId
    } finally {
      setPreparing(false)
    }
  }

  const handleSend = async () => {
    const body = text.trim()
    if (!body || !canReply) return
    setSending(true)
    try {
      const convId = await ensureConversation()
      await api.post(`/inbox/conversations/${convId}/reply`, { text: body })
      setText('')
      notifySuccess('Mensagem enviada pelo WhatsApp')
    } catch (e) {
      mutationError(e)
    } finally {
      setSending(false)
    }
  }

  if (!canReply) {
    return (
      <p className="text-xs text-[var(--rz-text-muted)]">
        Sem permissão para enviar mensagens. Peça acesso de atendimento ao administrador.
      </p>
    )
  }

  if (item.phone.startsWith('email:')) {
    return (
      <p className="text-xs text-[var(--rz-text-muted)]">
        Este lead não tem telefone. Vincule a um contato com WhatsApp antes de enviar mensagens.
      </p>
    )
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {preparing && <p className="text-xs text-[var(--rz-text-muted)]">Abrindo conversa no Inbox…</p>}
      <InboxComposer
        value={text}
        onChange={setText}
        onSend={() => void handleSend()}
        sending={sending || preparing}
        sendDisabled={preparing}
        quickReplies={quickReplies}
      />
      {conversationId && (
        <div className="flex justify-end">
          <Link
            to={`/platform/inbox?conv=${encodeURIComponent(conversationId)}`}
            className="inline-flex items-center text-xs px-2.5 py-1.5 rounded-lg border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]"
          >
            Abrir conversa completa no Inbox
          </Link>
        </div>
      )}
    </div>
  )
}
