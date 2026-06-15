import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { api } from '../../lib/api'
import { Activity, Database, Server } from 'lucide-react'
import { RadarPageShell, PageHeader, LoadingState, MetricCard } from '@/design-system'

export default function AdminMonitoring() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-monitoring'],
    queryFn: () =>
      api.get<{
        health: { mongodb: boolean; redis: boolean }
        stats: Record<string, number>
        timestamp: string
      }>('/admin/monitoring'),
    refetchInterval: 15_000,
  })

  const health = data?.health
  const stats = data?.stats ?? {}

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader title="Monitoramento" subtitle="Saúde da infraestrutura e métricas globais." />

      {isLoading ? (
        <LoadingState rows={4} className="pt-4" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              title="MongoDB"
              value={health?.mongodb ? 'Conectado' : 'Offline'}
              icon={Database}
              status={health?.mongodb ? { status: 'success', text: 'OK' } : { status: 'danger', text: 'Offline' }}
            />
            <MetricCard
              title="Redis"
              value={health?.redis ? 'Conectado' : 'Offline'}
              icon={Server}
              status={health?.redis ? { status: 'success', text: 'OK' } : { status: 'danger', text: 'Offline' }}
            />
          </div>

          <Card>
            <div className="flex items-center gap-2 text-[var(--rz-text-secondary)] text-sm mb-3">
              <Activity size={16} />
              Estatísticas ao vivo
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(stats).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-[var(--rz-border)] py-1">
                  <dt className="text-[var(--rz-text-muted)]">{k}</dt>
                  <dd className="text-[var(--rz-text-primary)] font-mono">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <p className="text-xs text-[var(--rz-text-muted)]">
            <Link to="/admin/queue" className="text-[var(--rz-primary)] hover:underline">
              Fila global
            </Link>
            {' · '}
            <Link to="/admin/logs" className="text-[var(--rz-primary)] hover:underline">
              Logs globais
            </Link>
          </p>
        </>
      )}
    </RadarPageShell>
  )
}
