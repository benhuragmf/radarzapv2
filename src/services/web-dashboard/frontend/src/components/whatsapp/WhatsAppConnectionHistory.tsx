import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Spinner } from '../ui/Spinner'
import { History } from 'lucide-react'

interface WaLog {
  _id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp: string
}

const CONNECTION_PATTERN =
  /connect|disconnect|reconnect|logout|qr|session|open|close|440|515/i

function eventLabel(message: string): { label: string; variant: 'green' | 'yellow' | 'red' | 'blue' | 'gray' } {
  const m = message.toLowerCase()
  if (m.includes('connected successfully') || m.includes('reconnected successfully')) {
    return { label: 'Conectado', variant: 'green' }
  }
  if (m.includes('disconnected') || m.includes('logout') || m.includes('cleaned up')) {
    return { label: 'Desconectado', variant: 'red' }
  }
  if (m.includes('reconnect') || m.includes('auto-reconnect')) {
    return { label: 'Reconexão', variant: 'yellow' }
  }
  if (m.includes('qr')) {
    return { label: 'QR Code', variant: 'blue' }
  }
  if (m.includes('closed')) {
    return { label: 'Queda', variant: 'yellow' }
  }
  return { label: 'Evento', variant: 'gray' }
}

export function WhatsAppConnectionHistory() {
  const { data: logs = [], isLoading } = useQuery<WaLog[]>({
    queryKey: ['wa-connection-history'],
    queryFn: () =>
      api.get('/logs?tenant=1&service=WhatsAppService&limit=80'),
    refetchInterval: 30_000,
  })

  const events = useMemo(
    () =>
      logs.filter(l => CONNECTION_PATTERN.test(l.message)).slice(0, 25),
    [logs],
  )

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size={24} />
      </div>
    )
  }

  return (
    <Card className="overflow-hidden p-0">
      {events.length === 0 ? (
        <div className="py-10 text-center text-sm text-[var(--rz-text-muted)]">
          <History size={28} className="mx-auto mb-2 opacity-30" />
          Nenhum evento de conexão registrado ainda.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--rz-border)]/80 max-h-[420px] overflow-y-auto">
          {events.map(log => {
            const { label, variant } = eventLabel(log.message)
            return (
              <li key={log._id} className="px-4 py-3 flex items-start gap-3 hover:bg-[var(--rz-surface-muted)]/30">
                <Badge label={label} variant={variant} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--rz-text-secondary)] leading-snug">{log.message}</p>
                  <p className="text-[11px] text-[var(--rz-text-muted)] mt-1">
                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
