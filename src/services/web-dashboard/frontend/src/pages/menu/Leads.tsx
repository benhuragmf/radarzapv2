import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { can, getMe } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { LeadIntegrationsPanel } from '../../components/leads/LeadIntegrationsPanel'
import { LeadFormFieldsEditor } from '../../components/leads/LeadFormFieldsEditor'
import { LeadStatsCards, LeadFunnelRow } from '../../components/leads/LeadStatsCards'
import { LeadCaptureDetail } from '../../components/leads/LeadCaptureDetail'
import { LeadKanbanBoard } from '../../components/leads/LeadKanbanBoard'
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
  LayoutGrid,
  Plug,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { notifySuccess, mutationError } from '../../lib/notify'
import { inputCls, textareaCls, LoadingState, EmptyState, searchFieldIconCls } from '@/design-system'
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
  LEAD_CAPTURE_ORIGIN_LABEL,
  LEAD_CAPTURE_ORIGINS,
  LEAD_CAPTURE_STATUS_LABEL,
  LEAD_CAPTURE_STATUS_VARIANT,
  LEAD_TEMPERATURE_LABEL,
} from '@radarzap-types/lead-form'

type LeadsTab = 'captures' | 'integrate' | 'forms' | 'segments'
type CaptureView = 'list' | 'kanban'

