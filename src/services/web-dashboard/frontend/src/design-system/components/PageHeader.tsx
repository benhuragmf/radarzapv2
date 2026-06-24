import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  badges?: ReactNode
  actions?: ReactNode
  className?: string
  /** Menos padding e tipografia — páginas densas (Inbox, IA). */
  compact?: boolean
}

export function PageHeader({ title, subtitle, badges, actions, className, compact }: PageHeaderProps) {
  return (
    <header
      className={cn(
        compact ? 'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between' : 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className={cn('min-w-0', compact ? 'space-y-0.5' : 'space-y-1')}>
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className={cn(
              'font-semibold text-[var(--rz-text-primary)]',
              compact ? 'text-lg' : 'text-xl sm:text-2xl',
            )}
          >
            {title}
          </h1>
          {badges}
        </div>
        {subtitle ? (
          <p
            className={cn(
              'text-[var(--rz-text-secondary)]',
              compact ? 'text-xs leading-snug line-clamp-2' : 'text-sm leading-relaxed',
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div> : null}
    </header>
  )
}
