import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import {
  MessageSquare,
  UserCheck,
  ArrowRightLeft,
  CheckCircle2,
  Send,
  Settings2,
  Bot,
  Clock,
  Hand,
  Search,
  Inbox as InboxIcon,
  Users,
  BarChart3,
} from 'lucide-react'
import { useInboxSocket } from '../../hooks/useInboxSocket'
import { formatQueueTimer, liveQueueState, priorityBorderClass } from '../../lib/inboxQueueUi'
import { formatContactIdentifier } from '../../lib/destinationFormat'

interface Department {
  _id: string
  name: string
  menuKey: string
}

interface Conversation {
  _id: string
  contactName: string
  contactIdentifier: string
  status: string
  departmentName?: string
  departmentId?: string
  assignedUserId?: string
  assignedUserName?: string
  suggestedUserId?: string
  suggestedUserName?: string
  suggestedAt?: string
  priorityForMe?: boolean
  canAccept?: boolean
  canPull?: boolean
  suggestedUserBusy?: boolean
  pullTimeoutSeconds?: number
  queueElapsedSec?: number
  queueUrgency?: number
  lastMessageAt: string
}

interface InboxMessage {
  _id: string
  direction: 'inbound' | 'outbound' | 'system'
  body: string
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  bot_triage: 'Triagem',
  waiting_queue: 'Na fila',
  in_progress: 'Em atendimento',
  transferred: 'Transferido',
  resolved: 'Finalizado',
  closed: 'Encerrado',
}

const STATUS_VARIANT: Record<string, 'yellow' | 'blue' | 'green' | 'gray' | 'red'> = {
  bot_triage: 'yellow',
  waiting_queue: 'blue',
  in_progress: 'green',
  transferred: 'yellow',
  resolved: 'gray',
  closed: 'gray',
}

type QuickFilter = 'all' | 'queue' | 'mine' | 'active' | 'triage'

const QUICK_FILTERS: { id: QuickFilter; label: string; status?: string; mine?: boolean }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'queue', label: 'Fila', status: 'waiting_queue' },
  { id: 'mine', label: 'Minhas', mine: true },
  { id: 'active', label: 'Atendendo', status: 'in_progress' },
  { id: 'triage', label: 'Triagem', status: 'bot_triage' },
]

function conversationBadge(c: Conversation): { label: string; variant: 'yellow' | 'blue' | 'green' | 'gray' | 'red' } {
  if (c.status === 'waiting_queue' && c.suggestedUserId) {
    if (c.priorityForMe) return { label: 'Sua prioridade', variant: 'yellow' }
    return { label: 'Aguardando aceite', variant: 'yellow' }
  }
  return {
    label: STATUS_LABEL[c.status] ?? c.status,
    variant: STATUS_VARIANT[c.status] ?? 'gray',
  }
}

function ContactAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initial = (name || '?').charAt(0).toUpperCase()
  const cls =
    size === 'lg'
      ? 'w-11 h-11 text-base'
      : size === 'sm'
        ? 'w-8 h-8 text-xs'
        : 'w-10 h-10 text-sm'
  return (
    <div
      className={`${cls} rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border border-gray-600/50 flex items-center justify-center font-semibold text-gray-200 shrink-0`}
    >
      {initial}
    </div>
  )
}

