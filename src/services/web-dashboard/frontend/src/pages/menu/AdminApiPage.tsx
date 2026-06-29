import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AdminOpsHubLink from '../admin/AdminOpsHubLink'
import { Card } from '../../components/ui/Card'
import { api } from '../../lib/api'
import { RadarPageShell, PageHeader, LoadingState, MetricCard } from '@/design-system'

export default function AdminApiPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-integrations-overview'],
    queryFn: () =>
      api.get<{
        apiKeysActive: number
        webhooksActive: number
        organizations: number
        billingOrdersPaid: number
        stripeMode: string
      }>('/admin/integrations-overview'),
    refetchInterval: 30_000,
  })

  return (
    <RadarPageShell>
      <PageHeader title="API global" subtitle="Visão administrativa das integrações em todo o Radar Chat." />

      <AdminOpsHubLink tab="overview" label="Resumo operacional consolidado:" />

      {isLoading ? (
        <LoadingState rows={3} className="pt-4" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <MetricCard title="Chaves API ativas" value={data?.apiKeysActive ?? 0} />
          <MetricCard title="Webhooks ativos" value={data?.webhooksActive ?? 0} />
          <MetricCard title="Organizações" value={data?.organizations ?? 0} />
          <MetricCard title="Pedidos pagos" value={data?.billingOrdersPaid ?? 0} />
        </div>
      )}

      {data?.stripeMode && (
        <Card className="text-sm text-[var(--rz-text-secondary)]">
          Stripe: <span className="capitalize text-[var(--rz-text-primary)]">{data.stripeMode}</span>
        </Card>
      )}

      <Card className="text-sm text-[var(--rz-text-secondary)] space-y-2">
        <p>Operações:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <Link to="/admin/errors" className="text-[var(--rz-primary)] hover:underline">
              Erros do sistema
            </Link>
          </li>
          <li>
            <Link to="/admin/queue" className="text-[var(--rz-primary)] hover:underline">
              Fila global
            </Link>
          </li>
          <li>
            <Link to="/admin/monitoring" className="text-[var(--rz-primary)] hover:underline">
              Monitoramento
            </Link>
          </li>
        </ul>
      </Card>
    </RadarPageShell>
  )
}
