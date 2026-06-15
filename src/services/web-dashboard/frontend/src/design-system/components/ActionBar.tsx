import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ActionBarProps {
  children: ReactNode
  className?: string
  align?: 'start' | 'end' | 'between'
}

const alignClass = {
  start: 'justify-start',
  end: 'justify-end',
  between: 'justify-between',
} as const

export function ActionBar({ children, className, align = 'end' }: ActionBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        alignClass[align],
        className,
      )}
    >
      {children}
    </div>
  )
}
