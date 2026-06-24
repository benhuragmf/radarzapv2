import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { can, getMe } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { LeadIntegrationsPanel } from '../../components/leads/LeadIntegrationsPanel'
import { LeadFormFieldsEditor } from '../../components/leads/LeadFormFieldsEditor'
import { LeadStatsCards } from '../../components/leads/LeadStatsCards'
import { LeadCaptureDetail, LeadDetailEmptyState } from '../../components/leads/LeadCaptureDetail'
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
import { Badge } from '../../components/ui/Badge'
import {
  ClipboardCopy,
  Copy,
  Eye,
  FileInput,
  List,
  Plug,
  Plus,
  Trash2,
} from 'lucide-react'
import { notifySuccess, mutationError } from '../../lib/notify'
import { inputCls, textareaCls, LoadingState, EmptyState } from '@/design-system'
import { embedScriptSnippet } from '../../lib/leadIntegrationSnippets'
import type {
  LeadCaptureListItem,
  LeadCaptureOrigin,
  LeadCaptureStatus,
  LeadTemperature,
  LeadFormListItem,
  LeadFormRouting,
  LeadSegmentSummary,
  LeadStats,
} from '@radarzap-types/lead-form'
import {
  DEFAULT_LEAD_FORM_ROUTING,
  LEAD_CAPTURE_STATUS_LABEL,
  LEAD_TEMPERATURE_LABEL,
} from '@radarzap-types/lead-form'

