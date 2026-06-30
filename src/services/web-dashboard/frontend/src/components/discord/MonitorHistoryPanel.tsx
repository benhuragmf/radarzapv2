import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { LoadingState } from '@/design-system'
import { Badge } from '../ui/Badge'
import { TRIGGER_LABELS } from '../../lib/discordMonitor'

interface HistoryEvent {
  _id: string
  trigger: string
  userName?: string
  status: string
  waJobsEnqueued: number
  skipReason?: string
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  captured: 'Capturado',
  wa_queued: 'Enviado à fila WA',
  no_rules: 'Sem regra',
  skipped_cooldown: 'Cooldown',
  wa_failed: 'Falha',
}

const STATUS_VARIANT: Record<string, 'green' | 'yellow' | 'gray' | 'red'> = {
  captured: 'gray',
  wa_queued: 'green',
  no_rules: 'yellow',
  skipped_cooldown: 'yellow',
  wa_failed: 'red',
}

export function MonitorHistoryPanel({ monitorId }: { monitorId: string }) {
  const { data: events = [], isLoading } = useQuery<HistoryEvent[]>({
    queryKey: ['channel-history', monitorId],
    queryFn: () => api.get(`/channels/${monitorId}/history?limit=25`),
    refetchInterval: 15_000,
  })

  if (isLoading) return <LoadingState rows={2} className="py-2" />

  if (events.length === 0) {
    return (
      <p className="text-xs text-[var(--rz-text-muted)] py-2">
        Nenhum evento registrado ainda. Histórico retido por 90 dias.
      </p>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-[var(--rz-border)] space-y-1.5 max-h-48 overflow-y-auto">
      {events.map(ev => (
        <div
          key={ev._id}
          className="flex items-start justify-between gap-2 text-xs py-1.5 px-2 rounded bg-[var(--rz-surface-muted)]/60"
        >
          <div className="min-w-0">
            <p className="text-[var(--rz-text-secondary)] truncate">
              {ev.userName ?? '—'}
              {' · '}
              {TRIGGER_LABELS[ev.trigger as keyof typeof TRIGGER_LABELS] ?? ev.trigger}
            </p>
            {ev.skipReason && (
              <p className="text-[var(--rz-text-muted)] truncate">{ev.skipReason}</p>
            )}
            <p className="text-[var(--rz-text-muted)]">
              {new Date(ev.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>
          <Badge
            label={STATUS_LABELS[ev.status] ?? ev.status}
            variant={STATUS_VARIANT[ev.status] ?? 'gray'}
          />
        </div>
      ))}
    </div>
  )
}
