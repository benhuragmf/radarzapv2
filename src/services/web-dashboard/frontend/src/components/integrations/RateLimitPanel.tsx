import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card, CardTitle, CardValue } from '../ui/Card'
import { Gauge } from 'lucide-react'
import { LoadingState } from '@/design-system'

interface RateLimitInfo {
  plan: string
  limits: Record<string, number>
  usage: Record<string, number>
  api: { windowMs: number; maxRequestsPerWindow: number; header: string }
}

export function RateLimitPanel() {
  const { data, isLoading } = useQuery<RateLimitInfo>({
    queryKey: ['rate-limit'],
    queryFn: () => api.get('/integrations/rate-limit'),
  })

  if (isLoading) {
    return <LoadingState rows={2} className="py-4" />
  }

  if (!data) return null

  const msgsLimit = data.limits.messagesPerDay ?? 0
  const msgsUsed = data.usage.messagesToday ?? 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardTitle>Mensagens hoje</CardTitle>
          <CardValue>
            {msgsUsed.toLocaleString('pt-BR')}
            {msgsLimit > 0 && ` / ${msgsLimit.toLocaleString('pt-BR')}`}
          </CardValue>
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-2">
            <CardTitle>API (janela)</CardTitle>
            <Gauge size={16} className="text-brand-400" />
          </div>
          <p className="text-sm text-gray-300">
            {data.api.maxRequestsPerWindow} req / {Math.round(data.api.windowMs / 1000)}s
          </p>
          <p className="text-xs text-gray-500 mt-1">Header: {data.api.header}</p>
        </Card>
      </div>
      <p className="text-xs text-gray-500 capitalize">Plano atual: {data.plan}</p>
    </div>
  )
}
