import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import AdminOpsLegacyBanner from './AdminOpsLegacyBanner'
import AdminOpsServersPanel from './AdminOpsServersPanel'
import { useAdminOpsSummary } from './useAdminOpsSummary'
import { Card } from '../../components/ui/Card'
import { RadarPageShell, PageHeader, LoadingState, MetricCard } from '@/design-system'
import { Hash, Smartphone } from 'lucide-react'

type DiscordSummary = {
  whatsappSessions: number
  connectedSessions: number
  discordGuilds: number
  activeChannels: number
}

export default function AdminServers() {
  const ops = useAdminOpsSummary()
  const discord = useQuery({
    queryKey: ['admin-servers-summary'],
    queryFn: () => api.get<DiscordSummary>('/admin/servers-summary'),
    refetchInterval: 30_000,
  })

  const isLoading = ops.isLoading || discord.isLoading

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Servidores"
        subtitle="WhatsApp, Discord e canais digitais — visão operacional global."
      />

      {ops.data ? (
        <>
          <AdminOpsLegacyBanner tab="atendimento" />
          <AdminOpsServersPanel ops={ops.data} discord={discord.data} />
        </>
      ) : isLoading ? (
        <LoadingState rows={4} className="pt-4" />
      ) : discord.data ? (
        <>
          <Card className="mb-4 text-sm text-[var(--rz-text-secondary)]">
            Resumo Discord/WA (capacidade <code className="text-xs">system:servers:view</code>). Para
            métricas de Inbox/WebChat, solicite acesso ao Dashboard global.
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              title="WhatsApp"
              value={`${discord.data.connectedSessions}/${discord.data.whatsappSessions}`}
              description="Conectadas / total"
              icon={Smartphone}
            />
            <MetricCard
              title="Discord"
              value={discord.data.discordGuilds}
              description={`${discord.data.activeChannels} canal(is) ativo(s)`}
              icon={Hash}
            />
          </div>
        </>
      ) : (
        <Card className="text-sm text-[var(--rz-text-secondary)]">
          Não foi possível carregar servidores. Verifique permissões ou tente novamente.
        </Card>
      )}
    </RadarPageShell>
  )
}
