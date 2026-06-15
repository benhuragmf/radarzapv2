import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { dashboardGridClassName } from '../theme'

interface DashboardShellProps {
  children: ReactNode
  className?: string
  /** Grid de métricas acima do conteúdo principal */
  metrics?: ReactNode
}

/** Layout interno para dashboards com grid de métricas opcional. */
export function DashboardShell({ children, className, metrics }: DashboardShellProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {metrics ? <div className={dashboardGridClassName()}>{metrics}</div> : null}
      {children}
    </div>
  )
}
