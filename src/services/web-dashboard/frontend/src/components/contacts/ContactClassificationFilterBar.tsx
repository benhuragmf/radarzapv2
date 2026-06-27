import type { ContactClassificationView } from '../../lib/contactClassificationUi'
import { CONTACT_KIND_LABELS } from '../../lib/contactClassificationUi'
import type { ContactKind } from '../../lib/contactClassificationUi'

export type ContactClassificationFilterKey =
  | 'opt_in'
  | 'pending'
  | 'hot'
  | 'blocked'
  | 'lead'
  | 'client'
  | 'prospect'

export function computeContactClassificationStats(
  contacts: Array<{ classification?: ContactClassificationView }>,
) {
  const stats = {
    total: contacts.length,
    optIn: 0,
    pending: 0,
    hotWarm: 0,
    blocked: 0,
    byKind: {} as Record<string, number>,
  }
  for (const c of contacts) {
    const cl = c.classification
    if (!cl) continue
    if (cl.permission === 'opt_in_accepted') stats.optIn++
    if (cl.permission === 'pending') stats.pending++
    if (cl.temperature === 'hot' || cl.temperature === 'warm') stats.hotWarm++
    if (!cl.campaignSelectable) stats.blocked++
    stats.byKind[cl.kind] = (stats.byKind[cl.kind] ?? 0) + 1
  }
  return stats
}

export function matchesContactClassificationFilter(
  classification: ContactClassificationView | undefined,
  key: ContactClassificationFilterKey | null,
): boolean {
  if (!key) return true
  if (!classification) return false
  if (key === 'opt_in') return classification.permission === 'opt_in_accepted'
  if (key === 'pending') return classification.permission === 'pending'
  if (key === 'hot') return classification.temperature === 'hot' || classification.temperature === 'warm'
  if (key === 'blocked') return !classification.campaignSelectable
  return classification.kind === key
}

export function ContactClassificationFilterBar({
  contacts,
  summary,
  activeKey,
  onSelect,
}: {
  contacts?: Array<{ classification?: ContactClassificationView }>
  summary?: {
    total: number
    optIn: number
    pending: number
    hotWarm: number
    blocked: number
    byKind: Record<string, number>
  }
  activeKey?: ContactClassificationFilterKey | null
  onSelect?: (key: ContactClassificationFilterKey | null) => void
}) {
  const stats =
    summary ??
    (contacts ? computeContactClassificationStats(contacts) : { total: 0, optIn: 0, pending: 0, hotWarm: 0, blocked: 0, byKind: {} })
  if (stats.total === 0) return null

  const cards: { key: ContactClassificationFilterKey; label: string; value: number }[] = (
    [
      { key: 'opt_in' as const, label: 'Opt-in aceito', value: stats.optIn },
      { key: 'pending' as const, label: 'Opt-in pendente', value: stats.pending },
      { key: 'hot' as const, label: 'Quentes/mornos', value: stats.hotWarm },
      { key: 'blocked' as const, label: 'Bloq. campanha', value: stats.blocked },
      { key: 'lead' as const, label: 'Leads', value: stats.byKind.lead ?? 0 },
      { key: 'client' as const, label: 'Clientes', value: stats.byKind.client ?? 0 },
      { key: 'prospect' as const, label: 'Prospects', value: stats.byKind.prospect ?? 0 },
    ] as const
  ).filter(c => c.value > 0) as { key: ContactClassificationFilterKey; label: string; value: number }[]

  if (cards.length === 0) return null

  const topKinds = (['lead', 'client', 'prospect'] as ContactKind[])
    .map(k => ({ kind: k, count: stats.byKind[k] ?? 0 }))
    .filter(x => x.count > 0)

  return (
    <div className="mb-3 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
        {cards.map(c => (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelect?.(activeKey === c.key ? null : c.key)}
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
      {topKinds.length > 0 && activeKey == null && (
        <p className="text-[10px] text-[var(--rz-text-muted)]">
          {topKinds
            .map(({ kind, count }) => `${count} ${CONTACT_KIND_LABELS[kind].toLowerCase()}`)
            .join(' · ')}
        </p>
      )}
      {activeKey && (
        <p className="text-[10px] text-[var(--rz-text-muted)]">
          Filtro ativo —{' '}
          <button
            type="button"
            className="text-[var(--rz-primary)] hover:underline"
            onClick={() => onSelect?.(null)}
          >
            limpar
          </button>
        </p>
      )}
    </div>
  )
}
