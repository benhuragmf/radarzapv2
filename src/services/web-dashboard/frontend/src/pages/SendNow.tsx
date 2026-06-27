import { useMemo, useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import {
  WHATSAPP_LIMITS,
  ALLOWED_SAFE_CAMPAIGN_DELAYS_MS,
  ALLOWED_RISK_CAMPAIGN_DELAYS_MS,
  estimateCampaignDurationMs,
  formatDuration,
  isUnlimited,
  exceedsPlanQuota,
  remainingDailyMessages,
  CAMPAIGN_SAFE_DEFAULT_DELAY_MS,
  CAMPAIGN_RISK_DEFAULT_DELAY_MS,
  campaignDelayOptionLabel,
  snapCampaignDelayMs,
} from '../lib/limits'
import {
  canSelectForSend,
  effectiveConsentStatus,
  type ConsentStatus,
} from '../lib/consentUi'
import { formatWaSessionLabel } from '../lib/destinationFormat'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import {
  Send,
  Smartphone,
  AlertCircle,
  Calendar,
  Clock,
  Search,
  Plus,
  RefreshCw,
  ShieldAlert,
  FileText,
  Eye,
  History,
  ListOrdered,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
interface CampaignSendPolicyPayload {
  canDisableProtection: boolean
  isOwner: boolean
  allowMembersDisableCampaignProtection: boolean
  system: {
    marketingDefaultMaxPerMinute: number
    marketingCapMaxPerMinute: number
    humanizeEnabled: boolean
    composingEnabled: boolean
  }
  org: {
    marketingMaxPerMinute: number
    marketingEnabled: boolean
    limitsDisabled: boolean
    humanizeEnabled: boolean
    composingEnabled: boolean
  }
  effective: {
    marketingMaxPerMinute: number | null
    marketingMinIntervalMs: number
    marketingMinIntervalSec: number
    humanizeEnabled: boolean
    composingEnabled: boolean
    protectedMode: boolean
    avgDelayMs: number
    avgDelaySec: number
  }
  protectedDelayOptionsMs: number[]
  riskDelayOptionsMs: number[]
  delayJitterHint: string | null
  campaignDelays: import('../lib/limits').CampaignDelaysUiConfig
  defaultProtectedDelayMs: number
  defaultRiskDelayMs: number
}
import { WhatsAppPreviewBubble } from '../components/platform/WhatsAppPreviewBubble'
import { WhatsAppTextEditor } from '../components/whatsapp/WhatsAppTextEditor'
import { SendCampaignSummary } from '../components/send/SendCampaignSummary'
import { SendRecipientsTable } from '../components/send/SendRecipientsTable'
import type { ContactClassificationView } from '../lib/contactClassificationUi'
import {
  isSmartSegmentPresetId,
  matchesSmartSegmentPreset,
} from '../lib/contactClassificationUi'
import { mutationError } from '../lib/notify'
import { RadarPageShell, PageHeader, inputCls, searchFieldIconCls } from '@/design-system'
import {
  clampDatetimeLocal,
  minDatetimeLocalFromNow,
  validateFutureSchedule,
} from '../lib/schedule-time'

interface Destination {
  _id: string
  name: string
  identifier: string
  type: 'contact' | 'group'
  contactGroupIds?: string[]
  consentStatus?: ConsentStatus
  consent?: { granted?: boolean }
  pendingOutboundCount?: number
  tags?: string[]
  lastMessageSent?: string
  classification?: ContactClassificationView
}

type SendAudienceMode = 'recommended' | 'leads_opt_in' | 'clients_active' | 'all' | 'review_blocked'

function isDestinationCampaignSelectable(d: Destination): boolean {
  if (d.type === 'group') return true
  if (d.classification) return d.classification.campaignSelectable
  const st = effectiveConsentStatus(d.consentStatus, d.consent?.granted)
  return canSelectForSend(st, d.pendingOutboundCount ?? 0)
}

function matchesAudience(d: Destination, mode: SendAudienceMode): boolean {
  if (d.type === 'group') {
    return mode === 'all' || mode === 'recommended'
  }
  const c = d.classification
  if (!c) return mode === 'all' || mode === 'recommended'
  switch (mode) {
    case 'recommended':
      return c.campaignSelectable
    case 'leads_opt_in':
      return c.kind === 'lead' && c.permission === 'opt_in_accepted'
    case 'clients_active':
      return (
        c.kind === 'client' &&
        c.permission === 'opt_in_accepted' &&
        c.commercialStatus !== 'inactive' &&
        c.commercialStatus !== 'lost'
      )
    case 'review_blocked':
      return !c.campaignSelectable
    case 'all':
    default:
      return true
  }
}

interface ContactGroupOption {
  _id: string
  name: string
  memberCount: number
}

interface Session {
  clientId: string
  status: string
  phoneNumber?: string
  profileName?: string
  waAccountType?: 'web' | 'business'
}

interface WAGroup {
  id: string
  name: string
  participantsCount: number
}

type DestinationScope = 'contacts' | 'lists' | 'segments' | 'whatsapp_groups' | 'both'

interface LeadSegmentSummary {
  id: string
  name: string
  leadCount: number
}

interface SmartSegmentPreset {
  id: string
  label: string
  description: string
  count: number
}

function destinationMatchesSegmentFilter(
  d: Destination,
  segmentId: string | null,
): boolean {
  if (!segmentId) return true
  if (isSmartSegmentPresetId(segmentId)) {
    return d.type === 'contact' && matchesSmartSegmentPreset(d.classification, segmentId)
  }
  return (d.contactGroupIds ?? []).some(gid => String(gid) === segmentId)
}

type Priority = 'high' | 'medium' | 'low'
type MessageMode = 'plain' | 'platform_template'

interface PlatformTemplateOption {
  _id: string
  name: string
  label?: string
  platformKind?: string
}

const DEFAULT_SAFE_DELAY_MS = CAMPAIGN_SAFE_DEFAULT_DELAY_MS

interface BillingMe {
  plan: string
  limits: { messagesPerDay: number; groupsMax: number; templatesMax: number }
  usage: { messagesUsed: number }
}

const labelCls = 'text-xs text-[var(--rz-text-muted)] mb-1 block'

function defaultScheduleLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30)
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  const raw = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  return clampDatetimeLocal(raw, minDatetimeLocalFromNow())
}