function formatMsgTime(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  if (sameDay) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Inbox() {
  const qc = useQueryClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })
  const canManageSectors = can(me ?? null, 'inbox:department:manage')
  const canSupervise = can(me ?? null, 'inbox:supervise')
  useInboxSocket(Boolean(me))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [reply, setReply] = useState('')
  const [transferDept, setTransferDept] = useState('')
  const [tick, setTick] = useState(0)

  const activeQuickFilter: QuickFilter = useMemo(() => {
    if (mineOnly) return 'mine'
    if (filterStatus === 'waiting_queue') return 'queue'
    if (filterStatus === 'in_progress') return 'active'
    if (filterStatus === 'bot_triage') return 'triage'
    return 'all'
  }, [filterStatus, mineOnly])

  const applyQuickFilter = (id: QuickFilter) => {
    const f = QUICK_FILTERS.find(x => x.id === id)
    setFilterStatus(f?.status ?? '')
    setMineOnly(Boolean(f?.mine))
  }

  const { data: departments = [] } = useQuery({
    queryKey: ['inbox-departments'],
    queryFn: () => api.get<Department[]>('/inbox/departments'),
  })

  const listParams = new URLSearchParams()
  if (filterStatus) listParams.set('status', filterStatus)
  if (filterDept) listParams.set('departmentId', filterDept)
  if (mineOnly) listParams.set('mine', '1')

  const { data: conversations = [], isLoading: loadingList } = useQuery({
    queryKey: ['inbox-conversations', filterStatus, filterDept, mineOnly],
    queryFn: () => api.get<Conversation[]>(`/inbox/conversations?${listParams}`),
    refetchInterval: 30_000,
  })

  const stats = useMemo(() => {
    const all = conversations
    return {
      queue: all.filter(c => c.status === 'waiting_queue').length,
      active: all.filter(c => c.status === 'in_progress').length,
      triage: all.filter(c => c.status === 'bot_triage').length,
      priority: all.filter(c => c.priorityForMe).length,
    }
  }, [conversations])

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c => {
      const phone = formatContactIdentifier(c.contactIdentifier, c.contactName).toLowerCase()
      return (
        c.contactName.toLowerCase().includes(q) ||
        phone.includes(q) ||
        (c.departmentName?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [conversations, search])

  const hasPriorityQueue = conversations.some(
    c => c.status === 'waiting_queue' && c.suggestedUserId,
  )

  useEffect(() => {
    if (!hasPriorityQueue) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [hasPriorityQueue])

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['inbox-conversation', selectedId],
    queryFn: () =>
      api.get<{ conversation: Conversation; messages: InboxMessage[] }>(
        `/inbox/conversations/${selectedId}`,
      ),
    enabled: Boolean(selectedId),
    refetchInterval: hasPriorityQueue ? 10_000 : 30_000,
  })

  const messages = detail?.messages ?? []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedId])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
    if (selectedId) qc.invalidateQueries({ queryKey: ['inbox-conversation', selectedId] })
  }

  const assign = useMutation({
    mutationFn: (id: string) => api.post(`/inbox/conversations/${id}/assign`, {}),
    onSuccess: invalidate,
  })

  const sendReply = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api.post(`/inbox/conversations/${id}/reply`, { text }),
    onSuccess: () => {
      setReply('')
      invalidate()
    },
  })

  const transfer = useMutation({
    mutationFn: ({ id, departmentId }: { id: string; departmentId: string }) =>
      api.post(`/inbox/conversations/${id}/transfer`, { departmentId }),
    onSuccess: invalidate,
  })

  const resolve = useMutation({
    mutationFn: (id: string) => api.post(`/inbox/conversations/${id}/resolve`, {}),
    onSuccess: invalidate,
  })

  const conv = detail?.conversation
  const isTerminal = conv?.status === 'resolved' || conv?.status === 'closed'

  const convLive = conv?.suggestedAt
    ? liveQueueState(conv.suggestedAt, conv.pullTimeoutSeconds ?? 120, tick)
    : { elapsedSec: 0, urgency: 0 }

  const convLiveCanPull =
    Boolean(conv?.suggestedUserId) &&
    !conv?.priorityForMe &&
    conv?.status === 'waiting_queue' &&
    (Boolean(conv?.suggestedUserBusy) || convLive.urgency >= 1)

  const selectCls =
    'bg-gray-900/80 border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-brand-500/50'

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] max-w-6xl -mx-1">
      {/* Cabeçalho */}
      <div className="shrink-0 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <InboxIcon size={22} className="text-brand-400" />
              Inbox
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-xl">
              Atenda conversas do WhatsApp. Prioridades do round-robin aparecem destacadas — aceite ou puxe quando puder.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {canSupervise && (
              <Link to="/platform/inbox/supervisor">
                <Button size="sm" variant="secondary">
                  <Users size={14} /> Supervisor
                </Button>
              </Link>
            )}
            {can(me ?? null, 'inbox:reports:view') && (
              <Link to="/platform/inbox/relatorios">
                <Button size="sm" variant="secondary">
                  <BarChart3 size={14} /> Relatórios
                </Button>
              </Link>
            )}
            {canManageSectors && (
              <>
                <Link to="/platform/inbox/bot">
                  <Button size="sm" variant="secondary">
                    <Bot size={14} /> Bot
                  </Button>
                </Link>
                <Link to="/platform/inbox/setores">
                  <Button size="sm" variant="secondary">
                    <Settings2 size={14} /> Setores
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {[
            { label: 'Na fila', value: stats.queue, color: 'text-blue-400' },
            { label: 'Em atendimento', value: stats.active, color: 'text-green-400' },
            { label: 'Triagem', value: stats.triage, color: 'text-yellow-400' },
            { label: 'Suas prioridades', value: stats.priority, color: 'text-amber-400' },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-xl border border-gray-800/80 bg-gray-900/40 px-3 py-2.5"
            >
              <p className="text-[10px] uppercase tracking-wider text-gray-600">{s.label}</p>
              <p className={`text-lg font-semibold tabular-nums mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Painel principal */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-0 rounded-xl border border-gray-800 bg-gray-900/30 overflow-hidden shadow-xl shadow-black/20">
        {/* Lista de conversas */}
        <aside className="w-full lg:w-[340px] xl:w-[380px] shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-800/80 bg-gray-950/40">
          <div className="p-3 space-y-2.5 border-b border-gray-800/80 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar contato ou setor…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-900/80 border border-gray-800 rounded-lg text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-brand-500/40"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
              {QUICK_FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => applyQuickFilter(f.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    activeQuickFilter === f.id
                      ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                      : 'text-gray-500 hover:text-gray-300 border border-transparent hover:bg-gray-800/60'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <select
              value={filterDept}
              onChange={e => setFilterDept(e.currentTarget.value)}
              className={`${selectCls} w-full`}
            >
              <option value="">Todos os setores</option>
              {departments.map(d => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="px-3 py-2 text-[11px] text-gray-600 border-b border-gray-800/60 shrink-0">
            {filteredConversations.length} conversa(s)
            {search && filteredConversations.length !== conversations.length && (
              <span className="text-gray-500"> · filtrado de {conversations.length}</span>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto lg:max-h-none max-h-[280px]">
            {loadingList ? (
              <div className="flex justify-center py-12">
                <Spinner size={24} />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <MessageSquare size={32} className="text-gray-700 mb-2" />
                <p className="text-sm text-gray-500">Nenhuma conversa aqui.</p>
                <p className="text-xs text-gray-600 mt-1">Ajuste os filtros ou aguarde novos contatos.</p>
              </div>
            ) : (
              filteredConversations.map(c => {
                const live = c.suggestedAt
                  ? liveQueueState(c.suggestedAt, c.pullTimeoutSeconds ?? 120, tick)
                  : { elapsedSec: c.queueElapsedSec ?? 0, urgency: c.queueUrgency ?? 0 }
                const badge = conversationBadge(c)
                const liveCanPull =
                  Boolean(c.suggestedUserId) &&
                  !c.priorityForMe &&
                  c.status === 'waiting_queue' &&
                  (Boolean(c.suggestedUserBusy) || live.urgency >= 1)
                const borderCls = priorityBorderClass(
                  live.urgency,
                  Boolean(c.priorityForMe),
                  liveCanPull,
                )
                const subtitle =
                  c.suggestedUserName && c.status === 'waiting_queue'
                    ? c.priorityForMe
                      ? `Prioridade · ${c.departmentName ?? ''}`
                      : `${c.suggestedUserName}${c.suggestedUserBusy ? ' · ocupado' : ''}`
                    : [c.departmentName, c.assignedUserName].filter(Boolean).join(' · ')

                const selected = selectedId === c._id

                return (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => setSelectedId(c._id)}
                    className={`w-full text-left px-3 py-3 flex gap-3 border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${borderCls} ${
                      selected ? 'bg-brand-500/[0.08] border-l-2 border-l-brand-500' : 'border-l-2 border-l-transparent'
                    }`}
                  >
                    <ContactAvatar name={c.contactName} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-gray-100 truncate">{c.contactName}</span>
                        <Badge label={badge.label} variant={badge.variant} />
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {formatContactIdentifier(c.contactIdentifier, c.contactName)}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-[11px] text-gray-600 truncate">{subtitle || '—'}</p>
                        {c.suggestedUserId && c.status === 'waiting_queue' ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-yellow-500/90 shrink-0 font-mono tabular-nums">
                            <Clock size={10} />
                            {formatQueueTimer(live.elapsedSec)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-600 shrink-0 tabular-nums">
                            {formatMsgTime(c.lastMessageAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Área do chat */}
        <section className="flex-1 min-w-0 flex flex-col bg-gray-950/20 min-h-[360px] lg:min-h-0">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-500 p-8">
              <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mb-4">
                <MessageSquare size={32} className="opacity-40" />
              </div>
              <p className="text-base font-medium text-gray-400">Selecione uma conversa</p>
              <p className="text-sm text-gray-600 mt-1 text-center max-w-xs">
                Escolha um contato na lista para ver o histórico e responder.
              </p>
            </div>
          ) : loadingDetail ? (
            <div className="flex justify-center items-center flex-1">
              <Spinner size={28} />
            </div>
          ) : conv ? (
            <>
              {/* Header do chat */}
              <header className="shrink-0 px-4 py-3 border-b border-gray-800/80 bg-gray-900/50 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ContactAvatar name={conv.contactName} size="lg" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-100 truncate">{conv.contactName}</p>
                        <Badge
                          label={conversationBadge(conv).label}
                          variant={conversationBadge(conv).variant}
                        />
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {formatContactIdentifier(conv.contactIdentifier, conv.contactName)}
                      </p>
                      {(conv.departmentName || conv.assignedUserName) && (
                        <p className="text-[11px] text-gray-600 mt-0.5">
                          {[conv.departmentName, conv.assignedUserName && `Atendente: ${conv.assignedUserName}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!isTerminal && conv.canAccept && conv.priorityForMe && (
                      <Button
                        size="sm"
                        onClick={() => assign.mutate(conv._id)}
                        disabled={assign.isPending}
                        className="bg-yellow-600 hover:bg-yellow-500 text-gray-950"
                      >
                        <UserCheck size={14} /> Aceitar
                      </Button>
                    )}
                    {!isTerminal && convLiveCanPull && !conv.priorityForMe && conv.status === 'waiting_queue' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => assign.mutate(conv._id)}
                        disabled={assign.isPending}
                      >
                        <Hand size={14} /> Puxar
                      </Button>
                    )}
                    {!isTerminal &&
                      conv.status !== 'in_progress' &&
                      conv.canAccept &&
                      !conv.priorityForMe &&
                      !conv.suggestedUserId && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => assign.mutate(conv._id)}
                          disabled={assign.isPending}
                        >
                          <UserCheck size={14} /> Assumir
                        </Button>
                      )}
                    {!isTerminal && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => resolve.mutate(conv._id)}
                        disabled={resolve.isPending}
                      >
                        <CheckCircle2 size={14} /> Finalizar
                      </Button>
                    )}
                  </div>
                </div>

                {conv.suggestedUserId && conv.status === 'waiting_queue' && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-yellow-500/90 bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-3 py-2">
                    <Clock size={14} className="shrink-0" />
                    {conv.priorityForMe ? (
                      <span>
                        Prioridade para você · <span className="font-mono">{formatQueueTimer(convLive.elapsedSec)}</span>
                      </span>
                    ) : (
                      <span>
                        Aguardando <strong className="font-medium">{conv.suggestedUserName}</strong>
                        {' · '}
                        <span className="font-mono">{formatQueueTimer(convLive.elapsedSec)}</span>
                        {conv.suggestedUserBusy && !conv.priorityForMe && (
                          <span className="text-orange-400"> · ocupado — pode puxar</span>
                        )}
                        {convLiveCanPull && !conv.priorityForMe && !conv.suggestedUserBusy && (
                          <span className="text-orange-400"> · pode puxar</span>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </header>

              {/* Mensagens */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900/40 via-transparent to-transparent">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-600 py-8">Nenhuma mensagem ainda.</p>
                ) : (
                  messages.map(m => (
                    <div
                      key={m._id}
                      className={`flex ${m.direction === 'outbound' ? 'justify-end' : m.direction === 'system' ? 'justify-center' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[min(85%,420px)] ${
                          m.direction === 'system'
                            ? 'w-full max-w-full'
                            : ''
                        }`}
                      >
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm ${
                            m.direction === 'outbound'
                              ? 'bg-brand-600/90 text-white rounded-br-md'
                              : m.direction === 'system'
                                ? 'bg-gray-800/40 text-gray-500 text-xs text-center border border-gray-800/60 rounded-xl py-2'
                                : 'bg-gray-800/90 text-gray-100 rounded-bl-md border border-gray-700/50'
                          }`}
                        >
                          {m.body}
                        </div>
                        {m.direction !== 'system' && (
                          <p
                            className={`text-[10px] text-gray-600 mt-1 px-1 ${
                              m.direction === 'outbound' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {formatMsgTime(m.createdAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer / estados */}
              {!isTerminal && conv.status === 'in_progress' && conv.assignedUserId === me?.userId && (
                <footer className="shrink-0 border-t border-gray-800/80 bg-gray-900/60 backdrop-blur-sm p-3 space-y-2">
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.currentTarget.value)}
                      placeholder="Digite sua resposta… (Enter envia, Shift+Enter quebra linha)"
                      rows={2}
                      className="flex-1 bg-gray-900 border border-gray-700/80 rounded-xl px-3 py-2.5 text-sm text-gray-200 resize-none focus:outline-none focus:border-brand-500/50 min-h-[44px] max-h-32"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && reply.trim()) {
                          e.preventDefault()
                          sendReply.mutate({ id: conv._id, text: reply })
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-10 w-10 p-0 shrink-0 rounded-xl"
                      onClick={() => sendReply.mutate({ id: conv._id, text: reply })}
                      disabled={!reply.trim() || sendReply.isPending}
                      aria-label="Enviar"
                    >
                      <Send size={16} />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={transferDept}
                      onChange={e => setTransferDept(e.currentTarget.value)}
                      className={selectCls}
                    >
                      <option value="">Transferir para…</option>
                      {departments.filter(d => d._id !== conv.departmentId).map(d => (
                        <option key={d._id} value={d._id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!transferDept || transfer.isPending}
                      onClick={() => {
                        transfer.mutate({ id: conv._id, departmentId: transferDept })
                        setTransferDept('')
                      }}
                    >
                      <ArrowRightLeft size={14} /> Transferir
                    </Button>
                  </div>
                </footer>
              )}

              {!isTerminal && conv.status === 'waiting_queue' && (
                <footer className="shrink-0 border-t border-gray-800/80 bg-gray-900/40 px-4 py-3 text-xs text-gray-500">
                  {conv.priorityForMe
                    ? 'Aceite a prioridade para começar a responder.'
                    : convLiveCanPull
                      ? 'Você pode puxar este atendimento — o indicado está ocupado ou o tempo de prioridade passou.'
                      : 'Aguardando o atendente indicado aceitar a conversa.'}
                </footer>
              )}

              {isTerminal && (
                <footer className="shrink-0 border-t border-gray-800/80 bg-gray-900/40 px-4 py-3 text-xs text-gray-500 text-center">
                  Conversa finalizada.
                </footer>
              )}
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
