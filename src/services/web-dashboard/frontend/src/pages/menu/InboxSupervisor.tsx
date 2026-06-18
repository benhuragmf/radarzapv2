import { useState, useEffect, useMemo } from 'react'
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
import { useInboxSocket } from '../../hooks/useInboxSocket'
import { formatQueueTimer, liveQueueState, queueUrgencyTimerClass } from '../../lib/inboxQueueUi'
import {
  Eye,
  RefreshCw,
  Clock3,
  Users,
  Star,
  MessageSquare,
  UserCheck,
} from 'lucide-react'
import { mutationError } from '../../lib/notify'
import { LoadingState, EmptyState } from '@/design-system'

interface Conversation {
  _id: string
  contactName: string
  status: string
  departmentName?: string
  assignedUserName?: string
  suggestedUserName?: string
  suggestedAt?: string
  pullTimeoutSeconds?: number
  priorityForMe?: boolean
}

interface TeamOption {
  userId: string | null
  displayName: string
  linked: boolean
  online?: boolean
}

const STATUS_LABEL: Record<string, string> = {
  bot_triage: 'Triagem',
  waiting_queue: 'Na fila',
  in_progress: 'Em atendimento',
}

export default function InboxSupervisor() {
  const qc = useQueryClient()
  const [tick, setTick] = useState(0)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [reassignFor, setReassignFor] = useState<string | null>(null)
  const [targetUser, setTargetUser] = useState('')
  const [mode, setMode] = useState<'suggest' | 'assign'>('suggest')

  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })

  useInboxSocket(true)

  const { data: queue = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['inbox-supervisor-queue'],
    queryFn: () => api.get<Conversation[]>('/inbox/supervisor/queue'),
    refetchInterval: 15_000,
  })

  const { data: team = [] } = useQuery({
    queryKey: ['inbox-team'],
    queryFn: () => api.get<TeamOption[]>('/inbox/members'),
  })

  const { data: activeConversations = [] } = useQuery({
    queryKey: ['inbox-conversations', 'in_progress'],
    queryFn: () => api.get<Conversation[]>('/inbox/conversations?status=in_progress'),
    refetchInterval: 30_000,
  })

  const hasPriority = queue.some(c => c.suggestedAt)
  useEffect(() => {
    if (!hasPriority) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [hasPriority])

  const linkedTeam = team.filter(t => t.linked && t.userId)
  const onlineTeam = linkedTeam.filter(t => t.online !== false)

  const stats = useMemo(
    () => ({
      queue: queue.filter(c => c.status === 'waiting_queue').length,
      triage: queue.filter(c => c.status === 'bot_triage').length,
      active: activeConversations.length,
      online: onlineTeam.length,
      priority: queue.filter(c => c.suggestedUserName).length,
    }),
    [queue, activeConversations, onlineTeam],
  )

  const refresh = () => {
    void refetch()
    setLastRefresh(Date.now())
  }

  const secondsAgo = Math.floor((Date.now() - lastRefresh) / 1000)

  const reassign = useMutation({
    mutationFn: ({ id, userId, mode }: { id: string; userId: string; mode: 'suggest' | 'assign' }) =>
      api.post(`/inbox/conversations/${id}/reassign`, { userId, mode }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-supervisor-queue'] })
      setReassignFor(null)
      setTargetUser('')
    },
    onError: mutationError,
  })

  return (
    <PlatformPage
      title="Supervisor"
      description="Fila ao vivo, redistribuição de conversas e monitoramento da equipe em tempo real."
    >
      <InboxAtendimentoNav me={me} className="mb-4" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link to="/platform/inbox">
          <Button size="sm" variant="secondary">← Inbox</Button>
        </Link>
        <Button size="sm" variant="secondary" onClick={refresh} disabled={isFetching}>
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Atualizar
        </Button>
        <span className="text-xs text-[var(--rz-text-muted)]">
          Atualizado há {secondsAgo}s
        </span>
      </div>

      <InboxStatsRow
        className="mb-6"
        items={[
          {
            label: 'Fila ao vivo',
            value: stats.queue,
            icon: Clock3,
            colorClass: 'text-blue-400',
            description: 'Aguardando atendente',
            alert: stats.queue > 0,
          },
          {
            label: 'Em atendimento',
            value: stats.active,
            icon: UserCheck,
            colorClass: 'text-green-400',
            description: 'Conversas ativas',
          },
          {
            label: 'Triagem',
            value: stats.triage,
            icon: MessageSquare,
            colorClass: 'text-yellow-400',
            description: 'Bot automático',
          },
          {
            label: 'Atendentes online',
            value: onlineTeam.length,
            icon: Users,
            colorClass: 'text-emerald-400',
            description: `${linkedTeam.length} na equipe`,
          },
          {
            label: 'Prioridades',
            value: stats.priority,
            icon: Star,
            colorClass: 'text-amber-400',
            description: 'Round-robin ativo',
          },
        ]}
      />

      {isLoading ? (
        <LoadingState rows={4} className="pt-4" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-[var(--rz-text-secondary)]">Fila ao vivo</h2>
            {queue.length === 0 ? (
              <EmptyState
                title="Parabéns! A fila está vazia"
                description="No momento, não há conversas aguardando atendimento. Novas conversas aparecerão aqui."
              />
            ) : (
              queue.map(c => {
                const live = c.suggestedAt
                  ? liveQueueState(c.suggestedAt, c.pullTimeoutSeconds ?? 120, tick)
                  : { elapsedSec: 0, urgency: 0 }
                return (
                  <Card key={c._id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm text-[var(--rz-text-primary)]">{c.contactName}</p>
                      <p className="text-xs text-[var(--rz-text-muted)] mt-0.5">
                        {[c.departmentName, c.assignedUserName && `· ${c.assignedUserName}`]
                          .filter(Boolean)
                          .join(' ')}
                        {c.suggestedUserName && (
                          <span className="text-yellow-500/90"> · prioridade: {c.suggestedUserName}</span>
                        )}
                        {c.suggestedAt && (
                          <span className={queueUrgencyTimerClass(live.urgency)}>
                            {' '}
                            · {formatQueueTimer(live.elapsedSec)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        label={STATUS_LABEL[c.status] ?? c.status}
                        variant={c.status === 'in_progress' ? 'green' : 'blue'}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setReassignFor(c._id)
                          setMode('suggest')
                        }}
                      >
                        <Eye size={14} /> Reatribuir
                      </Button>
                      <Link to={`/platform/inbox?conv=${c._id}`}>
                        <Button size="sm" variant="secondary">Abrir</Button>
                      </Link>
                    </div>
                    {reassignFor === c._id && (
                      <div className="w-full flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--rz-border)]">
                        <select
                          value={targetUser}
                          onChange={e => setTargetUser(e.target.value)}
                          className="bg-[var(--rz-surface-muted)] border border-[var(--rz-border)] rounded-lg px-2 py-1.5 text-xs text-[var(--rz-text-primary)]"
                        >
                          <option value="">Atendente…</option>
                          {linkedTeam.map(t => (
                            <option key={t.userId!} value={t.userId!}>
                              {t.displayName}
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
                        <Button
                          size="sm"
                          disabled={!targetUser || reassign.isPending}
                          onClick={() => reassign.mutate({ id: c._id, userId: targetUser, mode })}
                        >
                          Confirmar
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setReassignFor(null)}>
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </Card>
                )
              })
            )}
          </div>

          <aside className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--rz-text-primary)]">Atendentes</h3>
              {onlineTeam.length === 0 ? (
                <p className="text-xs text-[var(--rz-text-muted)]">
                  Nenhum atendente online no momento.
                </p>
              ) : (
                <ul className="space-y-2">
                  {onlineTeam.map(t => (
                    <li key={t.userId!} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-[var(--rz-text-secondary)]">{t.displayName}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/settings/team" className="text-xs text-brand-400 hover:underline">
                Ver equipe completa
              </Link>
            </Card>

            <Card className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-[var(--rz-text-primary)]">Ações rápidas</h3>
              <Link to="/platform/inbox?status=waiting_queue" className="block">
                <Button size="sm" variant="secondary" className="w-full justify-start">
                  Abrir fila no Inbox
                </Button>
              </Link>
              <Link to="/platform/inbox/tickets" className="block">
                <Button size="sm" variant="secondary" className="w-full justify-start">
                  Ver tickets
                </Button>
              </Link>
            </Card>
          </aside>
        </div>
      )}
    </PlatformPage>
  )
}
