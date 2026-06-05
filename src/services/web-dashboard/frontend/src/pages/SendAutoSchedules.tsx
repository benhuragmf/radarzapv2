import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { Button } from '../components/ui/Button'
import { Workflow, Plus } from 'lucide-react'
import { type TriggerType } from '../lib/automation-triggers'
import type { Campaign } from '../lib/campaigns'
import { ScheduleStatsBar } from '../components/send/ScheduleStatsBar'
import { NextScheduleCard } from '../components/send/NextScheduleCard'
import { CampaignListPanel } from '../components/send/CampaignListPanel'
import { ScheduleHistorySection } from '../components/send/ScheduleHistorySection'
import { filterCampaigns, nextScheduled, scheduleStats } from '../lib/schedule-display'

interface AutomationRule {
  _id: string
  name?: string
  templateName: string
  triggerType: TriggerType
  active: boolean
  sendTime: string
  lastRunDate?: string
  dayOfMonth?: number
  weekdays?: number[]
  weekday?: number
  scheduledAt?: string
}

export default function SendAutoSchedules() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [ruleFilter, setRuleFilter] = useState('')

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns-automation'],
    queryFn: () => api.get('/campaigns?source=automation'),
    refetchInterval: 15_000,
  })

  const { data: rules = [] } = useQuery<AutomationRule[]>({
    queryKey: ['platform-automations'],
    queryFn: () => api.get('/platform/automations'),
  })

  const ruleName = (id?: string) => {
    if (!id) return '—'
    const r = rules.find(x => x._id === id)
    return r?.name ?? r?.templateName ?? id.slice(-6)
  }

  const filteredByRule = useMemo(() => {
    if (!ruleFilter) return campaigns
    return campaigns.filter(c => c.automationRuleId === ruleFilter)
  }, [campaigns, ruleFilter])

  const stats = scheduleStats(filteredByRule)
  const next = nextScheduled(filteredByRule)
  const queue = filterCampaigns(filteredByRule, 'fila', search)
  const history = filterCampaigns(filteredByRule, 'historico', '')

  const cancelCampaign = useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns-automation'] }),
    onError: (err: Error) => alert(err.message),
  })

  const activeRules = rules.filter(r => r.active)

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
            <Workflow size={20} className="text-brand-400" />
            Agendamentos de automação
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Envios enfileirados quando um gatilho bate (aniversário, calendário, semanal, etc.).
            Regras iminentes: checagem a cada 1 min · recorrentes: planejamento a cada 5 min.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/platform/gatilhos">
            <Button size="sm" variant="secondary">
              Gatilhos
            </Button>
          </Link>
          <Link to="/platform/automacoes">
            <Button size="sm">
              <Plus size={14} /> Nova regra
            </Button>
          </Link>
        </div>
      </div>

      <ScheduleStatsBar
        queue={stats.pending}
        processing={stats.processing}
        sent={stats.sent}
        failed={stats.failed}
      />

      {next && (
        <NextScheduleCard
          campaign={next}
          ruleLabel={ruleName(next.automationRuleId)}
          editRuleId={next.automationRuleId}
        />
      )}

      <Card className="border-brand-800/30 bg-brand-950/10 text-xs text-gray-400">
        <p>
          <strong className="text-gray-300">Regras ativas:</strong> {activeRules.length} ·{' '}
          <strong className="text-gray-300">Pausadas:</strong> {rules.length - activeRules.length}
          {stats.failed > 0 && (
            <>
              {' '}
              · <span className="text-red-400">{stats.failed} falha(s) no histórico</span>
            </>
          )}
        </p>
      </Card>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-xs text-gray-500">Filtrar por regra:</label>
        <select
          value={ruleFilter}
          onChange={e => setRuleFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200"
        >
          <option value="">Todas as regras</option>
          {rules.map(r => (
            <option key={r._id} value={r._id}>
              {r.name || r.templateName} {r.active ? '' : '(pausada)'}
            </option>
          ))}
        </select>
      </div>

      {stats.queue === 0 && !search && !ruleFilter ? (
        <Card className="text-center py-12 text-gray-500">
          <Workflow size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-400">Nenhum envio automático na fila</p>
          <p className="text-sm mt-1">
            Quando o gatilho bater no dia, os envios aparecem aqui com o horário programado.
          </p>
          <Link to="/platform/automacoes" className="text-brand-400 text-sm hover:underline mt-3 inline-block">
            Configurar automações
          </Link>
        </Card>
      ) : (
        <CampaignListPanel
          campaigns={queue}
          search={search}
          onSearchChange={setSearch}
          onCancel={id => cancelCampaign.mutate(id)}
          cancelling={cancelCampaign.isPending}
          emptyMessage="Nenhum envio automático na fila para este filtro."
        />
      )}

      <ScheduleHistorySection
        campaigns={history}
        ruleName={ruleName}
        showRuleColumn
      />
    </div>
  )
}
