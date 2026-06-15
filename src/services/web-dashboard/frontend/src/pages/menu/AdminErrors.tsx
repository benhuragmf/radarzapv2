import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { api } from '../../lib/api'
import { Ban } from 'lucide-react'
import { RadarPageShell, PageHeader, LoadingState, EmptyState } from '@/design-system'

interface ErrorLog {
  _id: string
  level: string
  service: string
  message: string
  timestamp: string
}

export default function AdminErrors() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-errors'],
    queryFn: () =>
      api.get<{ logs: ErrorLog[]; since: string }>('/admin/errors'),
    refetchInterval: 20_000,
  })

  const logs = data?.logs ?? []

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Erros do sistema"
        subtitle="Últimas 24 horas — nível error."
      />

      {isLoading ? (
        <LoadingState rows={5} className="pt-4" />
      ) : logs.length === 0 ? (
        <EmptyState icon={Ban} title="Nenhum erro recente" description="Nenhum erro registrado nas últimas 24 horas." />
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
              <p className="text-[var(--rz-text-secondary)]">{log.message}</p>
            </Card>
          ))}
        </div>
      )}
    </RadarPageShell>
  )
}
