import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { api } from '../../lib/api'
import AdminOpsHubLink from '../admin/AdminOpsHubLink'
import { adminDashboardTabUrl } from '../admin/adminOpsTabs'
import { RadarPageShell, PageHeader, LoadingState, EmptyState } from '@/design-system'

interface AuditRow {
  _id: string
  action: string
  actorDiscordId?: string
  targetGuildId?: string
  details?: Record<string, unknown>
  createdAt: string
}

export default function AdminAuditPage() {
  const { data: logs = [], isLoading } = useQuery<AuditRow[]>({
    queryKey: ['admin-audit-logs'],
    queryFn: () => api.get('/admin/audit-logs'),
    refetchInterval: 30_000,
  })

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader title="Auditoria" subtitle="Ações administrativas registradas no sistema." />

      <AdminOpsHubLink
        tab="security"
        label="Eventos operacionais recentes (Attendance, Audit, SystemLog):"
      />

      <Card className="mb-4 text-xs text-[var(--rz-text-muted)]">
        Esta página lista <code>AuditLog</code> staff. Para feed unificado sanitizado, use{' '}
        <Link to={adminDashboardTabUrl('security')} className="text-[var(--rz-primary)] hover:underline">
          Segurança no dashboard
        </Link>
        .
      </Card>

      {isLoading ? (
        <LoadingState rows={5} className="pt-4" />
      ) : logs.length === 0 ? (
        <EmptyState title="Nenhum registro" description="Nenhuma ação administrativa registrada ainda." />
      ) : (
        <div className="space-y-2">
          {logs.map(row => (
            <Card key={row._id} className="text-xs">
              <div className="flex justify-between gap-2 mb-1">
                <span className="text-[var(--rz-primary)] font-medium">{row.action}</span>
                <span className="text-[var(--rz-text-muted)] shrink-0">
                  {new Date(row.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
              {row.actorDiscordId && (
                <p className="text-[var(--rz-text-muted)]">Actor: {row.actorDiscordId}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </RadarPageShell>
  )
}
