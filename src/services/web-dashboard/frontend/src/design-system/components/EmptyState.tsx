import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  size?: 'sm' | 'md'
  align?: 'center' | 'start'
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  size = 'md',
  align = 'center',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col justify-center',
        size === 'sm' ? 'py-6' : 'py-10',
        align === 'center' ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
      role="status"
    >
      <span
        className={cn(
          'mb-3 rounded-full bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)]',
          size === 'sm' ? 'p-2' : 'p-3',
        )}
      >
        <Icon className={size === 'sm' ? 'size-5' : 'size-6'} aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-[var(--rz-text-primary)]">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--rz-text-secondary)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
