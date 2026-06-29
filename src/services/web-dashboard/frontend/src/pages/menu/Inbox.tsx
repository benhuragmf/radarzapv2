import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { LoadingState, selectCls, inputCls, searchFieldIconCls, platformPageMaxWidthClass } from '@/design-system'
import { cn } from '@/lib/utils'
import {
  MessageSquare,
  UserCheck,
  ArrowRightLeft,
  CheckCircle2,
  Settings2,
  Bot,
  Clock,
  Hand,
  Search,
  Users,
  BarChart3,
  Ticket,
  History,
  UserPen,
  Zap,
  ArrowLeft,
  Globe,
  Clock3,
  Star,
  Smartphone,
  PanelRight,
} from 'lucide-react'
import { useInboxSocket } from '../../hooks/useInboxSocket'
import { formatQueueTimer, liveQueueState, liveQueueWaitState, liveHandleTimeSec, liveFallbackCountdown, liveTriageWaitState, liveInactivityCloseAllowed, liveGracefulCloseAllowed, priorityBorderClass, queueUrgencyPanelClass, queueUrgencyTimerClass } from '../../lib/inboxQueueUi'
import { formatContactIdentifier } from '../../lib/destinationFormat'
import { InboxMessageBubble, formatInboxMsgTime, type InboxMessageView } from '../../components/inbox/InboxMessageBubble'
import { InboxComposer, type QuickReplyItem } from '../../components/inbox/InboxComposer'
import { InboxContactDetailsPanel } from '../../components/inbox/InboxContactDetailsPanel'
import type { ContactStats, PreviousConversation } from '../../components/inbox/InboxContactSidebar'
import ContactEditorModal, { type ContactFormData } from '../../components/contacts/ContactEditorModal'
import { ContactClassificationBadges } from '../../components/contacts/ContactClassificationBadges'
import type { ContactClassificationView } from '../../lib/contactClassificationUi'
import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'
import { InboxStatsRow } from '../../components/inbox/InboxStatsRow'
import { InboxChannelBadge } from '../../components/inbox/InboxChannelBadge'
import { InboxDepartmentBadge } from '../../components/inbox/InboxDepartmentBadge'
import { InboxEmptyChat } from '../../components/inbox/InboxEmptyChat'
import { InboxLiveVisitors } from '../../components/inbox/InboxLiveVisitors'
import {
  InboxContactClassFilter,
  parseInboxClassFilter,
} from '../../components/inbox/InboxContactClassFilter'
import type { ContactClassificationFilterKey } from '../../components/contacts/ContactClassificationFilterBar'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'
import { isWebChatInboxId, webChatInboxIdToMongo, webChatMediaSrc } from '../../lib/webchatInbox'
import { readWebChatAttachmentFile } from '../../lib/webchatAttachment'
import { useWebChatSocket } from '../../hooks/useWebChatSocket'
import { getSocket } from '../../lib/socket'
import { useAgentPresenceContext } from '../../lib/agentPresenceContext'

interface Department {
  _id: string
  name: string
  menuKey: string
  clientVisible?: boolean
  internalRank?: number
  internalRankLabel?: string
  canTransferTo?: boolean
  canViewQueue?: boolean
}

interface Conversation {
  _id: string
  channel?: 'whatsapp_qr' | 'whatsapp_cloud' | 'webchat_site'
  contactName: string
  contactIdentifier: string
  destinationId?: string
  ticketRef?: string
  status: string
  departmentName?: string
  departmentId?: string
  assignedUserId?: string
  assignedUserName?: string
  suggestedUserId?: string
  suggestedUserName?: string
  suggestedUserOnline?: boolean
  suggestedAt?: string
  priorityForMe?: boolean
  canAccept?: boolean
  canPull?: boolean
  suggestedUserBusy?: boolean
  pullTimeoutSeconds?: number
  queueElapsedSec?: number
  queueUrgency?: number
  queueEnteredAt?: string
  handleTimeSec?: number
  triageWaitSince?: string
  triageElapsedSec?: number
  triageUrgency?: number
  triageInactivityTotalMin?: number
  encQuickReplyAllowed?: boolean
  encOkQuickReplyAllowed?: boolean
  inactivityWarnedAt?: string
  gracefulClosePromptAt?: string
  gracefulCloseAckAt?: string
  closeGateSource?: 'inactivity' | 'graceful'
  lastOutboundAt?: string
  lastMessageAt: string
  lastMessagePreview?: string
  unreadCount?: number
  widgetName?: string
  pageUrl?: string
  visitorPhone?: string
  contactReason?: string
  visitorIntake?: Record<string, string>
  createdAt?: string
  resolvedAt?: string
  acceptedAt?: string
  whatsappBridgeActive?: boolean
  whatsappFallbackEnabled?: boolean
  whatsappFallbackWaAlertSent?: boolean
  whatsappFallbackAcceptTimeoutSec?: number
  whatsappFallbackNoAgentTimeoutSec?: number
  whatsappFallbackPriorityStartedAt?: string
  whatsappFallbackWaNotifiedAt?: string
  isLeadEntry?: boolean
  departmentMenuKey?: string
  departmentBadgeLabel?: string
  departmentClientVisible?: boolean
  departmentInternalRankLabel?: string
  contactClassification?: ContactClassificationView
}

interface InboxContactInfo {
  _id: string
  name: string
  email: string
  notes: string
  organization: string
  identifier: string
  contactGroupIds: string[]
  tags?: string[]
  lastMessageSent?: string
  classification?: ContactClassificationView
}

interface ConversationDetail {
  conversation: Conversation
  messages: InboxMessageView[]
  contactStats?: ContactStats
  previousConversations?: PreviousConversation[]
  contact?: InboxContactInfo | null
  quickReplies?: QuickReplyItem[]
  inactivitySla?: {
    inactivityAutoCloseEnabled?: boolean
    inactivityCloseMinutes?: number
    inactivityWarningMinutes?: number
    inactivityWarningQuickCode?: string
    inactivityCloseQuickCode?: string
    gracefulCloseQuickCode?: string
    gracefulCloseAfterPromptMinutes?: number
    gracefulCloseDetectPhrases?: boolean
    inactivityCloseGracefulQuickCode?: string
    inactivityCloseGateWaitMinutes?: number
    closeQuickReplyGateEnabled?: boolean
    gracefulCloseQuickReplyGateEnabled?: boolean
  }
}

/** Perfil editável no Inbox — contato CRM ou dados do visitante WebChat. */
function resolveInboxProfileContact(
  conv: Conversation | undefined,
  contact: InboxContactInfo | null | undefined,
  isWebChat: boolean,
): InboxContactInfo | null {
  if (contact?._id) return contact
  if (!isWebChat || !conv) return contact ?? null
  const phone = conv.visitorPhone?.trim() || conv.visitorIntake?.phone?.trim() || ''
  const email = contact?.email?.trim() || conv.visitorIntake?.email?.trim() || ''
  const name =
    conv.contactName?.trim() ||
    conv.visitorIntake?.name?.trim() ||
    contact?.name?.trim() ||
    email ||
    phone ||
    ''
  if (!name && !phone && !email) return null
  return {
    _id: '',
    name: name || 'Visitante',
    email,
    notes: contact?.notes ?? '',
    organization: contact?.organization ?? '',
    identifier: phone || contact?.identifier || email,
    contactGroupIds: contact?.contactGroupIds ?? [],
  }
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

const AGENT_TYPING_STOP_MS = 4500
const VISITOR_TYPING_IDLE_MS = 8000

type QuickFilter = 'all' | 'queue' | 'mine' | 'active' | 'triage' | 'tickets' | 'closed'
type ChannelFilter = 'whatsapp' | 'webchat' | 'all'

const CHANNEL_FILTERS: { id: ChannelFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'webchat', label: 'Site' },
]

