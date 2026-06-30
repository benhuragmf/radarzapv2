import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { ScrollText, Loader2 } from 'lucide-react'
import { LoadingState } from '@/design-system'

interface AuditEvent {
  _id: string
  kind: string
  createdAt: string
  meta?: {
    name?: string
    ruleId?: string
    monitorId?: string
    channelName?: string
    isActive?: boolean
    triggers?: string[]
    dryRun?: boolean
    multiRulePerMessage?: boolean
    inboundEnabled?: boolean
  }
}

const KIND_LABELS: Record<string, string> = {
  'discord.rule.created': 'Regra criada',
  'discord.rule.updated': 'Regra atualizada',
  'discord.rule.deleted': 'Regra removida',
  'discord.rule.toggled': 'Regra ativada/desativada',
  'discord.monitor.created': 'Monitor adicionado',
  'discord.monitor.deleted': 'Monitor removido',
  'discord.monitor.toggled': 'Monitor ativado/desativado',
  'discord.monitor.filters_updated': 'Filtros do monitor',
  'discord.settings.updated': 'Configurações Discord',
}

function formatAuditDetail(ev: AuditEvent): string {
  const m = ev.meta
  if (!m) return ''
  if (ev.kind === 'discord.settings.updated') {
    const parts: string[] = []
    if (typeof m.dryRun === 'boolean') {
      parts.push(m.dryRun ? 'Simulação ativada' : 'Simulação desativada')
    }
    if (typeof m.multiRulePerMessage === 'boolean') {
      parts.push(m.multiRulePerMessage ? 'Multi-regra ativado' : 'Multi-regra desativado')
    }
    if (typeof m.inboundEnabled === 'boolean') {
      parts.push(m.inboundEnabled ? 'Inbound ativado' : 'Inbound desativado')
    }
    if (parts.length) return parts.join(' · ')
  }
  if (m.name) return m.name
  if (m.channelName) return m.channelName
  if (m.ruleId) return m.ruleId.slice(-8)
  if (m.monitorId) return m.monitorId.slice(-8)
  return ''
}

export function DiscordAuditPanel() {
  const { data: events = [], isLoading } = useQuery<AuditEvent[]>({
    queryKey: ['discord-audit'],
    queryFn: () => api.get('/discord/audit?limit=20'),
    refetchInterval: 60_000,
  })

  return (
    <Card className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <ScrollText size={14} className="text-brand-400" />
        <span className="text-sm font-medium text-[var(--rz-text-primary)]">Auditoria recente</span>
        {isLoading && <Loader2 size={12} className="animate-spin text-[var(--rz-text-muted)]" />}
      </div>

      {isLoading && events.length === 0 && <LoadingState rows={3} className="py-2" />}

      {!isLoading && events.length === 0 && (
        <p className="text-xs text-[var(--rz-text-muted)]">
          Nenhuma alteração registrada ainda. Mudanças em regras e monitores aparecem aqui.
        </p>
      )}

      {events.length > 0 && (
        <ul className="space-y-2 max-h-48 overflow-y-auto text-xs">
          {events.map(ev => {
            const detail = formatAuditDetail(ev)
            const when = new Date(ev.createdAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
            return (
              <li
                key={ev._id}
                className="flex items-start justify-between gap-2 py-1.5 border-b border-[var(--rz-border)]/50 last:border-0"
              >
                <div className="min-w-0">
                  <Badge
                    label={KIND_LABELS[ev.kind] ?? ev.kind}
                    variant={ev.kind.includes('deleted') ? 'gray' : 'blue'}
                  />
                  {detail && (
                    <p className="text-[var(--rz-text-secondary)] mt-1 truncate">{detail}</p>
                  )}
                  {ev.meta?.isActive !== undefined && (
                    <p className="text-[10px] text-[var(--rz-text-muted)] mt-0.5">
                      {ev.meta.isActive ? 'Ativo' : 'Inativo'}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-[var(--rz-text-muted)] shrink-0">{when}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
