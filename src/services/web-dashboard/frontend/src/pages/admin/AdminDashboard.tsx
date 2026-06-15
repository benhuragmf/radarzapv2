import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { api } from '../../lib/api'
import { LayoutDashboard, Users, Smartphone, AlertTriangle } from 'lucide-react'
import { RadarPageShell, PageHeader, MetricCard, LoadingState } from '@/design-system'

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-monitoring'],
    queryFn: () =>
      api.get<{
        health: { mongodb: boolean; redis: boolean }
        stats: Record<string, number>
        timestamp: string
      }>('/admin/monitoring'),
    refetchInterval: 30_000,
  })

  const stats = data?.stats ?? {}

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Dashboard global"
        subtitle="Visão geral do RadarZap — clientes, sessões, fila e saúde da plataforma."
      />

      {isLoading ? (
        <LoadingState rows={4} className="pt-4" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Mensagens (sistema)"
              value={(stats.totalMessages ?? 0).toLocaleString('pt-BR')}
              icon={LayoutDashboard}
            />
            <MetricCard
              title="Sessões WA ativas"
              value={stats.activeSessions ?? 0}
              icon={Smartphone}
            />
            <MetricCard title="Fila pendente" value={stats.pendingJobs ?? 0} icon={Users} />
            <MetricCard
              title="Falhas na fila"
              value={stats.failedJobs ?? 0}
              icon={AlertTriangle}
              status={(stats.failedJobs ?? 0) > 0 ? { status: 'danger', text: 'Atenção' } : undefined}
            />
          </div>

          <Card className="text-sm text-[var(--rz-text-secondary)] space-y-2">
            <p>Infraestrutura:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>MongoDB: {data?.health?.mongodb ? 'conectado' : 'offline'}</li>
              <li>Redis: {data?.health?.redis ? 'conectado' : 'offline'}</li>
            </ul>
            <p className="pt-2">
              Acesse{' '}
              <Link to="/admin/monitoring" className="text-[var(--rz-primary)] hover:underline">
                Monitoramento
              </Link>{' '}
              para detalhes ou{' '}
              <Link to="/admin/clients" className="text-[var(--rz-primary)] hover:underline">
                Clientes
              </Link>{' '}
              para suporte.
            </p>
          </Card>
        </>
      )}
    </RadarPageShell>
  )
}
