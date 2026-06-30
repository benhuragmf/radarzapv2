import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { can, canAny, getMe } from '../../lib/auth'
import { usePanelSocket } from '../../hooks/usePanelSocket'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { LeadFormEditorCard, type LeadFormEditorSectionId } from '../../components/leads/editor/LeadFormEditorCard'
import { LeadFormList } from '../../components/leads/LeadFormList'
import { LeadStatsDashboard } from '../../components/leads/LeadStatsDashboard'
import { LeadKanbanBoard } from '../../components/leads/LeadKanbanBoard'
import { LeadCaptureListTable } from '../../components/leads/LeadCaptureListTable'
import { LeadCapturesToolbar, type CaptureView, type PeriodFilter } from '../../components/leads/LeadCapturesToolbar'
import { LeadManualCaptureModal } from '../../components/leads/LeadManualCaptureModal'
import { LeadStatusReasonModal } from '../../components/leads/LeadStatusReasonModal'
import type { OperationalStatKey } from '../../lib/leadUi'
import { LEAD_STATUS_DISPLAY, SITE_FORM_ORIGINS } from '../../lib/leadUi'
import { LeadSegmentsTab } from '../../components/leads/LeadSegmentsTab'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import {
  FileInput,
  List,
  Plug,
  Plus,
} from 'lucide-react'
import { notifySuccess, mutationError } from '../../lib/notify'
import { inputCls, LoadingState, EmptyState } from '@/design-system'
import type {
  LeadCaptureListItem,
  LeadCaptureOrigin,
  LeadCaptureStatus,
  LeadTemperature,
  LeadFormListItem,
  LeadSegmentSummary,
  LeadStats,
  LeadClassificationStats,
} from '@radarzap-types/lead-form'
import type { ContactKind } from '../../lib/contactClassificationUi'
import {
  LEAD_TEMPERATURE_LABEL,
} from '@radarzap-types/lead-form'

type LeadsTab = 'captures' | 'forms' | 'segments'
type ClassificationStatKey = 'opt_in' | 'pending' | 'hot' | 'blocked' | 'unlinked'

const CAPTURE_VIEW_KEY = 'rz-leads-capture-view'

function loadCaptureView(): CaptureView {
  try {
    const s = localStorage.getItem(CAPTURE_VIEW_KEY)
    if (s === 'kanban' || s === 'list') return s
  } catch {
    /* ignore */
  }
  return typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'kanban' : 'list'
}

function periodToDates(period: PeriodFilter): { from?: string; to?: string } {
  if (!period) return {}
  const to = new Date()
  const from = new Date()
  if (period === 'today') from.setHours(0, 0, 0, 0)
  if (period === '7d') from.setDate(from.getDate() - 7)
  if (period === '30d') from.setDate(from.getDate() - 30)
  return { from: from.toISOString(), to: to.toISOString() }
}

