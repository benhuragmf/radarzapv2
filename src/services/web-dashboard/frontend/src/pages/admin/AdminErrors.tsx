import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Ban } from 'lucide-react'
import { api } from '../../lib/api'
import AdminOpsLegacyBanner from './AdminOpsLegacyBanner'
import AdminOpsSecurityPanel from './AdminOpsSecurityPanel'
import { useAdminOpsSummary } from './useAdminOpsSummary'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { RadarPageShell, PageHeader, LoadingState, EmptyState } from '@/design-system'
import { sanitizeOpsDisplayText } from '@radarchat-types/admin-ops-summary.util'

interface ErrorLog {
  _id: string
  level: string
  service: string
  message: string
  timestamp: string
}

type LegacyErrors = {
  logs: ErrorLog[]
  since: string
}

export default function AdminErrors() {
  const ops = useAdminOpsSummary()
  const legacy = useQuery({
    queryKey: ['admin-errors'],
    queryFn: () => api.get<LegacyErrors>('/admin/errors'),
    refetchInterval: 30_000,
    enabled: !ops.data && !ops.isLoading,
  })

  const isLoading = ops.isLoading || (!ops.data && legacy.isLoading)
  const logs = legacy.data?.logs ?? []

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Erros do sistema"
        subtitle="Eventos de erro sanitizados (24h) — feed unificado com a aba Segurança do Dashboard global."
      />

      <Card className="mb-4 text-sm text-[var(--rz-text-secondary)]">
        Reportes enviados pelos participantes da Fase Alfa ficam em{' '}
        <Link to="/admin/fase-alfa-reportes" className="text-[var(--rz-primary)] hover:underline">
          Reportes Fase Alfa
        </Link>
        .
      </Card>

      {ops.data ? (
        <>
          <AdminOpsLegacyBanner tab="security" label="Feed completo com filtros e alertas:" />
          <AdminOpsSecurityPanel
            security={ops.data.security}
            alerts={ops.data.alerts}
            initialLevelFilter="error"
          />
        </>
      ) : isLoading ? (
        <LoadingState rows={5} className="pt-4" />
      ) : legacy.data ? (
        <>
          <Card className="mb-4 text-sm text-[var(--rz-text-secondary)]">
            Lista bruta de SystemLog (capacidade <code className="text-xs">logs:global</code>).
            Para feed sanitizado unificado, solicite acesso ao Dashboard global.
          </Card>
          {logs.length === 0 ? (
            <EmptyState
              icon={Ban}
              title="Nenhum erro recente"
              description="Nenhum erro registrado nas últimas 24 horas."
            />
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <Card key={log._id} className="text-xs">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge label={log.level} variant="red" />
                    <span className="text-[var(--rz-text-muted)]">{log.service}</span>
                    <span className="text-[var(--rz-text-muted)] ml-auto">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-[var(--rz-text-secondary)]">
                    {sanitizeOpsDisplayText(log.message)}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <Card className="text-sm text-[var(--rz-text-secondary)]">
          Não foi possível carregar erros. Verifique permissões ou tente novamente.
        </Card>
      )}
    </RadarPageShell>
  )
}
