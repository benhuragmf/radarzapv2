import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { PlatformPage } from '../components/platform/PlatformPage'
import { ListOrdered, Clock, CheckCircle, AlertTriangle, Send } from 'lucide-react'
import { DiscordPage } from '../components/discord/DiscordPage'
import { MetricCard, EmptyState, LoadingState, RadarPageShell } from '@/design-system'

interface QueueStats {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

interface TenantCampaignQueue {
  stats: { pending: number; processing: number; sent: number; failed: number }
  items: Array<{
    _id: string
    title: string
    status: string
    scheduledFor: string
    destinations: number
    sentCount: number
    lastError?: string
    source: string
    automationRuleId?: string
  }>
}

const QUEUE_LABELS: Record<string, string> = {
  'message-processing': 'Processamento de mensagens',
  'discord-notifications': 'Notificações Discord',
  'whatsapp-send': 'Envio WhatsApp',
}

interface Props {
  scope?: 'all' | 'discord' | 'tenant'
}

const STATUS_BADGE: Record<string, 'yellow' | 'blue' | 'green' | 'red'> = {
  pending: 'yellow',
  processing: 'blue',
  sent: 'green',
  failed: 'red',
}

const STATUS_PT: Record<string, string> = {
  pending: 'Aguardando horário',
  processing: 'Enviando agora',
  sent: 'Enviado',
  failed: 'Falhou',
}

export default function Queue({ scope = 'all' }: Props) {
  const isDiscord = scope === 'discord'
  const isTenant = scope === 'tenant'

  const { data: queues = [], isLoading } = useQuery<QueueStats[]>({
    queryKey: ['queue'],
    queryFn: () => api.get('/queue'),
    refetchInterval: isTenant ? 10_000 : 5_000,
    enabled: !isTenant,
  })

  const { data: tenantQueue, isLoading: tenantLoading } = useQuery<TenantCampaignQueue>({
    queryKey: ['queue-tenant-campaigns'],
    queryFn: () => api.get('/queue/tenant-campaigns'),
    refetchInterval: 10_000,
    enabled: isTenant,
  })

  if (isTenant) {
    if (tenantLoading) {
      return (
        <PlatformPage title="Fila de envio" description="Acompanhe o que vai sair pelo WhatsApp da sua empresa.">
          <LoadingState rows={4} className="pt-8" />
        </PlatformPage>
      )
    }

    const s = tenantQueue?.stats ?? { pending: 0, processing: 0, sent: 0, failed: 0 }
    const items = tenantQueue?.items ?? []
    const upcoming = items.filter(i => i.status === 'pending' || i.status === 'processing')

    return (
      <PlatformPage
        title="Fila de envio"
        description="Envios agendados e em andamento da sua conta — campanhas manuais e automações."
      >
        <Card className="border-brand-800/30 bg-brand-950/10 text-xs text-gray-400 mb-4">
          <p>
            <strong className="text-gray-300">O que é isso?</strong> Cada linha é um envio para um ou mais
            contatos/grupos. Quando chega o horário, o sistema dispara pelo WhatsApp (~15 s de verificação).
          </p>
          <p className="mt-2">
            Automações aparecem com badge &quot;Automação&quot;. Envios manuais vêm de{' '}
            <Link to="/send" className="text-brand-400 hover:underline">
              Enviar agora
            </Link>
            .
          </p>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <MetricCard title="Na fila" value={s.pending} icon={Clock} />
          <MetricCard title="Enviando" value={s.processing} icon={Send} />
          <MetricCard title="Concluídos" value={s.sent} icon={CheckCircle} status={{ status: 'success', text: 'OK' }} />
          <MetricCard
            title="Falhas"
            value={s.failed}
            icon={AlertTriangle}
            status={s.failed > 0 ? { status: 'danger', text: 'Atenção' } : undefined}
          />
        </div>

        <h3 className="text-sm font-medium text-gray-300 mb-3">
          Próximos e recentes ({upcoming.length})
        </h3>
        {upcoming.length === 0 ? (
          <EmptyState
            title="Nada na fila agora"
            description="Crie um envio manual ou configure uma automação."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/send" className="text-sm text-[var(--rz-primary)] hover:underline">
                  Enviar agora
                </Link>
                <span className="text-[var(--rz-text-muted)]">·</span>
                <Link to="/platform/automacoes" className="text-sm text-[var(--rz-primary)] hover:underline">
                  Automações
                </Link>
              </div>
            }
          />
        ) : (
          <div className="space-y-2">
            {upcoming.map(item => (
              <Card key={item._id} className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <Badge label={STATUS_PT[item.status] ?? item.status} variant={STATUS_BADGE[item.status] ?? 'gray'} />
                    {item.source === 'automation' && <Badge label="Automação" variant="blue" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.destinations} destino(s)
                    {item.sentCount > 0 && ` · ${item.sentCount} enviado(s)`}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    {item.status === 'pending'
                      ? `Agendado: ${new Date(item.scheduledFor).toLocaleString('pt-BR')}`
                      : `Atualizado: ${new Date(item.scheduledFor).toLocaleString('pt-BR')}`}
                  </p>
                  {item.lastError && (
                    <p className="text-[11px] text-red-400/90 mt-1">{item.lastError}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-600 mt-6">
          Histórico completo de automações:{' '}
          <Link to="/send/autoagendamentos" className="text-brand-400 hover:underline">
            Agend. automação
          </Link>
        </p>
      </PlatformPage>
    )
  }

  const filtered = isDiscord
    ? queues.filter(q => ['message-processing', 'discord-notifications'].includes(q.name))
    : queues

  if (isLoading) {
    const loading = <LoadingState rows={4} className="pt-8" />
    if (isDiscord) {
      return (
        <DiscordPage description="Acompanhe o processamento das mensagens vindas do Discord.">
          {loading}
        </DiscordPage>
      )
    }
    return <RadarPageShell>{loading}</RadarPageShell>
  }

  const content = (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        {isDiscord
          ? 'Filas internas da automação Discord → WhatsApp.'
          : 'Filas técnicas do servidor (BullMQ). Clientes usam a aba Fila de envio na Plataforma.'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(q => (
          <Card key={q.name}>
            <div className="flex items-center gap-2 mb-3">
              <ListOrdered size={14} className="text-gray-500" />
              <span className="text-sm font-medium">{QUEUE_LABELS[q.name] ?? q.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Aguardando', value: q.waiting, color: 'text-yellow-400' },
                { label: 'Ativo', value: q.active, color: 'text-blue-400' },
                { label: 'Falhas', value: q.failed, color: 'text-red-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-950 rounded-lg p-2">
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState title="Nenhuma fila ativa" description="As filas aparecem quando há processamento em andamento." />
      )}
    </div>
  )

  if (isDiscord) {
    return (
      <DiscordPage description="Acompanhe o processamento das mensagens vindas do Discord.">
        {content}
      </DiscordPage>
    )
  }

  return content
}
