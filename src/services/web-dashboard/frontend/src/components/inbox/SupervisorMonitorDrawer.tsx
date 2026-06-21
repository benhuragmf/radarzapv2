import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { DetailsDrawer } from '@/design-system'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { InboxMessageBubble, type InboxMessageView } from './InboxMessageBubble'
import { LoadingState } from '@/design-system'
import { webChatMediaSrc } from '../../lib/webchatInbox'
import { ExternalLink, MessageSquare } from 'lucide-react'

interface ConversationDetail {
  conversation: {
    _id: string
    contactName: string
    contactIdentifier: string
    status: string
    channel?: string
    assignedUserName?: string
    departmentName?: string
    widgetName?: string
    ticketRef?: string
    whatsappBridgeActive?: boolean
  }
  messages: InboxMessageView[]
}

interface Props {
  conversationId: string | null
  onClose: () => void
}

const STATUS_LABEL: Record<string, string> = {
  bot_triage: 'Triagem',
  waiting_queue: 'Na fila',
  in_progress: 'Em atendimento',
}

function channelLabel(channel?: string): string {
  if (channel === 'webchat_site') return 'ChatBox'
  if (channel === 'whatsapp_cloud') return 'WhatsApp Cloud'
  return 'WhatsApp'
}

export function SupervisorMonitorDrawer({ conversationId, onClose }: Props) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['supervisor-monitor', conversationId],
    queryFn: () => api.get<ConversationDetail>(`/inbox/conversations/${conversationId}`),
    enabled: Boolean(conversationId),
    refetchInterval: 8_000,
  })

  useEffect(() => {
    if (!conversationId) return
    void refetch()
  }, [conversationId, refetch])

  const conv = data?.conversation
  const messages = (data?.messages ?? []).map(m => {
    if (m.mediaUrl && !m.mediaSrc) {
      return { ...m, mediaSrc: webChatMediaSrc(m.mediaUrl) }
    }
    return m
  })

  return (
    <DetailsDrawer
      open={Boolean(conversationId)}
      onClose={onClose}
      title={conv?.contactName ?? 'Monitorar conversa'}
      description={
        conv
          ? `${channelLabel(conv.channel)} · ${conv.contactIdentifier}${conv.assignedUserName ? ` · ${conv.assignedUserName}` : ''}`
          : 'Visualização somente leitura para supervisão'
      }
      width="xl"
      className="max-w-2xl"
      footer={
        conversationId ? (
          <div className="flex flex-wrap gap-2">
            <Link to={`/platform/inbox?conv=${encodeURIComponent(conversationId)}`}>
              <Button size="sm" variant="secondary">
                <ExternalLink size={14} /> Abrir no Inbox
              </Button>
            </Link>
            <Button size="sm" variant="secondary" onClick={onClose}>
              Fechar monitor
            </Button>
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <LoadingState rows={3} />
      ) : !conv ? (
        <p className="text-sm text-[var(--rz-text-muted)]">Conversa não encontrada.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              label={STATUS_LABEL[conv.status] ?? conv.status}
              variant={conv.status === 'in_progress' ? 'green' : 'blue'}
            />
            <Badge label={channelLabel(conv.channel)} variant="blue" />
            {conv.whatsappBridgeActive ? (
              <Badge label="Bridge WhatsApp" variant="yellow" />
            ) : null}
            {conv.ticketRef ? <Badge label={conv.ticketRef} variant="blue" /> : null}
          </div>
          {(conv.widgetName || conv.departmentName) && (
            <p className="text-xs text-[var(--rz-text-muted)]">
              {[conv.widgetName, conv.departmentName].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40 p-3 space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-[var(--rz-text-muted)]">
                <MessageSquare size={24} className="opacity-40" />
                <p className="text-sm">Nenhuma mensagem ainda.</p>
              </div>
            ) : (
              messages.map(m => <InboxMessageBubble key={m._id} message={m} />)
            )}
          </div>
          <p className="text-[11px] text-[var(--rz-text-muted)]">
            Modo supervisão — somente leitura. Atualiza automaticamente a cada 8s.
          </p>
        </div>
      )}
    </DetailsDrawer>
  )
}
