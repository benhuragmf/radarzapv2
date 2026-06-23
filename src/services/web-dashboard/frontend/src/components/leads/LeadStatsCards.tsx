import { Card } from '../ui/Card'
import type { LeadStats } from '@radarzap-types/lead-form'
import { LEAD_CAPTURE_ORIGIN_LABEL } from '@radarzap-types/lead-form'

export function LeadStatsCards({ stats }: { stats: LeadStats | undefined }) {
  if (!stats) return null

  const cards = [
    { label: 'Total de leads', value: stats.total },
    { label: 'Novos hoje', value: stats.newToday },
    { label: 'Em atendimento', value: stats.inProgress },
    { label: 'Convertidos', value: stats.converted },
    { label: 'Perdidos / spam', value: stats.lost },
    {
      label: 'Origem principal',
      value: stats.topOrigin ? LEAD_CAPTURE_ORIGIN_LABEL[stats.topOrigin] : '—',
      sub: stats.topOriginCount > 0 ? `${stats.topOriginCount} capturas` : undefined,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
      {cards.map(c => (
        <Card key={c.label} className="p-3 space-y-1">
          <p className="text-[11px] text-[var(--rz-text-muted)] uppercase tracking-wide">{c.label}</p>
          <p className="text-xl font-semibold tabular-nums">{c.value}</p>
          {c.sub && <p className="text-[10px] text-[var(--rz-text-muted)]">{c.sub}</p>}
        </Card>
      ))}
    </div>
  )
}

export function LeadFunnelRow({ stats }: { stats: LeadStats | undefined }) {
  if (!stats?.funnel.length) return null
  const max = Math.max(...stats.funnel.map(f => f.count), 1)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
      {stats.funnel.map(f => (
        <div
          key={f.status}
          className="rounded-lg border border-[var(--rz-border)] p-3 text-center"
        >
          <p className="text-xs text-[var(--rz-text-muted)]">{f.label}</p>
          <p className="text-lg font-semibold">{f.count}</p>
          <div className="mt-2 h-1 rounded-full bg-[var(--rz-surface-muted)] overflow-hidden">
            <div
              className="h-full bg-[var(--rz-primary)] rounded-full transition-all"
              style={{ width: `${Math.round((f.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
