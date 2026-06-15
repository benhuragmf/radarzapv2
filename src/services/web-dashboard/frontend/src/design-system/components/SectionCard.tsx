import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { themeClasses } from '../theme'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'

interface SectionCardProps {
  title?: string
  description?: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
  loading?: boolean
  empty?: { title: string; description?: string; action?: ReactNode }
  error?: { title?: string; message: string; onRetry?: () => void }
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  loading,
  empty,
  error,
}: SectionCardProps) {
  let body: ReactNode = children

  if (loading) {
    body = <LoadingState rows={3} />
  } else if (error) {
    body = (
      <ErrorState
        title={error.title}
        message={error.message}
        onRetry={error.onRetry}
      />
    )
  } else if (empty && !children) {
    body = (
      <EmptyState
        title={empty.title}
        description={empty.description}
        action={empty.action}
      />
    )
  }

  return (
    <section className={cn(themeClasses.card, 'overflow-hidden', className)}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-2 border-b border-[var(--rz-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-xs text-[var(--rz-text-secondary)]">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      <div className={cn(themeClasses.cardPadding, !title && !description && !actions && 'pt-5')}>
        {body}
      </div>
    </section>
  )
}
