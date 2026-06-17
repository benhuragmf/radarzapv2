import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Globe, MessageSquare, Plus, Copy, Trash2, Send, XCircle, Save, ExternalLink, RotateCcw, ArrowUpRight, UserCheck, Hand, Paperclip } from 'lucide-react'
import { notifySuccess, mutationError } from '../../lib/notify'
import { inputCls, textareaCls, LoadingState } from '@/design-system'
import { cn } from '@/lib/utils'
import { webChatMediaSrc } from '../../lib/webchatInbox'
import { readWebChatAttachmentFile } from '../../lib/webchatAttachment'

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
  appearance: {
    primaryColor: string
    position: 'left' | 'right'
    title: string
    subtitle: string
    greeting: string
    askName: boolean
    askEmail: boolean
  }
  autoReplyEnabled: boolean
  autoReplyMessage: string
  autoReplySenderName: string
  autoReplyUseAi: boolean
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
  pageUrl?: string
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
  return `<script src="${origin}/webchat/widget.js" data-widget-key="${publicKey}" async></script>`
}

export default function WebChat() {
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('chats')
  const [chatFilter, setChatFilter] = useState<ChatFilter>('open')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newWidgetName, setNewWidgetName] = useState('Site principal')
  const [escalateDeptId, setEscalateDeptId] = useState('')

  const { data: me } = useQuery<AuthUser | null>({ queryKey: ['auth-me'], queryFn: getMe })
  const canView = can(me ?? null, 'webchat:view')
  const canManage = can(me ?? null, 'webchat:manage')
  const canReply = can(me ?? null, 'webchat:reply')
  const canInbox = can(me ?? null, 'inbox:view')

  const { data: widgets, isLoading: loadingWidgets } = useQuery({
    queryKey: ['webchat-widgets'],
    queryFn: () => api.get<WebChatWidgetRow[]>('/webchat/widgets'),
    enabled: canManage,
  })

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

  useEffect(() => {
    const filter = searchParams.get('filter')
    const conv = searchParams.get('conv')
    if (filter === 'queue' || filter === 'open' || filter === 'closed') {
      setChatFilter(filter)
      setTab('chats')
    }
    if (conv) setSelectedId(conv)
  }, [searchParams])

  const { data: departments = [] } = useQuery({
    queryKey: ['inbox-departments', 'webchat'],
    queryFn: () => api.get<InboxDepartmentOption[]>('/inbox/departments'),
    enabled: canInbox,
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
  }, [chatFilter])

  useEffect(() => {
    if (!selectedId && conversations?.length) {
      setSelectedId(conversations[0].id)
    }
  }, [conversations, selectedId])

  const createWidget = useMutation({
    mutationFn: () => api.post<WebChatWidgetRow>('/webchat/widgets', { name: newWidgetName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webchat-widgets'] })
      notifySuccess('Widget criado')
      setTab('widgets')
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

  const sendMessage = useMutation({
    mutationFn: (body: string) => api.post(`/webchat/conversations/${selectedId}/messages`, { body }),
    onSuccess: () => {
      setDraft('')
      qc.invalidateQueries({ queryKey: ['webchat-conversation', selectedId] })
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
    },
    onError: mutationError,
  })

  const sendAttachment = useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption?: string }) => {
      const payload = await readWebChatAttachmentFile(file, caption)
      return api.post(`/webchat/conversations/${selectedId}/messages/attachment`, payload)
    },
    onSuccess: () => {
      setDraft('')
      qc.invalidateQueries({ queryKey: ['webchat-conversation', selectedId] })
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
    },
    onError: mutationError,
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  const closeChat = useMutation({
    mutationFn: () => api.post(`/webchat/conversations/${selectedId}/close`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webchat-conversation', selectedId] })
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
      qc.invalidateQueries({ queryKey: ['webchat-stats'] })
      notifySuccess('Conversa encerrada')
    },
    onError: mutationError,
  })

  const reopenChat = useMutation({
    mutationFn: () => api.post(`/webchat/conversations/${selectedId}/reopen`, {}),
    onSuccess: () => {
      setChatFilter('open')
      qc.invalidateQueries({ queryKey: ['webchat-conversation', selectedId] })
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
      qc.invalidateQueries({ queryKey: ['webchat-stats'] })
      notifySuccess('Conversa reaberta')
    },
    onError: mutationError,
  })

  const escalateChat = useMutation({
    mutationFn: () =>
      api.post(`/webchat/conversations/${selectedId}/escalate`, {
        departmentId: escalateDeptId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webchat-conversation', selectedId] })
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
      qc.invalidateQueries({ queryKey: ['webchat-stats'] })
      notifySuccess('Conversa encaminhada para a fila')
    },
    onError: mutationError,
  })

  const assignChat = useMutation({
    mutationFn: () => api.post(`/inbox/conversations/wc:${selectedId}/assign`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webchat-conversation', selectedId] })
      qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
      qc.invalidateQueries({ queryKey: ['webchat-stats'] })
      notifySuccess('Conversa assumida')
    },
    onError: mutationError,
  })

  const selected = detail?.conversation
  const messages = detail?.messages ?? []
  const canAgentReply =
    canReply &&
    selected?.status === 'open' &&
    selected.queueStatus === 'with_agent' &&
    (!selected.assignedUserId || selected.assignedUserId === me?.userId)
  const showAssignPull =
    canReply &&
    selected?.status === 'open' &&
    selected.queueStatus === 'waiting_human' &&
    Boolean(selected.canAccept || selected.canPull)

  const sortedConversations = useMemo(
    () => [...(conversations ?? [])].sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
      return tb - ta
    }),
    [conversations],
  )

  if (!canView) {
    return (
      <PlatformPage title="Chat do site" icon={Globe}>
        <Card className="p-6 text-sm text-[var(--rz-text-muted)]">
          Você não tem permissão para acessar o chat do site.
        </Card>
      </PlatformPage>
    )
  }

  return (
    <PlatformPage
      title="Chat do site"
      icon={Globe}
      description="Widget embedável para o seu website — atenda visitantes em tempo real pelo painel."
    >
      <Card className="mb-4 p-3 text-sm text-[var(--rz-text-muted)]">
        Teste local:{' '}
        <a className="text-[var(--rz-primary)] hover:underline" href="/webchat/widget.html" target="_blank" rel="noreferrer">
          /webchat/widget.html
        </a>
        {' · '}
        <a className="text-[var(--rz-primary)] hover:underline" href="/webchat/demo.html" target="_blank" rel="noreferrer">
          demo.html?key=…
        </a>
      </Card>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          variant={tab === 'chats' ? 'primary' : 'secondary'}
          onClick={() => setTab('chats')}
          type="button"
        >
          <MessageSquare className="h-4 w-4" />
          Conversas
        </Button>
        {canManage && (
          <Button
            variant={tab === 'widgets' ? 'primary' : 'secondary'}
            onClick={() => setTab('widgets')}
            type="button"
          >
            <Globe className="h-4 w-4" />
            Widgets
          </Button>
        )}
      </div>

      {tab === 'widgets' && canManage && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--rz-text)]">Novo widget</h3>
            <div className="flex flex-wrap gap-2">
              <input
                className={inputCls}
                value={newWidgetName}
                onChange={e => setNewWidgetName(e.target.value)}
                placeholder="Nome do widget"
              />
              <Button type="button" onClick={() => createWidget.mutate()} disabled={createWidget.isPending}>
                <Plus className="h-4 w-4" />
                Criar
              </Button>
            </div>
          </Card>

          {loadingWidgets ? (
            <LoadingState label="Carregando widgets..." />
          ) : (
            <div className="space-y-3">
              {(widgets ?? []).map(w => (
                <WidgetEditorCard
                  key={w.id}
                  widget={w}
                  departments={departments}
                  canPickDepartment={canInbox}
                  onDelete={() => deleteWidget.mutate(w.id)}
                  deleting={deleteWidget.isPending}
                />
              ))}
              {!widgets?.length && (
                <Card className="p-6 text-sm text-[var(--rz-text-muted)]">
                  Nenhum widget ainda. Crie um e cole o script no HTML do seu site.
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'chats' && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rz-border)] px-4 py-3">
              <div className="text-sm font-semibold">
                {(stats?.unreadCount ?? 0) > 0 && (
                  <span className="mr-2 rounded-full bg-[var(--rz-primary)] px-2 py-0.5 text-xs text-white">
                    {stats!.unreadCount} nova(s)
                  </span>
                )}
                {(stats?.myWaitingQueueCount ?? stats?.waitingQueueCount ?? 0) > 0 && chatFilter !== 'queue' && (
                  <span className="mr-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                    {stats!.myWaitingQueueCount ?? stats!.waitingQueueCount} na fila
                  </span>
                )}
                {chatFilter === 'open' && 'Abertas'}
                {chatFilter === 'closed' && 'Encerradas'}
                {chatFilter === 'queue' && 'Na fila'} ({sortedConversations.length})
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={chatFilter === 'open' ? 'primary' : 'secondary'}
                  onClick={() => setChatFilter('open')}
                >
                  Abertas
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={chatFilter === 'queue' ? 'primary' : 'secondary'}
                  onClick={() => setChatFilter('queue')}
                >
                  Na fila
                  {(stats?.myWaitingQueueCount ?? stats?.waitingQueueCount ?? 0) > 0 && (
                    <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">
                      {stats!.myWaitingQueueCount ?? stats!.waitingQueueCount}
                    </span>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={chatFilter === 'closed' ? 'primary' : 'secondary'}
                  onClick={() => setChatFilter('closed')}
                >
                  Encerradas
                </Button>
              </div>
            </div>
            {loadingConversations ? (
              <LoadingState label="Carregando..." />
            ) : (
              <ul className="max-h-[60vh] overflow-auto">
                {sortedConversations.map(c => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={
                        'w-full border-b border-[var(--rz-border)] px-4 py-3 text-left transition hover:bg-[var(--rz-surface-hover)] ' +
                        (selectedId === c.id ? 'bg-[var(--rz-surface-hover)]' : '')
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--rz-text)]">
                          {c.visitorName || c.visitorEmail || 'Visitante'}
                        </span>
                        {(c.unreadCount ?? 0) > 0 && (
                          <span className="rounded-full bg-[var(--rz-primary)] px-2 py-0.5 text-xs text-white">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-xs text-[var(--rz-text-muted)]">
                        {c.lastMessagePreview || 'Sem mensagens'}
                      </div>
                      {(queueStatusLabel(c.queueStatus) || c.departmentName) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {queueStatusLabel(c.queueStatus) && (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                              {queueStatusLabel(c.queueStatus)}
                            </span>
                          )}
                          {c.departmentName && (
                            <span className="rounded bg-[var(--rz-surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--rz-text-muted)]">
                              {c.departmentName}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
                {!sortedConversations.length && (
                  <li className="px-4 py-6 text-sm text-[var(--rz-text-muted)]">
                    {chatFilter === 'open' && 'Nenhuma conversa aberta.'}
                    {chatFilter === 'queue' && 'Nenhuma conversa na fila.'}
                    {chatFilter === 'closed' && 'Nenhuma conversa encerrada.'}
                  </li>
                )}
              </ul>
            )}
          </Card>

          <Card className="flex min-h-[60vh] flex-col overflow-hidden p-0">
            {!selectedId ? (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-[var(--rz-text-muted)]">
                Selecione uma conversa
              </div>
            ) : loadingDetail ? (
              <LoadingState label="Carregando conversa..." />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-[var(--rz-border)] px-4 py-3">
                  <div>
                    <div className="font-semibold text-[var(--rz-text)]">
                      {selected?.visitorName || selected?.visitorEmail || 'Visitante'}
                      {selected?.status === 'closed' && (
                        <span className="ml-2 text-xs font-normal text-[var(--rz-text-muted)]">(encerrada)</span>
                      )}
                    </div>
                    {selected?.pageUrl && (
                      <a
                        href={selected.pageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--rz-primary)] hover:underline"
                      >
                        Página de origem
                      </a>
                    )}
                    {(queueStatusLabel(selected?.queueStatus) || selected?.departmentName) && (
                      <div className="mt-1 flex flex-wrap gap-1 text-xs">
                        {queueStatusLabel(selected?.queueStatus) && (
                          <span className="rounded bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300">
                            {queueStatusLabel(selected?.queueStatus)}
                          </span>
                        )}
                        {selected?.departmentName && (
                          <span className="text-[var(--rz-text-muted)]">Setor: {selected.departmentName}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {showAssignPull && selected?.priorityForMe && selected.canAccept && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => assignChat.mutate()}
                        disabled={assignChat.isPending}
                        className="bg-yellow-600 hover:bg-yellow-500 text-[var(--rz-on-accent)]"
                      >
                        <UserCheck className="h-4 w-4" />
                        Aceitar
                      </Button>
                    )}
                    {showAssignPull && !selected?.priorityForMe && selected?.canPull && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => assignChat.mutate()}
                        disabled={assignChat.isPending}
                      >
                        <Hand className="h-4 w-4" />
                        Puxar
                      </Button>
                    )}
                    {showAssignPull &&
                      !selected?.priorityForMe &&
                      selected?.canAccept &&
                      !selected?.suggestedUserId && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => assignChat.mutate()}
                          disabled={assignChat.isPending}
                        >
                          <UserCheck className="h-4 w-4" />
                          Assumir
                        </Button>
                      )}
                    {canReply && selected?.status === 'open' && selected.queueStatus !== 'waiting_human' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {canInbox && departments.length > 0 && (
                          <select
                            className={inputCls + ' !w-auto text-xs'}
                            value={escalateDeptId}
                            onChange={e => setEscalateDeptId(e.target.value)}
                          >
                            <option value="">Setor padrão do widget</option>
                            {departments.map(d => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => escalateChat.mutate()}
                          disabled={escalateChat.isPending}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                          Encaminhar para fila
                        </Button>
                      </div>
                    )}
                    {canReply && selected?.status === 'open' && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => closeChat.mutate()}
                        disabled={closeChat.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                        Encerrar
                      </Button>
                    )}
                    {canReply && selected?.status === 'closed' && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => reopenChat.mutate()}
                        disabled={reopenChat.isPending}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reabrir
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-auto p-4">
                  {messages.map(m => (
                    <div
                      key={m.id}
                      className={
                        'flex ' + (m.direction === 'outbound' ? 'justify-end' : 'justify-start')
                      }
                    >
                      <div
                        className={
                          'max-w-[85%] rounded-2xl px-3 py-2 text-sm ' +
                          (m.direction === 'system'
                            ? 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)]'
                            : m.direction === 'outbound'
                              ? 'bg-[var(--rz-primary)] text-white'
                              : 'bg-[var(--rz-surface-muted)] text-[var(--rz-text)]')
                        }
                      >
                        {m.direction === 'outbound' && m.senderName && (
                          <div className="mb-1 text-[10px] font-medium opacity-80">{m.senderName}</div>
                        )}
                        {m.mediaType === 'image' && m.mediaUrl && (
                          <a
                            href={webChatMediaSrc(m.mediaUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="mb-1 block"
                          >
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
                        {m.mediaUrl &&
                          m.body &&
                          !m.body.startsWith('📎') && (
                            <div className="mt-1 whitespace-pre-wrap">{m.body}</div>
                          )}
                        <div className="mt-1 text-[10px] opacity-70">
                          {new Date(m.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {canAgentReply && selected?.status === 'open' && (
                  <form
                    className="flex gap-2 border-t border-[var(--rz-border)] p-3"
                    onSubmit={e => {
                      e.preventDefault()
                      if (!draft.trim()) return
                      sendMessage.mutate(draft.trim())
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) sendAttachment.mutate({ file, caption: draft.trim() || undefined })
                        e.target.value = ''
                      }}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={sendAttachment.isPending}
                      onClick={() => fileInputRef.current?.click()}
                      title="Enviar imagem"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <input
                      className={inputCls}
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      placeholder="Responder visitante… (texto vira legenda ao anexar)"
                    />
                    <Button type="submit" disabled={sendMessage.isPending || !draft.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </PlatformPage>
  )
}

function WidgetEditorCard({
  widget,
  departments,
  canPickDepartment,
  onDelete,
  deleting,
}: {
  widget: WebChatWidgetRow
  departments: InboxDepartmentOption[]
  canPickDepartment: boolean
  onDelete: () => void
  deleting: boolean
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState(widget)

  const { data: aiStatus } = useQuery({
    queryKey: ['webchat-ai-status'],
    queryFn: () => api.get<{ available: boolean; reason?: string }>('/webchat/ai-status'),
  })

  useEffect(() => {
    setForm(widget)
  }, [widget])

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/webchat/widgets/${widget.id}`, {
        name: form.name,
        active: form.active,
        allowedDomains: form.allowedDomains,
        appearance: form.appearance,
        autoReplyEnabled: form.autoReplyEnabled,
        autoReplyMessage: form.autoReplyMessage,
        autoReplySenderName: form.autoReplySenderName,
        autoReplyUseAi: form.autoReplyUseAi,
        defaultDepartmentId: form.defaultDepartmentId || null,
        useInboxBusinessHours: form.useInboxBusinessHours,
        businessHoursEnabled: form.businessHoursEnabled,
        timezone: form.timezone,
        schedule: form.schedule,
        outsideHoursMessage: form.outsideHoursMessage,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webchat-widgets'] })
      notifySuccess('Widget atualizado')
    },
    onError: mutationError,
  })

  const snippet = embedSnippet(widget.publicKey)
  const demoUrl = `/webchat/demo.html?key=${encodeURIComponent(widget.publicKey)}`

  const patchDay = (day: Weekday, field: 'enabled' | 'start' | 'end', value: boolean | string) => {
    setForm(f => ({
      ...f,
      schedule: {
        ...(f.schedule ?? DEFAULT_WEEKLY_SCHEDULE),
        [day]: {
          ...(f.schedule?.[day] ?? DEFAULT_WEEKLY_SCHEDULE[day]),
          [field]: value,
        },
      },
    }))
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-[var(--rz-text)]">{widget.name}</div>
          <div className="mt-1 text-xs text-[var(--rz-text-muted)]">Chave: {widget.publicKey}</div>
        </div>
        <div className="flex gap-2">
          <a href={demoUrl} target="_blank" rel="noreferrer">
            <Button type="button" variant="secondary" size="sm">
              <ExternalLink className="h-4 w-4" />
              Testar
            </Button>
          </a>
          <Button variant="danger" size="sm" type="button" onClick={onDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
          Nome interno
          <input
            className={inputCls + ' mt-1'}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </label>
        <label className="flex items-center gap-2 pt-5 text-sm text-[var(--rz-text)]">
          <input
            type="checkbox"
            checked={form.active}
            onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
          />
          Widget ativo
        </label>
        <label className="block text-xs font-medium text-[var(--rz-text-muted)] sm:col-span-2">
          Domínios permitidos (um por linha; vazio = qualquer)
          <textarea
            className={textareaCls + ' mt-1 font-mono text-xs'}
            rows={2}
            value={form.allowedDomains.join('\n')}
            onChange={e =>
              setForm(f => ({
                ...f,
                allowedDomains: e.target.value
                  .split(/[\n,]/)
                  .map(s => s.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="meusite.com.br&#10;*.loja.com"
          />
        </label>
        <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
          Título
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
          Saudação (mensagem de boas-vindas)
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
        <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
          Posição do botão
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
        <label className="flex items-center gap-2 text-sm text-[var(--rz-text)]">
          <input
            type="checkbox"
            checked={form.appearance.askName}
            onChange={e =>
              setForm(f => ({ ...f, appearance: { ...f.appearance, askName: e.target.checked } }))
            }
          />
          Pedir nome antes do chat
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--rz-text)]">
          <input
            type="checkbox"
            checked={form.appearance.askEmail}
            onChange={e =>
              setForm(f => ({ ...f, appearance: { ...f.appearance, askEmail: e.target.checked } }))
            }
          />
          Pedir e-mail antes do chat
        </label>
        {canPickDepartment && (
          <label className="block text-xs font-medium text-[var(--rz-text-muted)] sm:col-span-2">
            Setor padrão na escalação (opcional)
            <select
              className={inputCls + ' mt-1'}
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
            <span className="mt-1 block text-[10px] text-[var(--rz-text-muted)]">
              Usado ao encaminhar para humano (manual ou pela IA).
            </span>
          </label>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--rz-border)] p-3">
        <h4 className="text-sm font-semibold text-[var(--rz-text)]">Horário de atendimento</h4>
        <p className="mt-1 text-xs text-[var(--rz-text-muted)]">
          Fora do horário o visitante ainda pode enviar mensagens e recebe aviso automático.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm text-[var(--rz-text)]">
          <input
            type="checkbox"
            checked={form.useInboxBusinessHours}
            onChange={e => setForm(f => ({ ...f, useInboxBusinessHours: e.target.checked }))}
          />
          Usar horário do Inbox WhatsApp
        </label>
        {!form.useInboxBusinessHours && (
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-[var(--rz-text)]">
              <input
                type="checkbox"
                checked={form.businessHoursEnabled}
                onChange={e => setForm(f => ({ ...f, businessHoursEnabled: e.target.checked }))}
              />
              Ativar horário comercial neste widget
            </label>
            <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
              Fuso horário
              <input
                className={inputCls + ' mt-1'}
                value={form.timezone}
                onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                placeholder="America/Sao_Paulo"
              />
            </label>
            <label className="block text-xs font-medium text-[var(--rz-text-muted)]">
              Mensagem fora do horário
              <textarea
                className={textareaCls + ' mt-1'}
                rows={2}
                value={form.outsideHoursMessage}
                onChange={e => setForm(f => ({ ...f, outsideHoursMessage: e.target.value }))}
              />
            </label>
            <div className="space-y-1">
              {WEEKDAYS.map(day => (
                <div
                  key={day}
                  className="flex flex-wrap items-center gap-3 border-b border-[var(--rz-border)]/80 py-2 last:border-0"
                >
                  <label className="flex w-28 items-center gap-2 text-sm text-[var(--rz-text)]">
                    <input
                      type="checkbox"
                      checked={form.schedule?.[day]?.enabled ?? false}
                      onChange={e => patchDay(day, 'enabled', e.target.checked)}
                    />
                    {WEEKDAY_LABEL[day]}
                  </label>
                  <input
                    type="time"
                    className={cn(inputCls, 'w-auto px-2 py-1 text-xs')}
                    value={form.schedule?.[day]?.start ?? '09:00'}
                    disabled={!form.schedule?.[day]?.enabled}
                    onChange={e => patchDay(day, 'start', e.target.value)}
                  />
                  <span className="text-xs text-[var(--rz-text-muted)]">até</span>
                  <input
                    type="time"
                    className={cn(inputCls, 'w-auto px-2 py-1 text-xs')}
                    value={form.schedule?.[day]?.end ?? '18:00'}
                    disabled={!form.schedule?.[day]?.enabled}
                    onChange={e => patchDay(day, 'end', e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-[var(--rz-border)] p-3">
        <h4 className="text-sm font-semibold text-[var(--rz-text)]">Resposta automática</h4>
        <p className="mt-1 text-xs text-[var(--rz-text-muted)]">
          Enviada uma vez após a primeira mensagem do visitante, até um atendente responder.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm text-[var(--rz-text)]">
          <input
            type="checkbox"
            checked={form.autoReplyEnabled}
            onChange={e => setForm(f => ({ ...f, autoReplyEnabled: e.target.checked }))}
          />
          Ativar resposta automática
        </label>
        <label
          className={
            'mt-3 flex items-center gap-2 text-sm ' +
            (aiStatus?.available ? 'text-[var(--rz-text)]' : 'text-[var(--rz-text-muted)]')
          }
        >
          <input
            type="checkbox"
            checked={form.autoReplyUseAi}
            disabled={!aiStatus?.available || !form.autoReplyEnabled}
            onChange={e => setForm(f => ({ ...f, autoReplyUseAi: e.target.checked }))}
          />
          Usar IA da empresa (mesmas configs de Inbox → IA Atendimento)
        </label>
        {!aiStatus?.available && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            {aiStatus?.reason ?? 'IA indisponível — usa mensagem fixa abaixo.'}
          </p>
        )}
        {form.autoReplyUseAi && form.autoReplyEnabled && (
          <p className="mt-2 text-xs text-[var(--rz-text-muted)]">
            Se a IA falhar, envia a mensagem fixa como fallback.
          </p>
        )}
        <label className="mt-3 block text-xs font-medium text-[var(--rz-text-muted)]">
          Nome exibido (mensagem fixa / fallback)
          <input
            className={inputCls + ' mt-1'}
            value={form.autoReplySenderName}
            onChange={e => setForm(f => ({ ...f, autoReplySenderName: e.target.value }))}
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-[var(--rz-text-muted)]">
          Mensagem fixa (fallback)
          <textarea
            className={textareaCls + ' mt-1'}
            rows={2}
            value={form.autoReplyMessage}
            onChange={e => setForm(f => ({ ...f, autoReplyMessage: e.target.value }))}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="h-4 w-4" />
          Salvar alterações
        </Button>
      </div>

      <label className="mt-4 block text-xs font-medium text-[var(--rz-text-muted)]">
        Código para colar no site
      </label>
      <div className="mt-1 flex gap-2">
        <textarea className={textareaCls + ' font-mono text-xs'} readOnly rows={3} value={snippet} />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            navigator.clipboard.writeText(snippet)
            notifySuccess('Código copiado')
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}
