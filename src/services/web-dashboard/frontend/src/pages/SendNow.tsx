import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import {
  WHATSAPP_LIMITS,
  ALLOWED_SAFE_CAMPAIGN_DELAYS_MS,
  ALLOWED_RISK_CAMPAIGN_DELAYS_MS,
  estimateCampaignDurationMs,
  estimateBatchCount,
  formatDuration,
  isUnlimited,
  exceedsPlanQuota,
  remainingDailyMessages,
  effectiveSafeBatchSize,
} from '../lib/limits'
import {
  ConsentDot,
  CONSENT_STATUS_META,
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
  CheckCircle,
  XCircle,
  Smartphone,
  AlertCircle,
  Calendar,
  Clock,
  Users,
  Hash,
  Search,
  Plus,
  RefreshCw,
  ShieldAlert,
  FileText,
  Eye,
} from 'lucide-react'
import { WhatsAppPreviewBubble } from '../components/platform/WhatsAppPreviewBubble'

interface Destination {
  _id: string
  name: string
  identifier: string
  type: 'contact' | 'group'
  contactGroupIds?: string[]
  consentStatus?: ConsentStatus
  consent?: { granted?: boolean }
  pendingOutboundCount?: number
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

type Priority = 'high' | 'medium' | 'low'
type MessageMode = 'plain' | 'platform_template'

interface PlatformTemplateOption {
  _id: string
  name: string
  label?: string
  platformKind?: string
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'

const MIN_DELAY_MS = WHATSAPP_LIMITS.MIN_DELAY_BETWEEN_MS

interface BillingMe {
  plan: string
  limits: { messagesPerDay: number; groupsMax: number; templatesMax: number }
  usage: { messagesUsed: number }
}

const labelCls = 'text-xs text-gray-500 mb-1 block'

function defaultScheduleLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30)
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function SendNow() {
  const qc = useQueryClient()

  const [title, setTitle] = useState('')
  const [messageMode, setMessageMode] = useState<MessageMode>('plain')
  const [platformTemplateName, setPlatformTemplateName] = useState('pw-padrao')
  const [templateMensagem, setTemplateMensagem] = useState('')
  const [message, setMessage] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [destinationScope, setDestinationScope] = useState<
    'contacts' | 'whatsapp_groups' | 'both'
  >('both')
  const [contactGroupFilter, setContactGroupFilter] = useState<string>('all')
  const [priority, setPriority] = useState<Priority>('medium')
  const [delayBetweenMs, setDelayBetweenMs] = useState<number>(MIN_DELAY_MS)
  const [requireConnected, setRequireConnected] = useState(true)
  const [scheduleMode, setScheduleMode] = useState(false)
  const [sendAtLocal, setSendAtLocal] = useState(defaultScheduleLocal)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [acceptWhatsAppRisk, setAcceptWhatsAppRisk] = useState(false)
  const [riskAcknowledged, setRiskAcknowledged] = useState(false)
  const [showGroups, setShowGroups] = useState(false)

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
  const delayOptions = acceptWhatsAppRisk
    ? ALLOWED_RISK_CAMPAIGN_DELAYS_MS
    : ALLOWED_SAFE_CAMPAIGN_DELAYS_MS
  const minDelay = acceptWhatsAppRisk
    ? WHATSAPP_LIMITS.RISK_MIN_DELAY_BETWEEN_MS
    : WHATSAPP_LIMITS.MIN_DELAY_BETWEEN_MS

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

  const { data: contactGroups = [] } = useQuery<ContactGroupOption[]>({
    queryKey: ['contact-groups'],
    queryFn: () => api.get('/contact-groups'),
  })

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
    refetchInterval: 10_000,
  })

  const connected = sessions.find(s => s.status === 'connected')
  const isBusiness = connected?.waAccountType === 'business'
  const safeBatch = effectiveSafeBatchSize(isBusiness)

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

  const durationEst = estimateCampaignDurationMs(
    selectedIds.size,
    delayBetweenMs,
    acceptWhatsAppRisk,
    isBusiness,
  )
  const batchCount = estimateBatchCount(selectedIds.size, acceptWhatsAppRisk, isBusiness)
  const usesSafeQueue =
    !acceptWhatsAppRisk && selectedIds.size > safeBatch

  const { data: waGroups = [], isLoading: loadingGroups, refetch: refetchGroups } = useQuery<WAGroup[]>({
    queryKey: ['wa-groups', connected?.clientId],
    queryFn: () =>
      connected ? api.get(`/sessions/${connected.clientId}/groups`) : Promise.resolve([]),
    enabled: showGroups && !!connected,
  })

  const filteredDest = useMemo(() => {
    const q = search.trim().toLowerCase()
    return destinations.filter(d => {
      if (destinationScope === 'contacts' && d.type !== 'contact') return false
      if (destinationScope === 'whatsapp_groups' && d.type !== 'group') return false
      if (contactGroupFilter !== 'all') {
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
  }, [destinations, search, destinationScope, contactGroupFilter])

  const selectContactGroup = () => {
    if (contactGroupFilter === 'all') return
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const d of destinations) {
        if (d.type !== 'contact') continue
        if (next.size >= WHATSAPP_LIMITS.MAX_DESTINATIONS_PER_CAMPAIGN) break
        const inGroup = (d.contactGroupIds ?? []).some(gid => String(gid) === contactGroupFilter)
        if (!inGroup) continue
        const st = effectiveConsentStatus(d.consentStatus, d.consent?.granted)
        if (!canSelectForSend(st, d.pendingOutboundCount ?? 0)) continue
        if (hasSelectedGroup && contactsNotInGroupIds.has(d._id)) continue
        next.add(d._id)
      }
      return next
    })
  }

  const selectAllWaGroups = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const d of filteredDest) {
        if (d.type !== 'group') continue
        if (next.size >= WHATSAPP_LIMITS.MAX_DESTINATIONS_PER_CAMPAIGN) break
        next.add(d._id)
      }
      return next
    })
  }

  const toggleDest = (id: string) => {
    const dest = destinations.find(d => d._id === id)
    if (dest?.type === 'contact') {
      const st = effectiveConsentStatus(dest.consentStatus, dest.consent?.granted)
      if (!canSelectForSend(st, dest.pendingOutboundCount ?? 0)) return
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
          const st = effectiveConsentStatus(d.consentStatus, d.consent?.granted)
          if (!canSelectForSend(st, d.pendingOutboundCount ?? 0)) continue
          if (hasSelectedGroup && contactsNotInGroupIds.has(d._id)) continue
        }
        next.add(d._id)
      }
      return next
    })
  }

  const handleRiskToggle = (enabled: boolean) => {
    setAcceptWhatsAppRisk(enabled)
    if (!enabled) {
      setRiskAcknowledged(false)
      if (delayBetweenMs < WHATSAPP_LIMITS.MIN_DELAY_BETWEEN_MS) {
        setDelayBetweenMs(WHATSAPP_LIMITS.MIN_DELAY_BETWEEN_MS)
      }
    } else if (delayBetweenMs < WHATSAPP_LIMITS.RISK_MIN_DELAY_BETWEEN_MS) {
      setDelayBetweenMs(WHATSAPP_LIMITS.RISK_MIN_DELAY_BETWEEN_MS)
    }
  }

  const importGroup = useMutation({
    mutationFn: (g: WAGroup) =>
      api.post('/destinations', { type: 'group', identifier: g.id, name: g.name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['destinations'] }),
    onError: (err: Error) => alert(err.message),
  })

  const submit = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        title: title.trim() || undefined,
        message:
          messageMode === 'platform_template'
            ? previewText || ' '
            : message.trim(),
        destinationIds: Array.from(selectedIds),
        priority,
        delayBetweenMs: Math.max(minDelay, delayBetweenMs),
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
    <div className="max-w-4xl space-y-4">
      {!connected && (
        <Card className="flex items-start gap-3 border-amber-800/50 bg-amber-950/20">
          <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-200">WhatsApp desconectado</p>
            <p className="text-xs text-gray-500 mt-1">
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
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Smartphone size={14} className="text-brand-500" />
          Sessão ativa:{' '}
          <Badge
            label={formatWaSessionLabel({
              phoneNumber: connected.phoneNumber,
              profileName: connected.profileName,
            })}
            variant="green"
          />
        </div>
      )}

      {billing && (
        <Card className="border-gray-800 bg-gray-900/50 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-gray-400">
              Plano <span className="text-white capitalize font-medium">{billing.plan}</span>
              {' · '}
              Destinos cadastrados:{' '}
              <span className="text-white">{destinations.length}</span>
              {!isUnlimited(billing.limits.groupsMax) && (
                <span className="text-gray-500"> / {billing.limits.groupsMax}</span>
              )}
            </div>
            <div className="text-gray-400">
              Mensagens hoje:{' '}
              <span className={remainingToday === 0 ? 'text-amber-400' : 'text-brand-400'}>
                {billing.usage.messagesUsed}
                {!isUnlimited(billing.limits.messagesPerDay) && (
                  <> / {billing.limits.messagesPerDay}</>
                )}
              </span>
              {isUnlimited(billing.limits.messagesPerDay) && (
                <span className="text-gray-500"> (ilimitado)</span>
              )}
            </div>
          </div>
          {remainingToday === 0 && !isUnlimited(billing.limits.messagesPerDay) && (
            <p className="text-[11px] text-amber-500/90 mt-2">
              Limite diário atingido. Aguarde a renovação ou faça upgrade em Planos.
            </p>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <h2 className="text-sm font-medium text-gray-300 mb-3">1. Destinatários</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                {(
                  [
                    ['contacts', 'Contatos'],
                    ['whatsapp_groups', 'Grupos WA'],
                    ['both', 'Ambos'],
                  ] as const
                ).map(([scope, label]) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => {
                      setDestinationScope(scope)
                      if (scope === 'whatsapp_groups') setContactGroupFilter('all')
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      destinationScope === scope
                        ? 'border-brand-500 bg-brand-950/40 text-brand-200'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <div className="relative flex-1 min-w-[140px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar nome ou número..."
                    className={`${inputCls} pl-9`}
                  />
                </div>
                {destinationScope !== 'whatsapp_groups' && (
                  <select
                    value={contactGroupFilter}
                    onChange={e => setContactGroupFilter(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 max-w-[180px]"
                    title="Filtrar por grupo de contatos"
                  >
                    <option value="all">Grupo contato: todos</option>
                    {contactGroups.map(g => (
                      <option key={g._id} value={g._id}>
                        {g.name} ({g.memberCount})
                      </option>
                    ))}
                  </select>
                )}
                {contactGroupFilter !== 'all' && destinationScope !== 'whatsapp_groups' && (
                  <Button variant="ghost" size="sm" onClick={selectContactGroup}>
                    Marcar grupo
                  </Button>
                )}
                {destinationScope !== 'contacts' && (
                  <Button variant="ghost" size="sm" onClick={selectAllWaGroups}>
                    Marcar grupos WA
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={selectAllFiltered}>
                  Marcar visíveis
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Limpar
                </Button>
              </div>

              <p className="text-xs text-gray-500 mb-2">
                {selectedIds.size} selecionado(s)
                {selectedIds.size > safeBatch && !acceptWhatsAppRisk && (
                  <span className="text-brand-400/90"> · fila segura ({batchCount} lotes)</span>
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

              <div className="max-h-52 overflow-y-auto space-y-1 border border-gray-800 rounded-lg p-2">
                {filteredDest.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">
                    Nenhum destino.{' '}
                    <Link to="/contact" className="text-brand-400 hover:underline">
                      Cadastrar destinos
                    </Link>
                  </p>
                ) : (
                  filteredDest.map(d => {
                    const consentSt =
                      d.type === 'contact'
                        ? effectiveConsentStatus(d.consentStatus, d.consent?.granted)
                        : null
                    const blocked = consentSt != null && !canSelectForSend(consentSt, d.pendingOutboundCount ?? 0)
                    const contactNotInGroup =
                      hasSelectedGroup &&
                      d.type === 'contact' &&
                      contactsNotInGroupIds.has(d._id)
                    const groupNotInGroup =
                      d.type === 'group' &&
                      selectedIds.has(d._id) &&
                      !validatingGroups &&
                      selectedGroupIdsWithError.has(d._id)
                    const groupValidating =
                      d.type === 'group' && selectedIds.has(d._id) && validatingGroups
                    const blockedForGroup = contactNotInGroup && selectedIds.has(d._id)
                    return (
                    <label
                      key={d._id}
                      className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${
                        blocked || blockedForGroup
                          ? 'opacity-50 cursor-not-allowed'
                          : selectedIds.has(d._id)
                            ? groupNotInGroup
                              ? 'bg-red-950/20 border border-red-800/40 cursor-pointer'
                              : 'bg-brand-600/15 border border-brand-600/30 cursor-pointer'
                            : 'hover:bg-gray-800 cursor-pointer'
                      }`}
                      style={
                        consentSt
                          ? { borderLeft: `3px solid ${CONSENT_STATUS_META[consentSt].color}` }
                          : undefined
                      }
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d._id)}
                        disabled={blocked || blockedForGroup}
                        onChange={() => toggleDest(d._id)}
                        className="rounded border-gray-600"
                      />
                      {consentSt && <ConsentDot status={consentSt} />}
                      {d.type === 'group' ? (
                        <Hash size={14} className="text-brand-500 shrink-0" />
                      ) : (
                        <Users size={14} className="text-blue-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{d.name}</p>
                        <p className="text-[11px] text-gray-500 font-mono truncate">{d.identifier}</p>
                        {groupValidating && (
                          <p className="text-[10px] text-gray-500 mt-0.5">Verificando grupo…</p>
                        )}
                        {groupNotInGroup && (
                          <p className="text-[10px] text-red-400 mt-0.5">{GROUP_INLINE_ERROR}</p>
                        )}
                        {contactNotInGroup && (
                          <p className="text-[10px] text-red-400 mt-0.5">{GROUP_INLINE_ERROR}</p>
                        )}
                      </div>
                      <Badge label={d.type === 'group' ? 'grupo' : 'contato'} variant={d.type === 'group' ? 'green' : 'blue'} />
                    </label>
                    )
                  })
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
                <div className="mt-3 border border-gray-800 rounded-lg p-3 space-y-2">
                  {!connected ? (
                    <p className="text-xs text-gray-500">Conecte o WhatsApp para listar grupos.</p>
                  ) : loadingGroups ? (
                    <div className="flex justify-center py-4">
                      <Spinner size={20} />
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">{waGroups.length} grupos na sessão</span>
                        <button
                          type="button"
                          onClick={() => refetchGroups()}
                          className="text-gray-500 hover:text-white"
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
                              className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded bg-gray-800/50"
                            >
                              <span className="truncate">{g.name}</span>
                              {exists ? (
                                <span className="text-gray-600 shrink-0">Já cadastrado</span>
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
              <h2 className="text-sm font-medium text-gray-300 mb-3">2. Mensagem</h2>
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
                        : 'border-gray-700 text-gray-400'
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
                        : 'border-gray-700 text-gray-400'
                    }`}
                  >
                    <FileText size={12} className="inline mr-1" />
                    Modelo Plataforma (pw-*)
                  </button>
                </div>
                <p className="text-[10px] text-gray-600">
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
                      <label className={labelCls}>
                        Texto extra ({'{mensagem}'}) — opcional
                      </label>
                      <textarea
                        value={templateMensagem}
                        onChange={e => setTemplateMensagem(e.target.value)}
                        rows={2}
                        placeholder="Complemento inserido no modelo..."
                        className={`${inputCls} resize-none`}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
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
                    <label className={labelCls}>Texto da mensagem *</label>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      rows={5}
                      maxLength={WHATSAPP_LIMITS.MAX_MESSAGE_LENGTH}
                      placeholder="Digite a mensagem que será enviada no WhatsApp..."
                      className={`${inputCls} resize-none ${messageTooLong ? 'border-amber-600' : ''}`}
                    />
                    <p className={`text-[11px] mt-1 text-right ${messageTooLong ? 'text-amber-400' : 'text-gray-600'}`}>
                      {message.length} / {WHATSAPP_LIMITS.MAX_MESSAGE_LENGTH}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <h2 className="text-sm font-medium text-gray-300 mb-3">3. Quando e como enviar</h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleMode(false)}
                    className={`flex-1 py-2.5 rounded-lg text-sm border transition-colors ${
                      !scheduleMode
                        ? 'border-brand-500 bg-brand-600/20 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <Send size={14} className="inline mr-1.5" />
                    Enviar agora
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleMode(true)}
                    className={`flex-1 py-2.5 rounded-lg text-sm border transition-colors ${
                      scheduleMode
                        ? 'border-brand-500 bg-brand-600/20 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <Calendar size={14} className="inline mr-1.5" />
                    Agendar
                  </button>
                </div>

                {scheduleMode && (
                  <div>
                    <label className={labelCls}>Data e horário</label>
                    <input
                      type="datetime-local"
                      value={sendAtLocal}
                      onChange={e => setSendAtLocal(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Prioridade na fila</label>
                    <select
                      value={priority}
                      onChange={e => setPriority(e.target.value as Priority)}
                      className={inputCls}
                    >
                      <option value="high">Alta</option>
                      <option value="medium">Média</option>
                      <option value="low">Baixa</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Intervalo entre destinos</label>
                    <select
                      value={delayBetweenMs}
                      onChange={e => setDelayBetweenMs(Number(e.target.value))}
                      className={inputCls}
                    >
                      {delayOptions.map(ms => (
                        <option key={ms} value={ms}>
                          {ms / 1000} segundos
                          {ms === minDelay ? ' (mínimo)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-600 mt-1">
                      {acceptWhatsAppRisk
                        ? 'Modo sem proteção — intervalos menores aumentam risco de banimento.'
                        : `Modo protegido: lotes de ${safeBatch} msg/min com pausa de 1 min${isBusiness ? ' (WhatsApp Business — limite dobrado)' : ''}.`}
                    </p>
                  </div>
                </div>

                <Card className={`border ${acceptWhatsAppRisk ? 'border-red-800/60 bg-red-950/20' : 'border-gray-800 bg-gray-900/40'}`}>
                  <div className="flex items-start gap-3">
                    <ShieldAlert
                      size={18}
                      className={acceptWhatsAppRisk ? 'text-red-400 shrink-0' : 'text-amber-400 shrink-0'}
                    />
                    <div className="space-y-3 flex-1">
                      <div>
                        <p className="text-sm font-medium text-gray-200">
                          Proteção anti-banimento do WhatsApp
                        </p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          {acceptWhatsAppRisk
                            ? 'Proteção DESATIVADA. Envios mais rápidos podem fazer o WhatsApp banir ou suspender sua conta permanentemente.'
                            : 'Ativa por padrão. Envios grandes vão para fila automática (~20 msg/min) até entregar todos os destinos.'}
                        </p>
                      </div>
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={acceptWhatsAppRisk}
                          onChange={e => handleRiskToggle(e.target.checked)}
                          className="mt-0.5 rounded border-gray-600"
                        />
                        <span className={acceptWhatsAppRisk ? 'text-red-300' : 'text-gray-400'}>
                          Desativar proteção e aceitar risco de banimento da conta WhatsApp
                        </span>
                      </label>
                      {acceptWhatsAppRisk && (
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

                {usesSafeQueue && (
                  <p className="text-xs text-brand-400/90 flex items-start gap-1.5">
                    <Clock size={12} className="shrink-0 mt-0.5" />
                    {selectedIds.size} destinos serão entregues em fila segura (~
                    {formatDuration(durationEst)}). Você pode acompanhar em Agendamentos.
                  </p>
                )}

                <label className="flex items-start gap-2 text-sm text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireConnected}
                    onChange={e => setRequireConnected(e.target.checked)}
                    className="mt-0.5 rounded border-gray-600"
                  />
                  <span>
                    Só enviar se o WhatsApp estiver conectado no horário programado
                    <span className="block text-xs text-gray-600 mt-0.5">
                      Recomendado para agendamentos — evita falha se o servidor reiniciar.
                    </span>
                  </span>
                </label>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <Card className="sticky top-4">
              <h2 className="text-sm font-medium text-gray-300 mb-3">Resumo</h2>
              <ul className="text-xs text-gray-500 space-y-2 mb-4">
                <li>
                  <strong className="text-gray-400">Destinos:</strong>{' '}
                  {selectedIds.size || '—'}
                </li>
                <li>
                  <strong className="text-gray-400">Modo:</strong>{' '}
                  {scheduleMode ? `Agendado (${sendAtLocal})` : 'Imediato'}
                </li>
                <li>
                  <strong className="text-gray-400">Intervalo:</strong>{' '}
                  {Math.max(minDelay, delayBetweenMs) / 1000}s
                  {selectedIds.size > 1 && (
                    <span className="text-gray-600"> · {formatDuration(durationEst)} total</span>
                  )}
                </li>
                <li>
                  <strong className="text-gray-400">Proteção:</strong>{' '}
                  {acceptWhatsAppRisk && riskAcknowledged ? (
                    <span className="text-red-400">desativada (risco aceito)</span>
                  ) : (
                    <span className="text-brand-400">ativa — fila segura</span>
                  )}
                </li>
                {billing && !isUnlimited(billing.limits.messagesPerDay) && (
                  <li>
                    <strong className="text-gray-400">Plano hoje:</strong>{' '}
                    {billing.usage.messagesUsed}/{billing.limits.messagesPerDay} usadas
                  </li>
                )}
              </ul>

              <Button
                onClick={() => {
                  setResult(null)
                  submit.mutate()
                }}
                disabled={
                  !canSubmitMessage ||
                  selectedIds.size === 0 ||
                  messageTooLong ||
                  submit.isPending ||
                  (!scheduleMode && !connected) ||
                  (acceptWhatsAppRisk && !riskAcknowledged) ||
                  Boolean(groupMembershipError) ||
                  (hasSelectedGroup && validatingGroups)
                }
                className="w-full justify-center"
              >
                {submit.isPending ? <Spinner size={14} /> : scheduleMode ? <Calendar size={14} /> : <Send size={14} />}
                {submit.isPending
                  ? 'Processando...'
                  : scheduleMode
                    ? 'Agendar envio'
                    : `Enviar para ${selectedIds.size} destino(s)`}
              </Button>

              {!scheduleMode && !connected && (
                <p className="text-[11px] text-amber-500/90 mt-2 text-center">
                  Conecte o WhatsApp para envio imediato
                </p>
              )}
            </Card>

            {result && (
              <Card
                className={`flex items-start gap-3 ${result.success ? 'border-green-800' : 'border-red-800'}`}
              >
                {result.success ? (
                  <CheckCircle size={18} className="text-green-400 shrink-0" />
                ) : (
                  <XCircle size={18} className="text-red-400 shrink-0" />
                )}
                <p className="text-sm">{result.message}</p>
              </Card>
            )}

            <Card className="text-xs text-gray-600 space-y-1">
              <p className="flex items-center gap-1.5 text-gray-500">
                <Clock size={12} /> Dicas
              </p>
              <p>• Contatos em Destinos → Contatos; grupos só por importação em Grupos.</p>
              <p>• Modo protegido: fila automática (~{safeBatch} msg/min{isBusiness ? ', Business' : ''}) entrega todos os destinos.</p>
              <p>• Contatos com borda colorida: amarelo=aguardando aceite, verde=aceito, vermelho=recusou.</p>
              <p>• Desativar proteção só se você aceitar o risco de perder a conta WhatsApp.</p>
              <p>• Regras automáticas do Discord ficam na aba Discord → Regras.</p>
            </Card>
          </div>
        </div>
    </div>
  )
}
