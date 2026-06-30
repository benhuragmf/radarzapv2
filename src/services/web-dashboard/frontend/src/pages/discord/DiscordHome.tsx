import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DiscordPage } from '../../components/discord/DiscordPage'
import { Card } from '../../components/ui/Card'
import { api } from '../../lib/api'
import { useGuild } from '../../lib/guildContext'
import { Hash, BookOpen, ListOrdered, ScrollText, Settings, Mic, Users, FlaskConical } from 'lucide-react'
import { LoadingState, MetricCard } from '@/design-system'
import { DiscordBotHealthCard } from '../../components/discord/DiscordBotHealthCard'
import { DiscordMetricsPanel } from '../../components/discord/DiscordMetricsPanel'
import { DiscordRoadmapCard } from '../../components/discord/DiscordRoadmapCard'
import { DiscordAuditPanel } from '../../components/discord/DiscordAuditPanel'
import { getRuleTriggersFromRule, type DiscordRuleTrigger } from '../../lib/discordMonitor'

interface Channel {
  _id: string
  isActive: boolean
  monitorType?: string
}

interface Rule {
  _id: string
  isActive: boolean
  trigger?: DiscordRuleTrigger
  triggers?: DiscordRuleTrigger[]
}

const LINKS = [
  { to: '/discord/channels', label: 'Canais monitorados', icon: Hash },
  { to: '/discord/rules', label: 'Regras e filtros', icon: BookOpen },
  { to: '/discord/fila', label: 'Fila de envio', icon: ListOrdered },
  { to: '/discord/logs', label: 'Logs', icon: ScrollText },
  { to: '/discord/settings', label: 'Configurações do servidor', icon: Settings },
] as const

export default function DiscordHome() {
  const { guildId, guildName } = useGuild()

  const { data: channels = [], isLoading: loadingChannels } = useQuery<Channel[]>({
    queryKey: ['channels', guildId],
    queryFn: () => api.get(`/channels${guildId ? `?guildId=${guildId}` : ''}`),
    enabled: Boolean(guildId),
    refetchInterval: 30_000,
  })

  const { data: rules = [], isLoading: loadingRules } = useQuery<Rule[]>({
    queryKey: ['rules', guildId],
    queryFn: () => api.get(`/rules${guildId ? `?guildId=${guildId}` : ''}`),
    enabled: Boolean(guildId),
    refetchInterval: 30_000,
  })

  const { data: summary } = useQuery({
    queryKey: ['discord-monitor-summary', guildId],
    queryFn: () =>
      api.get<{ text: number; voice: number; guild: number; eventRules: number }>(
        `/discord/monitor-summary${guildId ? `?guildId=${guildId}` : ''}`,
      ),
    enabled: Boolean(guildId),
  })

  const { data: discordSettings } = useQuery<{ dryRun: boolean }>({
    queryKey: ['discord-settings'],
    queryFn: () => api.get('/discord/settings'),
  })

  const activeChannels = channels.filter(c => c.isActive).length
  const activeRules = rules.filter(r => r.isActive).length
  const eventRules = rules.filter(
    r => r.isActive && getRuleTriggersFromRule(r).some(t => t !== 'message'),
  ).length
  const loading = loadingChannels || loadingRules

  return (
    <DiscordPage
      description="Automação Discord → WhatsApp: mensagens, chamadas de voz e eventos de membros."
      requireGuild={false}
    >
      {!guildId ? (
        <Card className="text-sm text-amber-200/90">
          Selecione um servidor Discord na barra lateral para ver o resumo da integração.
        </Card>
      ) : (
        <>
          <p className="text-sm text-[var(--rz-text-secondary)] mb-4">
            Servidor: <span className="text-[var(--rz-text-primary)]">{guildName ?? guildId}</span>
          </p>

          <DiscordBotHealthCard guildId={guildId} />

          {discordSettings?.dryRun && (
            <Card className="mb-4 border-amber-600/40 bg-amber-950/20 flex items-start gap-3 text-sm">
              <FlaskConical size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-200">Modo simulação ativo</p>
                <p className="text-xs text-amber-200/80 mt-1">
                  Mensagens e eventos são capturados e avaliados, mas <strong>não são enviados</strong> ao WhatsApp.
                  Desative em{' '}
                  <Link to="/discord/settings" className="text-amber-300 hover:underline">
                    Configurações
                  </Link>
                  .
                </p>
              </div>
            </Card>
          )}

          <DiscordMetricsPanel guildId={guildId} />

          {loading ? (
            <LoadingState rows={2} className="py-4" />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <MetricCard
                title="Monitores ativos"
                value={activeChannels}
                description={`${channels.length} cadastrado(s)`}
                icon={Hash}
              />
              <MetricCard
                title="Texto"
                value={summary?.text ?? channels.filter(c => !c.monitorType || c.monitorType === 'text').length}
                icon={Hash}
              />
              <MetricCard title="Voz" value={summary?.voice ?? 0} icon={Mic} />
              <MetricCard title="Eventos" value={summary?.guild ?? 0} icon={Users} />
              <MetricCard
                title="Regras ativas"
                value={activeRules}
                description={eventRules > 0 ? `${eventRules} de evento` : `${rules.length} total`}
                icon={BookOpen}
              />
            </div>
          )}

          <Card className="mb-4 text-xs text-[var(--rz-text-muted)] space-y-1">
            <p><strong className="text-[var(--rz-text-secondary)]">Fluxo rápido:</strong></p>
            <p>1. <Link to="/discord/channels" className="text-brand-400 hover:underline">Canais</Link> — texto, voz ou eventos do servidor</p>
            <p>2. <Link to="/discord/rules" className="text-brand-400 hover:underline">Regras</Link> — gatilho (mensagem, voz, kick…) + destinos WhatsApp</p>
            <p>3. <Link to="/discord/logs" className="text-brand-400 hover:underline">Logs</Link> — acompanhar capturas e envios</p>
          </Card>

          <DiscordAuditPanel />
          <DiscordRoadmapCard />

          <Card className="mb-4 text-xs text-[var(--rz-text-muted)]">
            Badge de status para o site do servidor:{' '}
            <Link to="/discord/settings" className="text-brand-400 hover:underline">
              Configurações → embed público
            </Link>
            .
          </Card>

          <div className="grid sm:grid-cols-2 gap-2">
            {LINKS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] hover:border-[var(--rz-primary)]/40 transition-colors text-sm text-[var(--rz-text-secondary)] hover:text-[var(--rz-text-primary)]"
              >
                <Icon size={16} className="text-[var(--rz-primary)] shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </DiscordPage>
  )
}
