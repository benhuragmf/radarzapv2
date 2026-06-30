import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Globe, MessageSquare, Plus, Inbox as InboxIcon, Search, PanelRight, ArrowLeft, LayoutGrid, Moon, Sun } from 'lucide-react'
import { notifySuccess, notifyConfigSaved, mutationError } from '../../lib/notify'
import { inputCls, textareaCls, LoadingState, EmptyState, searchFieldIconCls } from '@/design-system'
import { cn } from '@/lib/utils'
import { inboxWebChatUrl, webChatMediaSrc } from '../../lib/webchatInbox'
import { WebChatPreviewTemplates } from '../../components/webchat/WebChatPreviewTemplates'
import { WebChatPrechatFieldsEditor } from '../../components/webchat/WebChatPrechatFieldsEditor'
import { WebChatWidgetList } from '../../components/webchat/WebChatWidgetList'
import {
  WebChatWidgetEditorSection,
  WebChatWidgetSectionNav,
  WebChatWidgetSectionNavCompact,
  WidgetSectionCard,
  type WebChatWidgetEditorSectionId,
} from '../../components/webchat/WebChatWidgetEditorSection'
import { WebChatWidgetEditorHeader } from '../../components/webchat/editor/WebChatWidgetEditorHeader'
import { WebChatWidgetSaveBar } from '../../components/webchat/editor/WebChatWidgetSaveBar'
import { WebChatWidgetPreviewPanel } from '../../components/webchat/editor/WebChatWidgetPreviewPanel'
import { WebChatBusinessHoursEditor } from '../../components/webchat/editor/WebChatBusinessHoursEditor'
import { WebChatWidgetOverview } from '../../components/webchat/editor/WebChatWidgetOverview'
import { WebChatIntegrationsPanel } from '../../components/webchat/WebChatIntegrationsPanel'
import { EmbedSitesSection } from '../../components/embed/EmbedSitesSection'
import { ProductBrandingFooterToggle } from '../../components/shared/ProductBrandingFooterToggle'
import {
  buildWidgetSavePayload,
  getWidgetSectionStatuses,
  isWidgetFormDirty,
  validateWidgetForm,
  type EditorMode,
} from '../../lib/webchatWidgetEditorUtils'
import { resolvePrechatFields, syncLegacyAppearanceFlags } from '../../lib/webchatPrechatFields'
import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'
import { InboxStatsRow } from '../../components/inbox/InboxStatsRow'
import { WebChatVisitorPanel } from '../../components/webchat/WebChatVisitorPanel'
import {
  WEBCHAT_PREVIEW_TEMPLATES,
  webChatPreviewUrl,
  type WebChatAppearancePreset,
} from '../../lib/webchatPreviewTemplates'
import {
  canUsePremiumChatBoxModels,
  chatBoxPreviewTemplateId,
  parseChatBoxModelId,
  type ChatBoxModel,
} from '../../lib/chatBoxModels'
import {
  DEFAULT_WEBCHAT_AI_ESCALATION_POLICY,
  normalizeEscalationPolicyForm,
  WEBCHAT_TRANSFER_TRIGGER_OPTIONS,
  type WebChatAiEscalationPolicy,
  type WebChatAiTransferTrigger,
} from '../../lib/webchatEscalationPolicy'

type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

interface DaySchedule {
  enabled: boolean
  start: string
  end: string
}

type WeeklySchedule = Record<Weekday, DaySchedule>

const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: { enabled: true, start: '09:00', end: '18:00' },
  tuesday: { enabled: true, start: '09:00', end: '18:00' },
  wednesday: { enabled: true, start: '09:00', end: '18:00' },
  thursday: { enabled: true, start: '09:00', end: '18:00' },
  friday: { enabled: true, start: '09:00', end: '18:00' },
  saturday: { enabled: false, start: '09:00', end: '13:00' },
  sunday: { enabled: false, start: '09:00', end: '13:00' },
}

const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
}

interface WebChatWidgetRow {
  id: string
  name: string
  publicKey: string
  active: boolean
  allowedDomains: string[]
  includeCompanyWebsite?: boolean
  appearance: {
    primaryColor: string
    position: 'left' | 'right'
    title: string
    subtitle: string
    greeting: string
    askName: boolean
    askPhone: boolean
    askContactReason: boolean
    contactReasonOptions: string[]
    askEmail: boolean
    prechatFields?: import('../../lib/webchatPrechatFields').WebChatPrechatField[]
    prechatMode?: import('../../lib/webchatPrechatFields').WebChatPrechatMode
    theme: 'light' | 'dark'
    chatLayout?: 'classic' | 'copilot'
    previewTemplateId?: string
    showPoweredBy?: boolean
  }
  autoReplyEnabled: boolean
  autoReplyMessage: string
  autoReplySenderName: string
  autoReplyUseAi: boolean
  aiEscalationPolicy: WebChatAiEscalationPolicy
  proactiveGreetingEnabled: boolean
  proactiveGreetingMessage: string
  proactiveGreetingDelaySeconds: number
  defaultDepartmentId?: string | null
  useInboxBusinessHours: boolean
  businessHoursEnabled: boolean
  timezone: string
  schedule: WeeklySchedule
  outsideHoursMessage: string
}

interface InboxDepartmentOption {
  id: string
  name: string
  isActive?: boolean
}

interface WebChatConversationRow {
  id: string
  status: 'open' | 'closed'
  visitorName?: string
  visitorEmail?: string
  visitorPhone?: string
  contactReason?: string
  visitorIntake?: Record<string, string>
  pageUrl?: string
  pageTitle?: string
  userAgent?: string
  createdAt?: string
  lastMessageAt?: string
  lastMessagePreview?: string
  unreadCount?: number
  widgetName?: string
  queueStatus?: 'bot' | 'waiting_human' | 'with_agent'
  departmentId?: string
  departmentName?: string
  assignedUserId?: string
  assignedUserName?: string
  suggestedUserId?: string
  suggestedUserName?: string
  priorityForMe?: boolean
  canAccept?: boolean
  canPull?: boolean
}

interface WebChatMessageRow {
  id: string
  direction: 'inbound' | 'outbound' | 'system'
  body: string
  createdAt: string
  senderName?: string
  mediaType?: 'image' | 'document'
  mediaUrl?: string
  mediaFileName?: string
}

type Tab = 'chats' | 'widgets'
type ChatFilter = 'open' | 'closed' | 'queue'

function queueStatusLabel(status?: WebChatConversationRow['queueStatus']) {
  if (status === 'waiting_human') return 'Na fila'
  if (status === 'with_agent') return 'Com atendente'
  if (status === 'bot') return 'Bot/IA'
  return null
}

function embedSnippet(publicKey: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://SEU-PAINEL'
  return `<script src="${origin}/webchat/widget.js?v=2.12.71" data-widget-key="${publicKey}" async></script>`
}

function parseWebChatTab(param: string | null): Tab {
  return param === 'widgets' ? 'widgets' : 'chats'
}

