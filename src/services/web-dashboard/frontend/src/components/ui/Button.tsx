import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'

const styles: Record<Variant, string> = {
  primary:
    'bg-[var(--rz-primary)] hover:bg-[var(--rz-primary-hover)] text-white rz-on-primary shadow-sm',
  secondary:
    'bg-[var(--rz-surface-muted)] hover:opacity-90 text-[var(--rz-text-primary)] border border-[var(--rz-border)]',
  danger:
    'bg-[var(--rz-danger)] hover:opacity-90 text-white rz-on-primary',
  ghost:
    'bg-transparent hover:bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)] hover:text-[var(--rz-text-primary)]',
  success:
    'bg-brand-600 hover:bg-brand-700 text-white rz-on-primary',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rz-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--rz-background)]',
        sz,
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
