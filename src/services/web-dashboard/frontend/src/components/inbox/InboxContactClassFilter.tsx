import type { ContactClassificationFilterKey } from '../contacts/ContactClassificationFilterBar'

const INBOX_CLASS_FILTERS: { key: ContactClassificationFilterKey; label: string }[] = [
  { key: 'opt_in', label: 'Opt-in' },
  { key: 'pending', label: 'Pendente' },
  { key: 'hot', label: 'Quente/morno' },
  { key: 'blocked', label: 'Bloq. campanha' },
  { key: 'lead', label: 'Lead' },
  { key: 'client', label: 'Cliente' },
  { key: 'prospect', label: 'Prospect' },
]

export function parseInboxClassFilter(raw: string | null): ContactClassificationFilterKey | null {
  if (!raw) return null
  return INBOX_CLASS_FILTERS.some(f => f.key === raw) ? (raw as ContactClassificationFilterKey) : null
}

export function InboxContactClassFilter({
  activeKey,
  onSelect,
}: {
  activeKey: ContactClassificationFilterKey | null
  onSelect: (key: ContactClassificationFilterKey | null) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] uppercase tracking-wide text-[var(--rz-text-muted)] px-0.5">Classificação CRM</p>
      <div className="flex flex-wrap gap-1">
        {INBOX_CLASS_FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => onSelect(activeKey === f.key ? null : f.key)}
            className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
              activeKey === f.key
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)] border border-transparent hover:bg-[var(--rz-surface-muted)]/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {activeKey && (
        <p className="text-[10px] text-[var(--rz-text-muted)] px-0.5">
          Só conversas com contato CRM vinculado —{' '}
          <button
            type="button"
            className="text-[var(--rz-primary)] hover:underline"
            onClick={() => onSelect(null)}
          >
            limpar
          </button>
        </p>
      )}
    </div>
  )
}
