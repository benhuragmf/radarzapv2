import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../ui/Card'
import { BarChart3 } from 'lucide-react'
import { Spinner } from '../ui/Spinner'
import { cn } from '@/lib/utils'

interface Stats {
  total: number
  messages: number
  events: number
  waQueued: number
  dryRun: number
  noRules: number
  cooldownSkips: number
  duplicates: number
  blocked: number
  byDay: { date: string; count: number }[]
}

interface Props {
  guildId?: string | null
}

const PERIODS = [7, 14, 30] as const

export function DiscordMetricsPanel({ guildId }: Props) {
  const [days, setDays] = useState<number>(7)

  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['discord-stats', guildId, days],
    queryFn: () =>
      api.get(`/discord/stats?days=${days}${guildId ? `&guildId=${guildId}` : ''}`),
    enabled: Boolean(guildId),
    refetchInterval: 60_000,
  })

  if (!guildId) return null

  const maxDay = Math.max(1, ...(stats?.byDay.map(d => d.count) ?? [1]))

  return (
    <Card className="mb-4 text-sm space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-brand-400" />
          <span className="font-medium text-[var(--rz-text-primary)]">Métricas Discord</span>
        </div>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setDays(p)}
              className={cn(
                'text-[10px] px-2 py-1 rounded border transition-colors',
                days === p
                  ? 'bg-brand-600 border-brand-500 text-white'
                  : 'border-[var(--rz-border)] text-[var(--rz-text-muted)]',
              )}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Spinner size={18} />
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Metric label="Total" value={stats.total} />
            <Metric label="Mensagens" value={stats.messages} />
            <Metric label="Voz/eventos" value={stats.events} />
            <Metric label="→ WhatsApp" value={stats.waQueued} highlight />
            <Metric label="Simulação" value={stats.dryRun} />
            <Metric label="Sem regra" value={stats.noRules} />
            <Metric label="Cooldown" value={stats.cooldownSkips} />
            <Metric label="Duplicadas" value={stats.duplicates} />
            <Metric label="Bloqueadas" value={stats.blocked} />
          </div>

          {stats.byDay.length > 0 && (
            <div className="pt-2 border-t border-[var(--rz-border)]">
              <p className="text-[10px] text-[var(--rz-text-muted)] mb-2">Capturas por dia</p>
              <div className="flex items-end gap-1 h-16">
                {stats.byDay.map(d => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                    <div
                      className="w-full bg-brand-600/80 rounded-t min-h-[2px]"
                      style={{ height: `${Math.max(4, (d.count / maxDay) * 100)}%` }}
                      title={`${d.date}: ${d.count}`}
                    />
                    <span className="text-[8px] text-[var(--rz-text-muted)] truncate w-full text-center">
                      {d.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-[var(--rz-text-muted)]">Sem dados no período.</p>
      )}
    </Card>
  )
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-md bg-[var(--rz-surface-muted)]/60 px-2 py-1.5">
      <p className="text-[var(--rz-text-muted)]">{label}</p>
      <p className={cn('font-semibold', highlight ? 'text-brand-400' : 'text-[var(--rz-text-primary)]')}>
        {value}
      </p>
    </div>
  )
}
