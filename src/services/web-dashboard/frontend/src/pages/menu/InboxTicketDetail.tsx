import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '../../lib/api'
import { getMe, type AuthUser } from '../../lib/auth'
import { usePanelSocket } from '../../hooks/usePanelSocket'
import type { PanelEvent } from '../../context/EventNotificationContext'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Button } from '../../components/ui/Button'
import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'
import { InboxTicketDetailView } from '../../components/inbox/InboxTicketDetailView'
import type { InboxMessageView } from '../../components/inbox/InboxMessageBubble'
import type { ContactStats, PreviousConversation } from '../../components/inbox/InboxContactSidebar'
import type { InboxTicketDetail, InboxTicketTeamMember } from '../../lib/inboxTicket'
import { ArrowLeft, Ticket } from 'lucide-react'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'
import { LoadingState, EmptyState } from '@/design-system'

interface DetailResponse {
  conversation: {
    _id: string
    contactName: string
    contactIdentifier: string
    ticketRef?: string
    status: string
    channel?: 'whatsapp' | 'webchat_site'
    departmentName?: string
    assignedUserName?: string
    createdAt?: string
    resolvedAt?: string
    acceptedAt?: string
    lastMessageAt?: string
  }
  ticket: InboxTicketDetail
  teamMembers: InboxTicketTeamMember[]
  messages: InboxMessageView[]
  contactStats?: ContactStats
  previousConversations?: PreviousConversation[]
  contact?: {
    _id: string
    name: string
    email: string
    notes: string
    organization: string
    identifier: string
  } | null
}

export default function InboxTicketDetailPage() {
  const { ref = '' } = useParams<{ ref: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['inbox-ticket', ref],
    queryFn: () => api.get<DetailResponse>(`/inbox/tickets/${encodeURIComponent(ref)}`),
    enabled: Boolean(ref),
    refetchInterval: 8_000,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inbox-ticket', ref] })
    qc.invalidateQueries({ queryKey: ['inbox-tickets'] })
    qc.invalidateQueries({ queryKey: ['inbox-ticket-stats'] })
  }

  const onPanelEvent = useCallback(
    (event: PanelEvent) => {
      if (event.href?.includes(`/tickets/${ref}`) || event.title.includes(ref)) {
        invalidate()
      }
    },
    [ref, qc],
  )

  usePanelSocket(Boolean(ref), onPanelEvent, { sessionAlerts: false })

  const closeMutation = useMutation({
    mutationFn: () => api.post(`/inbox/tickets/${encodeURIComponent(ref)}/close`),
    onSuccess: invalidate,
    onError: mutationError,
  })

  const reopenMutation = useMutation({
    mutationFn: () => api.post(`/inbox/tickets/${encodeURIComponent(ref)}/reopen`),
    onSuccess: invalidate,
    onError: mutationError,
  })

  const clientUpdateMutation = useMutation({
    mutationFn: () => api.post(`/inbox/tickets/${encodeURIComponent(ref)}/client-update`),
    onSuccess: () => {
      invalidate()
      const isWebChat =
        data?.conversation.channel === 'webchat_site' || data?.ticket.channel === 'webchat_site'
      notifySuccess(
        isWebChat
          ? 'Atualização enviada ao visitante no chat do site.'
          : 'Atualização enviada ao cliente no WhatsApp.',
      )
    },
    onError: mutationError,
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/inbox/tickets/${encodeURIComponent(ref)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-tickets'] })
      qc.invalidateQueries({ queryKey: ['inbox-ticket-stats'] })
      navigate('/platform/inbox/tickets')
    },
    onError: mutationError,
  })

  const forwardMutation = useMutation({
    mutationFn: (payload: { targetUserId?: string; phone?: string; note?: string }) =>
      api.post(`/inbox/tickets/${encodeURIComponent(ref)}/forward`, payload),
    onSuccess: () => {
      invalidate()
      notifySuccess('Ticket encaminhado via WhatsApp.')
    },
    onError: mutationError,
  })

  const commentMutation = useMutation({
    mutationFn: ({ body, mentionedUserIds }: { body: string; mentionedUserIds: string[] }) =>
      api.post(`/inbox/tickets/${encodeURIComponent(ref)}/comments`, { body, mentionedUserIds }),
    onSuccess: invalidate,
    onError: mutationError,
  })

  const noteMutation = useMutation({
    mutationFn: (body: string) =>
      api.post(`/inbox/tickets/${encodeURIComponent(ref)}/internal-notes`, { body }),
    onSuccess: invalidate,
    onError: mutationError,
  })

  const assignMutation = useMutation({
    mutationFn: (assignedUserId: string) =>
      api.patch(`/inbox/tickets/${encodeURIComponent(ref)}`, { assignedUserId }),
    onSuccess: invalidate,
    onError: mutationError,
  })

  const statusMutation = useMutation({
    mutationFn: (status: 'open' | 'in_progress' | 'client_replied') =>
      api.patch(`/inbox/tickets/${encodeURIComponent(ref)}`, { status }),
    onSuccess: invalidate,
    onError: mutationError,
  })

  return (
    <PlatformPage
      title={data?.ticket.ticketRef ? `Ticket ${data.ticket.ticketRef}` : 'Ticket'}
      description="Chamado interno da equipe — independente do status do chat WhatsApp."
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link to="/platform/inbox/tickets">
          <Button size="sm" variant="secondary">
            <ArrowLeft size={14} /> Lista de tickets
          </Button>
        </Link>
        <InboxAtendimentoNav me={me} className="flex-1 min-w-0" />
      </div>

      {isLoading ? (
        <LoadingState rows={4} className="pt-8" />
      ) : error ? (
        <EmptyState
          icon={Ticket}
          title="Ticket não encontrado"
          description="O ticket pode ter sido removido ou você não tem acesso."
          action={
            <Link to="/platform/inbox/tickets" className="text-sm text-[var(--rz-primary)] hover:underline">
              Ver todos os tickets
            </Link>
          }
        />
      ) : data ? (
        <InboxTicketDetailView
          conversation={data.conversation}
          ticket={data.ticket}
          teamMembers={data.teamMembers ?? []}
          messages={data.messages}
          contact={data.contact}
          contactStats={data.contactStats}
          previousConversations={data.previousConversations}
          onCloseTicket={() => closeMutation.mutate()}
          closingTicket={closeMutation.isPending}
          onReopenTicket={() => reopenMutation.mutate()}
          reopeningTicket={reopenMutation.isPending}
          onSendClientUpdate={() => clientUpdateMutation.mutate()}
          sendingClientUpdate={clientUpdateMutation.isPending}
          onDeleteTicket={() => deleteMutation.mutate()}
          deletingTicket={deleteMutation.isPending}
          onForward={payload => forwardMutation.mutateAsync(payload)}
          forwarding={forwardMutation.isPending}
          onAssign={userId => assignMutation.mutateAsync(userId)}
          assigning={assignMutation.isPending}
          onSetStatus={status => statusMutation.mutateAsync(status)}
          settingStatus={statusMutation.isPending}
          onAddComment={(body, mentionedUserIds) =>
            commentMutation.mutateAsync({ body, mentionedUserIds })
          }
          addingComment={commentMutation.isPending}
          onAddInternalNote={body => noteMutation.mutateAsync(body)}
          addingInternalNote={noteMutation.isPending}
        />
      ) : null}
    </PlatformPage>
  )
}
