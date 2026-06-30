import { Link } from 'react-router-dom'
import type { AdminOpsSummary } from '@radarchat-types/admin-ops-summary'
import { formatOpsNumber } from '@radarchat-types/admin-ops-summary.util'
import { Hash, Smartphone } from 'lucide-react'
import { MetricCard, SectionCard } from '@/design-system'

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--rz-border)] py-2 text-sm last:border-0">
      <span className="text-[var(--rz-text-muted)]">{label}</span>
      <span className="font-medium text-[var(--rz-text-primary)] tabular-nums">{value}</span>
    </div>
  )
}

interface DiscordSummary {
  whatsappSessions: number
  connectedSessions: number
  discordGuilds: number
  activeChannels: number
}

interface Props {
  ops: AdminOpsSummary
  discord?: DiscordSummary
}

export default function AdminOpsServersPanel({ ops, discord }: Props) {
  const wa = ops.operations.whatsapp

  return (
    <div className="space-y-4" data-testid="admin-ops-servers-panel">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="WA conectadas"
          value={wa.connected}
          description={`${wa.totalSessions} sessão(ões) total`}
          icon={Smartphone}
        />
        <MetricCard title="WA desconectadas" value={wa.disconnected} icon={Smartphone} />
        <MetricCard title="WA expiradas" value={wa.expired} icon={Smartphone} />
        <MetricCard
          title="Discord guilds"
          value={discord?.discordGuilds ?? '—'}
          description={
            discord != null ? `${discord.activeChannels} canal(is) ativo(s)` : 'Carregando…'
          }
          icon={Hash}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="WhatsApp (ops global)">
          <StatRow label="Conectadas" value={formatOpsNumber(wa.connected)} />
          <StatRow label="Desconectadas" value={formatOpsNumber(wa.disconnected)} />
          <StatRow label="Expiradas" value={formatOpsNumber(wa.expired)} />
          <StatRow label="Total sessões" value={formatOpsNumber(wa.totalSessions)} />
          {discord != null ? (
            <StatRow label="Conectadas (legado summary)" value={discord.connectedSessions} />
          ) : null}
          <p className="mt-3 text-xs text-[var(--rz-text-muted)]">
            <Link to="/admin/sessions" className="text-[var(--rz-primary)] hover:underline">
              Gerenciar sessões WhatsApp
            </Link>
          </p>
        </SectionCard>

        <SectionCard title="Canais digitais">
          <StatRow
            label="WebChat widgets ativos"
            value={formatOpsNumber(ops.operations.webchat.activeWidgets)}
          />
          <StatRow
            label="WebChat conversas ativas"
            value={formatOpsNumber(ops.operations.webchat.activeConversations)}
          />
          <StatRow
            label="WebChat na fila"
            value={formatOpsNumber(ops.operations.webchat.queuedConversations)}
          />
          <StatRow
            label="Bridge WebChat↔WA"
            value={formatOpsNumber(ops.operations.webchat.bridgeActive)}
          />
          <StatRow
            label="Inbox abertas"
            value={formatOpsNumber(ops.operations.inbox.openConversations)}
          />
        </SectionCard>
      </div>
    </div>
  )
}
