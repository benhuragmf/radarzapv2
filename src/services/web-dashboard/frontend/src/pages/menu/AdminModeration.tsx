import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Shield, UserX, Ban, Building2 } from 'lucide-react'
import AdminOpsHubLink from '../admin/AdminOpsHubLink'
import { useAdminOpsSummary } from '../admin/useAdminOpsSummary'
import { adminDashboardTabUrl } from '../admin/adminOpsTabs'
import { formatOpsNumber } from '@radarzap-types/admin-ops-summary.util'
import { RadarPageShell, PageHeader, MetricCard } from '@/design-system'

export default function AdminModeration() {
  const ops = useAdminOpsSummary()

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Moderação"
        subtitle="Consentimento LGPD, bloqueios manuais e atalhos operacionais — sem duplicar gestão de planos."
      />

      <AdminOpsHubLink
        tab="tenants"
        label="Alterar plano, trial ou billing de empresas:"
      />

      {ops.data ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <MetricCard
            title="Organizações"
            value={formatOpsNumber(ops.data.tenants.totalOrganizations)}
            icon={Building2}
          />
          <MetricCard title="Em trial" value={formatOpsNumber(ops.data.tenants.trialingOrganizations)} />
          <MetricCard title="Past due" value={formatOpsNumber(ops.data.tenants.pastDueOrganizations)} />
          <MetricCard title="Expiradas" value={formatOpsNumber(ops.data.tenants.expiredOrganizations)} />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <Card className="flex gap-3" data-testid="admin-mod-blocked">
          <UserX size={20} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--rz-text-primary)]">Bloqueio manual</p>
            <p className="text-xs text-[var(--rz-text-muted)] mt-1">
              <Link to="/contact?consent=blocked" className="text-[var(--rz-primary)] hover:underline">
                Contatos → Bloqueados
              </Link>
            </p>
          </div>
        </Card>
        <Card className="flex gap-3" data-testid="admin-mod-refused">
          <Ban size={20} className="text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[var(--rz-text-primary)]">Consentimento recusado</p>
            <p className="text-xs text-[var(--rz-text-muted)] mt-1">
              <Link to="/contact?consent=refused" className="text-[var(--rz-primary)] hover:underline">
                Contatos → Recusados
              </Link>
            </p>
          </div>
        </Card>
      </div>

      <Card className="text-sm text-[var(--rz-text-secondary)] space-y-2">
        <p className="flex items-center gap-2 text-[var(--rz-text-primary)]">
          <Shield size={14} /> Atalhos
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>
            <Link to={adminDashboardTabUrl('tenants')} className="text-[var(--rz-primary)] hover:underline">
              Empresas no dashboard
            </Link>
            {' — planos, trial, auditoria'}
          </li>
          <li>
            <Link to="/admin/payments" className="text-[var(--rz-primary)] hover:underline">
              Pagamentos Stripe
            </Link>
          </li>
          <li>
            <Link to="/admin/dashboard?tab=security" className="text-[var(--rz-primary)] hover:underline">
              Eventos de segurança
            </Link>
          </li>
        </ul>
      </Card>
    </RadarPageShell>
  )
}