export default function SendNow() {
  const qc = useQueryClient()
  const location = useLocation()
  const navState = location.state as {
    preselectedDestinationIds?: string[]
    smartSegmentId?: string
    destinationScope?: DestinationScope
  } | null
  const preselectedFromContacts = navState?.preselectedDestinationIds

  const [title, setTitle] = useState('')
  const [messageMode, setMessageMode] = useState<MessageMode>('plain')
  const [platformTemplateName, setPlatformTemplateName] = useState('pw-padrao')
  const [templateMensagem, setTemplateMensagem] = useState('')
  const [message, setMessage] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [destinationScope, setDestinationScope] = useState<DestinationScope>(
    navState?.destinationScope === 'segments' ? 'segments' : 'contacts',
  )
  const [selectedListId, setSelectedListId] = useState<string | null>(
    navState?.smartSegmentId ?? null,
  )
  const [contactGroupFilter, setContactGroupFilter] = useState<string>('all')
  const [priority, setPriority] = useState<Priority>('medium')
  const [delayBetweenMs, setDelayBetweenMs] = useState<number>(DEFAULT_SAFE_DELAY_MS)
  const [requireConnected, setRequireConnected] = useState(true)
  const [scheduleMode, setScheduleMode] = useState(false)
  const [sendAtLocal, setSendAtLocal] = useState(defaultScheduleLocal)
  const minSendAtLocal = useMemo(() => minDatetimeLocalFromNow(), [scheduleMode])
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [acceptWhatsAppRisk, setAcceptWhatsAppRisk] = useState(false)
  const [riskAcknowledged, setRiskAcknowledged] = useState(false)
  const [showGroups, setShowGroups] = useState(false)
  const [onlySendable, setOnlySendable] = useState(true)
  const [audienceMode, setAudienceMode] = useState<SendAudienceMode>('recommended')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const { data: billing } = useQuery<BillingMe>({
    queryKey: ['billing-me'],
    queryFn: () => api.get('/billing/me'),
    refetchInterval: 30_000,
  })

  const remainingToday = billing
    ? remainingDailyMessages(billing.usage, billing.limits)
    : Number.POSITIVE_INFINITY
  const planQuotaExceeded = billing
    ? exceedsPlanQuota(selectedIds.size, billing.limits, billing.usage)
    : false
  const messageTooLong =
    messageMode === 'plain' && message.length > WHATSAPP_LIMITS.MAX_MESSAGE_LENGTH
  const canSubmitMessage =
    messageMode === 'platform_template'
      ? !!platformTemplateName
      : !!message.trim()

  const { data: sendPolicy } = useQuery<CampaignSendPolicyPayload>({
    queryKey: ['campaigns-send-policy'],
    queryFn: () => api.get('/campaigns/send-policy'),
    staleTime: 60_000,
  })

  const delayOptions = acceptWhatsAppRisk
    ? (sendPolicy?.riskDelayOptionsMs ?? [...ALLOWED_RISK_CAMPAIGN_DELAYS_MS])
    : (sendPolicy?.protectedDelayOptionsMs ?? [...ALLOWED_SAFE_CAMPAIGN_DELAYS_MS])

  const { data: platformTemplates = [] } = useQuery<PlatformTemplateOption[]>({
    queryKey: ['platform-templates-send'],
    queryFn: async () => {
      const list = await api.get<PlatformTemplateOption[]>('/platform/templates')
      return list.filter(t => t.name.startsWith('pw-'))
    },
  })

  const firstSelectedDestId = useMemo(() => {
    const id = Array.from(selectedIds)[0]
    return id ?? null
  }, [selectedIds])

  useEffect(() => {
    if (messageMode !== 'platform_template' || !platformTemplateName) {
      setPreviewText('')
      return
    }
    const t = setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const res = await api.post<{ preview: string }>('/platform/templates/preview', {
          name: platformTemplateName,
          destinationId: firstSelectedDestId ?? undefined,
          mensagem: templateMensagem.trim() || undefined,
        })
        setPreviewText(res.preview)
      } catch {
        setPreviewText('')
      } finally {
        setPreviewLoading(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [messageMode, platformTemplateName, templateMensagem, firstSelectedDestId])

  const { data: destinations = [] } = useQuery<Destination[]>({
    queryKey: ['destinations'],
    queryFn: () => api.get('/destinations'),
  })

  useEffect(() => {
    if (!preselectedFromContacts?.length || destinations.length === 0) return
    const valid = preselectedFromContacts.filter(id =>
      destinations.some(d => d._id === id),
    )
    if (valid.length > 0) {
      setSelectedIds(new Set(valid))
      setDestinationScope('contacts')
    }
  }, [preselectedFromContacts, destinations])

  const { data: contactGroups = [] } = useQuery<ContactGroupOption[]>({
    queryKey: ['contact-groups'],
    queryFn: () => api.get('/contact-groups'),
  })

  const { data: leadSegments = [] } = useQuery<LeadSegmentSummary[]>({
    queryKey: ['leads-segments-summary'],
    queryFn: () => api.get('/leads/segments-summary'),
    retry: false,
  })

  const { data: smartSegments = [] } = useQuery<SmartSegmentPreset[]>({
    queryKey: ['destinations-smart-segments'],
    queryFn: () => api.get('/destinations/smart-segments'),
  })

  const segmentPickerItems = useMemo(() => {
    const smart = smartSegments.map(s => ({
      id: s.id,
      name: s.label,
      count: s.count,
      hint: 'contatos',
      description: s.description,
    }))
    const leads = leadSegments.map(s => ({
      id: s.id,
      name: s.name,
      count: s.leadCount,
      hint: 'leads',
      description: undefined as string | undefined,
    }))
    if (smart.length > 0 || leads.length > 0) {
      return [...smart, ...leads]
    }
    return contactGroups.map(g => ({
      id: g._id,
      name: g.name,
      count: g.memberCount,
      hint: 'membros',
      description: undefined as string | undefined,
    }))
  }, [smartSegments, leadSegments, contactGroups])

  useEffect(() => {
    if (destinationScope === 'lists' && !selectedListId && contactGroups[0]) {
      setSelectedListId(contactGroups[0]._id)
    }
    if (destinationScope === 'segments' && !selectedListId && segmentPickerItems[0]) {
      setSelectedListId(segmentPickerItems[0].id)
    }
  }, [destinationScope, selectedListId, contactGroups, segmentPickerItems])

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of contactGroups) m.set(g._id, g.name)
    return m
  }, [contactGroups])

  const contactGroupIdsByDest = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const d of destinations) {
      if (d.type !== 'contact') continue
      m.set(d._id, (d.contactGroupIds ?? []).map(String))
    }
    return m
  }, [destinations])

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
    refetchInterval: 10_000,
  })

  const connected = sessions.find(s => s.status === 'connected')
  const isBusiness = connected?.waAccountType === 'business'
  const marketingPerMinute = sendPolicy?.effective.marketingMaxPerMinute ?? null

  const hasSelectedGroup = useMemo(
    () => destinations.some(d => selectedIds.has(d._id) && d.type === 'group'),
    [destinations, selectedIds],
  )

  const selectedDestIdsKey = useMemo(
    () => Array.from(selectedIds).sort().join(','),
    [selectedIds],
  )

  const { data: groupValidation, isFetching: validatingGroups } = useQuery<{
    ok: boolean
    error?: string
    invalidDestinationIds?: string[]
    contactsNotInGroup?: string[]
  }>({
    queryKey: ['campaign-validate-destinations', connected?.clientId, selectedDestIdsKey],
    queryFn: () =>
      api.post('/campaigns/validate-destinations', {
        destinationIds: Array.from(selectedIds),
      }),
    enabled: hasSelectedGroup && !!connected,
    staleTime: 0,
  })

  const GROUP_INLINE_ERROR = 'Número não cadastrado no grupo selecionado'

  const groupMembershipError =
    groupValidation?.ok === false ? GROUP_INLINE_ERROR : null

  const contactsNotInGroupIds = useMemo(
    () => new Set(groupValidation?.contactsNotInGroup ?? []),
    [groupValidation?.contactsNotInGroup],
  )

  const selectedGroupIdsWithError = useMemo(() => {
    const ids = new Set<string>()
    if (!hasSelectedGroup || groupValidation?.ok !== false) return ids
    for (const d of destinations) {
      if (d.type !== 'group' || !selectedIds.has(d._id)) continue
      if (groupValidation.invalidDestinationIds?.includes(d._id)) {
        ids.add(d._id)
        continue
      }
      // Erro de sessão no grupo selecionado
      if (groupValidation.error) ids.add(d._id)
    }
    return ids
  }, [destinations, selectedIds, hasSelectedGroup, groupValidation])

  useEffect(() => {
    const socket = getSocket()
    const onSessionUpdate = (payload: { status?: string; event?: string }) => {
      if (
        payload.status === 'connected' ||
        payload.status === 'disconnected' ||
        payload.event === 'CONNECTION_UPDATE'
      ) {
        qc.invalidateQueries({ queryKey: ['sessions'] })
        qc.invalidateQueries({ queryKey: ['campaign-validate-destinations'] })
      }
    }
    socket.on('session:update', onSessionUpdate)
    return () => {
      socket.off('session:update', onSessionUpdate)
    }
  }, [qc])

  const delayConfig = sendPolicy?.campaignDelays

  const durationEst = estimateCampaignDurationMs(
    selectedIds.size,
    delayBetweenMs,
    acceptWhatsAppRisk,
    marketingPerMinute,
    delayConfig,
  )

  const { data: waGroups = [], isLoading: loadingGroups, refetch: refetchGroups } = useQuery<WAGroup[]>({
    queryKey: ['wa-groups', connected?.clientId],
    queryFn: () =>
      connected ? api.get(`/sessions/${connected.clientId}/groups`) : Promise.resolve([]),
    enabled: showGroups && !!connected,
  })

  const filteredDest = useMemo(() => {
    const q = search.trim().toLowerCase()
    const listFilter =
      destinationScope === 'lists' || destinationScope === 'segments' ? selectedListId : null
    return destinations.filter(d => {
      if (destinationScope === 'contacts' && d.type !== 'contact') return false
      if (destinationScope === 'lists' && d.type !== 'contact') return false
      if (destinationScope === 'segments' && d.type !== 'contact') return false
      if (destinationScope === 'whatsapp_groups' && d.type !== 'group') return false
      if (listFilter) {
        if (destinationScope === 'segments') {
          if (!destinationMatchesSegmentFilter(d, listFilter)) return false
        } else {
          const inGroup = (d.contactGroupIds ?? []).some(gid => String(gid) === listFilter)
          if (!inGroup) return false
        }
      }
      if (onlySendable && d.type === 'contact' && !isDestinationCampaignSelectable(d)) return false
      if (d.type === 'contact' && !matchesAudience(d, audienceMode)) return false
      if (contactGroupFilter !== 'all' && !listFilter) {
        if (d.type === 'group') return false
        const inGroup = (d.contactGroupIds ?? []).some(gid => String(gid) === contactGroupFilter)
        if (!inGroup) return false
      }
      if (!q) return true
      return (
        d.name.toLowerCase().includes(q) ||
        d.identifier.toLowerCase().includes(q)
      )
    })
  }, [destinations, search, destinationScope, contactGroupFilter, onlySendable, selectedListId, audienceMode])

  const selectionStats = useMemo(() => {
    let contacts = 0
    let groups = 0
    for (const id of selectedIds) {
      const d = destinations.find(x => x._id === id)
      if (d?.type === 'group') groups += 1
      else if (d) contacts += 1
    }
    return { contacts, groups, total: selectedIds.size }
  }, [selectedIds, destinations])

  useEffect(() => {
    if (!sendPolicy) return
    if (!sendPolicy.canDisableProtection && acceptWhatsAppRisk) {
      setAcceptWhatsAppRisk(false)
      setRiskAcknowledged(false)
    }
  }, [sendPolicy, acceptWhatsAppRisk])

  useEffect(() => {
    if (!sendPolicy) return
    const opts = acceptWhatsAppRisk
      ? sendPolicy.riskDelayOptionsMs
      : sendPolicy.protectedDelayOptionsMs
    if (!opts.length) return
    setDelayBetweenMs(prev => {
      if (opts.includes(prev)) return prev
      if (acceptWhatsAppRisk) {
        return sendPolicy.defaultRiskDelayMs ?? opts[0] ?? CAMPAIGN_RISK_DEFAULT_DELAY_MS
      }
      return sendPolicy.defaultProtectedDelayMs ?? opts[1] ?? opts[0] ?? CAMPAIGN_SAFE_DEFAULT_DELAY_MS
    })
  }, [sendPolicy, acceptWhatsAppRisk])

  const sendableInScopeCount = useMemo(() => {
    const listFilter =
      destinationScope === 'lists' || destinationScope === 'segments' ? selectedListId : null
    let n = 0
    for (const d of destinations) {
      if (destinationScope === 'contacts' && d.type !== 'contact') continue
      if (destinationScope === 'lists' && d.type !== 'contact') continue
      if (destinationScope === 'segments' && d.type !== 'contact') continue
      if (destinationScope === 'whatsapp_groups' && d.type !== 'group') continue
      if (listFilter) {
        if (destinationScope === 'segments') {
          if (!destinationMatchesSegmentFilter(d, listFilter)) continue
        } else {
          const inGroup = (d.contactGroupIds ?? []).some(gid => String(gid) === listFilter)
          if (!inGroup) continue
        }
      }
      if (contactGroupFilter !== 'all' && !listFilter && d.type === 'contact') {
        const inGroup = (d.contactGroupIds ?? []).some(gid => String(gid) === contactGroupFilter)
        if (!inGroup) continue
      }
      if (d.type === 'contact') {
        if (!isDestinationCampaignSelectable(d)) continue
      }
      n += 1
    }
    return n
  }, [destinations, destinationScope, contactGroupFilter, selectedListId])

  const sidebarPreviewText =
    messageMode === 'platform_template' ? previewText : message

  const submitBlockers = useMemo(() => {
    const blockers: string[] = []
    if (selectedIds.size === 0) blockers.push('Selecione ao menos um destinatário')
    if (!canSubmitMessage) blockers.push('Escreva a mensagem ou escolha um modelo')
    if (messageTooLong) blockers.push('Mensagem acima do limite permitido')
    if (!scheduleMode && !connected) {
      blockers.push('WhatsApp desconectado — conecte em Sessões ou use Agendar')
    }
    if (acceptWhatsAppRisk && !riskAcknowledged) {
      blockers.push('Confirme que aceita o risco de banimento')
    }
    if (groupMembershipError) blockers.push(groupMembershipError)
    if (hasSelectedGroup && validatingGroups) blockers.push('Aguarde a validação do grupo')
    return blockers
  }, [
    selectedIds.size,
    canSubmitMessage,
    messageTooLong,
    scheduleMode,
    connected,
    acceptWhatsAppRisk,
    riskAcknowledged,
    groupMembershipError,
    hasSelectedGroup,
    validatingGroups,
  ])

  const selectContactGroup = () => {
    if (contactGroupFilter === 'all') return
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const d of destinations) {
        if (d.type !== 'contact') continue
        if (next.size >= WHATSAPP_LIMITS.MAX_DESTINATIONS_PER_CAMPAIGN) break
        const inGroup = (d.contactGroupIds ?? []).some(gid => String(gid) === contactGroupFilter)
        if (!inGroup) continue
        if (!isDestinationCampaignSelectable(d)) continue
        if (hasSelectedGroup && contactsNotInGroupIds.has(d._id)) continue
        next.add(d._id)
      }
      return next
    })
  }

  const toggleDest = (id: string) => {
    const dest = destinations.find(d => d._id === id)
    if (dest?.type === 'contact') {
      if (!isDestinationCampaignSelectable(dest)) return
      if (hasSelectedGroup && contactsNotInGroupIds.has(id)) return
    }
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        return next
      }
      if (next.size >= WHATSAPP_LIMITS.MAX_DESTINATIONS_PER_CAMPAIGN) return prev
      next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const d of filteredDest) {
        if (next.size >= WHATSAPP_LIMITS.MAX_DESTINATIONS_PER_CAMPAIGN) break
        if (d.type === 'contact') {
          if (!isDestinationCampaignSelectable(d)) continue
          if (hasSelectedGroup && contactsNotInGroupIds.has(d._id)) continue
        }
        next.add(d._id)
      }
      return next
    })
  }

  const selectAllInScope = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const listFilter =
        destinationScope === 'lists' || destinationScope === 'segments' ? selectedListId : null
      for (const d of destinations) {
        if (next.size >= WHATSAPP_LIMITS.MAX_DESTINATIONS_PER_CAMPAIGN) break
        if (destinationScope === 'contacts' && d.type !== 'contact') continue
        if (destinationScope === 'lists' && d.type !== 'contact') continue
        if (destinationScope === 'segments' && d.type !== 'contact') continue
        if (destinationScope === 'whatsapp_groups' && d.type !== 'group') continue
        if (listFilter) {
          if (destinationScope === 'segments') {
            if (!destinationMatchesSegmentFilter(d, listFilter)) continue
          } else {
            const inGroup = (d.contactGroupIds ?? []).some(gid => String(gid) === listFilter)
            if (!inGroup) continue
          }
        }
        if (contactGroupFilter !== 'all' && !listFilter && d.type === 'contact') {
          const inGroup = (d.contactGroupIds ?? []).some(gid => String(gid) === contactGroupFilter)
          if (!inGroup) continue
        }
        if (d.type === 'contact') {
          if (!isDestinationCampaignSelectable(d)) continue
          if (hasSelectedGroup && contactsNotInGroupIds.has(d._id)) continue
        }
        next.add(d._id)
      }
      return next
    })
  }

  const handleScopeChange = (scope: DestinationScope) => {
    setDestinationScope(scope)
    if (scope === 'lists') {
      const first = contactGroups[0]
      setSelectedListId(first?._id ?? null)
      setContactGroupFilter('all')
      return
    }
    if (scope === 'segments') {
      const first = segmentPickerItems[0]
      setSelectedListId(first?.id ?? null)
      setContactGroupFilter('all')
      return
    }
    setSelectedListId(null)
    if (scope === 'whatsapp_groups') setContactGroupFilter('all')
  }

  const handleRiskToggle = (enabled: boolean) => {
    setAcceptWhatsAppRisk(enabled)
    if (!enabled) {
      setRiskAcknowledged(false)
      setDelayBetweenMs(sendPolicy?.defaultProtectedDelayMs ?? CAMPAIGN_SAFE_DEFAULT_DELAY_MS)
    } else {
      setDelayBetweenMs(sendPolicy?.defaultRiskDelayMs ?? CAMPAIGN_RISK_DEFAULT_DELAY_MS)
    }
  }

  const importGroup = useMutation({
    mutationFn: (g: WAGroup) =>
      api.post('/destinations', { type: 'group', identifier: g.id, name: g.name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['destinations'] }),
    onError: mutationError,
  })

  const submit = useMutation({
    mutationFn: () => {
      if (scheduleMode) {
        const err = validateFutureSchedule(sendAtLocal)
        if (err) throw new Error(err)
      }

      const body: Record<string, unknown> = {
        title: title.trim() || undefined,
        message:
          messageMode === 'platform_template'
            ? previewText || ' '
            : message.trim(),
        destinationIds: Array.from(selectedIds),
        priority,
        delayBetweenMs: snapCampaignDelayMs(delayBetweenMs, acceptWhatsAppRisk, delayConfig),
        requireConnected,
        acceptWhatsAppRisk: acceptWhatsAppRisk && riskAcknowledged,
        messageMode,
        platformTemplateName:
          messageMode === 'platform_template' ? platformTemplateName : undefined,
        templateMensagem:
          messageMode === 'platform_template' ? templateMensagem.trim() : undefined,
      }
      if (scheduleMode) {
        body.sendAt = new Date(sendAtLocal).toISOString()
      }
      return api.post<{ ok: boolean; message?: string }>('/campaigns', body)
    },
    onSuccess: data => {
      setResult({ success: true, message: data?.message ?? 'Campanha criada com sucesso!' })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      qc.invalidateQueries({ queryKey: ['billing-me'] })
      if (!scheduleMode) {
        setMessage('')
        setSelectedIds(new Set())
      }
    },
    onError: (err: Error) =>
      setResult({ success: false, message: err.message ?? 'Erro ao enviar.' }),
  })

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Enviar agora"
        subtitle="Campanha manual para contatos ou grupos com preview WhatsApp."
        actions={
          <>
            <Link to="/send/historico">
              <Button variant="ghost" size="sm">
                <History size={14} /> Histórico
              </Button>
            </Link>
            <Link to="/send/agendamentos">
              <Button variant="ghost" size="sm">
                <Calendar size={14} /> Agendamentos
              </Button>
            </Link>
            <Link to="/platform/fila">
              <Button variant="ghost" size="sm">
                <ListOrdered size={14} /> Fila
              </Button>
            </Link>
          </>
        }
      />

      <div className="space-y-4">
      {!connected && (
        <Card className="flex items-start gap-3 border-amber-800/50 bg-amber-950/20">
          <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-200">WhatsApp desconectado</p>
            <p className="text-xs text-[var(--rz-text-muted)] mt-1">
              Reconecte para enviar agora. Agendamentos futuros podem ser criados e serão
              enviados quando o WhatsApp estiver online (se a opção estiver ativa).
            </p>
            <Link to="/sessions" className="text-xs text-brand-400 hover:underline mt-2 inline-block">
              Ir para Conexão WhatsApp
            </Link>
          </div>
        </Card>
      )}

      {connected && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 text-[var(--rz-text-muted)]">
            <Smartphone size={14} className="text-brand-500" />
            Sessão ativa:{' '}
            <Badge
              label={formatWaSessionLabel({
                phoneNumber: connected.phoneNumber,
                profileName: connected.profileName,
              })}
              variant="green"
            />
            {isBusiness && (
              <Badge label="Business" variant="blue" />
            )}
          </div>
          {billing && (
            <>
              <span className="text-[var(--rz-border)] hidden sm:inline">|</span>
              <span className="text-[var(--rz-text-muted)]">
                Plano <span className="text-white capitalize font-medium">{billing.plan}</span>
                {' · '}
                {billing.usage.messagesUsed}
                {!isUnlimited(billing.limits.messagesPerDay) && (
                  <>/{billing.limits.messagesPerDay}</>
                )}{' '}
                msgs hoje
              </span>
              <span className="text-[var(--rz-text-muted)]">
                · {destinations.length}
                {!isUnlimited(billing.limits.groupsMax) && `/${billing.limits.groupsMax}`} destinos
              </span>
            </>
          )}
        </div>
      )}

      {!connected && billing && (
        <Card className="border-[var(--rz-border)] bg-[var(--rz-surface)]/50 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--rz-text-muted)]">
            <span>
              Plano <span className="text-white capitalize font-medium">{billing.plan}</span>
            </span>
            <span>
              Mensagens hoje:{' '}
              <span className={remainingToday === 0 ? 'text-amber-400' : 'text-brand-400'}>
                {billing.usage.messagesUsed}
                {!isUnlimited(billing.limits.messagesPerDay) && (
                  <> / {billing.limits.messagesPerDay}</>
                )}
              </span>
            </span>
          </div>
        </Card>
      )}

      {remainingToday === 0 && billing && !isUnlimited(billing.limits.messagesPerDay) && (
        <p className="text-[11px] text-amber-500/90 px-1">
          Limite diário atingido. Aguarde a renovação ou faça upgrade em Planos.
        </p>
      )}

      <div className="flex flex-col xl:flex-row gap-6 xl:items-start">
          <div className="flex-1 min-w-0 space-y-4">
            <Card>
              <h2 className="text-sm font-medium text-[var(--rz-text-secondary)] mb-3">1. Destinatários</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                {(
                  [
                    ['contacts', 'Contatos'],
                    ['lists', 'Listas'],
                    ['segments', 'Segmentos'],
                    ['whatsapp_groups', 'Grupos WA'],
                    ['both', 'Todos'],
                  ] as const
                ).map(([scope, label]) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => handleScopeChange(scope)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      destinationScope === scope
                        ? 'border-brand-500 bg-brand-950/40 text-brand-200'
                        : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-[var(--rz-border)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {destinationScope === 'lists' && (
                <div className="mb-3">
                  {contactGroups.length === 0 ? (
                    <p className="text-xs text-[var(--rz-text-muted)]">
                      Nenhuma lista criada.{' '}
                      <Link to="/platform/segmentos" className="text-brand-400 hover:underline">
                        Criar em Listas e segmentos
                      </Link>
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {contactGroups.map(g => (
                        <button
                          key={g._id}
                          type="button"
                          onClick={() => setSelectedListId(g._id)}
                          className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                            selectedListId === g._id
                              ? 'border-brand-500 bg-brand-950/40 text-brand-200'
                              : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-[var(--rz-border)]'
                          }`}
                        >
                          {g.name} ({g.memberCount})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {destinationScope === 'segments' && (
                <div className="mb-3">
                  {segmentPickerItems.length === 0 ? (
                    <p className="text-xs text-[var(--rz-text-muted)]">
                      Nenhum segmento com membros.{' '}
                      <Link to="/platform/segmentos?tab=smart" className="text-brand-400 hover:underline">
                        Ver segmentos dinâmicos
                      </Link>
                      {' · '}
                      <Link to="/platform/segmentos" className="text-brand-400 hover:underline">
                        Gerenciar listas
                      </Link>
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {segmentPickerItems.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          title={s.description}
                          onClick={() => setSelectedListId(s.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                            selectedListId === s.id
                              ? 'border-brand-500 bg-brand-950/40 text-brand-200'
                              : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-[var(--rz-border)]'
                          }`}
                        >
                          {s.name} ({s.count} {s.hint})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-3 p-3 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/25">
                <p className="text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)] mb-2">
                  Público da campanha
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['recommended', 'Opt-in aceito'],
                      ['leads_opt_in', 'Leads opt-in'],
                      ['clients_active', 'Clientes ativos'],
                      ['all', 'Ver todos'],
                      ['review_blocked', 'Bloqueados'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setAudienceMode(mode)
                        if (mode === 'recommended') setOnlySendable(true)
                        if (mode === 'all' || mode === 'review_blocked') setOnlySendable(false)
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                        audienceMode === mode
                          ? 'border-brand-500 bg-brand-950/40 text-brand-200'
                          : 'border-[var(--rz-border)] text-[var(--rz-text-muted)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--rz-text-muted)] mt-2 leading-relaxed">
                  Não pode enviar: opt-out, bloqueado, sem consentimento, telefone inválido/duplicado,
                  interno ou parceiro. O motivo aparece na coluna <strong className="text-[var(--rz-text-secondary)]">Risco</strong>.
                </p>
              </div>

              <div className="relative mb-3">
                <Search size={14} className={searchFieldIconCls} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar nome ou número..."
                  className={`${inputCls} pl-9 w-full`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={selectAllInScope}
                  disabled={sendableInScopeCount === 0}
                >
                  Selecionar todos aceitos ({sendableInScopeCount})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={selectedIds.size === 0}
                >
                  Limpar
                </Button>
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(v => !v)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)]"
                >
                  {showAdvancedFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  Filtros
                  {(contactGroupFilter !== 'all' || !onlySendable) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                  )}
                </button>
              </div>

              {showAdvancedFilters && (
                <div className="flex flex-wrap items-center gap-2 mb-3 p-3 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/30">
                  {destinationScope !== 'whatsapp_groups' &&
                    destinationScope !== 'lists' &&
                    destinationScope !== 'segments' && (
                    <select
                      value={contactGroupFilter}
                      onChange={e => setContactGroupFilter(e.target.value)}
                      className="bg-[var(--rz-surface-muted)] border border-[var(--rz-border)] rounded-lg px-3 py-2 text-sm text-[var(--rz-text-primary)] min-w-[160px]"
                      title="Filtrar por grupo de contatos"
                    >
                      <option value="all">Grupo de contatos: todos</option>
                      {contactGroups.map(g => (
                        <option key={g._id} value={g._id}>
                          {g.name} ({g.memberCount})
                        </option>
                      ))}
                    </select>
                  )}
                  {destinationScope !== 'whatsapp_groups' && (
                    <button
                      type="button"
                      onClick={() => setOnlySendable(v => !v)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        onlySendable
                          ? 'border-brand-500/60 bg-brand-950/30 text-brand-200'
                          : 'border-[var(--rz-border)] text-[var(--rz-text-muted)]'
                      }`}
                      title="Ocultar contatos sem consentimento para envio"
                    >
                      <Filter size={12} />
                      Só enviáveis na lista
                    </button>
                  )}
                  {filteredDest.length > 0 && filteredDest.length < sendableInScopeCount && (
                    <Button variant="ghost" size="sm" onClick={selectAllFiltered}>
                      Marcar {filteredDest.length} da busca
                    </Button>
                  )}
                  {contactGroupFilter !== 'all' && destinationScope !== 'whatsapp_groups' && (
                    <Button variant="ghost" size="sm" onClick={selectContactGroup}>
                      Marcar grupo inteiro
                    </Button>
                  )}
                </div>
              )}

              <p className="text-xs text-[var(--rz-text-muted)] mb-2">
                <span className="text-[var(--rz-text-secondary)] font-medium">
                  {selectionStats.total} selecionado(s)
                </span>
                {selectionStats.total > 0 && (
                  <span>
                    {' '}
                    · {selectionStats.contacts} contato(s) · {selectionStats.groups} grupo(s)
                  </span>
                )}
                {filteredDest.length !== sendableInScopeCount && search.trim() && (
                  <span> · {filteredDest.length} na busca</span>
                )}
                {selectedIds.size > 1 && !acceptWhatsAppRisk && (
                  <span className="text-brand-400/90">
                    {' '}
                    · 1 destino por vez · ~{formatDuration(durationEst)} para concluir
                  </span>
                )}
              </p>
              {planQuotaExceeded && billing && (
                <p className="text-[11px] text-amber-500/90 mb-2">
                  Cota do plano: {remainingToday} msg restante(s) hoje — o excedente pausa e retoma
                  amanhã automaticamente.
                </p>
              )}
              {groupMembershipError && (
                <p className="text-[11px] text-red-400/95 mb-2 flex items-start gap-1.5">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  {validatingGroups ? 'Verificando grupo…' : groupMembershipError}
                </p>
              )}

              <div className="mb-2">
                {(destinationScope === 'lists' || destinationScope === 'segments') &&
                !selectedListId ? (
                  <p className="text-xs text-[var(--rz-text-muted)] text-center py-6 border border-[var(--rz-border)] rounded-lg">
                    Escolha uma {destinationScope === 'lists' ? 'lista' : 'segmento'} acima.
                  </p>
                ) : filteredDest.length === 0 ? (
                  <p className="text-xs text-[var(--rz-text-muted)] text-center py-6 border border-[var(--rz-border)] rounded-lg">
                    Nenhum destino.{' '}
                    <Link to="/contact" className="text-brand-400 hover:underline">
                      Cadastrar destinos
                    </Link>
                  </p>
                ) : (
                  <SendRecipientsTable
                    rows={filteredDest}
                    selectedIds={selectedIds}
                    groupNameById={groupNameById}
                    contactGroupIdsByDest={contactGroupIdsByDest}
                    onToggle={toggleDest}
                    isBlocked={d => {
                      if (d.type === 'contact') {
                        if (!isDestinationCampaignSelectable(d as Destination)) return true
                        if (hasSelectedGroup && contactsNotInGroupIds.has(d._id)) return true
                      }
                      return false
                    }}
                    rowError={d => {
                      if (
                        d.type === 'group' &&
                        selectedIds.has(d._id) &&
                        !validatingGroups &&
                        selectedGroupIdsWithError.has(d._id)
                      ) {
                        return GROUP_INLINE_ERROR
                      }
                      if (
                        hasSelectedGroup &&
                        d.type === 'contact' &&
                        contactsNotInGroupIds.has(d._id) &&
                        selectedIds.has(d._id)
                      ) {
                        return GROUP_INLINE_ERROR
                      }
                      if (d.type === 'group' && selectedIds.has(d._id) && validatingGroups) {
                        return 'Verificando grupo…'
                      }
                      return null
                    }}
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowGroups(v => !v)}
                className="text-xs text-brand-400 hover:underline mt-3 flex items-center gap-1"
              >
                <Plus size={12} />
                {showGroups ? 'Ocultar grupos do WhatsApp' : 'Importar grupos do WhatsApp'}
              </button>

              {showGroups && (
                <div className="mt-3 border border-[var(--rz-border)] rounded-lg p-3 space-y-2">
                  {!connected ? (
                    <p className="text-xs text-[var(--rz-text-muted)]">Conecte o WhatsApp para listar grupos.</p>
                  ) : loadingGroups ? (
                    <div className="flex justify-center py-4">
                      <Spinner size={20} />
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[var(--rz-text-muted)]">{waGroups.length} grupos na sessão</span>
                        <button
                          type="button"
                          onClick={() => refetchGroups()}
                          className="text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)]"
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1">
                        {waGroups.map(g => {
                          const exists = destinations.some(d => d.identifier === g.id)
                          return (
                            <div
                              key={g.id}
                              className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-[var(--rz-surface-muted)]/50"
                            >
                              <span className="truncate">{g.name}</span>
                              {exists ? (
                                <span className="text-[var(--rz-text-muted)] shrink-0">Já cadastrado</span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={importGroup.isPending}
                                  onClick={() => importGroup.mutate(g)}
                                  className="text-brand-400 hover:underline shrink-0"
                                >
                                  Adicionar
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-sm font-medium text-[var(--rz-text-secondary)] mb-3">2. Mensagem</h2>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Título interno (opcional)</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ex: Promoção março"
                    maxLength={WHATSAPP_LIMITS.MAX_CAMPAIGN_TITLE_LENGTH}
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMessageMode('plain')}
                    className={`flex-1 py-2 rounded-lg text-xs border ${
                      messageMode === 'plain'
                        ? 'border-brand-500 bg-brand-600/20 text-white'
                        : 'border-[var(--rz-border)] text-[var(--rz-text-muted)]'
                    }`}
                  >
                    Texto livre
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageMode('platform_template')}
                    className={`flex-1 py-2 rounded-lg text-xs border ${
                      messageMode === 'platform_template'
                        ? 'border-brand-500 bg-brand-600/20 text-white'
                        : 'border-[var(--rz-border)] text-[var(--rz-text-muted)]'
                    }`}
                  >
                    <FileText size={12} className="inline mr-1" />
                    Modelo Plataforma (pw-*)
                  </button>
                </div>
                <p className="text-[10px] text-[var(--rz-text-muted)]">
                  Modelos Discord (dw-*) ficam na aba Discord → Formatos. Aqui só catálogo
                  plataforma para envio manual e agendado.
                </p>
                {messageMode === 'platform_template' ? (
                  <>
                    <div>
                      <label className={labelCls}>Modelo pw-*</label>
                      <select
                        value={platformTemplateName}
                        onChange={e => setPlatformTemplateName(e.target.value)}
                        className={inputCls}
                      >
                        {platformTemplates.map(t => (
                          <option key={t._id} value={t.name}>
                            {t.label ?? t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <WhatsAppTextEditor
                        label={
                          <label className={labelCls}>
                            Texto extra ({'{mensagem}'}) — opcional
                          </label>
                        }
                        value={templateMensagem}
                        onChange={setTemplateMensagem}
                        rows={2}
                        showHint={false}
                        placeholder="Complemento inserido no modelo..."
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--rz-text-muted)]">
                      <Eye size={12} />
                      Pré-visualização
                      {firstSelectedDestId ? (
                        <span className="text-brand-400/80">(1º destino selecionado)</span>
                      ) : (
                        <span>(amostra — selecione um contato para personalizar)</span>
                      )}
                    </div>
                    {previewLoading ? (
                      <div className="flex justify-center py-4">
                        <Spinner size={20} />
                      </div>
                    ) : (
                      <WhatsAppPreviewBubble text={previewText} />
                    )}
                    <Link
                      to="/platform/templates"
                      className="text-xs text-brand-400 hover:underline"
                    >
                      Editar modelos em Plataforma → Modelos
                    </Link>
                  </>
                ) : (
                  <div>
                    <WhatsAppTextEditor
                      label={<label className={labelCls}>Texto da mensagem *</label>}
                      value={message}
                      onChange={setMessage}
                      rows={5}
                      maxLength={WHATSAPP_LIMITS.MAX_MESSAGE_LENGTH}
                      placeholder="Digite a mensagem que será enviada no WhatsApp..."
                      showPreview
                      className={messageTooLong ? '[&_textarea]:border-amber-600' : ''}
                    />
                    {messageTooLong && (
                      <p className="text-[11px] mt-1 text-right text-amber-400">
                        Mensagem acima do limite recomendado
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <h2 className="text-sm font-medium text-[var(--rz-text-secondary)] mb-3">3. Proteção e opções</h2>
              <div className="space-y-4">
                {sendPolicy && (
                  <Card className="border border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/25 p-3 space-y-1.5 text-[11px]">
                    <p className="font-medium text-[var(--rz-text-secondary)]">
                      Hierarquia de limites (admin → empresa → envio)
                    </p>
                    <ul className="text-[var(--rz-text-muted)] space-y-1">
                      <li>
                        <strong className="text-[var(--rz-text-muted)]">Admin:</strong> teto marketing{' '}
                        {sendPolicy.system.marketingCapMaxPerMinute}/min · padrão{' '}
                        {sendPolicy.system.marketingDefaultMaxPerMinute}/min
                      </li>
                      <li>
                        <strong className="text-[var(--rz-text-muted)]">Empresa:</strong>{' '}
                        {sendPolicy.org.limitsDisabled
                          ? 'limites por minuto desativados na org'
                          : `marketing ${sendPolicy.org.marketingMaxPerMinute}/min`}
                        {sendPolicy.org.humanizeEnabled ? ' · humanizado' : ''}
                      </li>
                      <li>
                        <strong className="text-[var(--rz-text-muted)]">Efetivo agora:</strong>{' '}
                        {marketingPerMinute != null
                          ? `${marketingPerMinute} msg/min · 1 destino/ciclo · jitter no intervalo`
                          : 'sem teto por minuto (limites desativados)'}
                      </li>
                    </ul>
                    {!sendPolicy.canDisableProtection && (
                      <p className="text-[10px] text-amber-500/90">
                        Proteção anti-ban obrigatória para seu perfil. O dono pode liberar desativação em{' '}
                        <Link to="/platform/wa-limits" className="text-brand-400 hover:underline">
                          Limites de envio
                        </Link>
                        .
                      </p>
                    )}
                  </Card>
                )}

                <Card className={`border ${acceptWhatsAppRisk ? 'border-red-800/60 bg-red-950/20' : 'border-[var(--rz-border)] bg-[var(--rz-surface)]/40'}`}>
                  <div className="flex items-start gap-3">
                    <ShieldAlert
                      size={18}
                      className={acceptWhatsAppRisk ? 'text-red-400 shrink-0' : 'text-amber-400 shrink-0'}
                    />
                    <div className="space-y-3 flex-1">
                      <div>
                        <p className="text-sm font-medium text-[var(--rz-text-primary)]">
                          Proteção anti-banimento do WhatsApp
                        </p>
                        <p className="text-xs text-[var(--rz-text-muted)] mt-1 leading-relaxed">
                          {acceptWhatsAppRisk
                            ? 'Proteção DESATIVADA. Envios ignoram a fila humanizada e os limites por minuto — risco alto de banimento.'
                            : `Ativa por padrão. Uma mensagem por vez com intervalo variável (${
                                campaignDelayOptionLabel(delayBetweenMs, false, delayConfig).split('—')[0]?.trim() ??
                                `${delayBetweenMs / 1000}s`
                              }) e teto marketing${
                                marketingPerMinute != null ? ` (${marketingPerMinute} msg/min)` : ''
                              }${
                                sendPolicy?.effective.humanizeEnabled ? ' com digitação simulada' : ''
                              }. Ajuste em `}
                          {!acceptWhatsAppRisk && (
                            <Link to="/platform/wa-limits" className="text-brand-400 hover:underline">
                              Limites de envio
                            </Link>
                          )}
                          {!acceptWhatsAppRisk && ' (empresa) ou admin em Configurações.'}
                        </p>
                      </div>
                      {sendPolicy?.canDisableProtection ? (
                        <label className="flex items-start gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={acceptWhatsAppRisk}
                            onChange={e => handleRiskToggle(e.target.checked)}
                            className="mt-0.5 rounded border-[var(--rz-border)]"
                          />
                          <span className={acceptWhatsAppRisk ? 'text-red-300' : 'text-[var(--rz-text-muted)]'}>
                            Desativar proteção e aceitar risco de banimento da conta WhatsApp
                          </span>
                        </label>
                      ) : null}
                      {acceptWhatsAppRisk && sendPolicy?.canDisableProtection && (
                        <label className="flex items-start gap-2 text-xs text-red-200/90 cursor-pointer pl-6 border-l-2 border-red-800">
                          <input
                            type="checkbox"
                            checked={riskAcknowledged}
                            onChange={e => setRiskAcknowledged(e.target.checked)}
                            className="mt-0.5 rounded border-red-700"
                          />
                          <span>
                            Tenho ciência de que o RadarZap não se responsabiliza e que minha
                            conta WhatsApp pode ser <strong>banida ou perdida</strong> se eu
                            continuar.
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                </Card>

                {selectedIds.size > 1 && !acceptWhatsAppRisk && (
                  <p className="text-xs text-brand-400/90 flex items-start gap-1.5">
                    <Clock size={12} className="shrink-0 mt-0.5" />
                    {selectedIds.size} destinos serão entregues em fila segura (~
                    {formatDuration(durationEst)}). Você pode acompanhar em Agendamentos.
                  </p>
                )}

                <label className="flex items-start gap-2 text-sm text-[var(--rz-text-muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireConnected}
                    onChange={e => setRequireConnected(e.target.checked)}
                    className="mt-0.5 rounded border-[var(--rz-border)]"
                  />
                  <span>
                    Só enviar se o WhatsApp estiver conectado no horário programado
                    <span className="block text-xs text-[var(--rz-text-muted)] mt-0.5">
                      Recomendado para agendamentos — evita falha se o servidor reiniciar.
                    </span>
                  </span>
                </label>
              </div>
            </Card>
          </div>

          <SendCampaignSummary
              selectedTotal={selectionStats.total}
              selectedContacts={selectionStats.contacts}
              selectedGroups={selectionStats.groups}
              scheduleMode={scheduleMode}
              onScheduleModeChange={setScheduleMode}
              sendAtLocal={sendAtLocal}
              onSendAtLocalChange={v => setSendAtLocal(clampDatetimeLocal(v, minSendAtLocal))}
              minSendAtLocal={minSendAtLocal}
              priority={priority}
              onPriorityChange={setPriority}
              delayMs={delayBetweenMs}
              onDelayMsChange={setDelayBetweenMs}
              delayOptions={delayOptions}
              durationEst={durationEst}
              delayConfig={delayConfig}
              acceptWhatsAppRisk={acceptWhatsAppRisk}
              riskAcknowledged={riskAcknowledged}
              marketingPerMinute={marketingPerMinute}
              humanizeEnabled={sendPolicy?.effective.humanizeEnabled}
              policyJitterHint={sendPolicy?.delayJitterHint}
              billingLine={
                billing && !isUnlimited(billing.limits.messagesPerDay)
                  ? `${billing.usage.messagesUsed}/${billing.limits.messagesPerDay} usadas`
                  : undefined
              }
              previewText={sidebarPreviewText}
              showPreview={messageMode === 'plain' || messageMode === 'platform_template'}
              blockers={submitBlockers}
              canSubmit={submitBlockers.length === 0}
              isPending={submit.isPending}
              onSubmit={() => {
                setResult(null)
                submit.mutate()
              }}
              result={result}
            />
        </div>
      </div>
    </RadarPageShell>
  )
}
