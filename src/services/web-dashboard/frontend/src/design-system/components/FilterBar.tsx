import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FilterBarProps {
  children: ReactNode
  className?: string
  /** Ações à direita (limpar filtros, exportar, etc.) */
  actions?: ReactNode
}

export function FilterBar({ children, className, actions }: FilterBarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)] p-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">{children}</div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
