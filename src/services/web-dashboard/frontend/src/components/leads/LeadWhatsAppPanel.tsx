import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare, X } from 'lucide-react'
import { InboxComposer, type QuickReplyItem } from '../inbox/InboxComposer'
import { api } from '../../lib/api'
import { mutationError, notifySuccess } from '../../lib/notify'
import type { LeadCaptureListItem } from '@radarzap-types/lead-form'

interface Props {
  item: LeadCaptureListItem
  open: boolean
  onClose: () => void
  onConversationReady: (conversationId: string) => void
  canReply: boolean
}

export function LeadWhatsAppPanel({ item, open, onClose, onConversationReady, canReply }: Props) {
  const [text, setText] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(item.inboxConversationId ?? null)
  const [preparing, setPreparing] = useState(false)
  const [sending, setSending] = useState(false)

  const { data: quickReplies = [] } = useQuery({
    queryKey: ['inbox-quick-replies'],
    queryFn: () => api.get<QuickReplyItem[]>('/inbox/quick-replies'),
    enabled: open && canReply,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (open) {
      setConversationId(item.inboxConversationId ?? null)
      setText('')
    }
  }, [open, item.id, item.inboxConversationId])

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

  if (!open) return null

  const phoneLabel = item.phone.startsWith('email:') ? 'Sem telefone' : item.phone

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-[0_-8px_32px_rgba(0,0,0,0.25)]">
      <div className="max-w-5xl mx-auto px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare size={16} className="text-[var(--rz-primary)] shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">WhatsApp — {item.name}</p>
              <p className="text-xs text-[var(--rz-text-muted)] truncate">{phoneLabel}</p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)]"
            onClick={onClose}
            aria-label="Fechar painel WhatsApp"
          >
            <X size={18} />
          </button>
        </div>

        {!canReply ? (
          <p className="text-sm text-[var(--rz-text-muted)] pb-1">
            Sem permissão para enviar mensagens. Peça acesso de atendimento ao administrador.
          </p>
        ) : item.phone.startsWith('email:') ? (
          <p className="text-sm text-[var(--rz-text-muted)] pb-1">
            Este lead não tem telefone. Vincule a um contato com WhatsApp antes de enviar mensagens.
          </p>
        ) : (
          <>
            {preparing && (
              <p className="text-xs text-[var(--rz-text-muted)]">Abrindo conversa no Inbox…</p>
            )}
            <InboxComposer
              value={text}
              onChange={setText}
              onSend={() => void handleSend()}
              sending={sending || preparing}
              sendDisabled={preparing}
              quickReplies={quickReplies}
            />
            {conversationId && (
              <div className="flex justify-end pb-1">
                <Link
                  to={`/platform/inbox?conv=${encodeURIComponent(conversationId)}`}
                  className="inline-flex items-center text-sm px-3 py-1.5 rounded-lg border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]"
                >
                  Abrir conversa completa no Inbox
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
