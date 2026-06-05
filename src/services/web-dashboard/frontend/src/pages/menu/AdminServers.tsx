import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { api } from '../../lib/api'
import { Server, Smartphone, Hash } from 'lucide-react'

export default function AdminServers() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-servers-summary'],
    queryFn: () =>
      api.get<{
        whatsappSessions: number
        connectedSessions: number
        discordGuilds: number
        activeChannels: number
      }>('/admin/servers-summary'),
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size={32} /></div>
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-white">Servidores</h1>
      <p className="text-sm text-gray-500">
        Visão agregada de sessões WhatsApp e servidores Discord com automação ativa.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <Smartphone size={18} className="text-blue-400 mb-2" />
          <p className="text-2xl font-semibold text-white">{data?.connectedSessions ?? 0}</p>
          <p className="text-xs text-gray-500">WA conectadas / {data?.whatsappSessions ?? 0} total</p>
        </Card>
        <Card>
          <Hash size={18} className="text-violet-400 mb-2" />
          <p className="text-2xl font-semibold text-white">{data?.discordGuilds ?? 0}</p>
          <p className="text-xs text-gray-500">{data?.activeChannels ?? 0} canal(is) ativo(s)</p>
        </Card>
      </div>
      <Card className="text-sm text-gray-400">
        <Server size={16} className="inline mr-2 text-gray-500" />
        Gerencie sessões em{' '}
        <Link to="/admin/sessions" className="text-brand-400 hover:underline">
          Sessões WhatsApp
        </Link>
        .
      </Card>
    </div>
  )
}
