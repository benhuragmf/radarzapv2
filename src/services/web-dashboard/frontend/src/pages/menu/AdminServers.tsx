import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { api } from '../../lib/api'
import { Server, Smartphone, Hash } from 'lucide-react'
import { RadarPageShell, PageHeader, LoadingState, MetricCard } from '@/design-system'

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

  return (
    <RadarPageShell>
      <PageHeader
        title="Servidores"
        subtitle="Visão agregada de sessões WhatsApp e servidores Discord com automação ativa."
      />

      {isLoading ? (
        <LoadingState rows={3} className="pt-4" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              title="WA conectadas"
              value={data?.connectedSessions ?? 0}
              description={`${data?.whatsappSessions ?? 0} sessão(ões) total`}
              icon={Smartphone}
            />
            <MetricCard
              title="Servidores Discord"
              value={data?.discordGuilds ?? 0}
              description={`${data?.activeChannels ?? 0} canal(is) ativo(s)`}
              icon={Hash}
            />
          </div>
          <Card className="text-sm text-[var(--rz-text-secondary)]">
            <Server size={16} className="inline mr-2 text-[var(--rz-text-muted)]" />
            Gerencie sessões em{' '}
            <Link to="/admin/sessions" className="text-[var(--rz-primary)] hover:underline">
              Sessões WhatsApp
            </Link>
            .
          </Card>
        </>
      )}
    </RadarPageShell>
  )
}
