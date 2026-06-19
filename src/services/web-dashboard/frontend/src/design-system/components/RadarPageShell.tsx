import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { pageShellClassName, platformPageMaxWidthClass } from '../theme'

interface RadarPageShellProps {
  children: ReactNode
  className?: string
  /** Largura máxima — padrão 1600px (mesmo do Inbox) */
  maxWidth?: 'default' | 'wide' | 'full'
}

const maxWidthClass = {
  default: platformPageMaxWidthClass,
  wide: platformPageMaxWidthClass,
  full: 'max-w-none',
} as const

/** Container padrão de página tenant/plataforma — não substitui Layout global. */
export function RadarPageShell({ children, className, maxWidth = 'default' }: RadarPageShellProps) {
  return (
    <div className={cn(pageShellClassName(), maxWidthClass[maxWidth], className)}>
      {children}
    </div>
  )
}
