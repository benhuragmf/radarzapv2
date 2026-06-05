import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../ui/Card'
import { Spinner } from '../ui/Spinner'
import { Badge } from '../ui/Badge'
import { MessageSquare, Users, Workflow, Smartphone, BarChart3 } from 'lucide-react'

interface AccountStats {
  organizationName: string
  plan: string
  usage: { messagesUsed: number; lastReset: string }
  limits: { messagesPerDay: number }
  whatsapp: {
    status: string
    state: string
    phoneNumber?: string
    profileName?: string
    lastActivity?: string
    waAccountType?: string
  }
  campaigns: {
    pending: number
    processing: number
    sent: number
    failed: number
    automationTotal: number
  }
  automations: { activeRules: number }
  contacts: { total: number; segments: number }
}

function formatUptime(lastActivity?: string): string {
  if (!lastActivity) return '—'
  const diff = Date.now() - new Date(lastActivity).getTime()
  if (diff < 0) return 'agora'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins} min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  return `${Math.floor(hours / 24)}d atrás`
}

function statusVariant(status: string): 'green' | 'yellow' | 'red' | 'gray' {
  if (status === 'connected') return 'green'
  if (status === 'connecting' || status === 'qr') return 'yellow'
  if (status === 'disconnected') return 'red'
  return 'gray'
}

export function AccountStatsPanel() {
  const { data, isLoading } = useQuery<AccountStats>({
    queryKey: ['platform-account-stats'],
    queryFn: () => api.get('/platform/account-stats'),
    refetchInterval: 20_000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size={24} />
      </div>
    )
  }

  if (!data) return null

  const waLabel =
    data.whatsapp.status === 'connected'
      ? 'Conectado'
      : data.whatsapp.status === 'qr'
        ? 'Aguardando QR'
        : data.whatsapp.status === 'connecting'
          ? 'Conectando'
          : 'Desconectado'

  return (
    <div className="space-y-4 mb-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex gap-3 items-start">
          <Smartphone size={18} className="text-brand-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">WhatsApp</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge label={waLabel} variant={statusVariant(data.whatsapp.status)} />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {data.whatsapp.phoneNumber || data.whatsapp.profileName || 'Sem número'}
            </p>
            <p className="text-[11px] text-gray-600 mt-0.5">
              Última atividade: {formatUptime(data.whatsapp.lastActivity)}
            </p>
          </div>
        </Card>

        <Card className="flex gap-3 items-start">
          <MessageSquare size={18} className="text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">Mensagens hoje</p>
            <p className="text-xl font-semibold text-white mt-1">
              {data.usage.messagesUsed}
              <span className="text-sm text-gray-500 font-normal">
                {' '}
                / {data.limits.messagesPerDay === -1 ? '∞' : data.limits.messagesPerDay}
              </span>
            </p>
            <p className="text-[11px] text-gray-600">Plano {data.plan}</p>
          </div>
        </Card>

        <Card className="flex gap-3 items-start">
          <BarChart3 size={18} className="text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">Campanhas</p>
            <p className="text-sm text-gray-200 mt-1">
              <span className="text-yellow-400 font-medium">{data.campaigns.pending}</span> na fila ·{' '}
              <span className="text-green-400 font-medium">{data.campaigns.sent}</span> enviadas
            </p>
            {data.campaigns.failed > 0 && (
              <p className="text-xs text-red-400 mt-0.5">{data.campaigns.failed} com falha</p>
            )}
            <p className="text-[11px] text-gray-600 mt-0.5">
              {data.campaigns.automationTotal} via automação
            </p>
          </div>
        </Card>

        <Card className="flex gap-3 items-start">
          <Users size={18} className="text-purple-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500">Base</p>
            <p className="text-sm text-gray-200 mt-1">
              {data.contacts.total} contatos · {data.contacts.segments} segmentos
            </p>
            <p className="text-[11px] text-gray-600 mt-0.5 flex items-center gap-1">
              <Workflow size={10} />
              {data.automations.activeRules} regra(s) ativa(s)
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
