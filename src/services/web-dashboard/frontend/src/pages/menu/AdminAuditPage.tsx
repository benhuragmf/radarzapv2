import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { api } from '../../lib/api'

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
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-lg font-semibold text-white">Auditoria</h1>
      <p className="text-sm text-gray-500">Ações administrativas registradas no sistema.</p>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : logs.length === 0 ? (
        <Card className="text-center py-12 text-gray-500 text-sm">Nenhum registro ainda.</Card>
      ) : (
        <div className="space-y-2">
          {logs.map(row => (
            <Card key={row._id} className="text-xs">
              <div className="flex justify-between gap-2 mb-1">
                <span className="text-brand-300 font-medium">{row.action}</span>
                <span className="text-gray-600 shrink-0">
                  {new Date(row.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
              {row.actorDiscordId && (
                <p className="text-gray-500">Actor: {row.actorDiscordId}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
