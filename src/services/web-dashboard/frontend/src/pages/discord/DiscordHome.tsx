import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { DiscordPage } from '../../components/discord/DiscordPage'
import { Card, CardTitle, CardValue } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { api } from '../../lib/api'
import { useGuild } from '../../lib/guildContext'
import { Hash, BookOpen, ListOrdered, ScrollText, Settings } from 'lucide-react'

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
      <h1 className="text-lg font-semibold text-white -mt-2 mb-2">Início Discord</h1>
      {!guildId ? (
        <Card className="text-sm text-amber-200/90">
          Selecione um servidor Discord na barra lateral para ver o resumo da integração.
        </Card>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Servidor: <span className="text-gray-300">{guildName ?? guildId}</span>
          </p>

          {loading ? (
            <div className="flex justify-center py-10"><Spinner size={28} /></div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardTitle>Canais monitorados</CardTitle>
                <CardValue>{activeChannels}</CardValue>
                <p className="text-xs text-gray-500 mt-1">{channels.length} cadastrado(s)</p>
              </Card>
              <Card>
                <CardTitle>Regras ativas</CardTitle>
                <CardValue>{activeRules}</CardValue>
                <p className="text-xs text-gray-500 mt-1">{rules.length} regra(s) total</p>
              </Card>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-2">
            {LINKS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-800 bg-gray-900/50 hover:border-brand-500/40 hover:bg-gray-800/80 transition-colors text-sm text-gray-300"
              >
                <Icon size={16} className="text-brand-400 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </>
      )}
    </DiscordPage>
  )
}
