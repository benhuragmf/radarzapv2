import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { api } from '../../lib/api'
import { Ban } from 'lucide-react'

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
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <Ban size={20} className="text-red-400" />
        Erros do sistema
      </h1>
      <p className="text-sm text-gray-500">Últimas 24 horas — nível error.</p>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : logs.length === 0 ? (
        <Card className="text-center py-12 text-gray-500 text-sm">Nenhum erro recente.</Card>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <Card key={log._id} className="text-xs">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge label={log.level} variant="red" />
                <span className="text-gray-500">{log.service}</span>
                <span className="text-gray-600 ml-auto">
                  {new Date(log.timestamp).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="text-gray-300">{log.message}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