export default function WebChat() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => parseWebChatTab(searchParams.get('tab')))
  const [chatFilter, setChatFilter] = useState<ChatFilter>('open')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chatSearch, setChatSearch] = useState('')
  const [showVisitorPanel, setShowVisitorPanel] = useState(true)
  const [newWidgetName, setNewWidgetName] = useState('')
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null)

  const setPageTab = (next: Tab) => {
    setTab(next)
    setSearchParams(
      prev => {
        const p = new URLSearchParams(prev)
        if (next === 'widgets') p.set('tab', 'widgets')
        else p.delete('tab')
        return p
      },
      { replace: true },
    )
  }

  const { data: me } = useQuery<AuthUser | null>({ queryKey: ['auth-me'], queryFn: getMe })
  const canView = can(me ?? null, 'webchat:view')
  const canManage = can(me ?? null, 'webchat:manage')
  const canInbox = can(me ?? null, 'inbox:view')

  useEffect(() => {
    const conv = searchParams.get('conv')
    const filter = searchParams.get('filter')
    if (conv) {
      navigate(inboxWebChatUrl(conv), { replace: true })
      return
    }
    if (filter === 'queue') {
      navigate('/platform/inbox?status=waiting_queue&channel=webchat', { replace: true })
      return
    }
    if (filter === 'open' || filter === 'closed') {
      setChatFilter(filter)
      setPageTab('chats')
    }
  }, [searchParams, navigate])

  useEffect(() => {
    const fromUrl = parseWebChatTab(searchParams.get('tab'))
    if (fromUrl !== tab) setTab(fromUrl)
  }, [searchParams, tab])

  const { data: widgets, isLoading: loadingWidgets } = useQuery({
    queryKey: ['webchat-widgets'],
    queryFn: () => api.get<WebChatWidgetRow[]>('/webchat/widgets'),
    enabled: canManage,
  })

  useEffect(() => {
    if (!widgets?.length) {
      setActiveWidgetId(null)
      return
    }
    if (!activeWidgetId || !widgets.some(w => w.id === activeWidgetId)) {
      setActiveWidgetId(widgets[0].id)
    }
  }, [widgets, activeWidgetId])

  const activeWidget = useMemo(
    () => widgets?.find(w => w.id === activeWidgetId) ?? null,
    [widgets, activeWidgetId],
  )

  const { data: stats } = useQuery({
    queryKey: ['webchat-stats'],
    queryFn: () =>
      api.get<{
        openCount: number
        unreadCount: number
        waitingQueueCount: number
        myWaitingQueueCount?: number
      }>('/webchat/stats'),
    enabled: canView,
    refetchInterval: 30_000,
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['inbox-departments', 'webchat'],
    queryFn: () => api.get<InboxDepartmentOption[]>('/inbox/departments'),
    enabled: canInbox && canManage,
  })

  const conversationsUrl = useMemo(() => {
    if (chatFilter === 'queue') return '/webchat/conversations?status=open&queueStatus=waiting_human'
    return `/webchat/conversations?status=${chatFilter}`
  }, [chatFilter])

  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ['webchat-conversations', chatFilter],
    queryFn: () => api.get<WebChatConversationRow[]>(conversationsUrl),
    enabled: canView,
    refetchInterval: 30_000,
  })

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['webchat-conversation', selectedId],
    queryFn: () =>
      api.get<{ conversation: WebChatConversationRow; messages: WebChatMessageRow[] }>(
        `/webchat/conversations/${selectedId}`,
      ),
    enabled: canView && !!selectedId,
  })

  useEffect(() => {
    setSelectedId(null)
    setChatSearch('')
  }, [chatFilter])

  const filteredConversations = useMemo(() => {
    const q = chatSearch.trim().toLowerCase()
    const sorted = [...(conversations ?? [])].sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
      return tb - ta
    })
    if (!q) return sorted
    return sorted.filter(c => {
      const name = (c.visitorName ?? '').toLowerCase()
      const email = (c.visitorEmail ?? '').toLowerCase()
      const page = (c.pageUrl ?? '').toLowerCase()
      const preview = (c.lastMessagePreview ?? '').toLowerCase()
      return name.includes(q) || email.includes(q) || page.includes(q) || preview.includes(q)
    })
  }, [conversations, chatSearch])

  useEffect(() => {
    if (!selectedId && filteredConversations.length) {
      setSelectedId(filteredConversations[0].id)
    }
  }, [filteredConversations, selectedId])

  const createWidget = useMutation({
    mutationFn: () => api.post<WebChatWidgetRow>('/webchat/widgets', { name: newWidgetName }),
    onSuccess: created => {
      qc.invalidateQueries({ queryKey: ['webchat-widgets'] })
      notifySuccess('Widget criado')
      setActiveWidgetId(created.id)
      setNewWidgetName('')
      setPageTab('widgets')
    },
    onError: mutationError,
  })

  const deleteWidget = useMutation({
    mutationFn: (id: string) => api.delete(`/webchat/widgets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webchat-widgets'] })
      notifySuccess('Widget removido')
    },
    onError: mutationError,
  })

  const selected = detail?.conversation
  const messages = detail?.messages ?? []

  if (!canView) {
    return (
      <PlatformPage title="Chat do Site">
        <Card className="p-6 text-sm text-[var(--rz-text-muted)]">
          Você não tem permissão para acessar o chat do site.
        </Card>
      </PlatformPage>
    )
  }

  return (
    <PlatformPage
      title="Chat do Site"
      description="Configure o widget no site e consulte o histórico — o atendimento ativo é na caixa de entrada."
    >
      {canInbox && <InboxAtendimentoNav me={me} className="mb-4" />}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex w-fit gap-1 rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/50 p-1"
          role="tablist"
          aria-label="Chat do Site"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'chats'}
            onClick={() => setPageTab('chats')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              tab === 'chats'
                ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30'
                : 'text-[var(--rz-text-muted)] border border-transparent hover:bg-[var(--rz-surface-muted)]',
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Histórico
            {stats && stats.openCount > 0 ? (
              <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] text-emerald-300">
                {stats.openCount}
              </span>
            ) : null}
          </button>
          {canManage && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'widgets'}
              onClick={() => setPageTab('widgets')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                tab === 'widgets'
                  ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30'
                  : 'text-[var(--rz-text-muted)] border border-transparent hover:bg-[var(--rz-surface-muted)]',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Widgets
              {(widgets?.length ?? 0) > 0 ? (
                <span className="rounded-full bg-[var(--rz-surface-muted)] px-1.5 text-[10px] text-[var(--rz-text-secondary)]">
                  {widgets!.length}
                </span>
              ) : null}
            </button>
          )}
        </div>

        {tab === 'chats' && stats && (
          <p className="text-xs text-[var(--rz-text-muted)]">
            {stats.waitingQueueCount > 0 ? (
              <>
                <span className="font-medium text-amber-300">{stats.waitingQueueCount} na fila</span>
                {' · '}
              </>
            ) : null}
            {stats.unreadCount > 0 ? (
              <>
                <span className="font-medium text-violet-300">{stats.unreadCount} não lidas</span>
                {' · '}
              </>
            ) : null}
            Atendimento no{' '}
            <Link to="/platform/inbox?channel=webchat" className="text-brand-400 hover:underline">
              Caixa de Entrada
            </Link>
          </p>
        )}
      </div>

      {tab === 'chats' && canInbox && (
        <p className="mb-4 rounded-lg border border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/30 px-3 py-2 text-xs text-[var(--rz-text-muted)]">
          Esta aba é somente leitura. Para assumir, responder ou usar comandos rápidos, abra a conversa no{' '}
          <Link to="/platform/inbox?channel=webchat" className="font-medium text-brand-400 hover:underline">
            caixa de entrada
          </Link>
          .
        </p>
      )}

      {stats && tab === 'chats' && (
        <InboxStatsRow
          className="mb-4"
          items={[
            {
              label: 'Abertas',
              value: stats.openCount,
              icon: MessageSquare,
              colorClass: 'text-green-400',
              href: '/platform/webchat?filter=open',
            },
            {
              label: 'Na fila',
              value: stats.waitingQueueCount,
              icon: InboxIcon,
              colorClass: 'text-blue-400',
              href: '/platform/inbox?status=waiting_queue&channel=webchat',
              alert: stats.waitingQueueCount > 0,
            },
            {
              label: 'Não lidas',
              value: stats.unreadCount,
              icon: Globe,
              colorClass: 'text-violet-400',
            },
          ]}
        />
      )}

      {tab === 'widgets' && canManage && (
        <div className="space-y-4">
          {loadingWidgets ? (
            <LoadingState rows={4} className="w-full py-12" />
          ) : !widgets?.length ? (
            <Card className="w-full p-8">
              <EmptyState
                icon={LayoutGrid}
                title="Nenhum widget configurado"
                description="Crie seu primeiro widget para exibir o chat no site. Depois copie o script de instalação."
                action={
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <input
                      className={inputCls + ' max-w-xs'}
                      value={newWidgetName}
                      onChange={e => setNewWidgetName(e.target.value)}
                      placeholder="Nome do widget"
                    />
                    <Button type="button" onClick={() => createWidget.mutate()} disabled={createWidget.isPending}>
                      <Plus className="h-4 w-4" />
                      Criar widget
                    </Button>
                  </div>
                }
              />
            </Card>
          ) : (
            <Card className="overflow-visible p-0">
              <WebChatWidgetList
                widgets={widgets}
                selectedId={activeWidgetId}
                onSelect={setActiveWidgetId}
                newWidgetName={newWidgetName}
                onNewWidgetNameChange={setNewWidgetName}
                onCreate={() => createWidget.mutate()}
                creating={createWidget.isPending}
              />
              {activeWidget ? (
                <WidgetEditorCard
                  key={activeWidget.id}
                  embedded
                  widget={activeWidget}
                  departments={departments}
                  canPickDepartment={canInbox}
                  userPlan={me?.plan}
                  onDelete={() => deleteWidget.mutate(activeWidget.id)}
                  deleting={deleteWidget.isPending}
                  onDuplicated={id => setActiveWidgetId(id)}
                />
              ) : null}
            </Card>
          )}
        </div>
      )}

      {tab === 'chats' && (
        <div className="flex flex-col min-h-[70vh] lg:h-[calc(100vh-12rem)] rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)]/30 overflow-hidden shadow-xl shadow-black/10">
          <div className="flex flex-1 min-h-0 flex-col xl:flex-row">
            {/* Lista */}
            <aside
              className={cn(
                'w-full xl:w-[320px] shrink-0 flex flex-col border-b xl:border-b-0 xl:border-r border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/30',
                selectedId ? 'max-xl:hidden' : 'max-xl:flex-1',
              )}
            >
              <div className="p-3 space-y-2.5 border-b border-[var(--rz-border)]/80 shrink-0">
                <div className="relative">
                  <Search size={14} className={searchFieldIconCls} />
                  <input
                    type="search"
                    value={chatSearch}
                    onChange={e => setChatSearch(e.target.value)}
                    placeholder="Buscar visitante, e-mail ou página…"
                    className={`${inputCls} pl-9 text-sm`}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {(['open', 'queue', 'closed'] as ChatFilter[]).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setChatFilter(f)}
                      className={cn(
                        'shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
                        chatFilter === f
                          ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                          : 'text-[var(--rz-text-muted)] border border-transparent hover:bg-[var(--rz-surface-muted)]',
                      )}
                    >
                      {f === 'open' && 'Abertas'}
                      {f === 'queue' && `Na fila${(stats?.waitingQueueCount ?? 0) > 0 ? ` (${stats!.waitingQueueCount})` : ''}`}
                      {f === 'closed' && 'Encerradas'}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--rz-text-muted)]">
                  {filteredConversations.length} conversa(s)
                </p>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                {loadingConversations ? (
                  <LoadingState rows={4} className="py-8" />
                ) : filteredConversations.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="Nenhuma conversa encontrada"
                    description={
                      chatSearch
                        ? 'Ajuste a busca ou troque o filtro.'
                        : chatFilter === 'queue'
                          ? 'Nenhum visitante aguardando no momento.'
                          : 'Novas conversas do site aparecerão aqui.'
                    }
                    className="py-10"
                  />
                ) : (
                  filteredConversations.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        'w-full text-left px-3 py-3 flex gap-3 border-b border-[var(--rz-border)]/50 hover:bg-[var(--rz-surface-muted)]/40 transition-colors',
                        selectedId === c.id
                          ? 'bg-violet-500/[0.08] border-l-2 border-l-violet-500'
                          : 'border-l-2 border-l-transparent',
                        c.status === 'closed' && 'opacity-60',
                      )}
                    >
                      <div className="w-9 h-9 rounded-full bg-violet-500/15 flex items-center justify-center text-sm font-semibold text-violet-300 shrink-0">
                        {(c.visitorName || c.visitorEmail || 'V').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate text-[var(--rz-text-primary)]">
                            {c.visitorName || c.visitorEmail || 'Visitante'}
                          </span>
                          {(c.unreadCount ?? 0) > 0 && (
                            <span className="rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--rz-text-muted)] truncate mt-0.5">
                          {c.lastMessagePreview || 'Sem mensagens'}
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-[10px] text-violet-300/80">
                            {queueStatusLabel(c.queueStatus) ?? (c.status === 'closed' ? 'Encerrada' : 'Aberta')}
                          </span>
                          {c.lastMessageAt && (
                            <span className="text-[10px] text-[var(--rz-text-muted)] tabular-nums shrink-0">
                              {new Date(c.lastMessageAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {canInbox && (
                <div className="p-3 border-t border-[var(--rz-border)]/80 shrink-0">
                  <Link to="/platform/inbox?channel=webchat" className="text-xs text-brand-400 hover:underline">
                    Ver todas na caixa de entrada →
                  </Link>
                </div>
              )}
            </aside>

            {/* Conversa */}
            <section
              className={cn(
                'flex-1 min-w-0 flex flex-col bg-[var(--rz-surface)]/20 min-h-[360px]',
                selectedId ? '' : 'max-xl:hidden',
              )}
            >
              {!selectedId ? (
                <div className="hidden xl:flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <MessageSquare size={32} className="text-[var(--rz-text-muted)]/40 mb-3" />
                  <p className="text-sm font-medium text-[var(--rz-text-secondary)]">Selecione uma conversa</p>
                  <p className="text-xs text-[var(--rz-text-muted)] mt-1 max-w-xs">
                    Escolha um visitante na lista para ver o histórico. Atendimento ativo é feito na caixa de entrada.
                  </p>
                </div>
              ) : loadingDetail ? (
                <LoadingState rows={3} className="py-8 flex-1" />
              ) : selected ? (
                <>
                  <header className="shrink-0 px-4 py-3 border-b border-[var(--rz-border)]/80 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedId(null)}
                        className="xl:hidden p-1.5 text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)] rounded-lg"
                        aria-label="Voltar"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowVisitorPanel(v => !v)}
                        className="xl:hidden p-1.5 text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)] rounded-lg"
                        aria-label="Detalhes do visitante"
                      >
                        <PanelRight size={18} />
                      </button>
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--rz-text-primary)] truncate">
                          {selected.visitorName || selected.visitorEmail || 'Visitante'}
                        </p>
                        {selected.pageUrl && (
                          <a
                            href={selected.pageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-brand-400 hover:underline truncate block"
                          >
                            {selected.pageUrl.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                    </div>
                    {canInbox && selected.status === 'open' && (
                      <Link to={inboxWebChatUrl(selectedId)}>
                        <Button size="sm">
                          <InboxIcon size={14} /> Caixa de Entrada
                        </Button>
                      </Link>
                    )}
                  </header>

                  {canInbox && selected.status === 'open' && selected.queueStatus === 'waiting_human' && (
                    <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
                      Na fila —{' '}
                      <Link to={inboxWebChatUrl(selectedId)} className="font-medium underline">
                        atender na caixa de entrada
                      </Link>
                    </div>
                  )}

                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
                    {messages.length === 0 ? (
                      <p className="text-center text-sm text-[var(--rz-text-muted)] py-8">Nenhuma mensagem.</p>
                    ) : (
                      messages.map(m => (
                        <div
                          key={m.id}
                          className={'flex ' + (m.direction === 'outbound' ? 'justify-end' : 'justify-start')}
                        >
                          <div
                            className={cn(
                              'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                              m.direction === 'system'
                                ? 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)] text-xs text-center w-full max-w-full'
                                : m.direction === 'outbound'
                                  ? 'bg-brand-500 text-white rounded-tr-sm'
                                  : 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-primary)] rounded-tl-sm',
                            )}
                          >
                            {m.direction === 'outbound' && m.senderName && (
                              <div className="mb-1 text-[10px] font-medium opacity-80">{m.senderName}</div>
                            )}
                            {m.mediaType === 'image' && m.mediaUrl && (
                              <a href={webChatMediaSrc(m.mediaUrl)} target="_blank" rel="noreferrer" className="block mb-1">
                                <img
                                  src={webChatMediaSrc(m.mediaUrl)}
                                  alt={m.mediaFileName ?? m.body}
                                  className="max-h-64 max-w-full rounded-lg object-contain"
                                />
                              </a>
                            )}
                            {m.mediaType === 'document' && m.mediaUrl && (
                              <a
                                href={webChatMediaSrc(m.mediaUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="mb-1 block text-sm underline"
                              >
                                📎 {m.mediaFileName ?? 'Documento PDF'}
                              </a>
                            )}
                            {!(m.mediaUrl && (m.mediaType === 'image' || m.mediaType === 'document')) && (
                              <div className="whitespace-pre-wrap">{m.body}</div>
                            )}
                            <div className="mt-1 text-[10px] opacity-70">
                              {new Date(m.createdAt).toLocaleString('pt-BR')}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <footer className="shrink-0 border-t border-[var(--rz-border)]/80 px-4 py-3 text-xs text-[var(--rz-text-muted)] text-center bg-[var(--rz-surface-muted)]/40">
                    {selected.status === 'open' && canInbox ? (
                      <>
                        Atendimento ativo pelo{' '}
                        <Link to={inboxWebChatUrl(selectedId)} className="text-brand-400 hover:underline">
                          Caixa de Entrada
                        </Link>
                        .
                      </>
                    ) : (
                      'Conversa encerrada. O atendimento é feito na caixa de entrada.'
                    )}
                  </footer>
                </>
              ) : null}
            </section>

            {/* Visitante */}
            {selected && (
              <WebChatVisitorPanel
                visitor={selected}
                canInbox={canInbox}
                messageCount={messages.length}
                className={showVisitorPanel ? 'max-xl:flex' : 'max-xl:hidden'}
              />
            )}
          </div>
        </div>
      )}
    </PlatformPage>
  )
}

function appearanceMatchesTemplate(
  appearance: WebChatWidgetRow['appearance'],
  preset: WebChatAppearancePreset,
): boolean {
  return (
    appearance.primaryColor.toLowerCase() === preset.primaryColor.toLowerCase() &&
    appearance.title === preset.title &&
    appearance.subtitle === preset.subtitle &&
    (appearance.theme ?? 'light') === preset.theme
  )
}

/** Só campos de pré-chat — evita sobrescrever tema/cores em PATCH concorrente. */
function prechatAppearancePatch(
  appearance: WebChatWidgetRow['appearance'],
): Partial<WebChatWidgetRow['appearance']> {
  const synced = syncLegacyAppearanceFlags(appearance)
  return {
    prechatMode: synced.prechatMode,
    prechatFields: synced.prechatFields,
    askName: synced.askName,
    askPhone: synced.askPhone,
    askContactReason: synced.askContactReason,
    askEmail: synced.askEmail,
    contactReasonOptions: synced.contactReasonOptions,
  }
}

/** Visual do widget (tema, cores, textos) — independente do pré-chat. */
function visualAppearancePatch(
  appearance: WebChatWidgetRow['appearance'],
): Partial<WebChatWidgetRow['appearance']> {
  return {
    primaryColor: appearance.primaryColor,
    position: appearance.position,
    title: appearance.title,
    subtitle: appearance.subtitle,
    greeting: appearance.greeting,
    theme: appearance.theme ?? 'light',
    previewTemplateId: appearance.previewTemplateId,
    chatLayout: appearance.chatLayout === 'copilot' ? 'copilot' : 'classic',
    showPoweredBy: appearance.showPoweredBy !== false,
  }
}

function WidgetEditorCard({
  widget,
  departments,
  canPickDepartment,
  userPlan,
  onDelete,
  deleting,
  onDuplicated,
  embedded = false,
}: {
  widget: WebChatWidgetRow
  departments: InboxDepartmentOption[]
  canPickDepartment: boolean
  userPlan?: string | null
  onDelete: () => void
  deleting: boolean
  onDuplicated?: (newId: string) => void
  /** Dentro do card unificado com toolbar de widgets no topo */
  embedded?: boolean
}) {
  const qc = useQueryClient()
  const { data: orgProfile } = useQuery<{ website?: string }>({
    queryKey: ['organization-profile'],
    queryFn: () => api.get('/organization/profile'),
  })
  const [form, setForm] = useState(widget)
  const [delayDraft, setDelayDraft] = useState(String(widget.proactiveGreetingDelaySeconds ?? 30))
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(() => {
    if (widget.appearance.previewTemplateId) return widget.appearance.previewTemplateId
    const match = WEBCHAT_PREVIEW_TEMPLATES.find(t =>
      appearanceMatchesTemplate(widget.appearance, t.appearance),
    )
    return match?.id ?? null
  })
  const [previewReloadKey, setPreviewReloadKey] = useState(0)
  const bumpPreview = () => setPreviewReloadKey(k => k + 1)
  const [visualApplying, setVisualApplying] = useState(false)
  /** Template usado no iframe — só muda após PATCH visual no servidor (evita landing nova + config antiga). */
  const [livePreviewTemplateId, setLivePreviewTemplateId] = useState<string | null>(() => {
    if (widget.appearance.previewTemplateId) return widget.appearance.previewTemplateId
    const match = WEBCHAT_PREVIEW_TEMPLATES.find(t =>
      appearanceMatchesTemplate(widget.appearance, t.appearance),
    )
    return match?.id ?? null
  })
  const [editorSection, setEditorSection] = useState<WebChatWidgetEditorSectionId>('overview')
  const [editorMode, setEditorMode] = useState<EditorMode>('simple')
  const [baselineDelayDraft, setBaselineDelayDraft] = useState(
    String(widget.proactiveGreetingDelaySeconds ?? 30),
  )

  const baselineForm = useMemo(
    () => ({
      ...widget,
      appearance: syncLegacyAppearanceFlags({
        ...widget.appearance,
        prechatFields: resolvePrechatFields(widget.appearance),
      }),
      proactiveGreetingEnabled: widget.proactiveGreetingEnabled ?? false,
      proactiveGreetingMessage:
        widget.proactiveGreetingMessage ?? 'Olá! Estou por aqui caso precise de ajuda 😊',
      proactiveGreetingDelaySeconds: widget.proactiveGreetingDelaySeconds ?? 30,
      aiEscalationPolicy: normalizeEscalationPolicyForm(widget.aiEscalationPolicy),
    }),
    [widget],
  )

  const isDirty = useMemo(
    () =>
      isWidgetFormDirty(
        baselineForm as import('../../types/webchatWidgetEditor').WebChatWidgetFormState,
        form as import('../../types/webchatWidgetEditor').WebChatWidgetFormState,
        delayDraft,
        baselineDelayDraft,
      ),
    [baselineForm, form, delayDraft, baselineDelayDraft],
  )

  const validationErrors = useMemo(
    () => validateWidgetForm(form as import('../../types/webchatWidgetEditor').WebChatWidgetFormState, delayDraft),
    [form, delayDraft],
  )

  const sectionStatuses = useMemo(
    () => getWidgetSectionStatuses(form as import('../../types/webchatWidgetEditor').WebChatWidgetFormState, delayDraft, orgProfile?.website),
    [form, delayDraft, orgProfile?.website],
  )

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const handleEditorModeChange = useCallback((mode: EditorMode) => {
    setEditorMode(mode)
    if (mode === 'simple') {
      setEditorSection(prev => (prev === 'avancado' ? 'overview' : prev))
    }
  }, [])

  const { data: aiStatus } = useQuery({
    queryKey: ['webchat-ai-status'],
    queryFn: () =>
      api.get<{
        available: boolean
        reason?: string
        attendanceMode?: string
        attendanceModeLabel?: string
        premiumAiAllowed?: boolean
        globalModeHint?: string
      }>('/webchat/ai-status'),
  })

  const premiumAiAllowed = aiStatus?.premiumAiAllowed === true

  useEffect(() => {
    setForm({
      ...widget,
      appearance: syncLegacyAppearanceFlags({
        ...widget.appearance,
        prechatFields: resolvePrechatFields(widget.appearance),
      }),
      proactiveGreetingEnabled: widget.proactiveGreetingEnabled ?? false,
      proactiveGreetingMessage:
        widget.proactiveGreetingMessage ?? 'Olá! Estou por aqui caso precise de ajuda 😊',
      proactiveGreetingDelaySeconds: widget.proactiveGreetingDelaySeconds ?? 30,
      aiEscalationPolicy: normalizeEscalationPolicyForm(widget.aiEscalationPolicy),
    })
    setDelayDraft(String(widget.proactiveGreetingDelaySeconds ?? 30))
    const match = WEBCHAT_PREVIEW_TEMPLATES.find(t =>
      appearanceMatchesTemplate(widget.appearance, t.appearance),
    )
    const tplId = widget.appearance.previewTemplateId ?? match?.id ?? null
    setSelectedTemplateId(tplId)
    setLivePreviewTemplateId(tplId)
    setEditorSection('overview')
    setBaselineDelayDraft(String(widget.proactiveGreetingDelaySeconds ?? 30))
    // Só reseta o editor ao trocar de widget — evita pular layout ao salvar pré-chat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.id])

  const save = useMutation({
    mutationFn: () => {
      const errors = validateWidgetForm(form, delayDraft)
      if (errors.length) throw new Error(errors[0])
      return api.patch(`/webchat/widgets/${widget.id}`, buildWidgetSavePayload(form, delayDraft))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webchat-widgets'] })
      const tplId = form.appearance.previewTemplateId ?? selectedTemplateId
      if (tplId) setLivePreviewTemplateId(tplId)
      bumpPreview()
      setBaselineDelayDraft(delayDraft)
      notifyConfigSaved()
    },
    onError: err => {
      if (err instanceof Error && validateWidgetForm(form, delayDraft).includes(err.message)) {
        mutationError(err)
      } else {
        mutationError(err)
      }
    },
  })

  const duplicateWidget = useMutation({
    mutationFn: async () => {
      const created = await api.post<WebChatWidgetRow>('/webchat/widgets', {
        name: `${form.name.trim() || widget.name} (cópia)`,
      })
      await api.patch(`/webchat/widgets/${created.id}`, buildWidgetSavePayload(form, delayDraft))
      return created
    },
    onSuccess: created => {
      qc.invalidateQueries({ queryKey: ['webchat-widgets'] })
      notifySuccess('Widget duplicado')
      onDuplicated?.(created.id)
    },
    onError: mutationError,
  })

  const persistAppearancePatch = useMutation({
    mutationFn: (appearance: Partial<WebChatWidgetRow['appearance']>) =>
      api.patch<WebChatWidgetRow>(`/webchat/widgets/${widget.id}`, { appearance }),
    onError: mutationError,
  })

  const mergeWidgetAppearanceInCache = (updated: WebChatWidgetRow) => {
    qc.setQueryData<WebChatWidgetRow[]>(['webchat-widgets'], old =>
      old?.map(w => (w.id === updated.id ? { ...w, appearance: updated.appearance } : w)),
    )
  }

  const persistPrechatAppearance = (appearance: WebChatWidgetRow['appearance']) => {
    persistAppearancePatch.mutate(prechatAppearancePatch(appearance), {
      onSuccess: updated => {
        mergeWidgetAppearanceInCache(updated)
        bumpPreview()
        notifyConfigSaved()
      },
    })
  }

  const snippet = embedSnippet(widget.publicKey)
  const activePreviewTemplateId =
    form.appearance.previewTemplateId ?? selectedTemplateId ?? null
  const previewUrl = webChatPreviewUrl(
    '/webchat/widget.html',
    widget.publicKey,
    previewReloadKey || undefined,
    orgProfile?.website,
  )

  const persistVisualAppearance = (appearance: WebChatWidgetRow['appearance']) => {
    setVisualApplying(true)
    persistAppearancePatch.mutate(visualAppearancePatch(appearance), {
      onSuccess: updated => {
        mergeWidgetAppearanceInCache(updated)
        qc.invalidateQueries({ queryKey: ['webchat-widgets'] })
        const synced = syncLegacyAppearanceFlags(updated.appearance ?? appearance)
        setForm(f => ({ ...f, appearance: synced }))
        const tplId = synced.previewTemplateId
        if (tplId) {
          setSelectedTemplateId(tplId)
          setLivePreviewTemplateId(tplId)
        }
        bumpPreview()
        notifyConfigSaved()
      },
      onSettled: () => setVisualApplying(false),
    })
  }

  const applyTemplateAppearance = (appearance: WebChatAppearancePreset, templateId: string) => {
    const nextAppearance = syncLegacyAppearanceFlags({
      ...form.appearance,
      ...appearance,
      previewTemplateId: templateId,
    })
    setForm(f => ({ ...f, appearance: nextAppearance }))
    setSelectedTemplateId(templateId)
    persistVisualAppearance(nextAppearance)
  }

  const applyChatBoxModel = (model: ChatBoxModel) => {
    if (model.isPremium && !canUsePremiumChatBoxModels(userPlan)) return
    applyTemplateAppearance(
      model.appearance,
      chatBoxPreviewTemplateId(model.id),
    )
  }

  const selectedChatBoxModelId = parseChatBoxModelId(
    form.appearance.previewTemplateId ?? selectedTemplateId,
  )

  const persistAutoReply = useMutation({
    mutationFn: (patch: Pick<WebChatWidgetRow, 'autoReplyEnabled' | 'autoReplyUseAi'>) =>
      api.patch(`/webchat/widgets/${widget.id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webchat-widgets'] })
      notifyConfigSaved()
    },
    onError: mutationError,
  })

  const patchAutoReply = (patch: Partial<Pick<WebChatWidgetRow, 'autoReplyEnabled' | 'autoReplyUseAi'>>) => {
    setForm(f => {
      const next = { ...f, ...patch }
      persistAutoReply.mutate({
        autoReplyEnabled: next.autoReplyEnabled,
        autoReplyUseAi: next.autoReplyUseAi,
      })
      return next
    })
  }

  const persistEscalationPolicy = useMutation({
    mutationFn: (policy: WebChatAiEscalationPolicy) =>
      api.patch(`/webchat/widgets/${widget.id}`, { aiEscalationPolicy: policy }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webchat-widgets'] })
      notifyConfigSaved()
    },
    onError: mutationError,
  })

  const patchEscalationPolicy = (patch: Partial<WebChatAiEscalationPolicy>) => {
    setForm(f => {
      const next = normalizeEscalationPolicyForm({ ...f.aiEscalationPolicy, ...patch })
      persistEscalationPolicy.mutate(next)
      return { ...f, aiEscalationPolicy: next }
    })
  }

  const patchEscalationTrigger = (
    key: 'humanRequest' | 'commercialRequest' | 'supportRequest',
    value: WebChatAiTransferTrigger,
  ) => {
    patchEscalationPolicy({ [key]: value })
  }

  const handleSave = () => save.mutate()
  const copyScript = () => {
    navigator.clipboard.writeText(snippet)
    notifySuccess('Código copiado')
  }

  const editorBody = (
    <>
      <WebChatWidgetEditorHeader
        title={form.appearance.title || widget.name}
        internalName={form.name}
        publicKey={widget.publicKey}
        active={form.active}
        allowedDomains={form.allowedDomains}
        includeCompanyWebsite={form.includeCompanyWebsite !== false}
        companyWebsite={orgProfile?.website}
        isDirty={isDirty}
        previewUrl={previewUrl}
        snippet={snippet}
        saving={save.isPending}
        duplicating={duplicateWidget.isPending}
        deleting={deleting}
        validationErrors={validationErrors}
        onSave={handleSave}
        onDelete={onDelete}
        onDuplicate={() => duplicateWidget.mutate()}
        onCopyScript={copyScript}
      />

      <div className="p-4 pb-24 xl:pb-4">
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_min(320px,32%)] xl:gap-5">
          <div className="order-2 min-w-0 xl:order-1">
            <div className="xl:grid xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-4">
              <WebChatWidgetSectionNav
                className="hidden xl:block"
                active={editorSection}
                onChange={setEditorSection}
                statuses={sectionStatuses}
                editorMode={editorMode}
                onEditorModeChange={handleEditorModeChange}
              />

              <div className="min-w-0">
                <WebChatWidgetSectionNavCompact
                  active={editorSection}
                  onChange={setEditorSection}
                  editorMode={editorMode}
                />

      {editorSection === 'overview' && (
        <WebChatWidgetEditorSection
          id="webchat-section-overview"
          title="Visão geral"
          description="Comece pelos domínios permitidos, depois identifique o widget e instale no site."
        >
          <div className="space-y-4">
            <WidgetSectionCard
              title="Sites onde este widget pode aparecer"
              description="Primeiro passo — defina onde o chat pode carregar antes de copiar o script."
            >
              <EmbedSitesSection
                title=""
                description=""
                includeCompanyWebsite={form.includeCompanyWebsite !== false}
                onIncludeCompanyWebsiteChange={checked =>
                  setForm(f => ({ ...f, includeCompanyWebsite: checked }))
                }
                extraDomains={form.allowedDomains}
                onExtraDomainsChange={domains => setForm(f => ({ ...f, allowedDomains: domains }))}
                companyWebsite={orgProfile?.website}
                textareaCls={textareaCls}
                id="webchat-overview-extra-domains"
              />
            </WidgetSectionCard>
            <WebChatWidgetOverview
              statuses={sectionStatuses}
              onNavigate={setEditorSection}
              editorMode={editorMode}
            />
            <WidgetSectionCard
              title="Identificação"
              description="Esse nome aparece apenas para sua equipe no painel."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
                  Nome interno do widget
                  <input
                    className={inputCls + ' mt-1'}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex.: Site principal"
                  />
                </label>
                <label className="flex items-center gap-2 pt-5 text-sm text-[var(--rz-text)]">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  />
                  Widget ativo no site
                </label>
              </div>
            </WidgetSectionCard>
          </div>
        </WebChatWidgetEditorSection>
      )}

      {editorSection === 'avancado' && (
        <WebChatWidgetEditorSection
          id="webchat-section-avancado"
          title="Configurações avançadas"
          description="Roteamento e opções extras do widget."
        >
          <div className="space-y-4">
            {canPickDepartment && (
              <WidgetSectionCard
                title="Setor que recebe novas conversas"
                description="Conversas novas serão enviadas para esse setor quando não houver regra específica."
              >
                <select
                  className={inputCls}
                  value={form.defaultDepartmentId ?? ''}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      defaultDepartmentId: e.target.value || null,
                    }))
                  }
                >
                  <option value="">Nenhum — fila geral</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </WidgetSectionCard>
            )}
          </div>
        </WebChatWidgetEditorSection>
      )}

      {editorSection === 'visual' && (
        <div className="space-y-4">
          <WebChatWidgetEditorSection
            id="webchat-section-visual"
            title="Aparência"
            description="Identidade do chat e modelo visual aplicado no site."
          >
            <WidgetSectionCard
              title="Identidade do chat"
              description="Textos e cor que o visitante vê ao abrir o widget."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
                  Título do chat
                  <input
                    className={inputCls + ' mt-1'}
                    value={form.appearance.title}
                    onChange={e =>
                      setForm(f => ({ ...f, appearance: { ...f.appearance, title: e.target.value } }))
                    }
                  />
                </label>
                <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
                  Subtítulo
                  <input
                    className={inputCls + ' mt-1'}
                    value={form.appearance.subtitle}
                    onChange={e =>
                      setForm(f => ({ ...f, appearance: { ...f.appearance, subtitle: e.target.value } }))
                    }
                  />
                </label>
                <label className="block text-xs font-medium text-[var(--rz-text-muted)] sm:col-span-2">
                  Mensagem inicial
                  <textarea
                    className={textareaCls + ' mt-1'}
                    rows={2}
                    value={form.appearance.greeting}
                    onChange={e =>
                      setForm(f => ({ ...f, appearance: { ...f.appearance, greeting: e.target.value } }))
                    }
                  />
                </label>
                <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
                  Cor principal
                  <input
                    type="color"
                    className="mt-1 h-10 w-full cursor-pointer rounded border border-[var(--rz-border)]"
                    value={form.appearance.primaryColor}
                    onChange={e =>
                      setForm(f => ({ ...f, appearance: { ...f.appearance, primaryColor: e.target.value } }))
                    }
                  />
                </label>
                {editorMode === 'advanced' && (
                  <>
                    <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
                      Posição do balão
                      <select
                        className={inputCls + ' mt-1'}
                        value={form.appearance.position}
                        onChange={e =>
                          setForm(f => ({
                            ...f,
                            appearance: { ...f.appearance, position: e.target.value as 'left' | 'right' },
                          }))
                        }
                      >
                        <option value="right">Direita</option>
                        <option value="left">Esquerda</option>
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-[var(--rz-text-muted)] sm:col-span-2">
                      Tema do widget
                      <div
                        className={cn(
                          'mt-1 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm',
                          'border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40 text-[var(--rz-text)]',
                        )}
                      >
                        {form.appearance.theme === 'dark' ? (
                          <Moon className="h-4 w-4 shrink-0 text-cyan-400" />
                        ) : (
                          <Sun className="h-4 w-4 shrink-0 text-amber-400" />
                        )}
                        <span className="font-medium">
                          {form.appearance.theme === 'dark' ? 'Escuro' : 'Claro'}
                        </span>
                      </div>
                      <span className="mt-1 block text-[10px] text-[var(--rz-text-muted)]">
                        Definido pelo modelo aplicado abaixo.
                      </span>
                    </label>
                  </>
                )}
              </div>
              <ProductBrandingFooterToggle
                className="mt-4 border-t border-[var(--rz-border)] pt-4"
                planId={userPlan}
                checked={form.appearance.showPoweredBy !== false}
                onChange={checked => {
                  const next = { ...form.appearance, showPoweredBy: checked }
                  setForm(f => ({ ...f, appearance: next }))
                  persistVisualAppearance(next)
                }}
              />
            </WidgetSectionCard>
          </WebChatWidgetEditorSection>

          <WebChatWidgetEditorSection
            id="webchat-section-modelos"
            title="Modelos visuais"
            description="Chat Box com modelos essenciais (landings + widgets) e coleção premium."
          >
            <WebChatPreviewTemplates
              publicKey={widget.publicKey}
              selectedTemplateId={activePreviewTemplateId}
              selectedChatBoxModelId={selectedChatBoxModelId}
              userPlan={userPlan}
              onSelectTemplate={template => applyTemplateAppearance(template.appearance, template.id)}
              onApplyChatBoxModel={applyChatBoxModel}
            />
          </WebChatWidgetEditorSection>
        </div>
      )}

      {editorSection === 'prechat' && (
        <WebChatWidgetEditorSection
          id="webchat-section-prechat"
          title="Formulário inicial"
          description="Dados que o visitante informa antes de iniciar a conversa."
        >
          <WebChatPrechatFieldsEditor
            appearance={form.appearance}
            onChange={appearance =>
              setForm(f => ({
                ...f,
                appearance: syncLegacyAppearanceFlags({
                  ...f.appearance,
                  ...appearance,
                }),
              }))
            }
            onPersist={appearance =>
              persistPrechatAppearance(
                syncLegacyAppearanceFlags({ ...form.appearance, ...appearance }),
              )
            }
          />
        </WebChatWidgetEditorSection>
      )}

      {editorSection === 'automacao' && (
        <WebChatWidgetEditorSection
          id="webchat-section-automacao"
          title="IA e automações"
          description="Respostas automáticas, transferência para humanos e saudação proativa."
        >
        <div className="space-y-4">
          <WidgetSectionCard
            title="Resposta automática"
            description="Use para responder dúvidas simples antes de enviar para um atendente."
          >
            <label className="flex items-center gap-2 text-sm text-[var(--rz-text)]">
              <input
                type="checkbox"
                checked={form.autoReplyEnabled}
                onChange={e => patchAutoReply({ autoReplyEnabled: e.target.checked })}
              />
              Ativar resposta automática
            </label>
            {aiStatus?.globalModeHint && (
              <p className="mt-2 text-xs text-[var(--rz-text-muted)] rounded-md border border-[var(--rz-border)] bg-[var(--rz-surface-elevated)] px-3 py-2">
                {aiStatus.globalModeHint}{' '}
                <Link to="/platform/inbox/ia" className="text-brand-400 hover:underline">
                  IA Atendimento
                </Link>
              </p>
            )}
            <label
              className={
                'mt-3 flex items-center gap-2 text-sm ' +
                (premiumAiAllowed && aiStatus?.available !== false
                  ? 'text-[var(--rz-text)]'
                  : 'text-[var(--rz-text-muted)]')
              }
            >
              <input
                type="checkbox"
                checked={form.autoReplyUseAi}
                disabled={
                  !premiumAiAllowed ||
                  aiStatus?.available === false ||
                  !form.autoReplyEnabled
                }
                onChange={e => patchAutoReply({ autoReplyUseAi: e.target.checked })}
              />
              Usar IA Premium no widget
            </label>
            {!premiumAiAllowed && (
              <p className="mt-1 text-xs text-[var(--rz-text-muted)]">
                Disponível apenas com modo global{' '}
                <strong>IA Premium</strong> em{' '}
                <Link to="/platform/inbox/ia" className="text-brand-400 hover:underline">
                  IA Atendimento
                </Link>
                {aiStatus?.attendanceModeLabel
                  ? ` (atual: ${aiStatus.attendanceModeLabel})`
                  : ''}
                .
              </p>
            )}
            {premiumAiAllowed && aiStatus?.available === false && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                {aiStatus.reason ?? 'IA Premium indisponível — usa mensagem fixa abaixo.'}
              </p>
            )}
            <label className="mt-3 block text-xs font-medium text-[var(--rz-text-muted)]">
              Nome exibido do assistente
              <input
                className={inputCls + ' mt-1'}
                value={form.autoReplySenderName}
                onChange={e => setForm(f => ({ ...f, autoReplySenderName: e.target.value }))}
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-[var(--rz-text-muted)]">
              Mensagem quando a IA não souber responder
              <textarea
                className={textareaCls + ' mt-1'}
                rows={2}
                value={form.autoReplyMessage}
                onChange={e => setForm(f => ({ ...f, autoReplyMessage: e.target.value }))}
              />
            </label>
          </WidgetSectionCard>

          <WidgetSectionCard
            title="Transferência para humano"
            description="Define quando a IA deve parar de tentar resolver e encaminhar para a equipe."
          >
            <div
              className={
                !form.autoReplyUseAi || !form.autoReplyEnabled
                  ? 'opacity-60 pointer-events-none space-y-4'
                  : 'space-y-4'
              }
            >
              {!form.autoReplyUseAi && (
                <p className="text-xs text-[var(--rz-text-muted)]">
                  Ative a IA acima para configurar transferência automática.
                </p>
              )}
              {(
                [
                  ['humanRequest', 'Pedido de atendente humano'],
                  ['commercialRequest', 'Pedido de setor comercial / vendas'],
                  ['supportRequest', 'Pedido de suporte técnico'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs font-medium text-[var(--rz-text-muted)]">
                  {label}
                  <select
                    className={inputCls + ' mt-1 text-sm'}
                    value={form.aiEscalationPolicy?.[key] ?? DEFAULT_WEBCHAT_AI_ESCALATION_POLICY[key]}
                    disabled={!form.autoReplyUseAi || persistEscalationPolicy.isPending}
                    onChange={e =>
                      patchEscalationTrigger(key, e.target.value as WebChatAiTransferTrigger)
                    }
                  >
                    {WEBCHAT_TRANSFER_TRIGGER_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} — {opt.hint}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
                Tentativas antes de encaminhar (triagem)
                <select
                  className={inputCls + ' mt-1 text-sm w-full max-w-xs'}
                  value={String(form.aiEscalationPolicy?.escalateAfterRepeatedRequests ?? 2)}
                  disabled={!form.autoReplyUseAi || persistEscalationPolicy.isPending}
                  onChange={e =>
                    patchEscalationPolicy({
                      escalateAfterRepeatedRequests: Number(e.target.value),
                    })
                  }
                >
                  <option value="0">0 — só após o visitante confirmar que ainda precisa</option>
                  <option value="1">1 pedido</option>
                  <option value="2">2 pedidos (padrão)</option>
                  <option value="3">3 pedidos</option>
                  <option value="4">4 pedidos</option>
                  <option value="5">5 pedidos</option>
                </select>
              </label>
            </div>
          </WidgetSectionCard>

          <WidgetSectionCard
            title="Saudação proativa"
            description="Balão amigável após alguns segundos na página — independente do horário comercial."
          >
            <label className="flex items-center gap-2 text-sm text-[var(--rz-text)]">
              <input
                type="checkbox"
                checked={form.proactiveGreetingEnabled ?? false}
                onChange={e => setForm(f => ({ ...f, proactiveGreetingEnabled: e.target.checked }))}
              />
              Ativar saudação proativa
            </label>
            {form.proactiveGreetingEnabled && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Olá! Estou por aqui caso precise de ajuda 😊',
                    'Oi! Posso te ajudar a escolher o melhor plano?',
                    'Precisa de ajuda? Fale com nossa equipe agora.',
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      className="rounded-full border border-[var(--rz-border)] px-2.5 py-1 text-[10px] text-[var(--rz-text-secondary)] hover:border-brand-500/40"
                      onClick={() => setForm(f => ({ ...f, proactiveGreetingMessage: suggestion }))}
                    >
                      {suggestion.slice(0, 36)}…
                    </button>
                  ))}
                </div>
                <label className="mt-3 block text-xs font-medium text-[var(--rz-text-muted)]">
                  Mensagem
                  <textarea
                    className={textareaCls + ' mt-1'}
                    rows={2}
                    maxLength={300}
                    value={form.proactiveGreetingMessage ?? ''}
                    onChange={e =>
                      setForm(f => ({ ...f, proactiveGreetingMessage: e.target.value }))
                    }
                  />
                </label>
                <label className="mt-3 block text-xs font-medium text-[var(--rz-text-muted)]">
                  Tempo para mostrar a saudação (segundos)
                  <input
                    type="number"
                    min={5}
                    max={300}
                    step={1}
                    className={inputCls + ' mt-1 w-28'}
                    value={delayDraft}
                    onChange={e => setDelayDraft(e.target.value)}
                    onBlur={() => {
                      const clamped = Math.min(300, Math.max(5, parseInt(delayDraft, 10) || 30))
                      setDelayDraft(String(clamped))
                      setForm(f => ({ ...f, proactiveGreetingDelaySeconds: clamped }))
                    }}
                  />
                </label>
                {form.proactiveGreetingMessage && (
                  <div className="mt-3 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/30 px-3 py-2 text-xs text-[var(--rz-text-secondary)]">
                    <span className="text-[10px] uppercase text-[var(--rz-text-muted)]">Prévia</span>
                    <p className="mt-1">{form.proactiveGreetingMessage}</p>
                  </div>
                )}
              </>
            )}
          </WidgetSectionCard>
        </div>
        </WebChatWidgetEditorSection>
      )}

      {editorSection === 'horarios' && (
        <WebChatWidgetEditorSection
          id="webchat-section-horarios"
          title="Horário de atendimento"
          description="Quando o widget considera a equipe disponível."
        >
          <WebChatBusinessHoursEditor
            form={form as import('../../types/webchatWidgetEditor').WebChatWidgetFormState}
            editorMode={editorMode}
            onChange={patch => setForm(f => ({ ...f, ...patch }))}
          />
        </WebChatWidgetEditorSection>
      )}

      {editorSection === 'instalacao' && (
        <WebChatWidgetEditorSection
          id="webchat-section-instalacao"
          title="Instalação no site"
          description="Copie o script e integre em WordPress, Elementor ou via API."
        >
          <WebChatIntegrationsPanel
            publicKey={widget.publicKey}
            name={form.name}
            active={form.active}
          />
        </WebChatWidgetEditorSection>
      )}

      <WebChatWidgetSaveBar isDirty={isDirty} saving={save.isPending} onSave={handleSave} />

              </div>
            </div>
          </div>
          <div className="order-1 mb-4 xl:order-2 xl:mb-0">
            <WebChatWidgetPreviewPanel
              publicKey={widget.publicKey}
              selectedTemplateId={livePreviewTemplateId}
              companyWebsite={orgProfile?.website}
              reloadKey={previewReloadKey}
              applying={visualApplying}
            />
          </div>
        </div>
      </div>
    </>
  )

  if (embedded) {
    return <div className="min-w-0">{editorBody}</div>
  }

  return <Card className="overflow-visible p-0">{editorBody}</Card>
}