const QUICK_FILTERS: {
  id: QuickFilter
  label: string
  status?: string
  mine?: boolean
  hasTicket?: boolean
}[] = [
  { id: 'all', label: 'Todos' },
  { id: 'queue', label: 'Fila', status: 'waiting_queue' },
  { id: 'mine', label: 'Minhas', mine: true },
  { id: 'active', label: 'Atendendo', status: 'in_progress' },
  { id: 'triage', label: 'Triagem', status: 'bot_triage' },
  { id: 'tickets', label: 'Tickets', hasTicket: true },
  { id: 'closed', label: 'Encerrados', status: 'closed' },
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

function canReplyToConversation(conv: Conversation, me: AuthUser | null | undefined): boolean {
  if (!me?.userId || conv.status === 'closed' || conv.status === 'resolved') return false
  if (conv.channel === 'webchat_site') {
    if (conv.status === 'waiting_queue' || conv.status === 'bot_triage') return false
    return conv.status === 'in_progress' && conv.assignedUserId === me.userId
  }
  return conv.status === 'in_progress' && conv.assignedUserId === me?.userId
}

function canSendInternalChat(conv: Conversation, me: AuthUser | null | undefined): boolean {
  if (!me?.userId || conv.status === 'closed' || conv.status === 'resolved') return false
  if (!can(me, 'inbox:reply') && !can(me, 'inbox:supervise')) return false
  if (can(me, 'inbox:supervise')) return true
  return conv.status === 'in_progress' && conv.assignedUserId === me.userId
}

function internalChatBlockedReason(
  conv: Conversation,
  me: AuthUser | null | undefined,
): string | null {
  if (canSendInternalChat(conv, me)) return null
  if (conv.status === 'closed' || conv.status === 'resolved') return 'Conversa encerrada.'
  if (!can(me ?? null, 'inbox:reply') && !can(me ?? null, 'inbox:supervise')) {
    return 'Sem permissão para o chat interno.'
  }
  if (conv.status === 'in_progress' && conv.assignedUserId && conv.assignedUserId !== me?.userId) {
    return `Chat interno disponível para ${conv.assignedUserName ?? 'o atendente'} ou supervisores.`
  }
  return 'Assuma a conversa para usar o chat interno.'
}

function inboxReplyBlockedReason(
  conv: Conversation,
  me: AuthUser | null | undefined,
  convLiveCanPull: boolean,
): string | null {
  if (conv.channel === 'webchat_site') {
    if (canReplyToConversation(conv, me)) return null
    if (conv.status === 'closed' || conv.status === 'resolved') return 'Conversa encerrada.'
    if (conv.status === 'waiting_queue') {
      if (conv.priorityForMe) return 'Clique em Aceitar acima para liberar o envio.'
      if (convLiveCanPull) return 'Você pode puxar esta conversa — clique em Puxar acima.'
      if (!conv.suggestedUserId) return 'Fila aberta — clique em Assumir para atender.'
      return 'Aguardando o atendente indicado aceitar a conversa.'
    }
    if (conv.status === 'bot_triage') return 'Clique em Assumir acima para interromper a triagem automática.'
    if (conv.status === 'in_progress' && conv.assignedUserId && conv.assignedUserId !== me?.userId) {
      return `Em atendimento por ${conv.assignedUserName ?? 'outro agente'}.`
    }
    return 'Assuma a conversa para enviar mensagens.'
  }
  if (canReplyToConversation(conv, me)) return null
  if (conv.status === 'in_progress') {
    if (!me?.userId) return 'Sessão indisponível — recarregue a página.'
    if (conv.assignedUserId && conv.assignedUserId !== me.userId) {
      return `Em atendimento por ${conv.assignedUserName ?? 'outro agente'}.`
    }
    return 'Assuma a conversa para enviar mensagens.'
  }
  if (conv.status === 'waiting_queue') {
    if (conv.priorityForMe) return 'Clique em Aceitar acima para liberar o envio.'
    if (convLiveCanPull) return 'Você pode puxar esta conversa — clique em Puxar acima.'
    if (!conv.suggestedUserId) return 'Fila aberta — clique em Assumir para atender.'
    return 'Aguardando o atendente indicado aceitar a conversa.'
  }
  if (conv.status === 'bot_triage') return 'Conversa em triagem automática — aguarde encaminhamento.'
  return 'Assuma a conversa para enviar mensagens.'
}

function WebChatTypingLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1 text-xs text-[var(--rz-text-muted)]">
      <span className="inline-flex gap-0.5 items-end h-3" aria-hidden>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1 h-1 rounded-full bg-[var(--rz-text-muted)] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      <span>{label}</span>
    </div>
  )
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
      className={`${cls} rounded-full bg-gradient-to-br from-[var(--rz-surface-muted)] to-[var(--rz-surface)] border border-[var(--rz-border)]/50 flex items-center justify-center font-semibold text-[var(--rz-text-primary)] shrink-0`}
    >
      {initial}
    </div>
  )
}

