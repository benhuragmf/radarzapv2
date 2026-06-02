import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { RefreshCw, ListOrdered, ExternalLink } from 'lucide-react'

interface QueueStats {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

interface FailedJob {
  id: string
  name: string
  failedReason: string
  timestamp: number
  data: Record<string, unknown>
}

export default function Queue() {
  const qc = useQueryClient()

  const { data: queues = [], isLoading } = useQuery<QueueStats[]>({
    queryKey: ['queue'],
    queryFn: () => api.get('/queue'),
    refetchInterval: 5_000,
  })

  const { data: failed = [] } = useQuery<FailedJob[]>({
    queryKey: ['queue-failed'],
    queryFn: () => api.get('/queue/failed'),
    refetchInterval: 10_000,
  })

  const retry = useMutation({
    mutationFn: (id: string) => api.post(`/queue/${id}/retry`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queue'] })
      qc.invalidateQueries({ queryKey: ['queue-failed'] })
    },
  })

  if (isLoading) return <div className="flex justify-center pt-20"><Spinner size={32} /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Monitoramento das filas BullMQ em tempo real.</p>
        <a
          href="/api/admin/queues"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300"
        >
          <ExternalLink size={14} />
          Bull Board (avancado)
        </a>
      </div>

      {/* Queue stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {queues.map((q) => (
          <Card key={q.name}>
            <div className="flex items-center gap-2 mb-3">
              <ListOrdered size={14} className="text-gray-500" />
              <span className="text-sm font-medium">{q.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Aguardando', value: q.waiting,   color: 'text-yellow-400' },
                { label: 'Ativo',      value: q.active,    color: 'text-blue-400'   },
                { label: 'Falhas',     value: q.failed,    color: 'text-red-400'    },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-950 rounded-lg p-2">
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Failed jobs */}
      {failed.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-3">Jobs com falha</h2>
          <div className="space-y-2">
            {failed.map((job) => (
              <Card key={job.id} className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{job.name}</span>
                    <Badge label="falha" variant="red" />
                  </div>
                  <p className="text-xs text-red-400 truncate">{job.failedReason}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {new Date(job.timestamp).toLocaleString('pt-BR')}
                  </p>
                </div>
                <Button
                  size="sm" variant="secondary"
                  onClick={() => retry.mutate(job.id)}
                  disabled={retry.isPending}
                >
                  <RefreshCw size={12} /> Reenviar
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
