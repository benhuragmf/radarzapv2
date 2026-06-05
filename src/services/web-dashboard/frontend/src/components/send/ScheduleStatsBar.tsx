import { Card } from '../ui/Card'
import { Clock, Send, CheckCircle, AlertTriangle } from 'lucide-react'

interface Props {
  queue: number
  processing: number
  sent: number
  failed: number
}

export function ScheduleStatsBar({ queue, processing, sent, failed }: Props) {
  const items = [
    { label: 'Na fila', value: queue, icon: Clock, color: 'text-yellow-400' },
    { label: 'Enviando', value: processing, icon: Send, color: 'text-blue-400' },
    { label: 'Concluídos', value: sent, icon: CheckCircle, color: 'text-green-400' },
    { label: 'Falhas', value: failed, icon: AlertTriangle, color: 'text-red-400' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, value, icon: Icon, color }) => (
        <Card key={label} className="py-3 px-4">
          <div className="flex items-center gap-2">
            <Icon size={16} className={color} />
            <div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-[11px] text-gray-500">{label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
