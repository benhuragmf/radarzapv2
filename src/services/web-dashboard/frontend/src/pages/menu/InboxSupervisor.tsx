import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useInboxSocket } from '../../hooks/useInboxSocket'
import { formatQueueTimer, liveQueueState, queueUrgencyTimerClass } from '../../lib/inboxQueueUi'
import { Eye, RefreshCw } from 'lucide-react'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'
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
}

const STATUS_LABEL: Record<string, string> = {
  bot_triage: 'Triagem',
  waiting_queue: 'Na fila',
  in_progress: 'Em atendimento',
}

export default function InboxSupervisor() {
  const qc = useQueryClient()
  const [tick, setTick] = useState(0)
  const [reassignFor, setReassignFor] = useState<string | null>(null)
  const [targetUser, setTargetUser] = useState('')
  const [mode, setMode] = useState<'suggest' | 'assign'>('suggest')

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

  const hasPriority = queue.some(c => c.suggestedAt)
  useEffect(() => {
    if (!hasPriority) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [hasPriority])

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

  const linkedTeam = team.filter(t => t.linked && t.userId)

  return (
    <PlatformPage
      title="Supervisor"
      description="Fila ao vivo, reatribuição de conversas e acompanhamento da equipe."
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <Link to="/platform/inbox">
          <Button size="sm" variant="secondary">← Inbox</Button>
        </Link>
        <Button size="sm" variant="secondary" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Atualizar
        </Button>
      </div>

      {isLoading ? (
        <LoadingState rows={4} className="pt-4" />
      ) : (
        <div className="space-y-2">
          {queue.length === 0 ? (
            <EmptyState title="Fila vazia" description="Nenhuma conversa aguardando atendimento no momento." />
          ) : (
            queue.map(c => {
              const live = c.suggestedAt
                ? liveQueueState(c.suggestedAt, c.pullTimeoutSeconds ?? 120, tick)
                : { elapsedSec: 0, urgency: 0 }
              return (
                <Card key={c._id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm text-white">{c.contactName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
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
                  </div>
                  {reassignFor === c._id && (
                    <div className="w-full flex flex-wrap items-center gap-2 pt-2 border-t border-gray-800">
                      <select
                        value={targetUser}
                        onChange={e => setTargetUser(e.currentTarget.value)}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200"
                      >
                        <option value="">Atendente…</option>
                        {linkedTeam.map(t => (
                          <option key={t.userId!} value={t.userId!}>{t.displayName}</option>
                        ))}
                      </select>
                      <select
                        value={mode}
                        onChange={e => setMode(e.currentTarget.value as 'suggest' | 'assign')}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200"
                      >
                        <option value="suggest">Indicar prioridade</option>
                        <option value="assign">Forçar atribuição</option>
                      </select>
                      <Button
                        size="sm"
                        disabled={!targetUser || reassign.isPending}
                        onClick={() =>
                          reassign.mutate({ id: c._id, userId: targetUser, mode })
                        }
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
      )}
    </PlatformPage>
  )
}
