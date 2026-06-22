import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'
import { InboxStatsRow } from '../../components/inbox/InboxStatsRow'
import { SupervisorMonitorDrawer } from '../../components/inbox/SupervisorMonitorDrawer'
import { useInboxSocket } from '../../hooks/useInboxSocket'
import { usePanelSocket } from '../../hooks/usePanelSocket'
import { formatQueueTimer, liveQueueState, queueUrgencyTimerClass } from '../../lib/inboxQueueUi'
import {
  AlertTriangle,
  Eye,
  RefreshCw,
  Clock3,
  Users,
  MessageSquare,
  UserCheck,
  Timer,
  ThumbsUp,
  Globe,
  Smartphone,
  Activity,
} from 'lucide-react'
import { mutationError } from '../../lib/notify'
import { LoadingState, EmptyState } from '@/design-system'
import type {
  SupervisorActiveConversation,
  SupervisorAgentActivity,
  SupervisorDashboardPayload,
} from '@radarzap-types/inbox-supervisor'

const STATUS_BADGE: Record<string, 'green' | 'blue' | 'yellow'> = {
  bot_triage: 'yellow',
  waiting_queue: 'blue',
  in_progress: 'green',
}

const STATUS_LABEL: Record<string, string> = {
  bot_triage: 'Triagem',
  waiting_queue: 'Na fila',
  in_progress: 'Em atendimento',
}

const ACTIVITY_DOT: Record<SupervisorAgentActivity, string> = {
  offline: 'bg-zinc-500',
  idle: 'bg-emerald-500',
  inbox: 'bg-sky-400',
  supervisor: 'bg-violet-400',
  other_page: 'bg-amber-400',
  in_chat: 'bg-green-500',
}

