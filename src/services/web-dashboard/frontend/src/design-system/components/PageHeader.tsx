import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  badges?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, badges, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-[var(--rz-text-primary)] sm:text-2xl">{title}</h1>
          {badges}
        </div>
        {subtitle ? (
          <p className="text-sm text-[var(--rz-text-secondary)] leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
