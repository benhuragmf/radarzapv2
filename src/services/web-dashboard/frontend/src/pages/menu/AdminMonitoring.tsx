import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { api } from '../../lib/api'
import { Activity, Database, Server } from 'lucide-react'

export default function AdminMonitoring() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-monitoring'],
    queryFn: () =>
      api.get<{
        health: { mongodb: boolean; redis: boolean }
        stats: Record<string, number>
        timestamp: string
      }>('/admin/monitoring'),
    refetchInterval: 15_000,
  })

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size={32} /></div>
  }

  const health = data?.health
  const stats = data?.stats ?? {}

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-lg font-semibold text-white">Monitoramento</h1>
      <p className="text-sm text-gray-500">Saúde da infraestrutura e métricas globais.</p>

      <div className="grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3">
          <Database size={20} className={health?.mongodb ? 'text-green-400' : 'text-red-400'} />
          <div>
            <p className="text-xs text-gray-500">MongoDB</p>
            <p className="text-sm text-white">{health?.mongodb ? 'Conectado' : 'Offline'}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <Server size={20} className={health?.redis ? 'text-green-400' : 'text-red-400'} />
          <div>
            <p className="text-xs text-gray-500">Redis</p>
            <p className="text-sm text-white">{health?.redis ? 'Conectado' : 'Offline'}</p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-2 text-gray-300 text-sm mb-3">
          <Activity size={16} />
          Estatísticas ao vivo
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-gray-800 py-1">
              <dt className="text-gray-500">{k}</dt>
              <dd className="text-gray-200 font-mono">{String(v)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <p className="text-xs text-gray-600">
        <Link to="/admin/queue" className="text-brand-400 hover:underline">Fila global</Link>
        {' · '}
        <Link to="/admin/logs" className="text-brand-400 hover:underline">Logs globais</Link>
      </p>
    </div>
  )
}
