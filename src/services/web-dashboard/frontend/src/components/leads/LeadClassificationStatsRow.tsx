import type { LeadClassificationStats } from '@radarchat-types/lead-form'
import { CONTACT_KIND_LABELS } from '../../lib/contactClassificationUi'
import type { ContactKind } from '../../lib/contactClassificationUi'

type StatKey = 'opt_in' | 'pending' | 'hot' | 'blocked' | 'unlinked'

export function LeadClassificationStatsRow({
  stats,
  activeKey,
  onSelect,
}: {
  stats: LeadClassificationStats | undefined
  activeKey?: StatKey | null
  onSelect?: (key: StatKey) => void
}) {
  if (!stats || stats.totalLeads === 0) return null

  const cards: { key: StatKey; label: string; value: number }[] = [
    { key: 'opt_in', label: 'CRM com opt-in', value: stats.withOptIn },
    { key: 'pending', label: 'Opt-in pendente', value: stats.pendingConsent },
    { key: 'hot', label: 'Quentes/mornos', value: stats.hotWarm },
    { key: 'blocked', label: 'Bloq. campanha', value: stats.blockedCampaign },
    { key: 'unlinked', label: 'Sem contato CRM', value: stats.unlinkedLeads },
  ]

  const topKinds = (['lead', 'client', 'prospect'] as ContactKind[])
    .map(k => ({ kind: k, count: stats.byKind[k] ?? 0 }))
    .filter(x => x.count > 0)

  return (
    <div className="mb-3 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
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
      {topKinds.length > 0 && (
        <p className="text-[10px] text-[var(--rz-text-muted)]">
          Vinculados ao CRM:{' '}
          {topKinds
            .map(({ kind, count }) => `${count} ${CONTACT_KIND_LABELS[kind].toLowerCase()}`)
            .join(' · ')}
          {stats.linkedLeads > 0 && (
            <span className="text-[var(--rz-text-muted)]/80">
              {' '}
              ({stats.linkedLeads} de {stats.totalLeads} leads)
            </span>
          )}
        </p>
      )}
    </div>
  )
}
