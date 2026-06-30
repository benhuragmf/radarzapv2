import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Radio, Copy } from 'lucide-react'
import { notifySuccess } from '../../lib/notify'

interface Props {
  guildId?: string | null
}

interface PublicStatus {
  gatewayConnected: boolean
  automationActive: boolean
  botUsername: string | null
  activeMonitors: number
  botInGuild: boolean | null
}

function statusLabel(s: PublicStatus): string {
  if (s.automationActive) return 'Bot online · automação ativa'
  if (s.gatewayConnected && s.botInGuild === false) return 'Bot online · fora do servidor'
  if (s.gatewayConnected) return 'Bot online'
  return 'Bot offline'
}

export function DiscordStatusEmbedCard({ guildId }: Props) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://SEU-PAINEL'

  const snippet = useMemo(() => {
    if (!guildId) return ''
    return `<script src="${origin}/discord/status.js" data-guild-id="${guildId}" data-base-url="${origin}" async></script>`
  }, [guildId, origin])

  const { data: preview } = useQuery<PublicStatus>({
    queryKey: ['discord-public-status', guildId],
    queryFn: async () => {
      const res = await fetch(
        `${origin}/api/discord/public/status?guildId=${encodeURIComponent(guildId!)}`,
      )
      if (!res.ok) throw new Error('status failed')
      return res.json()
    },
    enabled: Boolean(guildId),
    refetchInterval: 60_000,
  })

  const copySnippet = async () => {
    if (!snippet) return
    await navigator.clipboard.writeText(snippet)
    notifySuccess('Código copiado')
  }

  if (!guildId) {
    return (
      <Card className="text-xs text-[var(--rz-text-muted)] mb-4">
        Selecione um servidor na barra lateral para gerar o código do badge de status.
      </Card>
    )
  }

  return (
    <Card className="space-y-3 mb-4 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <Radio size={16} className="text-brand-400" />
        <span className="font-medium text-[var(--rz-text-primary)]">Badge de status (embed)</span>
        <Badge label="Público" variant="gray" />
      </div>
      <p className="text-xs text-[var(--rz-text-muted)]">
        Cole no site do servidor. O script consulta{' '}
        <code className="text-[10px]">/api/discord/public/status</code> ao carregar a página.
      </p>

      {preview && (
        <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              preview.automationActive
                ? 'bg-green-500'
                : preview.gatewayConnected
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
          />
          <span className="text-[var(--rz-text-secondary)]">
            {statusLabel(preview)}
            {preview.botUsername ? ` (@${preview.botUsername})` : ''}
            {preview.activeMonitors > 0 ? ` · ${preview.activeMonitors} monitor(es)` : ''}
          </span>
        </div>
      )}

      <pre className="text-[10px] bg-[var(--rz-surface-muted)] border border-[var(--rz-border)] rounded-lg p-3 overflow-x-auto text-[var(--rz-text-secondary)]">
        {snippet}
      </pre>
      <Button size="sm" variant="secondary" onClick={copySnippet} className="gap-1.5">
        <Copy size={12} />
        Copiar código
      </Button>
    </Card>
  )
}
