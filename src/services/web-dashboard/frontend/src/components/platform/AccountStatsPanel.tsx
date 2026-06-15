import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { MessageSquare, Users, Workflow, Smartphone, BarChart3 } from 'lucide-react'
import { MetricCard, LoadingState } from '@/design-system'
import type { StatusVariant } from '@/design-system/tokens'

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

function waStatusLabel(status: string): string {
  if (status === 'connected') return 'Conectado'
  if (status === 'qr') return 'Aguardando QR'
  if (status === 'connecting') return 'Conectando'
  return 'Desconectado'
}

function waStatusTone(status: string): StatusVariant {
  if (status === 'connected') return 'success'
  if (status === 'connecting' || status === 'qr') return 'warning'
  if (status === 'disconnected') return 'danger'
  return 'neutral'
}

export function AccountStatsPanel() {
  const { data, isLoading } = useQuery<AccountStats>({
    queryKey: ['platform-account-stats'],
    queryFn: () => api.get('/platform/account-stats'),
    refetchInterval: 20_000,
  })

  if (isLoading) {
    return <LoadingState rows={2} className="mb-6" />
  }

  if (!data) return null

  const waLabel = waStatusLabel(data.whatsapp.status)
  const msgLimit =
    data.limits.messagesPerDay === -1 ? '∞' : data.limits.messagesPerDay.toLocaleString('pt-BR')

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      <MetricCard
        title="WhatsApp"
        value={data.whatsapp.phoneNumber || data.whatsapp.profileName || 'Sem número'}
        icon={Smartphone}
        status={{ status: waStatusTone(data.whatsapp.status), text: waLabel }}
        description={`Última atividade: ${formatUptime(data.whatsapp.lastActivity)}`}
      />
      <MetricCard
        title="Mensagens hoje"
        value={
          <>
            {data.usage.messagesUsed}
            <span className="text-base font-normal text-[var(--rz-text-muted)]"> / {msgLimit}</span>
          </>
        }
        icon={MessageSquare}
        description={`Plano ${data.plan}`}
      />
      <MetricCard
        title="Campanhas"
        value={
          <>
            <span className="text-[var(--rz-warning-text)]">{data.campaigns.pending}</span>
            <span className="text-base font-normal text-[var(--rz-text-muted)]"> na fila</span>
          </>
        }
        icon={BarChart3}
        description={`${data.campaigns.sent} enviadas · ${data.campaigns.automationTotal} via automação`}
        trend={
          data.campaigns.failed > 0
            ? { label: `${data.campaigns.failed} com falha`, positive: false }
            : undefined
        }
      />
      <MetricCard
        title="Base"
        value={`${data.contacts.total} contatos`}
        icon={Users}
        description={`${data.contacts.segments} segmentos · ${data.automations.activeRules} regra(s) ativa(s)`}
      />
    </div>
  )
}
