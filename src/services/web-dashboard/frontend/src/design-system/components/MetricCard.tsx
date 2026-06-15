import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { themeClasses } from '../theme'
import { StatusBadge, type StatusBadgeProps } from './StatusBadge'
import { Skeleton } from '@/components/ui/shadcn/skeleton'

interface MetricCardProps {
  title: string
  value: ReactNode
  description?: string
  icon?: LucideIcon
  status?: StatusBadgeProps
  trend?: { label: string; positive?: boolean }
  loading?: boolean
  className?: string
}

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  status,
  trend,
  loading,
  className,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className={cn(themeClasses.card, themeClasses.cardPadding, className)}>
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
      </div>
    )
  }

  return (
    <div className={cn(themeClasses.card, themeClasses.cardPadding, className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--rz-text-secondary)]">{title}</p>
        {Icon ? (
          <span className="rounded-lg bg-[var(--rz-surface-muted)] p-2 text-[var(--rz-primary)]">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-bold text-[var(--rz-text-primary)]">{value}</p>
      {(description || status || trend) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {description ? (
            <p className="text-xs text-[var(--rz-text-muted)]">{description}</p>
          ) : null}
          {status ? <StatusBadge {...status} /> : null}
          {trend ? (
            <span
              className={cn(
                'text-xs font-medium',
                trend.positive ? 'text-[var(--rz-success-text)]' : 'text-[var(--rz-danger-text)]',
              )}
            >
              {trend.label}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
