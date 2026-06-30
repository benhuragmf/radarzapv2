import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { AlertTriangle, CheckCircle2, Server } from 'lucide-react'
import { Spinner } from '../ui/Spinner'

interface Health {
  tokenConfigured: boolean
  botApiReachable: boolean
  botOnline: boolean
  botUsername: string | null
  guildsInToken: number
  clientIdConfigured: boolean
  error?: string
}

interface Props {
  guildId?: string | null
}

export function DiscordBotHealthCard({ guildId: _guildId }: Props) {
  const { data: health, isLoading: loadingHealth } = useQuery<Health>({
    queryKey: ['discord-health'],
    queryFn: () => api.get('/discord/health'),
    refetchInterval: 60_000,
  })

  if (loadingHealth) {
    return (
      <Card className="flex justify-center py-6 mb-4">
        <Spinner size={20} />
      </Card>
    )
  }

  if (!health) return null

  const ok = health.botOnline && health.tokenConfigured

  return (
    <Card className="text-sm space-y-2 mb-4">
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 size={16} className="text-green-400 shrink-0" />
        ) : (
          <AlertTriangle size={16} className="text-amber-400 shrink-0" />
        )}
        <span className="font-medium text-[var(--rz-text-primary)]">Status do bot</span>
        <Badge label={ok ? 'Online' : 'Atenção'} variant={ok ? 'green' : 'yellow'} />
      </div>
      <div className="text-xs text-[var(--rz-text-muted)] space-y-1">
        {health.botUsername && (
          <p className="flex items-center gap-1.5">
            <Server size={12} />
            @{health.botUsername} · {health.guildsInToken} servidor(es)
          </p>
        )}
        {!health.tokenConfigured && (
          <p>Configure <code className="text-[var(--rz-text-secondary)]">DISCORD_TOKEN</code> no servidor.</p>
        )}
        {health.error && <p className="text-amber-400/90">{health.error}</p>}
        <p className="text-[10px]">
          Intents: mensagens, conteúdo, membros, voz — ative no Discord Developer Portal.
        </p>
      </div>
    </Card>
  )
}