type PeriodFilter = '' | 'today' | '7d' | '30d'

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
  const [groupFilter, setGroupFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('')
  const [consentFilter, setConsentFilter] = useState<'' | 'yes' | 'no'>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingFormId, setEditingFormId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [captureView, setCaptureView] = useState<CaptureView>('list')
  const [editingSection, setEditingSection] = useState<'basic' | 'fields' | 'dest' | 'security' | 'appearance' | null>(null)

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe })
  const canManage = can(me ?? null, 'send:destination:manage')
  const canView = can(me ?? null, 'consent:view')
  const canReply = can(me ?? null, 'inbox:reply')

  const captureQuery = useMemo(() => {
    const p = new URLSearchParams()
    if (search.trim()) p.set('search', search.trim())
    if (statusFilter) p.set('status', statusFilter)
    if (formFilter) p.set('formId', formFilter)
    if (originFilter) p.set('origin', originFilter)
    if (groupFilter) p.set('groupId', groupFilter)
    if (consentFilter === 'yes') p.set('hasConsent', 'true')
    if (consentFilter === 'no') p.set('hasConsent', 'false')
    const dates = periodToDates(periodFilter)
    if (dates.from) p.set('from', dates.from)
    if (dates.to) p.set('to', dates.to)
    p.set('page', String(page))
    p.set('limit', '30')
    return p.toString()
  }, [search, statusFilter, formFilter, originFilter, groupFilter, periodFilter, consentFilter, page])

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
    enabled: canManage && (tab === 'forms' || editingFormId !== null),
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
    }) => api.patch<LeadCaptureListItem>(`/leads/captures/${payload.id}`, payload),
    onSuccess: (_data, variables) => {
      invalidateLeads()
      if (variables.status) {
        notifySuccess(`Status: ${LEAD_CAPTURE_STATUS_LABEL[variables.status]}`)
      } else if (variables.temperature !== undefined) {
        notifySuccess(
          variables.temperature
            ? `Temperatura: ${LEAD_TEMPERATURE_LABEL[variables.temperature]}`
            : 'Temperatura removida',
        )
      } else if (variables.internalNotes !== undefined) {
        notifySuccess('Observações salvas')
      }
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
    onSuccess: data => {
      invalidateLeads()
      notifySuccess('Conversa aberta no Inbox')
      navigate(`/platform/inbox?conv=${encodeURIComponent(data.conversationId)}`)
    },
    onError: mutationError,
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
      description="Capture, qualifique e converta contatos vindos do site, WhatsApp, WordPress, landing pages e formulários próprios."
    >
      <LeadStatsCards stats={stats} />
      {tab === 'captures' && <LeadFunnelRow stats={stats} />}

      <div className="flex flex-wrap gap-2 mb-6">
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
        <>
          <div className="flex gap-2 mb-4">
            <Button
              size="sm"
              variant={captureView === 'list' ? 'primary' : 'secondary'}
              onClick={() => setCaptureView('list')}
            >
              Lista
            </Button>
            <Button
              size="sm"
              variant={captureView === 'kanban' ? 'primary' : 'secondary'}
              onClick={() => setCaptureView('kanban')}
            >
              <LayoutGrid size={14} /> Kanban
            </Button>
          </div>

          {captureView === 'kanban' && capturesData?.items && (
            <LeadKanbanBoard
              items={capturesData.items}
              canManage={canManage}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onStatusChange={(id, status) => {
                const current = capturesData?.items.find(c => c.id === id)
                if (current?.status === status) return
                updateCapture.mutate({ id, status })
              }}
            />
          )}

        <div className="grid lg:grid-cols-5 gap-6">
          <div className={`lg:col-span-2 space-y-3 ${captureView === 'kanban' ? 'hidden' : ''}`}>
            <div className="relative">
              <Search size={16} className={searchFieldIconCls} />
              <input
                className={inputCls + ' pl-9'}
                placeholder="Buscar nome, telefone, e-mail, origem…"
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className={inputCls + ' text-sm'}
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value as LeadCaptureStatus | '')
                  setPage(1)
                }}
              >
                <option value="">Todos status</option>
                {(Object.keys(LEAD_CAPTURE_STATUS_LABEL) as LeadCaptureStatus[]).map(s => (
                  <option key={s} value={s}>
                    {LEAD_CAPTURE_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <select
                className={inputCls + ' text-sm'}
                value={originFilter}
                onChange={e => {
                  setOriginFilter(e.target.value as LeadCaptureOrigin | '')
                  setPage(1)
                }}
              >
                <option value="">Todas origens</option>
                {LEAD_CAPTURE_ORIGINS.map(o => (
                  <option key={o} value={o}>
                    {LEAD_CAPTURE_ORIGIN_LABEL[o]}
                  </option>
                ))}
              </select>
              <select
                className={inputCls + ' text-sm'}
                value={formFilter}
                onChange={e => {
                  setFormFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Todos formulários</option>
                {forms.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <select
                className={inputCls + ' text-sm'}
                value={groupFilter}
                onChange={e => {
                  setGroupFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">Todas listas</option>
                {contactGroups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <select
                className={inputCls + ' text-sm'}
                value={periodFilter}
                onChange={e => {
                  setPeriodFilter(e.target.value as PeriodFilter)
                  setPage(1)
                }}
              >
                <option value="">Todo período</option>
                <option value="today">Hoje</option>
                <option value="7d">7 dias</option>
                <option value="30d">30 dias</option>
              </select>
              <select
                className={inputCls + ' text-sm'}
                value={consentFilter}
                onChange={e => {
                  setConsentFilter(e.target.value as '' | 'yes' | 'no')
                  setPage(1)
                }}
              >
                <option value="">Consentimento</option>
                <option value="yes">Com consentimento</option>
                <option value="no">Sem consentimento</option>
              </select>
            </div>

            {loadingCaptures ? (
              <LoadingState rows={5} />
            ) : !capturesData?.items.length ? (
              <EmptyState
                title="Nenhum lead encontrado"
                description="Ajuste os filtros ou integre um formulário no site."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setTab('integrate')}>
                    <Plug size={14} /> Integrar no site
                  </Button>
                }
              />
            ) : captureView === 'list' ? (
              <>
                <p className="text-xs text-[var(--rz-text-muted)]">
                  {capturesData.total} lead{capturesData.total !== 1 ? 's' : ''}
                </p>
                <ul className="space-y-2">
                  {capturesData.items.map(item => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full text-left rounded-lg border p-3 transition-colors ${
                          selectedId === item.id
                            ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/5'
                            : 'border-[var(--rz-border)] hover:border-[var(--rz-primary)]/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-xs text-[var(--rz-text-muted)] truncate">
                              {item.phone.startsWith('email:') ? item.email : item.phone}
                            </p>
                            <p className="text-[10px] text-[var(--rz-text-muted)] mt-0.5">
                              {LEAD_CAPTURE_ORIGIN_LABEL[item.origin]} · {item.formName}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge
                              label={LEAD_CAPTURE_STATUS_LABEL[item.status]}
                              variant={LEAD_CAPTURE_STATUS_VARIANT[item.status]}
                            />
                            {item.possibleDuplicate && <Badge label="Duplicado?" variant="yellow" />}
                          </div>
                        </div>
                        <p className="text-[10px] text-[var(--rz-text-muted)] mt-1">
                          {new Date(item.createdAt).toLocaleString('pt-BR')}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
                {capturesData.total > 30 && (
                  <div className="flex gap-2 justify-center pt-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
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
              </>
            ) : null}
          </div>

          <div className={captureView === 'kanban' ? 'lg:col-span-5' : 'lg:col-span-3'}>
            {!selected ? (
              <Card>
                <p className="text-sm text-[var(--rz-text-muted)]">
                  Selecione um lead para ver detalhes, histórico e ações de conversão.
                </p>
              </Card>
            ) : (
              <LeadCaptureDetail
                item={selected}
                canManage={canManage}
                canReply={canReply}
                contactGroups={contactGroups}
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
            )}
          </div>
        </div>
        </>
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