export default function Leads() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState<LeadsTab>('captures')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadCaptureStatus | ''>('')
  const [formFilter, setFormFilter] = useState('')
  const [originFilter, setOriginFilter] = useState<LeadCaptureOrigin | ''>('')
  const [originsFilter, setOriginsFilter] = useState('')
  const [openOnlyFilter, setOpenOnlyFilter] = useState(false)
  const [manualCaptureOpen, setManualCaptureOpen] = useState(false)
  const [statusReasonModal, setStatusReasonModal] = useState<{
    id: string
    status: 'lost' | 'spam'
    name: string
  } | null>(null)
  const [groupFilter, setGroupFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('')
  const [consentFilter, setConsentFilter] = useState<'' | 'yes' | 'no'>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [activeStatKey, setActiveStatKey] = useState<OperationalStatKey | null>(null)
  const [activeClassificationStatKey, setActiveClassificationStatKey] =
    useState<ClassificationStatKey | null>(null)
  const [classificationKindFilter, setClassificationKindFilter] = useState<ContactKind | ''>('')
  const [classificationOptInOnly, setClassificationOptInOnly] = useState(false)
  const [classificationPendingOnly, setClassificationPendingOnly] = useState(false)
  const [classificationHotOnly, setClassificationHotOnly] = useState(false)
  const [classificationBlockedOnly, setClassificationBlockedOnly] = useState(false)
  const [unlinkedOnly, setUnlinkedOnly] = useState(false)
  const [pendingInboxId, setPendingInboxId] = useState<string | null>(null)
  const [activeFormId, setActiveFormId] = useState<string | null>(null)
  const [newFormName, setNewFormName] = useState('')
  const [formEditorSection, setFormEditorSection] = useState<LeadFormEditorSectionId | null>(null)
  const [page, setPage] = useState(1)
  const [captureView, setCaptureView] = useState<CaptureView>(loadCaptureView)
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)

  const setCaptureViewPersist = (v: CaptureView) => {
    setCaptureView(v)
    try {
      localStorage.setItem(CAPTURE_VIEW_KEY, v)
    } catch {
      /* ignore */
    }
  }

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe })
  const canManage = canAny(me ?? null, 'leads:manage', 'send:destination:manage')
  const canView = canAny(me ?? null, 'leads:view', 'consent:view')
  const canReply = can(me ?? null, 'inbox:reply')

  const captureQuery = useMemo(() => {
    const p = new URLSearchParams()
    if (search.trim()) p.set('search', search.trim())
    if (statusFilter) p.set('status', statusFilter)
    if (formFilter) p.set('formId', formFilter)
    if (originsFilter) p.set('origins', originsFilter)
    else if (originFilter) p.set('origin', originFilter)
    if (openOnlyFilter) p.set('openOnly', 'true')
    if (groupFilter) p.set('groupId', groupFilter)
    if (consentFilter === 'yes') p.set('hasConsent', 'true')
    if (consentFilter === 'no') p.set('hasConsent', 'false')
    if (assigneeFilter === '__unassigned__') p.set('unassigned', 'true')
    else if (assigneeFilter) p.set('assigneeId', assigneeFilter)
    const dates = periodToDates(periodFilter)
    if (dates.from) p.set('from', dates.from)
    if (dates.to) p.set('to', dates.to)
    if (classificationKindFilter) p.set('classificationKind', classificationKindFilter)
    if (classificationOptInOnly) p.set('classificationOptInOnly', 'true')
    if (classificationPendingOnly) p.set('classificationPendingOnly', 'true')
    if (classificationHotOnly) p.set('classificationHotOnly', 'true')
    if (classificationBlockedOnly) p.set('classificationBlockedOnly', 'true')
    if (unlinkedOnly) p.set('unlinkedOnly', 'true')
    p.set('page', String(page))
    p.set('limit', '30')
    return p.toString()
  }, [
    search,
    statusFilter,
    formFilter,
    originFilter,
    originsFilter,
    openOnlyFilter,
    groupFilter,
    periodFilter,
    consentFilter,
    assigneeFilter,
    classificationKindFilter,
    classificationOptInOnly,
    classificationPendingOnly,
    classificationHotOnly,
    classificationBlockedOnly,
    unlinkedOnly,
    page,
  ])

  const { data: stats } = useQuery<LeadStats>({
    queryKey: ['leads-stats'],
    queryFn: () => api.get('/leads/stats'),
    enabled: canView,
  })

  const { data: classificationStats } = useQuery<LeadClassificationStats>({
    queryKey: ['leads-classification-stats'],
    queryFn: () => api.get('/leads/classification-stats'),
    enabled: canView && tab === 'captures',
  })

  const { data: capturesData, isLoading: loadingCaptures } = useQuery({
    queryKey: ['leads-captures', captureQuery],
    queryFn: () =>
      api.get<{ items: LeadCaptureListItem[]; total: number }>(`/leads/captures?${captureQuery}`),
    enabled: canView && tab === 'captures',
  })

  const { data: forms = [], isLoading: loadingForms } = useQuery<LeadFormListItem[]>({
    queryKey: ['leads-forms'],
    queryFn: () => api.get('/leads/forms'),
    enabled: canView && (tab === 'forms' || tab === 'captures'),
  })

  const { data: segments = [], isLoading: loadingSegments } = useQuery<LeadSegmentSummary[]>({
    queryKey: ['leads-segments-summary'],
    queryFn: () => api.get('/leads/segments-summary'),
    enabled: canView && tab === 'segments',
  })

  const { data: assignees = [] } = useQuery<{ userId: string; displayName: string }[]>({
    queryKey: ['leads-assignees'],
    queryFn: () => api.get('/leads/assignees'),
    enabled: canView && (tab === 'forms' || tab === 'captures'),
  })

  const { data: contactGroups = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['contact-groups'],
    queryFn: () => api.get('/contact-groups'),
    enabled: canView,
  })

  const openLeadDetail = (id: string, tab?: 'conversa') => {
    navigate(tab ? `/platform/leads/${id}?tab=${tab}` : `/platform/leads/${id}`)
  }

  const openLeadWhatsApp = (item: LeadCaptureListItem) => {
    openLeadDetail(item.id, 'conversa')
  }

  const activeForm = useMemo(
    () => forms.find(f => f.id === activeFormId) ?? null,
    [forms, activeFormId],
  )

  useEffect(() => {
    if (!forms.length) {
      setActiveFormId(null)
      return
    }
    if (!activeFormId || !forms.some(f => f.id === activeFormId)) {
      setActiveFormId(forms[0].id)
    }
  }, [forms, activeFormId])

  const openFormEditor = (formId: string, section: LeadFormEditorSectionId = 'overview') => {
    setTab('forms')
    setActiveFormId(formId)
    setFormEditorSection(section)
  }

  const invalidateLeads = () => {
    void qc.invalidateQueries({ queryKey: ['leads-captures'] })
    void qc.invalidateQueries({ queryKey: ['leads-stats'] })
    void qc.invalidateQueries({ queryKey: ['leads-classification-stats'] })
    void qc.invalidateQueries({ queryKey: ['leads-segments-summary'] })
  }

  usePanelSocket(canView && tab === 'captures', ev => {
    if (ev.type === 'lead:new_entry' || ev.type === 'lead:updated') {
      invalidateLeads()
    }
  })

  const createForm = useMutation({
    mutationFn: (name: string) => api.post<LeadFormListItem>('/leads/forms', { name }),
    onSuccess: data => {
      void qc.invalidateQueries({ queryKey: ['leads-forms'] })
      setActiveFormId(data.id)
      setTab('forms')
      setFormEditorSection('overview')
      notifySuccess('Formulário criado')
    },
    onError: mutationError,
  })

  const updateCapture = useMutation({
    mutationFn: (payload: {
      id: string
      status?: LeadCaptureStatus
      temperature?: LeadTemperature | null
      internalNotes?: string
      statusReason?: string
    }) => api.patch<LeadCaptureListItem>(`/leads/captures/${payload.id}`, payload),
    onSuccess: (_data, variables) => {
      invalidateLeads()
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

  const createManualCapture = useMutation({
    mutationFn: (payload: {
      name: string
      phone: string
      email?: string
      message?: string
      temperature?: LeadTemperature
      origin?: LeadCaptureOrigin
    }) => api.post<LeadCaptureListItem>('/leads/captures', payload),
    onSuccess: data => {
      invalidateLeads()
      setManualCaptureOpen(false)
      navigate(`/platform/leads/${data.id}`)
      notifySuccess('Lead capturado')
    },
    onError: mutationError,
  })

  const convertCapture = useMutation({
    mutationFn: (payload: { id: string; contactGroupIds?: string[] }) =>
      api.post<LeadCaptureListItem>(`/leads/captures/${payload.id}/convert`, payload),
    onSuccess: () => {
      invalidateLeads()
      notifySuccess('Lead convertido em contato')
    },
    onError: mutationError,
  })

  const openInbox = useMutation({
    mutationFn: (captureId: string) =>
      api.post<{ conversationId: string; created?: boolean }>(`/leads/captures/${captureId}/open-inbox`, {}),
    onMutate: captureId => {
      setPendingInboxId(captureId)
    },
    onSuccess: data => {
      invalidateLeads()
      void qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
      void qc.invalidateQueries({ queryKey: ['inbox-conversation', data.conversationId] })
      notifySuccess(data.created ? 'Conversa criada no Inbox' : 'Conversa aberta no Inbox')
      navigate(`/platform/inbox?conv=${encodeURIComponent(data.conversationId)}&status=in_progress`)
    },
    onError: mutationError,
    onSettled: () => {
      setPendingInboxId(null)
    },
  })

  const updateForm = useMutation({
    mutationFn: (payload: Partial<LeadFormListItem> & { id: string }) =>
      api.patch(`/leads/forms/${payload.id}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads-forms'] })
      notifySuccess('Formulário salvo')
    },
    onError: mutationError,
  })

  const duplicateForm = useMutation({
    mutationFn: (id: string) => api.post<LeadFormListItem>(`/leads/forms/${id}/duplicate`, {}),
    onSuccess: data => {
      void qc.invalidateQueries({ queryKey: ['leads-forms'] })
      setActiveFormId(data.id)
      notifySuccess('Formulário duplicado')
    },
    onError: mutationError,
  })

  const deleteForm = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/forms/${id}`),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['leads-forms'] })
      if (activeFormId === id) setActiveFormId(null)
      notifySuccess('Formulário excluído')
    },
    onError: mutationError,
  })

  if (!canView) {
    return (
      <PlatformPage title="Leads">
        <EmptyState title="Sem permissão" description="Você não pode visualizar leads nesta conta." />
      </PlatformPage>
    )
  }

  const clearClassificationFilters = () => {
    setClassificationKindFilter('')
    setClassificationOptInOnly(false)
    setClassificationPendingOnly(false)
    setClassificationHotOnly(false)
    setClassificationBlockedOnly(false)
    setUnlinkedOnly(false)
    setActiveClassificationStatKey(null)
  }

  const clearAllFilters = () => {
    setSearch('')
    setStatusFilter('')
    setFormFilter('')
    setOriginFilter('')
    setOriginsFilter('')
    setOpenOnlyFilter(false)
    setGroupFilter('')
    setPeriodFilter('')
    setConsentFilter('')
    setAssigneeFilter('')
    setActiveStatKey(null)
    clearClassificationFilters()
    setPage(1)
  }

  const handleClassificationStatClick = (key: ClassificationStatKey) => {
    clearAllFilters()
    setActiveClassificationStatKey(key)
    if (key === 'opt_in') setClassificationOptInOnly(true)
    else if (key === 'pending') setClassificationPendingOnly(true)
    else if (key === 'hot') setClassificationHotOnly(true)
    else if (key === 'blocked') setClassificationBlockedOnly(true)
    else if (key === 'unlinked') setUnlinkedOnly(true)
  }

  const handleOperationalStatClick = (key: OperationalStatKey) => {
    clearAllFilters()
    setActiveStatKey(key)
    if (key === 'whatsappWaiting') {
      setOriginFilter('whatsapp')
      setOpenOnlyFilter(true)
    } else if (key === 'siteWaiting') {
      setOriginsFilter(SITE_FORM_ORIGINS.join(','))
      setOpenOnlyFilter(true)
    } else if (key === 'inProgress') {
      setStatusFilter('in_progress')
    } else if (key === 'unassigned') {
      setAssigneeFilter('__unassigned__')
    } else if (key === 'convertedToday') {
      setStatusFilter('converted')
      setPeriodFilter('today')
    } else if (key === 'newOpen') {
      setOpenOnlyFilter(true)
    }
  }

  const tabBtn = (id: LeadsTab, label: string, icon?: ReactNode) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        tab === id
          ? 'bg-[var(--rz-surface)] text-[var(--rz-primary)] shadow-sm'
          : 'text-[var(--rz-text-secondary)] hover:text-[var(--rz-text-primary)] hover:bg-[var(--rz-surface)]/60'
      }`}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <PlatformPage
      title="Leads"
      description="Central de entradas comerciais: capture, qualifique e converta contatos vindos do site, WhatsApp, chat, landing pages e formulários."
    >
      {tab === 'captures' && (
        <p className="text-[11px] text-[var(--rz-text-muted)] -mt-2 mb-3 max-w-3xl leading-relaxed">
          Leads são entradas ainda não tratadas.{' '}
          <strong className="font-medium text-[var(--rz-text-secondary)]">Contatos</strong> são pessoas já salvas na base.{' '}
          <strong className="font-medium text-[var(--rz-text-secondary)]">Atendimentos</strong> acontecem no Inbox.
        </p>
      )}

      {tab === 'captures' && (
        <LeadStatsDashboard
          stats={stats}
          classificationStats={classificationStats}
          activeOperationalKey={activeStatKey}
          activeClassificationKey={activeClassificationStatKey}
          onOperationalSelect={handleOperationalStatClick}
          onClassificationSelect={handleClassificationStatClick}
        />
      )}

      <div className="flex flex-wrap gap-1.5 mb-4 p-1 rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/10 w-fit">
        {tabBtn('captures', 'Capturas')}
        {canManage && tabBtn('forms', 'Formulários', <FileInput size={15} />)}
        {tabBtn('segments', 'Listas e segmentos', <List size={15} />)}
      </div>

      {tab === 'segments' && (
        <LeadSegmentsTab segments={segments} loading={loadingSegments} canManage={canManage} />
      )}

      {tab === 'captures' && (
        <div className="flex flex-col flex-1 min-h-0">
          <LeadCapturesToolbar
            search={search}
            onSearchChange={v => {
              setSearch(v)
              setPage(1)
            }}
            statusFilter={statusFilter}
            onStatusFilterChange={v => {
              setStatusFilter(v)
              setPage(1)
            }}
            originFilter={originFilter}
            onOriginFilterChange={v => {
              setOriginFilter(v)
              setOriginsFilter('')
              setOpenOnlyFilter(false)
              setActiveStatKey(null)
              setPage(1)
            }}
            periodFilter={periodFilter}
            onPeriodFilterChange={v => {
              setPeriodFilter(v)
              setPage(1)
            }}
            formFilter={formFilter}
            onFormFilterChange={v => {
              setFormFilter(v)
              setPage(1)
            }}
            groupFilter={groupFilter}
            onGroupFilterChange={v => {
              setGroupFilter(v)
              setPage(1)
            }}
            consentFilter={consentFilter}
            onConsentFilterChange={v => {
              setConsentFilter(v)
              setPage(1)
            }}
            assigneeFilter={assigneeFilter}
            onAssigneeFilterChange={v => {
              setAssigneeFilter(v)
              setPage(1)
            }}
            assignees={assignees}
            forms={forms}
            contactGroups={contactGroups}
            captureView={captureView}
            onCaptureViewChange={setCaptureViewPersist}
            total={capturesData?.total}
            advancedOpen={advancedFiltersOpen}
            onAdvancedOpenChange={setAdvancedFiltersOpen}
            onClearFilters={clearAllFilters}
            classificationKindFilter={classificationKindFilter}
            onClassificationKindFilterChange={v => {
              setClassificationKindFilter(v)
              setActiveClassificationStatKey(null)
              setClassificationOptInOnly(false)
              setClassificationPendingOnly(false)
              setClassificationHotOnly(false)
              setClassificationBlockedOnly(false)
              setUnlinkedOnly(false)
              setPage(1)
            }}
            classificationOptInOnly={classificationOptInOnly}
            onClassificationOptInOnlyChange={v => {
              setClassificationOptInOnly(v)
              setActiveClassificationStatKey(v ? 'opt_in' : null)
              if (v) {
                setClassificationPendingOnly(false)
                setClassificationHotOnly(false)
                setClassificationBlockedOnly(false)
                setUnlinkedOnly(false)
              }
              setPage(1)
            }}
            classificationPendingOnly={classificationPendingOnly}
            onClassificationPendingOnlyChange={v => {
              setClassificationPendingOnly(v)
              setActiveClassificationStatKey(v ? 'pending' : null)
              if (v) {
                setClassificationOptInOnly(false)
                setClassificationHotOnly(false)
                setClassificationBlockedOnly(false)
                setUnlinkedOnly(false)
              }
              setPage(1)
            }}
            classificationHotOnly={classificationHotOnly}
            onClassificationHotOnlyChange={v => {
              setClassificationHotOnly(v)
              setActiveClassificationStatKey(v ? 'hot' : null)
              if (v) {
                setClassificationOptInOnly(false)
                setClassificationPendingOnly(false)
                setClassificationBlockedOnly(false)
                setUnlinkedOnly(false)
              }
              setPage(1)
            }}
            classificationBlockedOnly={classificationBlockedOnly}
            onClassificationBlockedOnlyChange={v => {
              setClassificationBlockedOnly(v)
              setActiveClassificationStatKey(v ? 'blocked' : null)
              if (v) {
                setClassificationOptInOnly(false)
                setClassificationPendingOnly(false)
                setClassificationHotOnly(false)
                setUnlinkedOnly(false)
              }
              setPage(1)
            }}
            unlinkedOnly={unlinkedOnly}
            onUnlinkedOnlyChange={v => {
              setUnlinkedOnly(v)
              setActiveClassificationStatKey(v ? 'unlinked' : null)
              if (v) {
                setClassificationOptInOnly(false)
                setClassificationPendingOnly(false)
                setClassificationHotOnly(false)
                setClassificationBlockedOnly(false)
              }
              setPage(1)
            }}
            canManage={canManage}
            onAddManual={() => setManualCaptureOpen(true)}
          />

          <LeadManualCaptureModal
            open={manualCaptureOpen}
            onClose={() => setManualCaptureOpen(false)}
            onSubmit={payload => createManualCapture.mutate(payload)}
            submitting={createManualCapture.isPending}
          />

          {statusReasonModal && (
            <LeadStatusReasonModal
              open
              status={statusReasonModal.status}
              leadName={statusReasonModal.name}
              onClose={() => setStatusReasonModal(null)}
              onConfirm={reason => {
                updateCapture.mutate(
                  { id: statusReasonModal.id, status: statusReasonModal.status, statusReason: reason || undefined },
                  { onSuccess: () => setStatusReasonModal(null) },
                )
              }}
              submitting={updateCapture.isPending}
            />
          )}

          <div className="flex flex-1 min-h-0 rounded-xl border border-[var(--rz-border)] overflow-hidden bg-[var(--rz-surface)]">
            {loadingCaptures ? (
              <div className="p-4">
                <LoadingState rows={5} />
              </div>
            ) : !capturesData?.items.length ? (
              <div className="p-6 flex-1 flex items-center justify-center min-h-[320px]">
                <EmptyState
                  title="Nenhum lead encontrado"
                  description="Ajuste os filtros ou integre um formulário no site."
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (forms.length) openFormEditor(forms[0].id, 'instalacao')
                        else setTab('forms')
                      }}
                    >
                      <Plug size={14} /> Integrar no site
                    </Button>
                  }
                />
              </div>
            ) : captureView === 'kanban' ? (
              <div className="flex-1 min-h-[min(720px,calc(100dvh-16rem))] h-full p-2">
                <LeadKanbanBoard
                  items={capturesData.items}
                  canManage={canManage}
                  canReply={canReply}
                  selectedId={null}
                  onSelect={openLeadDetail}
                  onAssume={id => openInbox.mutate(id)}
                  onWhatsApp={openLeadWhatsApp}
                  onConvert={id => convertCapture.mutate({ id })}
                  assumingId={pendingInboxId}
                  convertingId={convertCapture.isPending ? convertCapture.variables?.id ?? null : null}
                  onStatusChange={(id, status) => {
                    const current = capturesData.items.find(c => c.id === id)
                    if (!current || current.status === status) return
                    if (status === 'lost' || status === 'spam') {
                      setStatusReasonModal({ id, status, name: current.name })
                      return
                    }
                    updateCapture.mutate({ id, status })
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto p-2">
                <LeadCaptureListTable
                  items={capturesData.items}
                  selectedId={null}
                  onSelect={openLeadDetail}
                  canReply={canReply}
                  canManage={canManage}
                  onAssume={id => openInbox.mutate(id)}
                  onWhatsApp={openLeadWhatsApp}
                  onConvert={id => convertCapture.mutate({ id })}
                  assumingId={pendingInboxId}
                  convertingId={convertCapture.isPending ? convertCapture.variables?.id ?? null : null}
                />
                {capturesData.total > 30 && (
                  <div className="flex gap-2 justify-center pt-2 pb-1 sticky bottom-0 bg-[var(--rz-surface)]">
                    <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      Anterior
                    </Button>
                    <span className="text-xs self-center text-[var(--rz-text-muted)]">Pág. {page}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={page * 30 >= capturesData.total}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'forms' && canManage && (
        <div className="space-y-4">
          {loadingForms ? (
            <LoadingState rows={4} className="w-full py-12" />
          ) : !forms.length ? (
            <Card className="w-full p-8">
              <EmptyState
                icon={FileInput}
                title="Nenhum formulário configurado"
                description="Crie seu primeiro formulário para capturar leads no site. Depois copie o script de integração."
                action={
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <input
                      className={inputCls + ' max-w-xs'}
                      value={newFormName}
                      onChange={e => setNewFormName(e.target.value)}
                      placeholder="Nome do formulário"
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (newFormName.trim()) createForm.mutate(newFormName.trim())
                      }}
                      disabled={createForm.isPending || !newFormName.trim()}
                    >
                      <Plus className="h-4 w-4" />
                      Criar formulário
                    </Button>
                  </div>
                }
              />
            </Card>
          ) : (
            <Card className="overflow-visible p-0">
              <LeadFormList
                forms={forms}
                selectedId={activeFormId}
                onSelect={id => {
                  setActiveFormId(id)
                  setFormEditorSection(null)
                }}
                newFormName={newFormName}
                onNewFormNameChange={setNewFormName}
                onCreate={() => {
                  if (newFormName.trim()) createForm.mutate(newFormName.trim())
                }}
                creating={createForm.isPending}
              />
              {activeForm ? (
                <LeadFormEditorCard
                  key={activeForm.id}
                  embedded
                  form={activeForm}
                  contactGroups={contactGroups}
                  assignees={assignees}
                  initialSection={formEditorSection ?? 'overview'}
                  onSave={patch => updateForm.mutate({ id: activeForm.id, ...patch })}
                  onDelete={() => {
                    if (window.confirm(`Excluir "${activeForm.name}"? Capturas antigas permanecem.`)) {
                      deleteForm.mutate(activeForm.id)
                    }
                  }}
                  onDuplicate={() => duplicateForm.mutate(activeForm.id)}
                  pending={updateForm.isPending}
                  deleting={deleteForm.isPending}
                  duplicating={duplicateForm.isPending}
                  organizationPlan={me?.plan}
                />
              ) : null}
            </Card>
          )}
        </div>
      )}
    </PlatformPage>
  )
}
