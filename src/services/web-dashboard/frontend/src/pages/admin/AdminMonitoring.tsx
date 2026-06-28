import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, Database, Server } from 'lucide-react'
import { api } from '../../lib/api'
import AdminOpsLegacyBanner from './AdminOpsLegacyBanner'
import AdminOpsInfraPanel from './AdminOpsInfraPanel'
import { useAdminOpsSummary } from './useAdminOpsSummary'
import { Card } from '../../components/ui/Card'
import { RadarPageShell, PageHeader, LoadingState, MetricCard, SectionCard } from '@/design-system'
import { formatOpsNumber } from '@radarzap-types/admin-ops-summary.util'

type LegacyMonitoring = {
  health: { mongodb: boolean; redis: boolean }
  stats: Record<string, number>
  timestamp: string
}

export default function AdminMonitoring() {
  const ops = useAdminOpsSummary()
  const legacy = useQuery({
    queryKey: ['admin-monitoring'],
    queryFn: () => api.get<LegacyMonitoring>('/admin/monitoring'),
    refetchInterval: 15_000,
    enabled: !ops.isLoading,
  })

  const isLoading = ops.isLoading || (!ops.data && legacy.isLoading)
  const health = legacy.data?.health
  const stats = legacy.data?.stats ?? {}

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Monitoramento"
        subtitle="Saúde de MongoDB, Redis, filas e recursos do processo — complemento ao Dashboard global."
      />

      {ops.data ? (
        <>
          <AdminOpsLegacyBanner tab="infra" />
          <AdminOpsInfraPanel data={ops.data} title="Infraestrutura (Ops global)" />
        </>
      ) : null}

      {isLoading && !ops.data ? (
        <LoadingState rows={4} className="pt-4" />
      ) : legacy.data || ops.data ? (
        <SectionCard title="Stats ao vivo (legado)" className={ops.data ? 'mt-4' : ''}>
          {legacy.data ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <MetricCard
                  title="MongoDB"
                  value={health?.mongodb ? 'Conectado' : 'Offline'}
                  icon={Database}
                  status={
                    health?.mongodb
                      ? { status: 'success', text: 'OK' }
                      : { status: 'danger', text: 'Offline' }
                  }
                />
                <MetricCard
                  title="Redis"
                  value={health?.redis ? 'Conectado' : 'Offline'}
                  icon={Server}
                  status={
                    health?.redis
                      ? { status: 'success', text: 'OK' }
                      : { status: 'danger', text: 'Offline' }
                  }
                />
              </div>
              {Object.keys(stats).length > 0 ? (
                <div className="flex items-center gap-2 text-[var(--rz-text-secondary)] text-sm mb-3">
                  <Activity size={16} />
                  Estatísticas
                </div>
              ) : null}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(stats).map(([k, v]) => (
                  <MetricCard key={k} title={k} value={formatOpsNumber(v)} />
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--rz-text-muted)]">
              Stats legado indisponíveis — verifique cap <code className="text-xs">logs:global</code>.
            </p>
          )}
          <p className="mt-3 text-xs text-[var(--rz-text-muted)]">
            <Link to="/admin/queue" className="text-[var(--rz-primary)] hover:underline">
              Fila global
            </Link>
            {' · '}
            <Link to="/admin/logs" className="text-[var(--rz-primary)] hover:underline">
              Logs globais
            </Link>
          </p>
        </SectionCard>
      ) : (
        <Card className="text-sm text-[var(--rz-text-secondary)]">
          Não foi possível carregar monitoramento. Verifique permissões ou tente novamente.
        </Card>
      )}

      {ops.data ? (
        <p className="mt-4 text-xs text-[var(--rz-text-muted)]">
          Atualizado: {new Date(ops.data.generatedAt).toLocaleString('pt-BR')} · v
          {ops.data.system.version}
        </p>
      ) : null}
    </RadarPageShell>
  )
}
