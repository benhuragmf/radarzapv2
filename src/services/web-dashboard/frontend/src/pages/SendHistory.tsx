import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { CardTitle } from '../components/ui/Card'
import { History } from 'lucide-react'
import { CampaignRow, type Campaign } from '../lib/campaigns'
import { RadarPageShell, PageHeader, EmptyState, LoadingState } from '@/design-system'

export default function SendHistory() {
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns'),
    refetchInterval: 30_000,
  })

  const history = campaigns.filter(c => c.status !== 'pending')

  if (isLoading) {
    return (
      <RadarPageShell>
        <LoadingState rows={4} className="pt-8" />
      </RadarPageShell>
    )
  }

  return (
    <RadarPageShell>
      <PageHeader
        title="Histórico de envios"
        subtitle="Envios já processados — enviados, em andamento ou com falha."
      />

      {history.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhum envio no histórico"
          description="Após enviar ou agendar, os registros aparecem aqui."
          action={
            <Link to="/send" className="text-sm text-[var(--rz-primary)] hover:underline">
              Ir para Enviar agora
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          <CardTitle>Histórico ({history.length})</CardTitle>
          {history.map(c => (
            <CampaignRow key={c._id} c={c} />
          ))}
        </div>
      )}
    </RadarPageShell>
  )
}
