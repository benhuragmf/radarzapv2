import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DiscordPage } from '../../components/discord/DiscordPage'
import { Card } from '../../components/ui/Card'
import { api } from '../../lib/api'
import { useGuild } from '../../lib/guildContext'
import { Hash, BookOpen, ListOrdered, ScrollText, Settings } from 'lucide-react'
import { LoadingState, MetricCard } from '@/design-system'

interface Channel {
  _id: string
  isActive: boolean
}

interface Rule {
  _id: string
  isActive: boolean
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

  const activeChannels = channels.filter(c => c.isActive).length
  const activeRules = rules.filter(r => r.isActive).length
  const loading = loadingChannels || loadingRules

  return (
    <DiscordPage
      description="Resumo da automação Discord → WhatsApp do servidor selecionado."
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

          {loading ? (
            <LoadingState rows={2} className="py-4" />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <MetricCard
                title="Canais monitorados"
                value={activeChannels}
                description={`${channels.length} cadastrado(s)`}
                icon={Hash}
              />
              <MetricCard
                title="Regras ativas"
                value={activeRules}
                description={`${rules.length} regra(s) total`}
                icon={BookOpen}
              />
            </div>
          )}

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
