import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { DiscordPage } from '../components/discord/DiscordPage'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { CampaignRow, type Campaign } from '../lib/campaigns'
import { History } from 'lucide-react'

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
      <p className="text-sm text-gray-500">
        Envios já processados (automação Discord e campanhas manuais).
      </p>
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : history.length === 0 ? (
        <Card className="text-center py-12 text-gray-500">
          <History size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-400">Nenhum registro no histórico</p>
        </Card>
      ) : (
        history.map(c => <CampaignRow key={c._id} c={c} />)
      )}
      {isDiscord && (
        <Link to="/discord/logs" className="text-xs text-brand-400 hover:underline">
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

  return <div className="max-w-3xl">{body}</div>
}
