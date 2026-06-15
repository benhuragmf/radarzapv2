import { Clock, Send, CheckCircle, AlertTriangle } from 'lucide-react'
import { MetricCard } from '@/design-system'

interface Props {
  queue: number
  processing: number
  sent: number
  failed: number
}

export function ScheduleStatsBar({ queue, processing, sent, failed }: Props) {
  const items = [
    { label: 'Na fila', value: queue, icon: Clock, color: 'text-[var(--rz-warning-text)]' },
    { label: 'Enviando', value: processing, icon: Send, color: 'text-[var(--rz-info-text)]' },
    { label: 'Concluídos', value: sent, icon: CheckCircle, color: 'text-[var(--rz-success-text)]' },
    { label: 'Falhas', value: failed, icon: AlertTriangle, color: 'text-[var(--rz-danger-text)]' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, value, icon: Icon, color }) => (
        <MetricCard
          key={label}
          title={label}
          icon={Icon}
          value={<span className={color}>{value}</span>}
          className="py-3"
        />
      ))}
    </div>
  )
}
