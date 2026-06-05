import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { api } from '../../lib/api'
import { CampaignRow, type Campaign } from '../../lib/campaigns'
import { Megaphone, Plus } from 'lucide-react'

export default function PlatformCampaigns() {
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns'),
    refetchInterval: 15_000,
  })

  const pending = campaigns.filter(c => c.status === 'pending' || c.status === 'processing')
  const done = campaigns.filter(c => !['pending', 'processing'].includes(c.status))

  return (
    <PlatformPage
      title="Campanhas"
      description="Todos os envios em lote — pendentes, em andamento e concluídos."
    >
      <div className="flex gap-2 mb-4">
        <Link to="/send">
          <Button size="sm"><Plus size={14} /> Nova campanha</Button>
        </Link>
        <Link to="/send/agendamentos">
          <Button size="sm" variant="ghost">Agendamentos</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      ) : campaigns.length === 0 ? (
        <Card className="text-center py-12 text-gray-500">
          <Megaphone size={32} className="mx-auto mb-2 opacity-40" />
          <p>Nenhuma campanha ainda.</p>
          <Link to="/send" className="text-brand-400 text-sm hover:underline mt-2 inline-block">
            Enviar agora
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-gray-300 mb-2">Ativas ({pending.length})</h2>
              <div className="space-y-2">{pending.map(c => <CampaignRow key={c._id} c={c} />)}</div>
            </section>
          )}
          <section>
            <h2 className="text-sm font-medium text-gray-300 mb-2">
              Histórico ({done.length})
            </h2>
            <div className="space-y-2">
              {done.slice(0, 30).map(c => <CampaignRow key={c._id} c={c} />)}
            </div>
          </section>
        </div>
      )}
    </PlatformPage>
  )
}
