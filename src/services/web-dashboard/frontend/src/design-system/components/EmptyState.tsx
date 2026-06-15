import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-10 text-center',
        className,
      )}
    >
      <span className="mb-3 rounded-full bg-[var(--rz-surface-muted)] p-3 text-[var(--rz-text-muted)]">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-[var(--rz-text-primary)]">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--rz-text-secondary)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
