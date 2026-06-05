import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card, CardTitle } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { History } from 'lucide-react'
import { CampaignRow, type Campaign } from '../lib/campaigns'

export default function SendHistory() {
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns'),
    refetchInterval: 30_000,
  })

  const history = campaigns.filter(c => c.status !== 'pending')

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold text-white">Histórico de envios</h1>
      <p className="text-sm text-gray-500">
        Envios já processados — enviados, em andamento ou com falha.
      </p>

      {history.length === 0 ? (
        <Card className="text-center py-12 text-gray-500">
          <History size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-400">Nenhum envio no histórico</p>
          <p className="text-sm mt-1">Após enviar ou agendar, os registros aparecem aqui.</p>
          <Link to="/send" className="text-brand-400 text-sm hover:underline mt-3 inline-block">
            Ir para Enviar agora
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          <CardTitle>Histórico ({history.length})</CardTitle>
          {history.map(c => (
            <CampaignRow key={c._id} c={c} />
          ))}
        </div>
      )}
    </div>
  )
}
