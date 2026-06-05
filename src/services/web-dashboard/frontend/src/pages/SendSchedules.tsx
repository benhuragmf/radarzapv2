import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Calendar, Workflow, Plus, Trash2 } from 'lucide-react'
import { describeTrigger, type TriggerType } from '../lib/automation-triggers'

interface Campaign {
  _id: string
  title: string
  message: string
  destinations: Array<{ name: string; type: string }>
  status: 'pending' | 'processing' | 'sent' | 'failed'
  scheduledFor: string
  processedAt?: string
  lastError?: string
  sentCount?: number
  source?: string
  automationRuleId?: string
}

interface AutomationRule {
  _id: string
  name?: string
  templateName: string
  triggerType: TriggerType
  active: boolean
  sendTime: string
  scheduledAt?: string
  lastRunDate?: string
  dayOfMonth?: number
  weekdays?: number[]
  weekday?: number
}

const STATUS_PT: Record<Campaign['status'], string> = {
  pending: 'Na fila',
  processing: 'Enviando',
  sent: 'Enviado',
  failed: 'Erro',
}

const STATUS_VARIANT: Record<Campaign['status'], 'yellow' | 'blue' | 'green' | 'red'> = {
  pending: 'yellow',
  processing: 'blue',
  sent: 'green',
  failed: 'red',
}

export default function SendSchedules() {
  const qc = useQueryClient()

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns-automation'],
    queryFn: () => api.get('/campaigns?source=automation'),
    refetchInterval: 15_000,
  })

  const { data: rules = [] } = useQuery<AutomationRule[]>({
    queryKey: ['platform-automations'],
    queryFn: () => api.get('/platform/automations'),
  })

  const pending = campaigns.filter(c => c.status === 'pending' || c.status === 'processing')
  const history = campaigns.filter(c => c.status === 'sent' || c.status === 'failed')

  const cancelCampaign = useMutation({
    mutationFn: (id: string) => api.delete(`/campaigns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns-automation'] }),
    onError: (err: Error) => alert(err.message),
  })

  const ruleName = (id?: string) => {
    if (!id) return '—'
    const r = rules.find(x => x._id === id)
    return r?.name ?? r?.templateName ?? id.slice(-6)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <Workflow size={20} className="text-brand-400" />
            Agendamentos de automação
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Somente envios gerados por regras automáticas — não inclui campanhas manuais de{' '}
            <Link to="/send" className="text-brand-400 hover:underline">
              Enviar agora
            </Link>
            .
          </p>
        </div>
        <Link to="/platform/automacoes">
          <Button size="sm">
            <Plus size={14} /> Nova regra
          </Button>
        </Link>
      </div>

      {pending.length === 0 ? (
        <Card className="text-center py-12 text-gray-500">
          <Calendar size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-400">Nenhum envio automático na fila</p>
          <p className="text-sm mt-1">
            Quando um gatilho bater, os envios aparecem aqui antes do horário programado.
          </p>
          <Link to="/platform/automacoes" className="text-brand-400 text-sm hover:underline mt-3 inline-block">
            Configurar automações
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-300">Na fila ({pending.length})</h3>
          {pending.map(c => (
            <Card key={c._id} className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{c.title}</p>
                  <Badge label={STATUS_PT[c.status]} variant={STATUS_VARIANT[c.status]} />
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{c.message}</p>
                <p className="text-[11px] text-gray-600 mt-1">
                  Regra: {ruleName(c.automationRuleId)} · {c.destinations.length} destino(s) ·{' '}
                  {new Date(c.scheduledFor).toLocaleString('pt-BR')}
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (window.confirm('Cancelar este envio automático?')) cancelCampaign.mutate(c._id)
                }}
                disabled={cancelCampaign.isPending}
              >
                <Trash2 size={12} /> Cancelar
              </Button>
            </Card>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          Regras ativas ({rules.filter(r => r.active).length})
        </h3>
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-900/80 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Gatilho</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Último enfileiramento</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                    Nenhuma regra cadastrada
                  </td>
                </tr>
              ) : (
                rules.map(r => (
                  <tr key={r._id} className="hover:bg-gray-900/40">
                    <td className="px-3 py-2 text-gray-200">{r.name || r.templateName}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{describeTrigger(r)}</td>
                    <td className="px-3 py-2">
                      <Badge label={r.active ? 'Ativa' : 'Pausada'} variant={r.active ? 'green' : 'gray'} />
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">
                      {r.lastRunDate?.replace(/^rec:|^once:/, '') ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Link to="/platform/automacoes" className="text-xs text-brand-400 hover:underline">
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Histórico recente ({history.length})
          </h3>
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-900/80 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Resultado</th>
                  <th className="px-3 py-2">Regra</th>
                  <th className="px-3 py-2">Destinos</th>
                  <th className="px-3 py-2">Quando</th>
                  <th className="px-3 py-2">Erro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {history.slice(0, 30).map(c => (
                  <tr key={c._id} className="hover:bg-gray-900/40">
                    <td className="px-3 py-2 text-gray-200 max-w-[140px] truncate">{c.title}</td>
                    <td className="px-3 py-2">
                      <Badge label={STATUS_PT[c.status]} variant={STATUS_VARIANT[c.status]} />
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{ruleName(c.automationRuleId)}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">
                      {(c.sentCount ?? 0) > 0 ? `${c.sentCount}/` : ''}
                      {c.destinations.length}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                      {c.processedAt
                        ? new Date(c.processedAt).toLocaleString('pt-BR')
                        : new Date(c.scheduledFor).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-red-400/90 text-xs max-w-[200px] truncate">
                      {c.lastError ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
