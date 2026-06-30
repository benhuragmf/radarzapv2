import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { api } from '../../lib/api'
import { can, canAny, getMe } from '../../lib/auth'
import { usePanelSocket } from '../../hooks/usePanelSocket'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { LeadCaptureDetail } from '../../components/leads/LeadCaptureDetail'
import { LeadStatusReasonModal } from '../../components/leads/LeadStatusReasonModal'
import { notifySuccess, mutationError } from '../../lib/notify'
import { EmptyState, LoadingState } from '@/design-system'
import { LEAD_STATUS_DISPLAY } from '../../lib/leadUi'
import type { LeadCaptureListItem, LeadCaptureStatus, LeadTemperature } from '@radarchat-types/lead-form'
import { LEAD_TEMPERATURE_LABEL } from '@radarchat-types/lead-form'

export default function LeadCaptureDetailPage() {
  const { captureId = '' } = useParams<{ captureId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [statusReasonModal, setStatusReasonModal] = useState<{
    id: string
    status: 'lost' | 'spam'
    name: string
  } | null>(null)

  const focusConversa = searchParams.get('tab') === 'conversa'

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe })
  const canManage = canAny(me ?? null, 'leads:manage', 'send:destination:manage')
  const canReply = can(me ?? null, 'inbox:reply')

  const { data: item, isLoading, error } = useQuery({
    queryKey: ['lead-capture', captureId],
    queryFn: () => api.get<LeadCaptureListItem>(`/leads/captures/${captureId}`),
    enabled: Boolean(captureId),
  })

  const { data: contactGroups = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['contact-groups'],
    queryFn: () => api.get('/contact-groups'),
  })

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['lead-capture', captureId] })
    void qc.invalidateQueries({ queryKey: ['leads-captures'] })
    void qc.invalidateQueries({ queryKey: ['leads-stats'] })
    void qc.invalidateQueries({ queryKey: ['leads-classification-stats'] })
  }, [qc, captureId])

  usePanelSocket(Boolean(captureId), ev => {
    if (ev.type === 'lead:new_entry' || ev.type === 'lead:updated') {
      invalidate()
    }
  })

  const updateCapture = useMutation({
    mutationFn: (payload: {
      status?: LeadCaptureStatus
      temperature?: LeadTemperature | null
      internalNotes?: string
      statusReason?: string
    }) => api.patch<LeadCaptureListItem>(`/leads/captures/${captureId}`, payload),
    onSuccess: (_data, variables) => {
      invalidate()
      if (variables.status) {
        notifySuccess(`Status: ${LEAD_STATUS_DISPLAY[variables.status]}`)
      } else if (variables.temperature !== undefined) {
        notifySuccess(
          variables.temperature
            ? `Prioridade: ${LEAD_TEMPERATURE_LABEL[variables.temperature]}`
            : 'Prioridade removida',
        )
      } else if (variables.internalNotes !== undefined) {
        notifySuccess('Observações salvas')
      }
    },
    onError: mutationError,
  })

  const linkCapture = useMutation({
    mutationFn: (contactId: string) =>
      api.post<LeadCaptureListItem>(`/leads/captures/${captureId}/link`, { contactId }),
    onSuccess: () => {
      invalidate()
      notifySuccess('Lead vinculado ao contato')
    },
    onError: mutationError,
  })

  const convertCapture = useMutation({
    mutationFn: (opts: { contactGroupIds?: string[] }) =>
      api.post<LeadCaptureListItem>(`/leads/captures/${captureId}/convert`, opts),
    onSuccess: () => {
      invalidate()
      notifySuccess('Lead convertido em contato')
    },
    onError: mutationError,
  })

  const addToGroups = useMutation({
    mutationFn: (groupIds: string[]) =>
      api.post<LeadCaptureListItem>(`/leads/captures/${captureId}/add-to-groups`, { groupIds }),
    onSuccess: () => {
      invalidate()
      notifySuccess('Listas atualizadas')
    },
    onError: mutationError,
  })

  const deleteCapture = useMutation({
    mutationFn: () => api.delete(`/leads/captures/${captureId}`),
    onSuccess: () => {
      invalidate()
      notifySuccess('Lead excluído')
      navigate('/platform/leads')
    },
    onError: mutationError,
  })

  const openInbox = useMutation({
    mutationFn: () =>
      api.post<{ conversationId: string; created?: boolean }>(`/leads/captures/${captureId}/open-inbox`, {}),
    onSuccess: data => {
      invalidate()
      void qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
      void qc.invalidateQueries({ queryKey: ['inbox-conversation', data.conversationId] })
      notifySuccess(data.created ? 'Conversa criada no Inbox' : 'Conversa aberta no Inbox')
      navigate(`/platform/inbox?conv=${encodeURIComponent(data.conversationId)}&status=in_progress`)
    },
    onError: mutationError,
  })

  const handleConversaFocusDone = useCallback(() => {
    if (searchParams.get('tab')) {
      const next = new URLSearchParams(searchParams)
      next.delete('tab')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const pageTitle = useMemo(() => item?.name ?? 'Lead', [item?.name])

  return (
    <PlatformPage title={pageTitle} description="Qualifique, responda e converta este lead." compact>
      <div className="mb-4">
        <Link
          to="/platform/leads"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)] transition-colors"
        >
          <ArrowLeft size={15} /> Voltar ao Kanban
        </Link>
      </div>

      {isLoading ? (
        <LoadingState rows={6} className="pt-4" />
      ) : error || !item ? (
        <EmptyState
          icon={UserPlus}
          title="Lead não encontrado"
          description="O lead pode ter sido removido ou você não tem acesso."
          action={
            <Link to="/platform/leads" className="text-sm text-[var(--rz-primary)] hover:underline">
              Ver todos os leads
            </Link>
          }
        />
      ) : (
        <>
          <LeadCaptureDetail
            item={item}
            canManage={canManage}
            canReply={canReply}
            contactGroups={contactGroups}
            layout="page"
            focusConversa={focusConversa}
            onConversaFocusDone={handleConversaFocusDone}
            onClose={() => navigate('/platform/leads')}
            onUpdate={patch => {
              if (patch.status === 'lost' || patch.status === 'spam') {
                setStatusReasonModal({ id: item.id, status: patch.status, name: item.name })
                return
              }
              updateCapture.mutate(patch)
            }}
            onOpenInbox={() => openInbox.mutate()}
            onConvert={opts => convertCapture.mutate(opts)}
            onLinkContact={contactId => linkCapture.mutate(contactId)}
            onInboxConversationReady={() => invalidate()}
            onAddToGroups={groupIds => addToGroups.mutate(groupIds)}
            onDelete={() => {
              if (window.confirm('Excluir este lead permanentemente?')) deleteCapture.mutate()
            }}
            openingInbox={openInbox.isPending}
            converting={convertCapture.isPending}
            linking={linkCapture.isPending}
            pending={updateCapture.isPending || addToGroups.isPending}
          />

          {statusReasonModal && (
            <LeadStatusReasonModal
              open
              status={statusReasonModal.status}
              leadName={statusReasonModal.name}
              onClose={() => setStatusReasonModal(null)}
              onConfirm={reason => {
                updateCapture.mutate(
                  { status: statusReasonModal.status, statusReason: reason || undefined },
                  { onSuccess: () => setStatusReasonModal(null) },
                )
              }}
              submitting={updateCapture.isPending}
            />
          )}
        </>
      )}
    </PlatformPage>
  )
}
