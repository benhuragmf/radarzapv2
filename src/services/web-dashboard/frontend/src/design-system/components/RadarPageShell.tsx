import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { pageShellClassName } from '../theme'

interface RadarPageShellProps {
  children: ReactNode
  className?: string
  /** Largura máxima — padrão max-w-6xl alinhado ao PlatformPage */
  maxWidth?: 'default' | 'wide' | 'full'
}

const maxWidthClass = {
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
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
