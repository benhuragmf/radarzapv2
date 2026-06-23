import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { LeadStats } from '@radarzap-types/lead-form'
import { LEAD_CAPTURE_ORIGIN_LABEL } from '@radarzap-types/lead-form'

const METRICS_KEY = 'rz-leads-metrics-collapsed'

export function LeadStatsCards({ stats }: { stats: LeadStats | undefined }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(METRICS_KEY) === '1'
    } catch {
      return false
    }
  })

  if (!stats) return null

  const toggle = () => {
    setCollapsed(v => {
      const next = !v
      try {
        localStorage.setItem(METRICS_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const cards = [
    { label: 'Total', value: stats.total },
    { label: 'Novos hoje', value: stats.newToday },
    { label: 'Em atendimento', value: stats.inProgress },
    { label: 'Convertidos', value: stats.converted },
    { label: 'Perdidos', value: stats.lost },
    {
      label: 'Origem top',
      value: stats.topOrigin ? LEAD_CAPTURE_ORIGIN_LABEL[stats.topOrigin] : '—',
      sub: stats.topOriginCount > 0 ? `${stats.topOriginCount}` : undefined,
    },
  ]

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--rz-text-muted)] mb-1.5 hover:text-[var(--rz-text-secondary)]"
      >
        Métricas
        {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
      {!collapsed && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {cards.map(c => (
            <div
              key={c.label}
              className="rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/30 px-2.5 py-2"
            >
              <p className="text-[10px] text-[var(--rz-text-muted)] truncate">{c.label}</p>
              <p className="text-base font-semibold tabular-nums leading-tight">{c.value}</p>
              {c.sub && <p className="text-[9px] text-[var(--rz-text-muted)]">{c.sub} capturas</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function LeadFunnelRow({ stats }: { stats: LeadStats | undefined }) {
  if (!stats?.funnel.length) return null
  const max = Math.max(...stats.funnel.map(f => f.count), 1)

  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {stats.funnel.map(f => (
        <div
          key={f.status}
          className="flex items-center gap-2 flex-1 min-w-[88px] rounded-md border border-[var(--rz-border)] px-2 py-1.5 bg-[var(--rz-surface-muted)]/20"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[9px] text-[var(--rz-text-muted)] truncate">{f.label}</p>
            <p className="text-sm font-semibold tabular-nums leading-none">{f.count}</p>
          </div>
          <div className="w-10 h-1 rounded-full bg-[var(--rz-surface-muted)] overflow-hidden shrink-0">
            <div
              className="h-full bg-[var(--rz-primary)] rounded-full"
              style={{ width: `${Math.max(8, Math.round((f.count / max) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
