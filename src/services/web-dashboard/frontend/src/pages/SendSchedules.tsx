import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card, CardTitle } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { Calendar } from 'lucide-react'
import { CampaignRow, type Campaign } from '../lib/campaigns'

export default function SendSchedules() {
  const qc = useQueryClient()

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns'),
    refetchInterval: 15_000,
  })

  const pending = campaigns.filter(c => c.status === 'pending')

  const cancelCampaign = useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
    onError: (err: Error) => alert(err.message),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-gray-500">
        Envios programados para o futuro. O sistema tenta enviar a cada 15 segundos quando chegar o horário.
      </p>

      {pending.length === 0 ? (
        <Card className="text-center py-12 text-gray-500">
          <Calendar size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-400">Nenhum agendamento pendente</p>
          <p className="text-sm mt-1">Crie um envio com data futura em Enviar agora.</p>
          <Link to="/send" className="text-brand-400 text-sm hover:underline mt-3 inline-block">
            Ir para Enviar agora
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          <CardTitle>Próximos envios ({pending.length})</CardTitle>
          {pending.map(c => (
            <CampaignRow
              key={c._id}
              c={c}
              onCancel={() => {
                if (window.confirm('Cancelar este agendamento?')) cancelCampaign.mutate(c._id)
              }}
              cancelling={cancelCampaign.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}
