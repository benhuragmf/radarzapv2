import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card, CardTitle } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { Calendar, Cake } from 'lucide-react'
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
        Use modelos <strong className="text-gray-400">pw-*</strong> em Enviar agora → Modelo Plataforma.
      </p>

      <Card className="flex flex-wrap items-center justify-between gap-3 border-brand-800/30 bg-brand-950/10">
        <div className="flex items-start gap-3">
          <Cake size={20} className="text-brand-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-300">Aniversários automáticos</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Regras recorrentes (dia do aniversário, dia 10 do mês, a cada N meses). Job a cada 15 min.
            </p>
          </div>
        </div>
        <Link
          to="/platform/automacoes"
          className="text-sm text-brand-400 hover:underline shrink-0"
        >
          Configurar →
        </Link>
      </Card>

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
