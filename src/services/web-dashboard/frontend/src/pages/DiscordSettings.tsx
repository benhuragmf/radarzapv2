import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useGuild } from '../lib/guildContext'
import { DiscordPage } from '../components/discord/DiscordPage'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import type { AuthUser } from '../lib/auth'
import { Hash, BookOpen, ExternalLink } from 'lucide-react'

interface Props {
  user: AuthUser
}
interface ChannelRow {
  _id: string
  channelName: string
  isActive: boolean
}

export default function DiscordSettings({ user }: Props) {
  const { guildId, guildName } = useGuild()

  const membership = user?.guilds.find(g => g.id === guildId)

  const { data: channels = [] } = useQuery<ChannelRow[]>({
    queryKey: ['channels', guildId],
    queryFn: () => api.get(`/channels?guildId=${guildId}`),
    enabled: !!guildId,
  })

  return (
    <DiscordPage description="Configurações e permissões do servidor selecionado na barra lateral.">
      <Card className="space-y-4">
        <div className="flex items-start gap-3">
          <Hash size={20} className="text-brand-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[var(--rz-text-muted)]">Servidor Discord</p>
            <p className="text-lg font-semibold text-[var(--rz-text-primary)] truncate">{guildName}</p>
            <p className="text-xs text-[var(--rz-text-muted)] font-mono mt-0.5">{guildId}</p>
          </div>
        </div>

        {membership && (
          <>
            <div>
              <p className="text-xs text-[var(--rz-text-muted)]">Seu papel neste servidor</p>
              <p className="text-sm font-medium mt-0.5 text-[var(--rz-text-primary)]">{membership.role}</p>
              <Badge
                label={membership.apiAccessEnabled ? 'API habilitada' : 'API desabilitada'}
                variant={membership.apiAccessEnabled ? 'green' : 'gray'}
              />
            </div>
            <div>
              <p className="text-xs text-[var(--rz-text-muted)]">Papel efetivo no Radar Chat</p>
              <p className="text-sm text-[var(--rz-text-secondary)]">{membership.effectiveRole.replace('_', ' ')}</p>
            </div>
          </>
        )}

        {!membership && user?.isInternalStaff && (
          <p className="text-xs text-amber-400/90">Acesso administrativo — sem vínculo de membro neste servidor.</p>
        )}

        <div>
          <p className="text-xs text-[var(--rz-text-muted)]">Automação</p>
          <p className="text-sm mt-0.5 text-[var(--rz-text-secondary)]">
            {channels.length} canal(is) monitorado(s)
            {channels.filter(c => c.isActive).length !== channels.length &&
              ` · ${channels.filter(c => c.isActive).length} ativo(s)`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--rz-border)]">
          <Link to="/discord/channels" className="text-xs text-[var(--rz-primary)] hover:underline flex items-center gap-1">
            <Hash size={12} /> Canais
          </Link>
          <Link to="/discord/rules" className="text-xs text-[var(--rz-primary)] hover:underline flex items-center gap-1">
            <BookOpen size={12} /> Regras
          </Link>
          <a
            href={`https://discord.com/channels/${guildId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--rz-primary)] hover:underline flex items-center gap-1"
          >
            <ExternalLink size={12} /> Abrir no Discord
          </a>
        </div>
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-medium text-[var(--rz-text-primary)]">Conta Radar Chat</p>
        <p className="text-xs text-[var(--rz-text-muted)]">
          Plano, chaves de API e dados da conta Discord ficam em{' '}
          <Link to="/settings" className="text-[var(--rz-primary)] hover:underline">
            Plataforma → Configurações
          </Link>
          .
        </p>
      </Card>
    </DiscordPage>
  )
}