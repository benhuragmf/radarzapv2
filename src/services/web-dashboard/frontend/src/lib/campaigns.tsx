import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Trash2 } from 'lucide-react'

export interface Campaign {
  _id: string
  title: string
  message: string
  destinations: Array<{ name: string; type: string }>
  status: 'pending' | 'processing' | 'sent' | 'failed'
  scheduledFor: string
  createdAt: string
  processedAt?: string
  lastError?: string
  delayBetweenMs?: number
}

const statusBadge: Record<Campaign['status'], 'green' | 'yellow' | 'red' | 'blue'> = {
  sent: 'green',
  pending: 'yellow',
  processing: 'blue',
  failed: 'red',
}

const statusLabel: Record<Campaign['status'], string> = {
  sent: 'Enviado',
  pending: 'Agendado',
  processing: 'Enviando',
  failed: 'Falhou',
}

export function CampaignRow({
  c,
  onCancel,
  cancelling,
}: {
  c: Campaign
  onCancel?: () => void
  cancelling?: boolean
}) {
  return (
    <Card className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{c.title}</p>
          <Badge label={statusLabel[c.status]} variant={statusBadge[c.status]} />
        </div>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.message}</p>
        <p className="text-[11px] text-gray-600 mt-1">
          {c.destinations.length} destino(s) ·{' '}
          {c.status === 'pending'
            ? `Agendado: ${new Date(c.scheduledFor).toLocaleString('pt-BR')}`
            : c.processedAt
              ? `Processado: ${new Date(c.processedAt).toLocaleString('pt-BR')}`
              : `Criado: ${new Date(c.createdAt).toLocaleString('pt-BR')}`}
        </p>
        {c.lastError && (
          <p className="text-[11px] text-red-400/90 mt-1">{c.lastError}</p>
        )}
      </div>
      {onCancel && c.status === 'pending' && (
        <Button variant="danger" size="sm" onClick={onCancel} disabled={cancelling}>
          <Trash2 size={12} /> Cancelar
        </Button>
      )}
    </Card>
  )
}