function formatDurationSec(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`
}

function channelIcon(channel: SupervisorActiveConversation['channel']) {
  if (channel === 'webchat_site') return Globe
  return Smartphone
}

function channelShort(channel: SupervisorActiveConversation['channel']): string {
  if (channel === 'webchat_site') return 'ChatBox'
  if (channel === 'whatsapp_cloud') return 'Cloud'
  return 'WhatsApp'
}

function ConversationRow({
  conv,
  tick,
  onMonitor,
  onReassign,
  reassignOpen,
  linkedTeam,
  targetUser,
  setTargetUser,
  mode,
  setMode,
  onConfirmReassign,
  onCancelReassign,
  reassignPending,
}: {
  conv: SupervisorActiveConversation
  tick: number
  onMonitor: (id: string) => void
  onReassign: (id: string) => void
  reassignOpen: boolean
  linkedTeam: SupervisorDashboardPayload['agents']
  targetUser: string
  setTargetUser: (v: string) => void
  mode: 'suggest' | 'assign'
  setMode: (v: 'suggest' | 'assign') => void
  onConfirmReassign: () => void
  onCancelReassign: () => void
  reassignPending: boolean
}) {
  const ChannelIcon = channelIcon(conv.channel)
  const live = conv.suggestedAt
    ? liveQueueState(conv.suggestedAt, conv.pullTimeoutSeconds ?? 120, tick)
    : { elapsedSec: conv.queueWaitSec ?? 0, urgency: 0 }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm text-[var(--rz-text-primary)]">{conv.contactName}</p>
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--rz-text-muted)] uppercase tracking-wide">
              <ChannelIcon size={12} /> {channelShort(conv.channel)}
            </span>
            {conv.whatsappBridgeActive ? (
              <Badge label="Bridge WA" variant="yellow" />
            ) : null}
            {conv.supervisorHelpAt ? (
              <Badge label="Pediu ajuda" variant="yellow" />
            ) : null}
          </div>
          <p className="text-xs text-[var(--rz-text-muted)] mt-0.5 truncate">
            {conv.contactIdentifier}
            {[conv.widgetName, conv.departmentName].filter(Boolean).length > 0 && (
              <> · {[conv.widgetName, conv.departmentName].filter(Boolean).join(' · ')}</>
            )}
          </p>
          <p className="text-xs text-[var(--rz-text-muted)] mt-1">
            {conv.assignedUserName && (
              <span className="text-green-400/90">Atendente: {conv.assignedUserName}</span>
            )}
            {conv.suggestedUserName && (
              <span className="text-yellow-500/90">
                {conv.assignedUserName ? ' · ' : ''}Prioridade: {conv.suggestedUserName}
              </span>
            )}
            {conv.handleTimeSec != null && conv.status === 'in_progress' && (
              <span> · Atendimento: {formatDurationSec(conv.handleTimeSec)}</span>
            )}
            {(conv.suggestedAt || conv.queueWaitSec != null) && conv.status !== 'in_progress' && (
              <span className={queueUrgencyTimerClass(live.urgency)}>
                {' '}
                · Espera: {formatQueueTimer(live.elapsedSec)}
              </span>
            )}
            {conv.lastMessagePreview && (
              <span className="block mt-1 text-[var(--rz-text-muted)] italic truncate">
                {conv.lastMessagePreview}
              </span>
            )}
            {conv.supervisorHelpPreview && (
              <span className="block mt-1 text-amber-500/90 truncate">
                {conv.supervisorHelpAuthor ? `${conv.supervisorHelpAuthor}: ` : ''}
                {conv.supervisorHelpPreview}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            label={STATUS_LABEL[conv.status] ?? conv.status}
            variant={STATUS_BADGE[conv.status] ?? 'blue'}
          />
          <Button size="sm" variant="secondary" onClick={() => onMonitor(conv.id)}>
            <Eye size={14} /> Monitorar
          </Button>
          {conv.status !== 'in_progress' && (
            <Button size="sm" variant="secondary" onClick={() => onReassign(conv.id)}>
              Reatribuir
            </Button>
          )}
        </div>
      </div>
      {reassignOpen && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--rz-border)]">
          <select
            value={targetUser}
            onChange={e => setTargetUser(e.target.value)}
            className="bg-[var(--rz-surface-muted)] border border-[var(--rz-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--rz-text-primary)]"
          >
            <option value="">Atendente…</option>
            {linkedTeam.map(t => (
              <option key={t.userId} value={t.userId}>
                {t.displayName}{t.online ? ' · online' : ''}
              </option>
            ))}
          </select>
          <select
            value={mode}
            onChange={e => setMode(e.target.value as 'suggest' | 'assign')}
            className="bg-[var(--rz-surface-muted)] border border-[var(--rz-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--rz-text-primary)]"
          >
            <option value="suggest">Indicar prioridade</option>
            <option value="assign">Forçar atribuição</option>
          </select>
          <Button size="sm" disabled={!targetUser || reassignPending} onClick={onConfirmReassign}>
            Confirmar
          </Button>
          <Button size="sm" variant="secondary" onClick={onCancelReassign}>
            Cancelar
          </Button>
        </div>
      )}
    </Card>
  )
}

export default function InboxSupervisor() {
  const qc = useQueryClient()
  const [tick, setTick] = useState(0)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [reassignFor, setReassignFor] = useState<string | null>(null)
  const [targetUser, setTargetUser] = useState('')
  const [mode, setMode] = useState<'suggest' | 'assign'>('suggest')
  const [monitorId, setMonitorId] = useState<string | null>(null)
  const [tab, setTab] = useState<'team' | 'active' | 'queue'>('team')

  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })

  useInboxSocket(true)

  const onSupervisorPanelEvent = useCallback(
    (ev: { type: string }) => {
      if (ev.type === 'inbox:supervisor_help') {
        qc.invalidateQueries({ queryKey: ['inbox-supervisor-dashboard'] })
      }
    },
    [qc],
  )
  usePanelSocket(true, onSupervisorPanelEvent)

  const { data: dashboard, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['inbox-supervisor-dashboard'],
    queryFn: () => api.get<SupervisorDashboardPayload>('/inbox/supervisor/dashboard'),
    refetchInterval: 15_000,
  })

  const hasPriority = (dashboard?.queue ?? []).some(c => c.suggestedAt)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const linkedTeam = useMemo(
    () => (dashboard?.agents ?? []).filter(a => a.linked),
    [dashboard?.agents],
  )

  const helpRequests = useMemo(
    () =>
      (dashboard?.activeConversations ?? []).filter(c => c.supervisorHelpAt).sort(
        (a, b) =>
          new Date(b.supervisorHelpAt!).getTime() - new Date(a.supervisorHelpAt!).getTime(),
      ),
    [dashboard?.activeConversations],
  )

  const refresh = () => {
    void refetch()
    setLastRefresh(Date.now())
  }

  const secondsAgo = Math.floor((Date.now() - lastRefresh) / 1000)
  const summary = dashboard?.summary
  const periodDays = dashboard?.periodDays ?? 7

  const reassign = useMutation({
    mutationFn: ({ id, userId, mode }: { id: string; userId: string; mode: 'suggest' | 'assign' }) =>
      api.post(`/inbox/conversations/${id}/reassign`, { userId, mode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-supervisor-dashboard'] })
      setReassignFor(null)
      setTargetUser('')
    },
    onError: mutationError,
  })

  return (
    <PlatformPage
      title="Supervisão"
      description="Equipe ao vivo, conversas ativas, fila e métricas de desempenho dos atendentes."
    >
      <InboxAtendimentoNav me={me} className="mb-4" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link to="/platform/inbox">
          <Button size="sm" variant="secondary">← Caixa de Entrada</Button>
        </Link>
        <Button size="sm" variant="secondary" onClick={refresh} disabled={isFetching}>
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Atualizar
        </Button>
        <span className="text-xs text-[var(--rz-text-muted)]">
          Atualizado há {secondsAgo}s · métricas dos últimos {periodDays} dias
        </span>
      </div>

      <InboxStatsRow
        className="mb-6"
        items={[
          {
            label: 'Fila ao vivo',
            value: summary?.queueCount ?? 0,
            icon: Clock3,
            colorClass: 'text-blue-400',
            description: 'Aguardando atendente',
            alert: (summary?.queueCount ?? 0) > 0,
          },
          {
            label: 'Em atendimento',
            value: summary?.activeCount ?? 0,
            icon: UserCheck,
            colorClass: 'text-green-400',
            description: 'WhatsApp + ChatBox',
          },
          {
            label: 'Disponíveis p/ fila',
            value: summary?.onlineAgents ?? 0,
            icon: Users,
            colorClass: 'text-emerald-400',
            description: `${linkedTeam.length} na equipe`,
          },
          {
            label: 'Tempo médio atend.',
            value: formatDurationSec(summary?.avgHandleTimeSec),
            icon: Timer,
            colorClass: 'text-cyan-400',
            description: `${periodDays} dias`,
          },
          {
            label: 'Tempo p/ puxar',
            value: formatDurationSec(summary?.avgPullTimeSec),
            icon: Activity,
            colorClass: 'text-orange-400',
            description: 'Fila → aceite',
          },
          {
            label: 'CSAT médio',
            value:
              summary?.avgCsatScore != null ? `${summary.avgCsatScore.toFixed(1)}/5` : '—',
            icon: ThumbsUp,
            colorClass: 'text-amber-400',
            description: 'Avaliação equipe',
          },
        ]}
      />

      {helpRequests.length > 0 && (
        <Card className="p-4 mb-6 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-medium text-amber-400">
                Pedidos de ajuda ({helpRequests.length})
              </p>
              <p className="text-xs text-[var(--rz-text-muted)]">
                Atendentes mencionaram @supervisor no chat interno.
              </p>
              <div className="space-y-2">
                {helpRequests.map(conv => (
                  <div
                    key={conv.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-[var(--rz-text-secondary)] truncate">
                      {channelShort(conv.channel)} · {conv.contactName}
                      {conv.assignedUserName ? ` · ${conv.assignedUserName}` : ''}
                      {conv.supervisorHelpPreview ? ` — “${conv.supervisorHelpPreview}”` : ''}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => setMonitorId(conv.id)}>
                      <Eye size={12} /> Monitorar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-1 mb-4 overflow-x-auto pb-0.5">
        {(
          [
            ['team', 'Equipe ao vivo', Users],
            ['active', 'Em atendimento', MessageSquare],
            ['queue', 'Fila', Clock3],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === id
                ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)] border border-transparent hover:bg-[var(--rz-surface-muted)]/60'
            }`}
          >
            <Icon size={14} />
            {label}
            {id === 'active' && (dashboard?.activeConversations.length ?? 0) > 0 && (
              <span className="ml-0.5 opacity-70">({dashboard?.activeConversations.length})</span>
            )}
            {id === 'queue' && (dashboard?.queue.length ?? 0) > 0 && (
              <span className="ml-0.5 opacity-70">({dashboard?.queue.length})</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState rows={4} className="pt-4" />
      ) : tab === 'team' ? (
        <div className="space-y-3">
          {linkedTeam.length === 0 ? (
            <EmptyState title="Nenhum atendente vinculado" description="Convide membros em Configurações → Equipe." />
          ) : (
            linkedTeam.map(agent => (
              <Card key={agent.userId} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${ACTIVITY_DOT[agent.activity]}`}
                      title={agent.activityLabel}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-[var(--rz-text-primary)]">
                        {agent.displayName}
                        <span className="ml-2 inline-block align-middle">
                          <Badge
                            label={agent.statusLabel}
                            variant={agent.availableForQueue ? 'green' : agent.online ? 'yellow' : 'gray'}
                          />
                        </span>
                      </p>
                      <p className="text-xs text-[var(--rz-text-muted)] mt-0.5">{agent.activityLabel}</p>
                      {agent.whatsappPhone && (
                        <p className="text-xs text-[var(--rz-text-muted)]">WhatsApp: {agent.whatsappPhone}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded-md bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)]">
                      {agent.activeCount} ativo(s)
                    </span>
                    <span className="px-2 py-1 rounded-md bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)]">
                      Atend.: {formatDurationSec(agent.metrics.avgHandleTimeSec)}
                    </span>
                    <span className="px-2 py-1 rounded-md bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)]">
                      Puxar: {formatDurationSec(agent.metrics.avgPullTimeSec)}
                    </span>
                    <span className="px-2 py-1 rounded-md bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)]">
                      CSAT:{' '}
                      {agent.metrics.avgCsatScore != null
                        ? `${agent.metrics.avgCsatScore.toFixed(1)} (${agent.metrics.csatCount})`
                        : '—'}
                    </span>
                  </div>
                </div>
                {agent.activeConversations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--rz-border)] space-y-2">
                    {agent.activeConversations.map(conv => (
                      <div
                        key={conv.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <span className="text-[var(--rz-text-secondary)] truncate">
                          {channelShort(conv.channel)} · {conv.contactName}
                          {conv.supervisorHelpAt ? (
                            <span className="text-amber-500/90"> · pediu ajuda</span>
                          ) : null}
                          {conv.handleTimeSec != null && (
                            <span className="text-[var(--rz-text-muted)]">
                              {' '}
                              · {formatDurationSec(conv.handleTimeSec)}
                            </span>
                          )}
                        </span>
                        <Button size="sm" variant="secondary" onClick={() => setMonitorId(conv.id)}>
                          <Eye size={12} /> Monitorar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      ) : tab === 'active' ? (
        <div className="space-y-3">
          {(dashboard?.activeConversations ?? []).length === 0 ? (
            <EmptyState title="Nenhum atendimento ativo" description="Conversas em andamento aparecerão aqui." />
          ) : (
            dashboard!.activeConversations.map(conv => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                tick={tick}
                onMonitor={setMonitorId}
                onReassign={id => {
                  setReassignFor(id)
                  setMode('suggest')
                }}
                reassignOpen={reassignFor === conv.id}
                linkedTeam={linkedTeam}
                targetUser={targetUser}
                setTargetUser={setTargetUser}
                mode={mode}
                setMode={setMode}
                onConfirmReassign={() =>
                  reassign.mutate({ id: conv.id, userId: targetUser, mode })
                }
                onCancelReassign={() => setReassignFor(null)}
                reassignPending={reassign.isPending}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {(dashboard?.queue ?? []).length === 0 ? (
            <EmptyState
              title="Parabéns! A fila está vazia"
              description="Novas conversas aguardando atendimento aparecerão aqui."
            />
          ) : (
            dashboard!.queue.map(conv => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                tick={tick}
                onMonitor={setMonitorId}
                onReassign={id => {
                  setReassignFor(id)
                  setMode('suggest')
                }}
                reassignOpen={reassignFor === conv.id}
                linkedTeam={linkedTeam}
                targetUser={targetUser}
                setTargetUser={setTargetUser}
                mode={mode}
                setMode={setMode}
                onConfirmReassign={() =>
                  reassign.mutate({ id: conv.id, userId: targetUser, mode })
                }
                onCancelReassign={() => setReassignFor(null)}
                reassignPending={reassign.isPending}
              />
            ))
          )}
        </div>
      )}

      <SupervisorMonitorDrawer conversationId={monitorId} onClose={() => setMonitorId(null)} />
    </PlatformPage>
  )
}
