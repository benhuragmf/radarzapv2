import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { Button } from '../components/ui/Button'
import { Calendar, Send, Plus } from 'lucide-react'
import { type Campaign } from '../lib/campaigns'
import { ScheduleStatsBar } from '../components/send/ScheduleStatsBar'
import { NextScheduleCard } from '../components/send/NextScheduleCard'
import { CampaignListPanel } from '../components/send/CampaignListPanel'
import { ScheduleHistorySection } from '../components/send/ScheduleHistorySection'
import { filterCampaigns, nextScheduled, scheduleStats } from '../lib/schedule-display'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../lib/notify'

export default function SendSchedules() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns-manual'],
    queryFn: () => api.get('/campaigns?source=manual'),
    refetchInterval: 15_000,
  })

  const stats = scheduleStats(campaigns)
  const next = nextScheduled(campaigns)
  const queue = filterCampaigns(campaigns, 'fila', search)
  const history = filterCampaigns(campaigns, 'historico', '')

  const cancelCampaign = useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns-manual'] }),
    onError: mutationError,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <Calendar size={20} className="text-brand-400" />
            Agendamentos manuais
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Envios programados em{' '}
            <Link to="/send" className="text-brand-400 hover:underline">
              Enviar agora
            </Link>
            . O sistema verifica a fila a cada ~15 s e dispara no horário marcado.
          </p>
        </div>
        <Link to="/send">
          <Button size="sm">
            <Plus size={14} /> Novo agendamento
          </Button>
        </Link>
      </div>

      <ScheduleStatsBar
        queue={stats.pending}
        processing={stats.processing}
        sent={stats.sent}
        failed={stats.failed}
      />

      {next && <NextScheduleCard campaign={next} />}

      {stats.queue === 0 && !search ? (
        <Card className="text-center py-12 text-gray-500">
          <Send size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-400">Nenhum agendamento na fila</p>
          <p className="text-sm mt-1">
            Em Enviar agora, escolha destinos, escreva a mensagem e marque uma data/hora futura.
          </p>
          <Link to="/send" className="text-brand-400 text-sm hover:underline mt-3 inline-block">
            Criar agendamento
          </Link>
        </Card>
      ) : (
        <CampaignListPanel
          campaigns={queue}
          search={search}
          onSearchChange={setSearch}
          onCancel={id => cancelCampaign.mutate(id)}
          cancelling={cancelCampaign.isPending}
        />
      )}

      <ScheduleHistorySection campaigns={history} />

      <p className="text-xs text-gray-600">
        Histórico completo em{' '}
        <Link to="/send/historico" className="text-brand-400 hover:underline">
          Histórico de envios
        </Link>
        . Acompanhe a fila em tempo real em{' '}
        <Link to="/platform/fila" className="text-brand-400 hover:underline">
          Fila de envio
        </Link>
        .
      </p>
    </div>
  )
}
