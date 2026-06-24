import type { LeadStats } from '@radarzap-types/lead-form'
import { operationalStatCards, type OperationalStatKey } from '../../lib/leadUi'

export function LeadOperationalStats({
  stats,
  activeKey,
  onSelect,
}: {
  stats: LeadStats | undefined
  activeKey?: OperationalStatKey | null
  onSelect?: (key: OperationalStatKey) => void
}) {
  const cards = operationalStatCards(stats)
  if (!cards.length) return null

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-3">
      {cards.map(c => (
        <button
          key={c.key}
          type="button"
          onClick={() => onSelect?.(c.key)}
          className={`rounded-md border px-2 py-1.5 text-left transition-colors ${
            activeKey === c.key
              ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10'
              : 'border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/20 hover:border-[var(--rz-primary)]/40'
          }`}
        >
          <p className="text-[9px] text-[var(--rz-text-muted)] truncate leading-tight">{c.label}</p>
          <p className="text-base font-semibold tabular-nums leading-tight">{c.value}</p>
        </button>
      ))}
    </div>
  )
}

/** @deprecated use LeadOperationalStats — mantido para compatibilidade */
export function LeadStatsCards({
  stats,
  activeKey,
  onSelect,
}: {
  stats: LeadStats | undefined
  activeKey?: OperationalStatKey | null
  onSelect?: (key: OperationalStatKey) => void
}) {
  return <LeadOperationalStats stats={stats} activeKey={activeKey} onSelect={onSelect} />
}

export function LeadFunnelRow() {
  return null
}
