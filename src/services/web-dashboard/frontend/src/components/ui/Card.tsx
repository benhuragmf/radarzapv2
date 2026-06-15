import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={cn('rz-card p-5', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-sm font-medium text-[var(--rz-text-secondary)] mb-1">{children}</h2>
  )
}

export function CardValue({ children }: { children: ReactNode }) {
  return (
    <p className="text-2xl font-bold text-[var(--rz-text-primary)]">{children}</p>
  )
}
