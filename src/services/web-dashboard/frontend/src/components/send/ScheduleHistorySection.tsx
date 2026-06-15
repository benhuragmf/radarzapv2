import { useState } from 'react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Campaign } from '../../lib/campaigns'

const STATUS_PT: Record<Campaign['status'], string> = {
  pending: 'Agendado',
  processing: 'Enviando',
  sent: 'Enviado',
  failed: 'Falhou',
}

const STATUS_VARIANT: Record<Campaign['status'], 'yellow' | 'blue' | 'green' | 'red'> = {
  pending: 'yellow',
  processing: 'blue',
  sent: 'green',
  failed: 'red',
}

function ExpandedDetails({ c, ruleName }: { c: Campaign; ruleName?: (id?: string) => string }) {
  return (
    <div className="mt-3 pt-3 border-t border-[var(--rz-border)] space-y-2 text-xs text-[var(--rz-text-muted)]">
      <p className="text-[var(--rz-text-secondary)] whitespace-pre-wrap">{c.message}</p>
      {c.platformTemplateName && (
        <p>
          Modelo: <span className="text-gray-300">{c.platformTemplateName}</span>
        </p>
      )}
      {c.automationRuleId && ruleName && (
        <p>
          Regra: <span className="text-gray-300">{ruleName(c.automationRuleId)}</span>
        </p>
      )}
      {c.delayBetweenMs != null && c.delayBetweenMs > 0 && (
        <p>Intervalo entre destinos: {(c.delayBetweenMs / 1000).toFixed(0)}s</p>
      )}
      <div>
        <p className="text-gray-600 mb-1">Destinos ({c.destinations.length}):</p>
        <div className="flex flex-wrap gap-1">
          {c.destinations.slice(0, 20).map((d, i) => (
            <span key={i} className="bg-gray-800 px-1.5 py-0.5 rounded text-[10px] text-gray-400">
              {d.name}
            </span>
          ))}
          {c.destinations.length > 20 && (
            <span className="text-[10px] text-gray-600">+{c.destinations.length - 20}</span>
          )}
        </div>
      </div>
      {c.lastError && <p className="text-red-400/90">{c.lastError}</p>}
    </div>
  )
}

interface Props {
  campaigns: Campaign[]
  ruleName?: (id?: string) => string
  showRuleColumn?: boolean
  limit?: number
}

export function ScheduleHistorySection({
  campaigns,
  ruleName,
  showRuleColumn,
  limit = 30,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (campaigns.length === 0) return null

  const items = campaigns.slice(0, limit)

  return (
    <div>
      <h3 className="text-sm font-medium text-[var(--rz-text-secondary)] mb-3">
        Histórico recente ({campaigns.length})
      </h3>
      <div className="space-y-2">
        {items.map(c => {
          const open = expandedId === c._id
          return (
            <Card key={c._id}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setExpandedId(open ? null : c._id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[var(--rz-text-primary)] truncate">{c.title}</p>
                      <Badge label={STATUS_PT[c.status]} variant={STATUS_VARIANT[c.status]} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">{c.message}</p>
                    <p className="text-[11px] text-gray-600 mt-1">
                      {c.destinations.length} destino(s)
                      {(c.sentCount ?? 0) > 0 && ` · ${c.sentCount} enviado(s)`}
                      {' · '}
                      {c.processedAt
                        ? new Date(c.processedAt).toLocaleString('pt-BR')
                        : new Date(c.scheduledFor).toLocaleString('pt-BR')}
                      {showRuleColumn && c.automationRuleId && ruleName && (
                        <> · {ruleName(c.automationRuleId)}</>
                      )}
                    </p>
                    {!open && c.lastError && (
                      <p className="text-[11px] text-red-400/80 mt-1 truncate">{c.lastError}</p>
                    )}
                  </div>
                  {open ? (
                    <ChevronUp size={16} className="text-gray-500 shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-500 shrink-0" />
                  )}
                </div>
              </button>
              {open && <ExpandedDetails c={c} ruleName={ruleName} />}
            </Card>
          )
        })}
      </div>
      {campaigns.length > limit && (
        <p className="text-xs text-gray-600 mt-2">
          Exibindo os {limit} mais recentes de {campaigns.length}.
        </p>
      )}
    </div>
  )
}
