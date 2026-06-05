import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { api } from '../../lib/api'
import { LayoutDashboard, Users, Smartphone, AlertTriangle } from 'lucide-react'

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-monitoring'],
    queryFn: () =>
      api.get<{
        health: { mongodb: boolean; redis: boolean }
        stats: Record<string, number>
        timestamp: string
      }>('/admin/monitoring'),
    refetchInterval: 30_000,
  })

  const stats = data?.stats ?? {}
  const cards = [
    { label: 'Mensagens (sistema)', value: stats.totalMessages ?? 0, icon: LayoutDashboard, color: 'text-brand-400' },
    { label: 'Sessões WA ativas', value: stats.activeSessions ?? 0, icon: Smartphone, color: 'text-blue-400' },
    { label: 'Fila pendente', value: stats.pendingJobs ?? 0, icon: Users, color: 'text-yellow-400' },
    { label: 'Falhas na fila', value: stats.failedJobs ?? 0, icon: AlertTriangle, color: 'text-red-400' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Dashboard global</h1>
        <p className="text-sm text-gray-500 mt-1">
          Visão geral do RadarZap — clientes, sessões, fila e saúde da plataforma.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <Icon size={18} className={color} />
                </div>
                <p className="text-2xl font-semibold text-white">{value.toLocaleString('pt-BR')}</p>
              </Card>
            ))}
          </div>

          <Card className="text-sm text-gray-400 space-y-2">
            <p>Infraestrutura:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>MongoDB: {data?.health?.mongodb ? 'conectado' : 'offline'}</li>
              <li>Redis: {data?.health?.redis ? 'conectado' : 'offline'}</li>
            </ul>
            <p className="pt-2">
              Acesse{' '}
              <Link to="/admin/monitoring" className="text-brand-400 hover:underline">
                Monitoramento
              </Link>{' '}
              para detalhes ou{' '}
              <Link to="/admin/clients" className="text-brand-400 hover:underline">
                Clientes
              </Link>{' '}
              para suporte.
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
