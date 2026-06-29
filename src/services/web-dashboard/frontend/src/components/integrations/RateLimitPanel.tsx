import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card, CardTitle, CardValue } from '../ui/Card'
import { Gauge } from 'lucide-react'
import { ErrorState, InlineNotice, LoadingState, StatusBadge } from '@/design-system'

interface RateLimitInfo {
  plan: string
  limits: Record<string, number>
  usage: Record<string, number>
  api: { windowMs: number; maxRequestsPerWindow: number; header: string }
}

export function RateLimitPanel() {
  const { data, isLoading, isError, error, refetch } = useQuery<RateLimitInfo>({
    queryKey: ['rate-limit'],
    queryFn: () => api.get('/integrations/rate-limit'),
  })

  if (isLoading) {
    return <LoadingState rows={2} className="py-4" label="Carregando limites da API" />
  }

  if (isError) {
    return (
      <ErrorState
        title="Não foi possível carregar os limites"
        message={(error as Error).message}
        onRetry={() => void refetch()}
      />
    )
  }

  if (!data) return null

  const msgsLimit = data.limits.messagesPerDay ?? 0
  const msgsUsed = data.usage.messagesToday ?? 0

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
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
          <p className="text-sm text-[var(--rz-text-secondary)]">
            {data.api.maxRequestsPerWindow} req / {Math.round(data.api.windowMs / 1000)}s
          </p>
          <p className="text-xs text-[var(--rz-text-muted)] mt-1">Header: {data.api.header}</p>
        </Card>
      </div>
      <InlineNotice tone="neutral" title="Contexto dos limites">
        Plano atual:{' '}
        <StatusBadge status="info" text={data.plan} size="sm" className="capitalize" />. Os limites exibidos são
        informativos e seguem o plano da empresa.
      </InlineNotice>
    </div>
  )
}
