import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Send, Plus } from 'lucide-react'
import { type Campaign } from '../lib/campaigns'
import { ScheduleStatsBar } from '../components/send/ScheduleStatsBar'
import { NextScheduleCard } from '../components/send/NextScheduleCard'
import { CampaignListPanel } from '../components/send/CampaignListPanel'
import { ScheduleHistorySection } from '../components/send/ScheduleHistorySection'
import { filterCampaigns, nextScheduled, scheduleStats } from '../lib/schedule-display'
import { mutationError } from '../lib/notify'
import { RadarPageShell, PageHeader, EmptyState, LoadingState } from '@/design-system'

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
      <RadarPageShell>
        <LoadingState rows={5} className="pt-8" />
      </RadarPageShell>
    )
  }

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Agendamentos manuais"
        subtitle={
          <>
            Envios programados em{' '}
            <Link to="/send" className="text-[var(--rz-primary)] hover:underline">
              Enviar agora
            </Link>
            . O sistema verifica a fila a cada ~15 s e dispara no horário marcado.
          </>
        }
        actions={
          <Link to="/send">
            <Button size="sm">
              <Plus size={14} /> Novo agendamento
            </Button>
          </Link>
        }
      />

      <ScheduleStatsBar
        queue={stats.pending}
        processing={stats.processing}
        sent={stats.sent}
        failed={stats.failed}
      />

      {next && <NextScheduleCard campaign={next} />}

      {stats.queue === 0 && !search ? (
        <EmptyState
          icon={Send}
          title="Nenhum agendamento na fila"
          description="Em Enviar agora, escolha destinos, escreva a mensagem e marque uma data/hora futura."
          action={
            <Link to="/send" className="text-sm text-[var(--rz-primary)] hover:underline">
              Criar agendamento
            </Link>
          }
        />
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

      <p className="text-xs text-[var(--rz-text-muted)]">
        Histórico completo em{' '}
        <Link to="/send/historico" className="text-[var(--rz-primary)] hover:underline">
          Histórico de envios
        </Link>
        . Acompanhe a fila em{' '}
        <Link to="/platform/fila" className="text-[var(--rz-primary)] hover:underline">
          Fila de envio
        </Link>
        .
      </p>
    </RadarPageShell>
  )
}
