import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { api } from '../../lib/api'
import { CampaignRow, type Campaign } from '../../lib/campaigns'
import { Megaphone, Plus } from 'lucide-react'
import { LoadingState, EmptyState } from '@/design-system'

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
        <LoadingState rows={4} className="pt-4" />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nenhuma campanha ainda"
          description="Crie envios em lote a partir de Enviar agora."
          action={
            <Link to="/send" className="text-sm text-[var(--rz-primary)] hover:underline">
              Enviar agora
            </Link>
          }
        />
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
