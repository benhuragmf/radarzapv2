import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InboxStatItem {
  label: string
  value: number | string
  icon: LucideIcon
  colorClass?: string
  description?: string
  href?: string
  alert?: boolean
}

interface Props {
  items: InboxStatItem[]
  className?: string
}

export function InboxStatsRow({ items, className }: Props) {
  return (
    <div className={cn('grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6', className)}>
      {items.map(item => {
        const Icon = item.icon
        const inner = (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)] leading-tight">
                {item.label}
              </p>
              <span
                className={cn(
                  'rounded-lg p-1.5 shrink-0',
                  item.alert
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-[var(--rz-surface-muted)]/80 text-[var(--rz-text-muted)]',
                )}
              >
                <Icon size={14} aria-hidden />
              </span>
            </div>
            <p
              className={cn(
                'text-xl font-semibold tabular-nums mt-1',
                item.colorClass ?? 'text-[var(--rz-text-primary)]',
              )}
            >
              {item.value}
            </p>
            {item.description && (
              <p className="text-[10px] text-[var(--rz-text-muted)] mt-0.5 line-clamp-1">{item.description}</p>
            )}
          </>
        )

        const cardCls = cn(
          'rounded-xl border px-3 py-2.5 transition-colors',
          item.alert
            ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
            : 'border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/40 hover:bg-[var(--rz-surface-muted)]/60',
          item.href && 'cursor-pointer',
        )

        if (item.href) {
          return (
            <Link key={item.label} to={item.href} className={cardCls}>
              {inner}
            </Link>
          )
        }

        return (
          <div key={item.label} className={cardCls}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}
