import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { DiscordPage } from '../components/discord/DiscordPage'
import { CampaignRow, type Campaign } from '../lib/campaigns'
import { History } from 'lucide-react'
import { RadarPageShell, PageHeader, EmptyState, LoadingState } from '@/design-system'

export default function DestinationsHistory() {
  const isDiscord = useLocation().pathname.startsWith('/discord')

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns'),
    refetchInterval: 30_000,
  })

  const history = campaigns.filter(c => c.status !== 'pending')

  const body = (
    <div className="space-y-3">
      <p className="text-sm text-[var(--rz-text-secondary)]">
        Envios já processados (automação Discord e campanhas manuais).
      </p>
      {isLoading ? (
        <LoadingState rows={4} className="pt-6" />
      ) : history.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhum registro no histórico"
          description="Após enviar ou agendar campanhas, os registros aparecem aqui."
        />
      ) : (
        history.map(c => <CampaignRow key={c._id} c={c} />)
      )}
      {isDiscord && (
        <Link to="/discord/logs" className="text-xs text-[var(--rz-primary)] hover:underline">
          Ver logs detalhados do Discord →
        </Link>
      )}
    </div>
  )

  if (isDiscord) {
    return (
      <DiscordPage description="Histórico de mensagens enviadas ao WhatsApp pela automação.">
        {body}
      </DiscordPage>
    )
  }

  return (
    <RadarPageShell>
      <PageHeader title="Histórico de envios" />
      {body}
    </RadarPageShell>
  )
}