export default function Inbox() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })
  const canManageSectors = can(me ?? null, 'inbox:department:manage')
  const canSupervise = can(me ?? null, 'inbox:supervise')
  const canInboxView = can(me ?? null, 'inbox:view')
  const canWaSessions = can(me ?? null, 'whatsapp:session:view')
  const canWebChatEngage = can(me ?? null, 'webchat:reply')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  useInboxSocket(Boolean(me))
  useWebChatSocket(canInboxView, { syncInbox: true })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const agentPresence = useAgentPresenceContext()
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [hasTicketOnly, setHasTicketOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [reply, setReply] = useState('')
  const [transferDept, setTransferDept] = useState('')
  const [tick, setTick] = useState(0)
  const [historyConvId, setHistoryConvId] = useState<string | null>(null)
  const [showContactEditor, setShowContactEditor] = useState(false)
  const [showDetailsPanel, setShowDetailsPanel] = useState(true)
  const [composeMode, setComposeMode] = useState<'reply' | 'internal'>('reply')
  const [visitorTyping, setVisitorTyping] = useState(false)
  const visitorTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const agentTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const agentTypingActiveRef = useRef(false)

  const classFilter = useMemo(
    () => parseInboxClassFilter(searchParams.get('class')),
    [searchParams],
  )

  const setClassFilter = (key: ContactClassificationFilterKey | null) => {
    const next = new URLSearchParams(searchParams)
    if (key) next.set('class', key)
    else next.delete('class')
    setSearchParams(next, { replace: true })
  }

  const activeQuickFilter: QuickFilter = useMemo(() => {
    if (hasTicketOnly) return 'tickets'
    if (mineOnly) return 'mine'
    if (filterStatus === 'waiting_queue') return 'queue'
    if (filterStatus === 'in_progress') return 'active'
    if (filterStatus === 'bot_triage') return 'triage'
    if (filterStatus === 'closed') return 'closed'
    return 'all'
  }, [filterStatus, mineOnly, hasTicketOnly])

  const applyQuickFilter = (id: QuickFilter) => {
    const f = QUICK_FILTERS.find(x => x.id === id)
    setFilterStatus(f?.status ?? '')
    setMineOnly(Boolean(f?.mine))
    setHasTicketOnly(Boolean(f?.hasTicket))
  }

  useEffect(() => {
    const convParam = searchParams.get('conv')
    const statusParam = searchParams.get('status')
    const channelParam = searchParams.get('channel')
    const searchParam = searchParams.get('search') ?? searchParams.get('q')
    if (convParam) setSelectedId(convParam)
    if (searchParam) setSearch(searchParam)
    if (statusParam === 'waiting_queue') {
      setFilterStatus('waiting_queue')
      setMineOnly(false)
      setHasTicketOnly(false)
    } else if (statusParam) {
      setFilterStatus(statusParam)
    }
    if (channelParam === 'webchat' || channelParam === 'whatsapp' || channelParam === 'all') {
      setChannelFilter(channelParam)
    }
  }, [searchParams])

  useEffect(() => {
    agentPresence.setViewingConversationId(selectedId)
    return () => agentPresence.setViewingConversationId(null)
  }, [selectedId, agentPresence])

  const { data: departments = [] } = useQuery({
    queryKey: ['inbox-departments'],
    queryFn: () => api.get<Department[]>('/inbox/departments'),
  })

  const { data: quickReplies = [] } = useQuery({
    queryKey: ['inbox-quick-replies'],
    queryFn: () => api.get<QuickReplyItem[]>('/inbox/quick-replies'),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const listParams = new URLSearchParams()
  if (filterStatus) listParams.set('status', filterStatus)
  if (filterDept) listParams.set('departmentId', filterDept)
  if (mineOnly) listParams.set('mine', '1')
  if (hasTicketOnly) listParams.set('hasTicket', '1')
  if (canInboxView) listParams.set('channel', channelFilter)
  if (classFilter) listParams.set('class', classFilter)

  const { data: conversations = [], isLoading: loadingList } = useQuery({
    queryKey: ['inbox-conversations', filterStatus, filterDept, mineOnly, hasTicketOnly, channelFilter, classFilter],
    queryFn: () => api.get<Conversation[]>(`/inbox/conversations?${listParams}`),
    refetchInterval: 30_000,
  })

  const { data: waStatus } = useQuery({
    queryKey: ['inbox-whatsapp-status'],
    queryFn: () =>
      api.get<{ connected: boolean; status: string }>('/inbox/whatsapp-status'),
    enabled: canInboxView,
    refetchInterval: 30_000,
  })
  const waConnected = waStatus?.connected === true

  const { data: webchatBridge } = useQuery({
    queryKey: ['webchat-stats'],
    queryFn: () =>
      api.get<{
        waitingQueueCount: number
        myWaitingQueueCount?: number
        unreadCount: number
      }>('/webchat/stats'),
    enabled: canInboxView,
    refetchInterval: 30_000,
  })

  const webchatQueueCount = webchatBridge?.waitingQueueCount ?? 0

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
        (c.departmentName?.toLowerCase().includes(q) ?? false) ||
        (c.ticketRef?.toLowerCase().includes(q) ?? false) ||
        (c.lastMessagePreview?.toLowerCase().includes(q) ?? false) ||
        (c.widgetName?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [conversations, search])

  const hasPriorityQueue = conversations.some(
    c => c.status === 'waiting_queue' && c.suggestedAt,
  )
  const hasQueueWait = conversations.some(
    c => c.status === 'waiting_queue' && (c.queueEnteredAt || c.suggestedAt),
  )
  const hasTriageWait = conversations.some(
    c => c.status === 'bot_triage' && !c.assignedUserId,
  )

  const { data: detail, isLoading: loadingDetail, isError: detailError, refetch: refetchDetail } = useQuery({
    queryKey: ['inbox-conversation', selectedId],
    queryFn: () =>
      api.get<ConversationDetail>(`/inbox/conversations/${selectedId}`),
    enabled: Boolean(selectedId),
    refetchInterval: hasPriorityQueue || hasTriageWait || hasQueueWait ? 10_000 : 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  const conv = detail?.conversation
  const isWebChatConv =
    conv?.channel === 'webchat_site' || Boolean(conv?._id && isWebChatInboxId(conv._id))
  const profileContact = useMemo(
    () => resolveInboxProfileContact(conv, detail?.contact, isWebChatConv),
    [conv, detail?.contact, isWebChatConv],
  )
  const contactEditorMode: 'create' | 'edit' =
    isWebChatConv && profileContact && !profileContact._id && !profileContact.identifier
      ? 'create'
      : 'edit'

  const { data: contactGroups = [] } = useQuery({
    queryKey: ['contact-groups'],
    queryFn: () => api.get<{ _id: string; name: string }[]>('/contact-groups'),
    enabled: Boolean(profileContact?.contactGroupIds?.length) || showContactEditor,
  })

  const contactListLabels = useMemo(() => {
    const ids = profileContact?.contactGroupIds ?? []
    return ids
      .map(id => contactGroups.find(g => g._id === id)?.name)
      .filter((n): n is string => Boolean(n))
  }, [profileContact?.contactGroupIds, contactGroups])

  const messages = detail?.messages ?? []

  useEffect(() => {
    setHistoryConvId(null)
    setShowContactEditor(false)
    setComposeMode('reply')
    setVisitorTyping(false)
    if (visitorTypingTimerRef.current) clearTimeout(visitorTypingTimerRef.current)
    if (agentTypingTimerRef.current) clearTimeout(agentTypingTimerRef.current)
  }, [selectedId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedId, visitorTyping])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
    if (selectedId) qc.invalidateQueries({ queryKey: ['inbox-conversation', selectedId] })
    qc.invalidateQueries({ queryKey: ['webchat-conversations'] })
    qc.invalidateQueries({ queryKey: ['webchat-stats'] })
    if (selectedId && isWebChatInboxId(selectedId)) {
      qc.invalidateQueries({
        queryKey: ['webchat-conversation', webChatInboxIdToMongo(selectedId)],
      })
    }
  }

  const assign = useMutation({
    mutationFn: (id: string) => api.post(`/inbox/conversations/${id}/assign`, {}),
    onMutate: async (id) => {
      if (!me?.userId) return {}
      await qc.cancelQueries({ queryKey: ['inbox-conversation', id] })
      const prevDetail = qc.getQueryData<ConversationDetail>(['inbox-conversation', id])
      const prevLists = qc.getQueriesData<Conversation[]>({ queryKey: ['inbox-conversations'] })
      const optimisticPatch: Partial<Conversation> = {
        status: 'in_progress',
        assignedUserId: me.userId,
        assignedUserName: me.username,
        priorityForMe: false,
        suggestedUserId: undefined,
        suggestedUserName: undefined,
      }
      if (prevDetail) {
        qc.setQueryData<ConversationDetail>(['inbox-conversation', id], {
          ...prevDetail,
          conversation: { ...prevDetail.conversation, ...optimisticPatch },
        })
      }
      for (const [key, list] of prevLists) {
        if (!list) continue
        qc.setQueryData(
          key,
          list.map(c => (c._id === id ? { ...c, ...optimisticPatch } : c)),
        )
      }
      return { prevDetail, prevLists }
    },
    onError: (err, id, ctx) => {
      if (ctx?.prevDetail) {
        qc.setQueryData(['inbox-conversation', id], ctx.prevDetail)
      }
      if (ctx?.prevLists) {
        for (const [key, list] of ctx.prevLists) {
          qc.setQueryData(key, list)
        }
      }
      mutationError(err)
    },
    onSuccess: invalidate,
  })

  const sendReply = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api.post(`/inbox/conversations/${id}/reply`, { text }),
    onSuccess: () => {
      setReply('')
      invalidate()
    },
    onError: mutationError,
  })

  const sendWebChatAttachment = useMutation({
    mutationFn: async ({ id, file, caption }: { id: string; file: File; caption?: string }) => {
      const payload = await readWebChatAttachmentFile(file, caption)
      return api.post(`/inbox/conversations/${id}/reply/attachment`, payload)
    },
    onSuccess: () => {
      setReply('')
      invalidate()
    },
    onError: mutationError,
  })

  const transfer = useMutation({
    mutationFn: ({ id, departmentId }: { id: string; departmentId: string }) =>
      api.post(`/inbox/conversations/${id}/transfer`, { departmentId }),
    onSuccess: invalidate,
    onError: mutationError,
  })

  const resolve = useMutation({
    mutationFn: (id: string) => api.post(`/inbox/conversations/${id}/resolve`, {}),
    onSuccess: invalidate,
    onError: mutationError,
  })

  const convertTicket = useMutation({
    mutationFn: (id: string) => api.post<{ ticketRef: string }>(`/inbox/conversations/${id}/ticket`, {}),
    onSuccess: (data) => {
      invalidate()
      if (data?.ticketRef) notifySuccess(`Chamado ${data.ticketRef} aberto`)
    },
    onError: mutationError,
  })

  const saveTicketInternalNote = useMutation({
    mutationFn: async (text: string) => {
      const d = qc.getQueryData<ConversationDetail>(['inbox-conversation', selectedId])
      const ticketRef = d?.conversation?.ticketRef
      if (!ticketRef) throw new Error('Sem ticket vinculado')
      return api.post(`/inbox/tickets/${encodeURIComponent(ticketRef)}/internal-notes`, { body: text })
    },
    onSuccess: () => {
      const d = qc.getQueryData<ConversationDetail>(['inbox-conversation', selectedId])
      if (d?.conversation?.ticketRef) {
        qc.invalidateQueries({ queryKey: ['inbox-ticket-notes', d.conversation.ticketRef] })
      }
      notifySuccess('Nota do ticket salva')
    },
    onError: mutationError,
  })

  const saveInternalChat = useMutation({
    mutationFn: (text: string) =>
      api.post<{ message: InboxMessageView }>(
        `/inbox/conversations/${encodeURIComponent(selectedId!)}/internal-chat`,
        { text },
      ),
    onSuccess: () => {
      setReply('')
      invalidate()
    },
    onError: mutationError,
  })

  const isTerminal = conv?.status === 'resolved' || conv?.status === 'closed'

  const displayMessages = useMemo(() => {
    if (!isWebChatConv) return messages
    return messages.map(m =>
      m.mediaUrl && (m.mediaType === 'image' || m.mediaType === 'document')
        ? { ...m, mediaSrc: webChatMediaSrc(m.mediaUrl) }
        : m,
    )
  }, [messages, isWebChatConv])

  useEffect(() => {
    if (!isWebChatConv || !selectedId) return
    const convMongoId = webChatInboxIdToMongo(selectedId)
    const socket = getSocket()

    const onTyping = (payload: {
      conversationId?: string
      typing?: boolean
      senderType?: string
    }) => {
      const incomingId = webChatInboxIdToMongo(payload.conversationId ?? '')
      if (incomingId !== convMongoId) return
      if (payload.senderType !== 'visitor') return
      setVisitorTyping(Boolean(payload.typing))
      if (visitorTypingTimerRef.current) clearTimeout(visitorTypingTimerRef.current)
      if (payload.typing) {
        visitorTypingTimerRef.current = setTimeout(() => setVisitorTyping(false), VISITOR_TYPING_IDLE_MS)
      }
    }

    socket.on('webchat:typing', onTyping)
    return () => {
      socket.off('webchat:typing', onTyping)
    }
  }, [isWebChatConv, selectedId])

  const convLive = conv?.status === 'waiting_queue'
    ? liveQueueWaitState(
        conv.queueEnteredAt,
        conv.suggestedAt,
        conv.pullTimeoutSeconds ?? 120,
        tick,
      )
    : { elapsedSec: 0, urgency: 0 }

  const convHandleSec =
    conv?.status === 'in_progress'
      ? liveHandleTimeSec(conv.acceptedAt, tick)
      : 0

  const convFallbackLive =
    isWebChatConv && conv?.status === 'waiting_queue'
      ? liveFallbackCountdown(conv, tick)
      : null

  const convInTriage = Boolean(conv?.status === 'bot_triage' && !conv?.assignedUserId)
  const convTriageLive = convInTriage
    ? liveTriageWaitState(
        conv?.triageWaitSince ?? conv?.createdAt,
        conv?.triageInactivityTotalMin ?? 3,
        tick,
      )
    : { elapsedSec: 0, urgency: 0 }

  const inactivityCloseGateEnabled = detail?.inactivitySla?.closeQuickReplyGateEnabled !== false
  const gracefulCloseGateEnabled =
    detail?.inactivitySla?.gracefulCloseQuickReplyGateEnabled !== undefined
      ? detail.inactivitySla.gracefulCloseQuickReplyGateEnabled !== false
      : detail?.inactivitySla?.closeQuickReplyGateEnabled !== false

  const inactivityCloseGateWaitMinutes =
    detail?.inactivitySla?.inactivityCloseGateWaitMinutes ?? 5

  const inactivityCloseAllowed =
    !inactivityCloseGateEnabled ||
    liveInactivityCloseAllowed(conv?.inactivityWarnedAt, inactivityCloseGateWaitMinutes, tick)

  const encOkCloseAllowed =
    !gracefulCloseGateEnabled ||
    liveGracefulCloseAllowed(
      conv?.gracefulClosePromptAt,
      conv?.gracefulCloseAckAt,
      detail?.inactivitySla?.gracefulCloseAfterPromptMinutes ?? 2,
      tick,
    )

  const gracefulClosePending =
    gracefulCloseGateEnabled &&
    Boolean(conv?.gracefulClosePromptAt) &&
    !conv?.gracefulCloseAckAt &&
    !encOkCloseAllowed &&
    conv?.status === 'in_progress'

  const convLiveCanPull =
    Boolean(conv?.suggestedUserId) &&
    !conv?.priorityForMe &&
    conv?.status === 'waiting_queue' &&
    (Boolean(conv?.suggestedUserBusy) ||
      convLive.urgency >= 1 ||
      conv?.suggestedUserOnline === false)

  const canReply = conv ? canReplyToConversation(conv, me) : false
  const canInternalChat = conv ? canSendInternalChat(conv, me) : false
  const replyBlockedReason = conv
    ? inboxReplyBlockedReason(conv, me, convLiveCanPull)
    : null
  const internalChatBlocked = conv ? internalChatBlockedReason(conv, me) : null

  useEffect(() => {
    if (!isWebChatConv || !selectedId || composeMode !== 'reply') return
    const convId = selectedId
    const convMongoId = webChatInboxIdToMongo(selectedId)
    const socket = getSocket()
    const trimmed = reply.trim()
    const senderName = me?.username?.trim() || undefined

    if (agentTypingTimerRef.current) clearTimeout(agentTypingTimerRef.current)

    const sendTyping = (typing: boolean) => {
      socket.emit('webchat:typing', {
        conversationId: convMongoId,
        typing,
        senderType: 'agent',
        senderName,
      })
      void api.post(`/inbox/conversations/${convId}/typing`, { typing }).catch(() => {})
    }

    if (!trimmed) {
      if (agentTypingActiveRef.current) {
        sendTyping(false)
        agentTypingActiveRef.current = false
      }
      return
    }

    if (!agentTypingActiveRef.current) {
      sendTyping(true)
      agentTypingActiveRef.current = true
    }
    agentTypingTimerRef.current = setTimeout(() => {
      sendTyping(false)
      agentTypingActiveRef.current = false
    }, AGENT_TYPING_STOP_MS)

    return () => {
      if (agentTypingTimerRef.current) clearTimeout(agentTypingTimerRef.current)
    }
  }, [reply, isWebChatConv, selectedId, composeMode, me?.username])

  const needsLiveTimer =
    hasPriorityQueue ||
    hasQueueWait ||
    hasTriageWait ||
    Boolean(conv?.status === 'waiting_queue' && (conv?.queueEnteredAt || conv?.suggestedAt)) ||
    Boolean(conv?.status === 'in_progress' && conv?.acceptedAt) ||
    convInTriage ||
    Boolean(
      conv?.status === 'in_progress' &&
        ((inactivityCloseGateEnabled &&
          conv?.inactivityWarnedAt &&
          !inactivityCloseAllowed) ||
          (gracefulCloseGateEnabled &&
            conv?.gracefulClosePromptAt &&
            !encOkCloseAllowed)),
    )

  useEffect(() => {
    if (!needsLiveTimer) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [needsLiveTimer])

  const inboxSelectCls = cn(selectCls, 'text-xs py-1.5')
  const inboxSearchCls = cn(inputCls, 'pl-9 text-sm')
  const chatFocus = Boolean(selectedId)

  return (
    <div
      className={cn(
        'flex flex-col flex-1 min-h-0 w-full mx-auto',
        platformPageMaxWidthClass,
      )}
    >
      {/* Cabeçalho — mínimo com conversa aberta (título já está no Header global) */}
      <div className={cn('shrink-0', chatFocus ? 'mb-1' : 'mb-2 space-y-1.5')}>
        {!chatFocus && (
          <div className="flex flex-wrap justify-end gap-1.5">
            <Link to="/platform/inbox/tickets">
              <Button size="sm" variant="secondary" className="h-7 px-2 text-xs">
                <Ticket size={13} /> Tickets
              </Button>
            </Link>
            {canSupervise && (
              <Link to="/platform/inbox/supervisor">
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs">
                  <Users size={13} /> Supervisor
                </Button>
              </Link>
            )}
            {can(me ?? null, 'inbox:reports:view') && (
              <Link to="/platform/inbox/relatorios">
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs">
                  <BarChart3 size={13} /> Relatórios
                </Button>
              </Link>
            )}
            {canManageSectors && (
              <>
                <Link to="/platform/inbox/bot">
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-xs">
                    <Bot size={13} /> Bot
                  </Button>
                </Link>
                <Link to="/platform/inbox/respostas">
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-xs">
                    <Zap size={13} /> Respostas
                  </Button>
                </Link>
                <Link to="/platform/inbox/setores">
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-xs">
                    <Settings2 size={13} /> Setores
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}

        {!chatFocus && <InboxAtendimentoNav me={me} compact />}

        {!chatFocus && canInboxView && webchatQueueCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 text-amber-200">
              <Globe size={16} className="shrink-0" />
              <span>
                {webchatQueueCount} chat(s) do site aguardando atendente
                {(webchatBridge?.unreadCount ?? 0) > 0 && (
                  <span className="text-amber-300/80">
                    {' '}
                    · {webchatBridge!.unreadCount} não lida(s)
                  </span>
                )}
              </span>
            </div>
            <Link to="/platform/inbox?status=waiting_queue&channel=webchat">
              <Button size="sm" variant="secondary">
                Ver fila na caixa de entrada
              </Button>
            </Link>
          </div>
        )}

        {!chatFocus && (
        <>
        <InboxLiveVisitors compact canEngage={canWebChatEngage} />
        <InboxStatsRow
          compact
          items={[
            {
              label: 'Na fila',
              value: stats.queue,
              icon: Clock3,
              colorClass: 'text-blue-400',
              description: 'Aguardando atendente',
              href: '/platform/inbox?status=waiting_queue',
              alert: stats.queue > 0,
            },
            {
              label: 'Em atendimento',
              value: stats.active,
              icon: UserCheck,
              colorClass: 'text-green-400',
              description: 'Conversas ativas',
              href: '/platform/inbox?status=in_progress',
            },
            {
              label: 'Triagem',
              value: stats.triage,
              icon: Bot,
              colorClass: 'text-yellow-400',
              description: 'Bot automático',
              href: '/platform/inbox?status=bot_triage',
            },
            {
              label: 'Prioridades',
              value: stats.priority,
              icon: Star,
              colorClass: 'text-amber-400',
              description: 'Round-robin para você',
            },
            ...(canInboxView
              ? [
                  {
                    label: 'Chat do site',
                    value: webchatQueueCount,
                    icon: Globe,
                    colorClass: 'text-violet-400',
                    description: 'Visitantes na fila',
                    href: '/platform/inbox?status=waiting_queue&channel=webchat',
                    alert: webchatQueueCount > 0,
                  },
                ]
              : []),
            {
              label: 'WhatsApp',
              value: waConnected ? 'On' : 'Off',
              icon: Smartphone,
              colorClass: waConnected ? 'text-emerald-400' : 'text-red-400',
              description: waConnected ? 'Conectado' : 'Desconectado',
              href: canWaSessions ? '/sessions' : undefined,
              alert: !waConnected,
            },
          ]}
        />
        </>
        )}
      </div>

      {/* Painel principal */}
      <div
        className={cn(
          'flex flex-col lg:flex-row gap-0 rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)]/30 overflow-hidden shadow-xl shadow-black/20',
          'flex-1 min-h-0',
        )}
      >
        {/* Lista de conversas */}
        <aside
          className={`w-full lg:w-[300px] xl:w-[320px] shrink-0 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/40 ${
            selectedId ? 'max-lg:hidden' : 'max-lg:flex-1'
          }`}
        >
          <div className="p-2 space-y-2 border-b border-[var(--rz-border)]/80 shrink-0">
            <div className="relative">
              <Search size={14} className={searchFieldIconCls} />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar contato, ticket ou setor…"
                className={inboxSearchCls}
              />
            </div>

            <div className="flex flex-wrap gap-1 pb-0.5">
              {QUICK_FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => applyQuickFilter(f.id)}
                  className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                    activeQuickFilter === f.id
                      ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                      : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)] border border-transparent hover:bg-[var(--rz-surface-muted)]/60'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {canInboxView && (
              <div className="flex flex-wrap gap-1 pb-0.5">
                {CHANNEL_FILTERS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setChannelFilter(f.id)}
                    className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
                      channelFilter === f.id
                        ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
                        : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)] border border-transparent hover:bg-[var(--rz-surface-muted)]/60'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            <InboxContactClassFilter activeKey={classFilter} onSelect={setClassFilter} />

            <select
              value={filterDept}
              onChange={e => setFilterDept(e.currentTarget.value)}
              className={`${inboxSelectCls} w-full`}
            >
              <option value="">Todos os setores</option>
              {departments.filter(d => d.canViewQueue !== false).map(d => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="px-3 py-2 text-[11px] text-[var(--rz-text-muted)] border-b border-[var(--rz-border)]/60 shrink-0">
            {filteredConversations.length} conversa(s)
            {classFilter && <span> · filtro CRM ativo</span>}
            {search && filteredConversations.length !== conversations.length && (
              <span className="text-[var(--rz-text-muted)]"> · filtrado de {conversations.length}</span>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {loadingList ? (
              <LoadingState rows={3} className="py-8" />
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <MessageSquare size={32} className="text-[var(--rz-text-muted)]/50 mb-2" />
                <p className="text-sm text-[var(--rz-text-muted)]">Nenhuma conversa aqui.</p>
                <p className="text-xs text-[var(--rz-text-muted)] mt-1">Ajuste os filtros ou aguarde novos contatos.</p>
              </div>
            ) : (
              filteredConversations.map(c => {
                const inTriage = c.status === 'bot_triage' && !c.assignedUserId
                const live =
                  c.status === 'waiting_queue'
                    ? liveQueueWaitState(
                        c.queueEnteredAt,
                        c.suggestedAt,
                        c.pullTimeoutSeconds ?? 120,
                        tick,
                      )
                    : { elapsedSec: c.queueElapsedSec ?? 0, urgency: c.queueUrgency ?? 0 }
                const triageLive = inTriage
                  ? liveTriageWaitState(
                      c.triageWaitSince ?? c.createdAt,
                      c.triageInactivityTotalMin ?? 3,
                      tick,
                    )
                  : null
                const fallbackLive =
                  c.channel === 'webchat_site' && c.status === 'waiting_queue'
                    ? liveFallbackCountdown(c, tick)
                    : null
                const badge = conversationBadge(c)
                const hasPriorityTimer =
                  Boolean(c.suggestedUserId) && c.status === 'waiting_queue' && Boolean(c.suggestedAt)
                const liveCanPull =
                  Boolean(c.suggestedUserId) &&
                  !c.priorityForMe &&
                  c.status === 'waiting_queue' &&
                  (Boolean(c.suggestedUserBusy) ||
                    live.urgency >= 1 ||
                    c.suggestedUserOnline === false)
                const borderCls = priorityBorderClass(
                  live.urgency,
                  Boolean(c.priorityForMe),
                  liveCanPull,
                  hasPriorityTimer,
                )
                const timerCls = queueUrgencyTimerClass(live.urgency)
                const subtitle =
                  c.channel === 'webchat_site'
                    ? [c.widgetName, c.departmentName, c.lastMessagePreview].filter(Boolean).join(' · ')
                    : c.suggestedUserName && c.status === 'waiting_queue'
                    ? c.priorityForMe
                      ? `Prioridade · ${c.departmentName ?? ''}`
                      : `${c.suggestedUserName}${c.suggestedUserOnline === false ? ' · offline' : ''}${c.suggestedUserBusy ? ' · ocupado' : ''}`
                    : [c.departmentName, c.assignedUserName].filter(Boolean).join(' · ')

                const selected = selectedId === c._id
                const isClosed = c.status === 'closed' || c.status === 'resolved'

                return (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => setSelectedId(c._id)}
                    className={`w-full text-left px-2.5 py-2 flex gap-2 border-b border-[var(--rz-border)]/50 hover:bg-[var(--rz-surface-muted)]/40 transition-colors ${borderCls} ${
                      selected ? 'bg-brand-500/[0.08] border-l-2 border-l-brand-500' : 'border-l-2 border-l-transparent'
                    } ${isClosed ? 'opacity-55 hover:opacity-75' : ''}`}
                  >
                    <ContactAvatar name={c.contactName} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-[var(--rz-text-primary)] truncate min-w-0 flex-1">
                          {c.contactName}
                        </span>
                        <div className="flex items-start gap-1.5 shrink-0">
                          <div className="flex flex-col items-end gap-0.5">
                            <InboxChannelBadge channel={c.channel} />
                            {c.departmentBadgeLabel && (
                              <InboxDepartmentBadge
                                label={c.departmentBadgeLabel}
                                departmentName={c.departmentName}
                                menuKey={c.departmentMenuKey}
                                clientVisible={c.departmentClientVisible}
                                internalRankLabel={c.departmentInternalRankLabel}
                              />
                            )}
                            {c.ticketRef && (
                              <Link
                                to={`/platform/inbox/tickets/${c.ticketRef}`}
                                onClick={e => e.stopPropagation()}
                                className="text-[9px] font-mono text-amber-500/90 bg-amber-500/10 px-1 rounded hover:bg-amber-500/20 truncate max-w-[72px]"
                              >
                                {c.ticketRef}
                              </Link>
                            )}
                            {c.whatsappBridgeActive && (
                              <span
                                className="inline-flex items-center gap-0.5 text-[9px] text-emerald-400 bg-emerald-500/10 px-1 rounded"
                                title="Atendimento espelhado no WhatsApp do atendente"
                              >
                                <Smartphone size={10} aria-hidden />
                                Bridge
                              </span>
                            )}
                            {(c.unreadCount ?? 0) > 0 && (
                              <span className="min-w-[18px] rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white text-center">
                                {c.unreadCount}
                              </span>
                            )}
                          </div>
                          <Badge label={badge.label} variant={badge.variant} />
                        </div>
                      </div>
                      <p className="text-xs text-[var(--rz-text-muted)] truncate mt-0.5">
                        {c.channel === 'webchat_site'
                          ? c.contactIdentifier
                          : formatContactIdentifier(c.contactIdentifier, c.contactName)}
                      </p>
                      {c.contactClassification && (
                        <div className="mt-1">
                          <ContactClassificationBadges classification={c.contactClassification} compact />
                        </div>
                      )}
                      {fallbackLive && (
                        <p className="text-[10px] text-sky-400/90 truncate mt-0.5 flex items-center gap-1">
                          <Smartphone size={10} aria-hidden />
                          {fallbackLive.label}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-[11px] text-[var(--rz-text-muted)] truncate">{subtitle || '—'}</p>
                        {c.status === 'waiting_queue' && (c.queueEnteredAt || c.suggestedAt) ? (
                          <span className={`flex items-center gap-0.5 text-[10px] shrink-0 font-mono tabular-nums ${timerCls}`}>
                            <Clock size={10} />
                            {formatQueueTimer(live.elapsedSec)}
                          </span>
                        ) : inTriage && triageLive ? (
                          <span
                            className={`flex items-center gap-0.5 text-[10px] shrink-0 font-mono tabular-nums ${queueUrgencyTimerClass(triageLive.urgency)}`}
                            title="Tempo aguardando atendimento humano"
                          >
                            <Clock size={10} />
                            {formatQueueTimer(triageLive.elapsedSec)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--rz-text-muted)] shrink-0 tabular-nums">
                            {formatInboxMsgTime(c.lastMessageAt, false)}
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

        {/* Área do chat + histórico */}
        <div
          className={cn(
            'flex-1 min-w-0 flex flex-col xl:flex-row min-h-0',
            selectedId ? '' : 'max-lg:hidden',
          )}
        >
        <section className="flex-1 min-w-0 flex flex-col bg-[var(--rz-surface)]/20 min-h-0">
          {!selectedId ? (
            <InboxEmptyChat
              queueCount={stats.queue}
              triageCount={stats.triage}
              priorityCount={stats.priority}
              webchatQueueCount={webchatQueueCount}
              waConnected={waConnected}
              compact
            />
          ) : loadingDetail ? (
            <div className="flex justify-center items-center flex-1">
              <LoadingState rows={3} className="py-8" />
            </div>
          ) : conv ? (
            <>
              {/* Header do chat */}
              <header className="shrink-0 px-4 py-2 border-b border-[var(--rz-border)]/80 bg-[var(--rz-surface)]/50 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setShowDetailsPanel(v => !v)}
                      className="xl:hidden shrink-0 p-1.5 -mr-1 mt-0.5 text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)] rounded-lg hover:bg-[var(--rz-surface-muted)]"
                      aria-label="Detalhes do contato"
                    >
                      <PanelRight size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="lg:hidden shrink-0 p-1.5 -ml-1 mt-0.5 text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)] rounded-lg hover:bg-[var(--rz-surface-muted)]"
                      aria-label="Voltar para lista"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <ContactAvatar name={conv.contactName} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[var(--rz-text-primary)] truncate">{conv.contactName}</p>
                        <Badge
                          label={conversationBadge(conv).label}
                          variant={conversationBadge(conv).variant}
                        />
                        {!isWebChatConv && (
                          <InboxChannelBadge channel={conv.channel ?? 'whatsapp_qr'} size="md" />
                        )}
                        {isWebChatConv && (
                          <InboxChannelBadge channel="webchat_site" size="md" />
                        )}
                        {conv.departmentBadgeLabel && (
                          <InboxDepartmentBadge
                            label={conv.departmentBadgeLabel}
                            departmentName={conv.departmentName}
                            menuKey={conv.departmentMenuKey}
                            clientVisible={conv.departmentClientVisible}
                            internalRankLabel={conv.departmentInternalRankLabel}
                            size="md"
                          />
                        )}
                        {isWebChatConv && conv.whatsappBridgeActive && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded"
                            title="Visitante ↔ WhatsApp do atendente (bridge ativo)"
                          >
                            <Smartphone size={12} aria-hidden />
                            Bridge WA
                          </span>
                        )}
                        {conv.ticketRef && (
                          <Link
                            to={`/platform/inbox/tickets/${conv.ticketRef}`}
                            className="text-[10px] font-mono text-amber-500/90 bg-amber-500/10 px-1.5 py-0.5 rounded hover:bg-amber-500/20"
                          >
                            {conv.ticketRef}
                          </Link>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-[var(--rz-text-muted)] truncate">
                          {isWebChatConv
                            ? conv.contactIdentifier
                            : formatContactIdentifier(conv.contactIdentifier, conv.contactName)}
                        </p>
                        {isWebChatConv && conv.pageUrl && (
                          <a
                            href={conv.pageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-brand-400 hover:underline"
                          >
                            Página de origem
                          </a>
                        )}
                        {detail?.contactStats && (
                          <span className="text-[10px] text-[var(--rz-text-muted)] shrink-0">
                            · {detail.contactStats.totalConversations} atend.
                          </span>
                        )}
                      </div>
                      {(conv.departmentName || conv.assignedUserName) && (
                        <p className="text-[11px] text-[var(--rz-text-muted)] mt-0.5">
                          {[conv.departmentName, conv.assignedUserName && `Atendente: ${conv.assignedUserName}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 shrink-0 ml-1">
                      <button
                        type="button"
                        title="Converter em chamado"
                        disabled={isTerminal || convertTicket.isPending}
                        onClick={() => convertTicket.mutate(conv._id)}
                        className="p-2 rounded-lg text-[var(--rz-text-muted)] hover:text-amber-400 hover:bg-[var(--rz-surface-muted)]/80 border border-[var(--rz-border)]/60 disabled:opacity-40"
                      >
                        <Ticket size={16} />
                      </button>
                      <button
                        type="button"
                        title="Editar perfil do cliente"
                        disabled={!profileContact}
                        onClick={() => setShowContactEditor(true)}
                        className="p-2 rounded-lg text-[var(--rz-text-muted)] hover:text-green-400 hover:bg-[var(--rz-surface-muted)]/80 border border-[var(--rz-border)]/60 disabled:opacity-40"
                      >
                        <UserPen size={16} />
                      </button>
                      {!isWebChatConv && (
                        <>
                      <button
                        type="button"
                        title="Histórico de atendimentos"
                        onClick={() => setShowDetailsPanel(true)}
                        className="p-2 rounded-lg text-[var(--rz-text-muted)] hover:text-brand-400 hover:bg-[var(--rz-surface-muted)]/80 border border-[var(--rz-border)]/60 xl:hidden"
                      >
                        <History size={16} />
                      </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!isTerminal && conv.canAccept && conv.priorityForMe && (
                      <Button
                        size="sm"
                        onClick={() => assign.mutate(conv._id)}
                        disabled={assign.isPending}
                        className="bg-yellow-600 hover:bg-yellow-500 text-[var(--rz-on-accent)]"
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
                      (!conv.suggestedUserId || conv.status === 'bot_triage') && (
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

                {conv.status === 'waiting_queue' && convFallbackLive && (
                  <div className={queueUrgencyPanelClass(convFallbackLive.urgency)}>
                    <Smartphone size={14} className={`shrink-0 ${queueUrgencyTimerClass(convFallbackLive.urgency)}`} />
                    <span>
                      {convFallbackLive.label}
                      {convFallbackLive.phase === 'panel' && conv.suggestedUserId && (
                        <span className="text-[var(--rz-text-muted)]">
                          {' '}
                          · aceite no painel ou alerta WA
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {conv.status === 'waiting_queue' && !conv.suggestedUserId && (conv.queueEnteredAt || convLive.elapsedSec > 0) && (
                  <div className={queueUrgencyPanelClass(convLive.urgency)}>
                    <Clock size={14} className={`shrink-0 ${queueUrgencyTimerClass(convLive.urgency)}`} />
                    <span>
                      Na fila aguardando atendente ·{' '}
                      <span className={`font-mono ${queueUrgencyTimerClass(convLive.urgency)}`}>
                        {formatQueueTimer(convLive.elapsedSec)}
                      </span>
                    </span>
                  </div>
                )}
                {conv.suggestedUserId && conv.status === 'waiting_queue' && (
                  <div className={queueUrgencyPanelClass(convLive.urgency)}>
                    <Clock size={14} className={`shrink-0 ${queueUrgencyTimerClass(convLive.urgency)}`} />
                    {conv.priorityForMe ? (
                      <span>
                        Prioridade para você ·{' '}
                        <span className={`font-mono ${queueUrgencyTimerClass(convLive.urgency)}`}>
                          {formatQueueTimer(convLive.elapsedSec)}
                        </span>
                      </span>
                    ) : (
                      <span>
                        Aguardando <strong className="font-medium">{conv.suggestedUserName}</strong>
                        {conv.suggestedUserOnline === false && (
                          <span className="text-orange-400"> (offline no painel)</span>
                        )}
                        {' · '}
                        <span className={`font-mono ${queueUrgencyTimerClass(convLive.urgency)}`}>
                          {formatQueueTimer(convLive.elapsedSec)}
                        </span>
                        {conv.suggestedUserOnline === false && !conv.priorityForMe && (
                          <span className="text-orange-400"> · offline — pode puxar</span>
                        )}
                        {conv.suggestedUserBusy && !conv.priorityForMe && (
                          <span className="text-orange-400"> · ocupado — pode puxar</span>
                        )}
                        {convLiveCanPull &&
                          !conv.priorityForMe &&
                          !conv.suggestedUserBusy &&
                          conv.suggestedUserOnline !== false && (
                          <span className="text-orange-400"> · pode puxar</span>
                        )}
                      </span>
                    )}
                  </div>
                )}
                {conv.status === 'in_progress' && convHandleSec > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 text-xs border-b border-emerald-500/20 bg-emerald-500/5 text-emerald-300/90">
                    <Clock size={14} className="shrink-0" />
                    <span>
                      Em atendimento ·{' '}
                      <span className="font-mono tabular-nums">{formatQueueTimer(convHandleSec)}</span>
                    </span>
                  </div>
                )}
                {convInTriage && (
                  <div className={queueUrgencyPanelClass(convTriageLive.urgency)}>
                    <Clock size={14} className={`shrink-0 ${queueUrgencyTimerClass(convTriageLive.urgency)}`} />
                    <span>
                      Em triagem · sem atendimento humano ·{' '}
                      <span className={`font-mono ${queueUrgencyTimerClass(convTriageLive.urgency)}`}>
                        {formatQueueTimer(convTriageLive.elapsedSec)}
                      </span>
                      <span className="text-[var(--rz-text-muted)]">
                        {' '}
                        · encerra automaticamente se o visitante não responder (Inbox → Bot)
                      </span>
                    </span>
                  </div>
                )}
              </header>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[var(--rz-surface-muted)]/40 via-transparent to-transparent">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-[var(--rz-text-muted)] py-8">Nenhuma mensagem ainda.</p>
                ) : (
                  displayMessages.map(m => <InboxMessageBubble key={m._id} message={m} />)
                )}
                {isWebChatConv && visitorTyping && (
                  <WebChatTypingLine
                    label={`${conv?.contactName?.trim() || 'Visitante'} está digitando…`}
                  />
                )}
                <div ref={messagesEndRef} />
              </div>

              {!isTerminal && (canReply || canInternalChat) && (
                <footer className="shrink-0 border-t border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/60 backdrop-blur-sm p-3 space-y-2">
                  {detailError && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--rz-warning-text)]/30 bg-[var(--rz-warning-bg)] px-3 py-2 text-xs text-[var(--rz-warning-text)]">
                      <span>Conexão com a API instável — recarregue ou tente sincronizar antes de enviar.</span>
                      <button
                        type="button"
                        onClick={() => void refetchDetail()}
                        className="underline font-medium hover:opacity-80"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  )}
                  {composeMode === 'reply' && replyBlockedReason && (
                    <p className="text-xs text-[var(--rz-text-muted)]">{replyBlockedReason}</p>
                  )}
                  {composeMode === 'internal' && internalChatBlocked && (
                    <p className="text-xs text-[var(--rz-text-muted)]">{internalChatBlocked}</p>
                  )}
                  {gracefulClosePending && (
                    <p className="text-xs text-[var(--rz-text-muted)]">
                      Pergunta final enviada —{' '}
                      <code>/{detail?.inactivitySla?.inactivityCloseGracefulQuickCode ?? 'enc_ok'}</code>{' '}
                      libera após resposta do cliente ou{' '}
                      {detail?.inactivitySla?.gracefulCloseAfterPromptMinutes ?? 2} min.
                    </p>
                  )}
                  <InboxComposer
                    value={reply}
                    onChange={setReply}
                    quickReplies={quickReplies}
                    inactivityWarningQuickCode={detail?.inactivitySla?.inactivityWarningQuickCode ?? 'aus'}
                    inactivityCloseQuickCode={detail?.inactivitySla?.inactivityCloseQuickCode ?? 'enc'}
                    inactivityCloseGracefulQuickCode={
                      detail?.inactivitySla?.inactivityCloseGracefulQuickCode ?? 'enc_ok'
                    }
                    gracefulCloseQuickCode={detail?.inactivitySla?.gracefulCloseQuickCode ?? 'mais'}
                    inactivityCloseAllowed={inactivityCloseAllowed}
                    encOkCloseAllowed={encOkCloseAllowed}
                    inactivityCloseGateEnabled={inactivityCloseGateEnabled}
                    gracefulCloseGateEnabled={gracefulCloseGateEnabled}
                    sending={composeMode === 'internal' ? saveInternalChat.isPending : sendReply.isPending}
                    sendDisabled={!canReply}
                    composeMode={composeMode}
                    onComposeModeChange={setComposeMode}
                    internalChatDisabled={!canInternalChat}
                    onSend={() => {
                      if (composeMode === 'internal') {
                        saveInternalChat.mutate(reply)
                        return
                      }
                      sendReply.mutate({ id: conv._id, text: reply })
                    }}
                    onImageAttach={
                      isWebChatConv && canReply
                        ? file => sendWebChatAttachment.mutate({ id: conv._id, file, caption: reply })
                        : undefined
                    }
                    imageAttachDisabled={!canReply}
                    imageAttaching={sendWebChatAttachment.isPending}
                  />
                  {canReply && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={transferDept}
                        onChange={e => setTransferDept(e.currentTarget.value)}
                        className={inboxSelectCls}
                      >
                        <option value="">Transferir para…</option>
                        {departments
                          .filter(d => d._id !== conv.departmentId && d.canTransferTo !== false)
                          .map(d => (
                          <option key={d._id} value={d._id}>
                            {d.name}
                            {d.clientVisible === false
                              ? ` (${d.internalRankLabel ?? 'interno'})`
                              : ''}
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
                  )}
                </footer>
              )}

              {isTerminal && (
                <footer className="shrink-0 border-t border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/40 px-4 py-3 text-xs text-[var(--rz-text-muted)] text-center">
                  Conversa encerrada. Reabra o atendimento para responder.
                </footer>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center">
              <MessageSquare size={36} className="text-[var(--rz-text-muted)]/50 mb-3" />
              <p className="text-sm font-medium text-[var(--rz-text-primary)]">
                Não foi possível abrir esta conversa
              </p>
              <p className="text-xs text-[var(--rz-text-muted)] mt-2 max-w-sm">
                Ela pode ter sido encerrada ou você não tem acesso. Volte à lista ou ajuste os filtros.
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-4"
                onClick={() => setSelectedId(null)}
              >
                Voltar à lista
              </Button>
            </div>
          )}
        </section>

        {conv && (
          <InboxContactDetailsPanel
            className={showDetailsPanel ? 'max-xl:flex' : 'max-xl:hidden'}
            conversation={conv}
            contact={profileContact ?? detail?.contact}
            contactStats={detail?.contactStats}
            previousConversations={detail?.previousConversations}
            isWebChat={isWebChatConv}
            isTerminal={isTerminal}
            historyConvId={historyConvId}
            onSelectHistory={id => {
              setHistoryConvId(id)
            }}
            onEditContact={profileContact ? () => setShowContactEditor(true) : undefined}
            onAssign={() => assign.mutate(conv._id)}
            onResolve={() => resolve.mutate(conv._id)}
            onConvertTicket={() => convertTicket.mutate(conv._id)}
            assignPending={assign.isPending}
            resolvePending={resolve.isPending}
            ticketPending={convertTicket.isPending}
            showAccept={!isTerminal && Boolean(conv.canAccept && conv.priorityForMe)}
            showPull={!isTerminal && convLiveCanPull && !conv.priorityForMe && conv.status === 'waiting_queue'}
            showAssume={
              !isTerminal &&
              conv.status !== 'in_progress' &&
              Boolean(conv.canAccept && !conv.priorityForMe && (!conv.suggestedUserId || conv.status === 'bot_triage'))
            }
            onSaveInternalNote={
              conv.ticketRef ? body => saveTicketInternalNote.mutateAsync(body) : undefined
            }
            savingNote={saveTicketInternalNote.isPending}
            listLabels={contactListLabels}
          />
        )}
        </div>
      </div>

      {showContactEditor && profileContact && conv && (
        <ContactEditorModal
          mode={contactEditorMode}
          contactName={profileContact.name}
          contactPhone={profileContact.identifier}
          initial={{
            identifier: profileContact.identifier,
            name: profileContact.name,
            email: profileContact.email,
            organization: profileContact.organization,
            notes: profileContact.notes,
            contactGroupIds: profileContact.contactGroupIds,
            contactKind: (detail?.contact?.classification?.kind ?? '') as ContactFormData['contactKind'],
            contactOrigin: (detail?.contact?.classification?.origin ?? '') as ContactFormData['contactOrigin'],
            commercialStatus: (detail?.contact?.classification?.commercialStatus ?? '') as ContactFormData['commercialStatus'],
            temperature: (detail?.contact?.classification?.temperature ?? '') as ContactFormData['temperature'],
          }}
          groups={contactGroups.map(g => ({ _id: g._id, name: g.name, memberCount: 0 }))}
          onClose={() => setShowContactEditor(false)}
          onSave={async (data: ContactFormData) => {
            if (isWebChatConv) {
              await api.patch(
                `/inbox/conversations/${encodeURIComponent(conv._id)}/visitor-profile`,
                {
                  name: data.name.trim(),
                  identifier: data.identifier.trim() || undefined,
                  email: data.email.trim() || undefined,
                  organization: data.organization.trim() || undefined,
                  notes: data.notes.trim() || undefined,
                  contactGroupIds: data.contactGroupIds,
                  contactKind: data.contactKind || null,
                  contactOrigin: data.contactOrigin || null,
                  commercialStatus: data.commercialStatus || null,
                  temperature: data.temperature || null,
                },
              )
            } else {
              await api.patch(`/destinations/${profileContact._id}`, {
                name: data.name.trim(),
                email: data.email.trim() || undefined,
                organization: data.organization.trim() || undefined,
                notes: data.notes.trim() || undefined,
                contactGroupIds: data.contactGroupIds,
                contactKind: data.contactKind || null,
                contactOrigin: data.contactOrigin || null,
                commercialStatus: data.commercialStatus || null,
                temperature: data.temperature || null,
              })
            }
            invalidate()
          }}
        />
      )}
    </div>
  )
}