type LeadsTab = 'captures' | 'integrate' | 'forms' | 'segments'

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
  const [pendingInboxId, setPendingInboxId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingFormId, setEditingFormId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [captureView, setCaptureView] = useState<CaptureView>(loadCaptureView)
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<'basic' | 'fields' | 'dest' | 'security' | 'appearance' | null>(null)

  const setCaptureViewPersist = (v: CaptureView) => {
    setCaptureView(v)
    try {
      localStorage.setItem(CAPTURE_VIEW_KEY, v)
    } catch {
      /* ignore */
    }
  }

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe })
  const canManage = can(me ?? null, 'send:destination:manage')
  const canView = can(me ?? null, 'consent:view')
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
    p.set('page', String(page))
    p.set('limit', '30')
    return p.toString()
  }, [search, statusFilter, formFilter, originFilter, originsFilter, openOnlyFilter, groupFilter, periodFilter, consentFilter, assigneeFilter, page])

  const { data: stats } = useQuery<LeadStats>({
    queryKey: ['leads-stats'],
    queryFn: () => api.get('/leads/stats'),
    enabled: canView,
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
    enabled: canView && (tab === 'forms' || tab === 'integrate' || tab === 'captures'),
  })

  const { data: segments = [], isLoading: loadingSegments } = useQuery<LeadSegmentSummary[]>({
    queryKey: ['leads-segments-summary'],
    queryFn: () => api.get('/leads/segments-summary'),
    enabled: canView && tab === 'segments',
  })

  const { data: assignees = [] } = useQuery<{ userId: string; displayName: string }[]>({
    queryKey: ['leads-assignees'],
    queryFn: () => api.get('/leads/assignees'),
    enabled: canView && (tab === 'forms' || tab === 'captures' || editingFormId !== null),
  })

  const { data: contactGroups = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['contact-groups'],
    queryFn: () => api.get('/contact-groups'),
    enabled: canView,
  })

  const selected = useMemo(
    () => capturesData?.items.find(c => c.id === selectedId) ?? null,
    [capturesData, selectedId],
  )

  const editingForm = useMemo(
    () => forms.find(f => f.id === editingFormId) ?? null,
    [forms, editingFormId],
  )

  const invalidateLeads = () => {
    void qc.invalidateQueries({ queryKey: ['leads-captures'] })
    void qc.invalidateQueries({ queryKey: ['leads-stats'] })
    void qc.invalidateQueries({ queryKey: ['leads-segments-summary'] })
  }

  const createForm = useMutation({
    mutationFn: (name: string) => api.post<LeadFormListItem>('/leads/forms', { name }),
    onSuccess: data => {
      void qc.invalidateQueries({ queryKey: ['leads-forms'] })
      setEditingFormId(data.id)
      setTab('forms')
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
      setSelectedId(data.id)
      notifySuccess('Lead capturado')
    },
    onError: mutationError,
  })

  const linkCapture = useMutation({
    mutationFn: (payload: { id: string; contactId: string }) =>
      api.post<LeadCaptureListItem>(`/leads/captures/${payload.id}/link`, { contactId: payload.contactId }),
    onSuccess: () => {
      invalidateLeads()
      notifySuccess('Lead vinculado ao contato')
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

  const addToGroups = useMutation({
    mutationFn: (payload: { id: string; groupIds: string[] }) =>
      api.post<LeadCaptureListItem>(`/leads/captures/${payload.id}/add-to-groups`, {
        groupIds: payload.groupIds,
      }),
    onSuccess: () => {
      invalidateLeads()
      notifySuccess('Listas atualizadas')
    },
    onError: mutationError,
  })

  const deleteCapture = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/captures/${id}`),
    onSuccess: () => {
      setSelectedId(null)
      invalidateLeads()
      notifySuccess('Lead excluído')
    },
    onError: mutationError,
  })

  const openInbox = useMutation({
    mutationFn: (captureId: string) =>
      api.post<{ conversationId: string }>(`/leads/captures/${captureId}/open-inbox`, {}),
    onMutate: captureId => {
      setPendingInboxId(captureId)
    },
    onSuccess: data => {
      invalidateLeads()
      notifySuccess('Atendimento assumido')
      navigate(`/platform/inbox?conv=${encodeURIComponent(data.conversationId)}`)
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
      setEditingFormId(data.id)
      notifySuccess('Formulário duplicado')
    },
    onError: mutationError,
  })

  const deleteForm = useMutation({
    mutationFn: (id: string) => api.delete(`/leads/forms/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads-forms'] })
      setEditingFormId(null)
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
    setPage(1)
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
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border ${
        tab === id
          ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10 text-[var(--rz-primary)]'
          : 'border-[var(--rz-border)] text-[var(--rz-text-secondary)]'
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
        <LeadStatsCards stats={stats} activeKey={activeStatKey} onSelect={handleOperationalStatClick} />
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {tabBtn('captures', 'Capturas')}
        {tabBtn('integrate', 'Integrar no site', <Plug size={15} />)}
        {tabBtn('segments', 'Listas e segmentos', <List size={15} />)}
        {canManage && tabBtn('forms', 'Formulários')}
      </div>

      {tab === 'integrate' &&
        (loadingForms ? (
          <LoadingState rows={4} />
        ) : (
          <LeadIntegrationsPanel
            forms={forms}
            readOnly={!canManage}
            onConfigureDomains={formId => {
              setEditingFormId(formId)
              setEditingSection('security')
              setTab('forms')
            }}
          />
        ))}

      {tab === 'segments' && (
        <LeadSegmentsTab segments={segments} loading={loadingSegments} canManage={canManage} />
      )}

      {tab === 'captures' && (
        <div className="flex flex-col min-h-[calc(100vh-14rem)] max-h-[calc(100vh-8rem)]">
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
            {/* Área principal — lista ou kanban */}
            <div className="flex-1 min-w-0 flex flex-col min-h-0">
              {loadingCaptures ? (
                <div className="p-4">
                  <LoadingState rows={5} />
                </div>
              ) : !capturesData?.items.length ? (
                <div className="p-6 flex-1 flex items-center justify-center">
                  <EmptyState
                    title="Nenhum lead encontrado"
                    description="Ajuste os filtros ou integre um formulário no site."
                    action={
                      <Button variant="secondary" size="sm" onClick={() => setTab('integrate')}>
                        <Plug size={14} /> Integrar no site
                      </Button>
                    }
                  />
                </div>
              ) : captureView === 'kanban' ? (
                <div className="flex-1 min-h-0 p-2">
                  <LeadKanbanBoard
                    items={capturesData.items}
                    canManage={canManage}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
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
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    canReply={canReply}
                    canManage={canManage}
                    onAssume={id => openInbox.mutate(id)}
                    assumingId={pendingInboxId}
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

            {/* Painel lateral — desktop */}
            <aside className="hidden lg:flex w-[min(420px,38vw)] max-w-[460px] shrink-0 border-l border-[var(--rz-border)] flex-col min-h-0">
              {selected ? (
                <LeadCaptureDetail
                  item={selected}
                  canManage={canManage}
                  canReply={canReply}
                  contactGroups={contactGroups}
                  layout="sidebar"
                  onClose={() => setSelectedId(null)}
                  onUpdate={patch => updateCapture.mutate({ id: selected.id, ...patch })}
                  onOpenInbox={() => openInbox.mutate(selected.id)}
                  onConvert={opts => convertCapture.mutate({ id: selected.id, ...opts })}
                  onLinkContact={contactId => linkCapture.mutate({ id: selected.id, contactId })}
                  onInboxConversationReady={() => invalidateLeads()}
                  onAddToGroups={groupIds => addToGroups.mutate({ id: selected.id, groupIds })}
                  onDelete={() => {
                    if (window.confirm('Excluir este lead permanentemente?')) deleteCapture.mutate(selected.id)
                  }}
                  openingInbox={openInbox.isPending}
                  converting={convertCapture.isPending}
                  linking={linkCapture.isPending}
                  pending={updateCapture.isPending || addToGroups.isPending}
                />
              ) : (
                <LeadDetailEmptyState />
              )}
            </aside>
          </div>

          {/* Drawer mobile — detalhe full screen */}
          {selected && (
            <div className="lg:hidden">
              <LeadCaptureDetail
                item={selected}
                canManage={canManage}
                canReply={canReply}
                contactGroups={contactGroups}
                layout="mobile-drawer"
                onClose={() => setSelectedId(null)}
                onUpdate={patch => updateCapture.mutate({ id: selected.id, ...patch })}
                onOpenInbox={() => openInbox.mutate(selected.id)}
                onConvert={opts => convertCapture.mutate({ id: selected.id, ...opts })}
                onLinkContact={contactId => linkCapture.mutate({ id: selected.id, contactId })}
                onInboxConversationReady={() => invalidateLeads()}
                onAddToGroups={groupIds => addToGroups.mutate({ id: selected.id, groupIds })}
                onDelete={() => {
                  if (window.confirm('Excluir este lead permanentemente?')) deleteCapture.mutate(selected.id)
                }}
                openingInbox={openInbox.isPending}
                converting={convertCapture.isPending}
                linking={linkCapture.isPending}
                pending={updateCapture.isPending || addToGroups.isPending}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'forms' && canManage && (
        <div className="space-y-6">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setTab('integrate')}>
              <Plug size={16} /> Ver códigos de integração
            </Button>
            <Button
              onClick={() => {
                const name = window.prompt('Nome do formulário', 'Formulário principal')
                if (name?.trim()) createForm.mutate(name.trim())
              }}
              disabled={createForm.isPending}
            >
              <Plus size={16} /> Novo formulário
            </Button>
          </div>

          {loadingForms ? (
            <LoadingState rows={3} />
          ) : !forms.length ? (
            <EmptyState icon={FileInput} title="Nenhum formulário" description="Crie um formulário para gerar chaves e códigos." />
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              {forms.map(form => (
                <Card key={form.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium">{form.name}</h3>
                    <Badge label={form.active ? 'Ativo' : 'Inativo'} variant={form.active ? 'green' : 'gray'} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-[var(--rz-text-muted)]">Capturas</p>
                      <p className="font-semibold">{form.captureCount}</p>
                    </div>
                    <div>
                      <p className="text-[var(--rz-text-muted)]">7 dias</p>
                      <p className="font-semibold">{form.captureCount7d}</p>
                    </div>
                    <div>
                      <p className="text-[var(--rz-text-muted)]">Criado</p>
                      <p>{new Date(form.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--rz-text-muted)] font-mono truncate">{form.publicKey}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditingFormId(form.id)}>
                      Configurar
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setTab('integrate')}>
                      Integrar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => window.open(`/leads/preview.html?key=${encodeURIComponent(form.publicKey)}`, '_blank')}
                    >
                      <Eye size={14} /> Pré-visualizar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={duplicateForm.isPending}
                      onClick={() => duplicateForm.mutate(form.id)}
                    >
                      <Copy size={14} /> Duplicar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => updateForm.mutate({ id: form.id, active: !form.active })}
                    >
                      {form.active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-red-600"
                      disabled={deleteForm.isPending}
                      onClick={() => {
                        if (window.confirm(`Excluir "${form.name}"? Capturas antigas permanecem.`)) {
                          deleteForm.mutate(form.id)
                        }
                      }}
                    >
                      <Trash2 size={14} /> Excluir
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {editingForm && (
            <FormEditor
              form={editingForm}
              contactGroups={contactGroups}
              assignees={assignees}
              initialSection={editingSection ?? undefined}
              onClose={() => {
                setEditingFormId(null)
                setEditingSection(null)
              }}
              onSave={patch => updateForm.mutate({ id: editingForm.id, ...patch })}
              onDelete={() => {
                if (window.confirm(`Excluir "${editingForm.name}"?`)) deleteForm.mutate(editingForm.id)
              }}
              onOpenIntegrate={() => {
                setEditingFormId(null)
                setTab('integrate')
              }}
              pending={updateForm.isPending}
              deleting={deleteForm.isPending}
            />
          )}
        </div>
      )}
    </PlatformPage>
  )
}

function FormEditor({
  form,
  contactGroups,
  assignees,
  initialSection,
  onClose,
  onSave,
  onDelete,
  onOpenIntegrate,
  pending,
  deleting,
}: {
  form: LeadFormListItem
  contactGroups: { id: string; name: string }[]
  assignees: { userId: string; displayName: string }[]
  initialSection?: 'basic' | 'fields' | 'dest' | 'security' | 'appearance'
  onClose: () => void
  onSave: (patch: Partial<LeadFormListItem>) => void
  onDelete: () => void
  onOpenIntegrate: () => void
  pending: boolean
  deleting: boolean
}) {
  const [draft, setDraft] = useState(form)
  const [section, setSection] = useState<'basic' | 'fields' | 'dest' | 'security' | 'appearance'>(
    initialSection ?? 'basic',
  )
  const snippet = embedScriptSnippet(form.publicKey)
  const domainsText = (draft.allowedDomains ?? []).join('\n')
  const routing: LeadFormRouting = { ...DEFAULT_LEAD_FORM_ROUTING, ...draft.routing }

  const sectionBtn = (id: typeof section, label: string) => (
    <button
      type="button"
      onClick={() => setSection(id)}
      className={`px-3 py-1.5 rounded-lg text-xs border ${
        section === id ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10' : 'border-[var(--rz-border)]'
      }`}
    >
      {label}
    </button>
  )

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold">Configurar: {form.name}</h3>
        <div className="flex items-center gap-2">
          <button type="button" className="text-sm text-red-600 hover:underline disabled:opacity-50" disabled={deleting || pending} onClick={onDelete}>
            Excluir
          </button>
          <button type="button" className="text-sm text-[var(--rz-text-muted)]" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {sectionBtn('basic', 'Informações')}
        {sectionBtn('fields', 'Campos')}
        {sectionBtn('appearance', 'Aparência')}
        {sectionBtn('dest', 'Destino do lead')}
        {sectionBtn('security', 'Segurança / LGPD')}
      </div>

      {section === 'basic' && (
        <>
          <input className={inputCls} placeholder="Nome interno" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.active} onChange={e => setDraft(d => ({ ...d, active: e.target.checked }))} />
            Formulário ativo
          </label>
          <input className={inputCls} placeholder="Título público" value={draft.appearance.title} onChange={e => setDraft(d => ({ ...d, appearance: { ...d.appearance, title: e.target.value } }))} />
          <textarea className={textareaCls} rows={2} placeholder="Descrição" value={draft.appearance.description} onChange={e => setDraft(d => ({ ...d, appearance: { ...d.appearance, description: e.target.value } }))} />
          <div className="grid sm:grid-cols-2 gap-3">
            <input className={inputCls} placeholder="Texto do botão" value={draft.appearance.buttonText} onChange={e => setDraft(d => ({ ...d, appearance: { ...d.appearance, buttonText: e.target.value } }))} />
            <input className={inputCls} type="color" title="Cor primária" value={draft.appearance.primaryColor} onChange={e => setDraft(d => ({ ...d, appearance: { ...d.appearance, primaryColor: e.target.value } }))} />
          </div>
          <textarea className={textareaCls} rows={2} placeholder="Mensagem de sucesso" value={draft.appearance.successMessage} onChange={e => setDraft(d => ({ ...d, appearance: { ...d.appearance, successMessage: e.target.value } }))} />
          <input className={inputCls} placeholder="URL após envio (opcional)" value={draft.redirectUrl ?? ''} onChange={e => setDraft(d => ({ ...d, redirectUrl: e.target.value || undefined }))} />
        </>
      )}

      {section === 'fields' && (
        <LeadFormFieldsEditor
          value={{
            askEmail: draft.appearance.askEmail,
            requireEmail: draft.appearance.requireEmail,
            askMessage: draft.appearance.askMessage,
            requireMessage: draft.appearance.requireMessage,
            customFields: draft.appearance.customFields ?? [],
          }}
          onChange={fields =>
            setDraft(d => ({
              ...d,
              appearance: { ...d.appearance, ...fields },
            }))
          }
        />
      )}

      {section === 'appearance' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Tema</label>
            <select
              className={inputCls + ' mt-1'}
              value={draft.appearance.theme ?? 'auto'}
              onChange={e =>
                setDraft(d => ({
                  ...d,
                  appearance: { ...d.appearance, theme: e.target.value as 'auto' | 'light' | 'dark' },
                }))
              }
            >
              <option value="auto">Automático (sistema)</option>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Tamanho</label>
            <select
              className={inputCls + ' mt-1'}
              value={draft.appearance.size ?? 'default'}
              onChange={e =>
                setDraft(d => ({
                  ...d,
                  appearance: { ...d.appearance, size: e.target.value as 'compact' | 'default' | 'wide' },
                }))
              }
            >
              <option value="compact">Compacto</option>
              <option value="default">Padrão</option>
              <option value="wide">Largo</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Arredondamento ({draft.appearance.borderRadius ?? 8}px)</label>
            <input
              type="range"
              min={0}
              max={24}
              className="w-full mt-1"
              value={draft.appearance.borderRadius ?? 8}
              onChange={e =>
                setDraft(d => ({
                  ...d,
                  appearance: { ...d.appearance, borderRadius: Number(e.target.value) },
                }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.appearance.showLogo ?? false}
              onChange={e => setDraft(d => ({ ...d, appearance: { ...d.appearance, showLogo: e.target.checked } }))}
            />
            Mostrar crédito RadarZap no rodapé
          </label>
        </div>
      )}

      {section === 'dest' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Status inicial do lead</label>
            <select
              className={inputCls + ' mt-1'}
              value={routing.initialStatus}
              onChange={e =>
                setDraft(d => ({
                  ...d,
                  routing: { ...routing, initialStatus: e.target.value as LeadCaptureStatus },
                }))
              }
            >
              {(Object.keys(LEAD_CAPTURE_STATUS_LABEL) as LeadCaptureStatus[]).map(s => (
                <option key={s} value={s}>{LEAD_CAPTURE_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Lista padrão para novos leads</label>
            <select
              className={inputCls + ' mt-1'}
              multiple
              size={Math.min(5, contactGroups.length || 3)}
              value={routing.defaultContactGroupIds}
              onChange={e => {
                const ids = Array.from(e.target.selectedOptions).map(o => o.value)
                setDraft(d => ({ ...d, routing: { ...routing, defaultContactGroupIds: ids } }))
              }}
            >
              {contactGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-[var(--rz-text-muted)] mt-1">Ctrl+clique para selecionar várias</p>
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Tags padrão (separadas por vírgula)</label>
            <input
              className={inputCls + ' mt-1'}
              value={(routing.defaultTags ?? []).join(', ')}
              onChange={e =>
                setDraft(d => ({
                  ...d,
                  routing: {
                    ...routing,
                    defaultTags: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                  },
                }))
              }
            />
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Criar contato automaticamente</label>
            <select
              className={inputCls + ' mt-1'}
              value={routing.contactMode}
              onChange={e =>
                setDraft(d => ({
                  ...d,
                  routing: { ...routing, contactMode: e.target.value as LeadFormRouting['contactMode'] },
                }))
              }
            >
              <option value="always">Sim — criar/vincular ao capturar</option>
              <option value="qualify">Aguardar qualificação manual</option>
              <option value="never">Apenas salvar como lead</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Responsável padrão</label>
            <select
              className={inputCls + ' mt-1'}
              value={routing.defaultAssigneeId ?? ''}
              onChange={e =>
                setDraft(d => ({
                  ...d,
                  routing: { ...routing, defaultAssigneeId: e.target.value || undefined },
                }))
              }
            >
              <option value="">Nenhum</option>
              {assignees.map(a => (
                <option key={a.userId} value={a.userId}>
                  {a.displayName}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm opacity-60" title="Disponível em versão futura — use Iniciar atendimento manualmente">
            <input
              type="checkbox"
              checked={routing.autoOpenInbox}
              disabled
              onChange={e => setDraft(d => ({ ...d, routing: { ...routing, autoOpenInbox: e.target.checked } }))}
            />
            Enviar automaticamente para Inbox (em breve)
          </label>
        </div>
      )}

      {section === 'security' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Domínios permitidos (um por linha)</label>
            <textarea
              className={textareaCls + ' mt-1 font-mono text-xs'}
              rows={3}
              placeholder="Vazio = qualquer site"
              value={domainsText}
              onChange={e =>
                setDraft(d => ({
                  ...d,
                  allowedDomains: e.target.value.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean),
                }))
              }
            />
            {!draft.allowedDomains?.length && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                Qualquer domínio poderá enviar leads. Configure domínios para mais segurança.
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.appearance.honeypot !== false} onChange={e => setDraft(d => ({ ...d, appearance: { ...d.appearance, honeypot: e.target.checked } }))} />
            Campo honeypot anti-spam
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.appearance.requireConsent} onChange={e => setDraft(d => ({ ...d, appearance: { ...d.appearance, requireConsent: e.target.checked } }))} />
            Exigir aceite de consentimento (LGPD)
          </label>
          {draft.appearance.requireConsent && (
            <>
              <textarea className={textareaCls} rows={2} placeholder="Texto do consentimento" value={draft.appearance.consentText} onChange={e => setDraft(d => ({ ...d, appearance: { ...d.appearance, consentText: e.target.value } }))} />
              <input className={inputCls} placeholder="URL da política de privacidade" value={draft.appearance.consentPolicyUrl ?? ''} onChange={e => setDraft(d => ({ ...d, appearance: { ...d.appearance, consentPolicyUrl: e.target.value || undefined } }))} />
            </>
          )}
        </div>
      )}

      <div className="rounded-lg border border-[var(--rz-border)] p-3 space-y-2">
        <p className="text-xs text-[var(--rz-text-muted)]">
          Integração completa na aba{' '}
          <button type="button" className="text-[var(--rz-primary)] underline" onClick={onOpenIntegrate}>Integrar no site</button>
        </p>
        <pre className="text-xs p-2 rounded bg-[var(--rz-surface-muted)] overflow-x-auto">{snippet}</pre>
        <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard.writeText(snippet); notifySuccess('Embed copiado') }}>
          <ClipboardCopy size={14} /> Copiar embed
        </Button>
      </div>

      <Button
        disabled={pending}
        onClick={() =>
          onSave({
            name: draft.name,
            active: draft.active,
            allowedDomains: draft.allowedDomains,
            redirectUrl: draft.redirectUrl,
            appearance: draft.appearance,
            routing: draft.routing,
          })
        }
      >
        Salvar formulário
      </Button>
    </Card>
  )
}