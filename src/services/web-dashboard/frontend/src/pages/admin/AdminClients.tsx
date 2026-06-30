import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import AdminOpsHubLink from './AdminOpsHubLink'
import { useAdminOpsSummary } from './useAdminOpsSummary'
import { adminDashboardTabUrl } from './adminOpsTabs'
import { formatOpsNumber } from '@radarchat-types/admin-ops-summary.util'
import {
  RadarPageShell,
  PageHeader,
  LoadingState,
  EmptyState,
  MetricCard,
  SectionCard,
} from '@/design-system'

interface AdminUserRow {
  _id: string
  discordUserId: string | null
  email: string | null
  displayName: string
  organizationName: string | null
  plan: string
}

function userSubtitle(u: AdminUserRow): string {
  const parts = [
    u.organizationName,
    u.discordUserId ? `Discord ${u.discordUserId}` : null,
    u.email,
    `Conta ${u._id}`,
  ].filter(Boolean)
  return parts.join(' · ')
}

export default function AdminClients() {
  const ops = useAdminOpsSummary()
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<AdminUserRow[]>('/users'),
  })

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Usuários"
        subtitle="Contas cadastradas (Discord/e-mail). Para empresas, planos e trial, use Empresas no Dashboard global."
      />

      <AdminOpsHubLink
        tab="tenants"
        label="Gerenciar empresas (planos, trial, billing):"
      />

      <Card
        className="mb-4 text-sm text-[var(--rz-text-secondary)]"
        data-testid="admin-users-vs-orgs-guide"
      >
        <p>
          <strong className="text-[var(--rz-text-primary)]">Usuários</strong> = pessoas com login.
          {' '}
          <strong className="text-[var(--rz-text-primary)]">Empresas</strong> = organizações tenant
          (plano, trial, limites).{' '}
          <Link to={adminDashboardTabUrl('tenants')} className="text-[var(--rz-primary)] hover:underline">
            Abrir Empresas no dashboard
          </Link>
        </p>
      </Card>

      {ops.data ? (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <MetricCard
            title="Usuários listados"
            value={formatOpsNumber(users.length)}
            icon={Users}
          />
          <MetricCard
            title="Organizações (Ops)"
            value={formatOpsNumber(ops.data.tenants.totalOrganizations)}
            description="Ver detalhe na aba Empresas"
          />
        </div>
      ) : null}

      <SectionCard title="Contas cadastradas">
        {isLoading ? (
          <LoadingState rows={4} />
        ) : users.length === 0 ? (
          <EmptyState title="Nenhum usuário" description="Nenhuma conta cadastrada ainda." />
        ) : (
          <div className="grid gap-3">
            {users.map(u => (
              <Card key={u._id} className="flex justify-between items-center gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.displayName}</p>
                  <p className="text-xs text-[var(--rz-text-muted)] truncate">{userSubtitle(u)}</p>
                </div>
                <span className="text-xs capitalize text-[var(--rz-primary)] shrink-0">{u.plan}</span>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
    </RadarPageShell>
  )
}
