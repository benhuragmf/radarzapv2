import { cn } from '@/lib/utils'

type Variant = 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'purple' | 'premium'

const styles: Record<Variant, string> = {
  green:  'bg-[var(--rz-success-bg)] text-[var(--rz-success-text)] border-[var(--rz-success-text)]/25',
  red:    'bg-[var(--rz-danger-bg)]  text-[var(--rz-danger-text)]  border-[var(--rz-danger-text)]/25',
  yellow: 'bg-[var(--rz-warning-bg)] text-[var(--rz-warning-text)] border-[var(--rz-warning-text)]/25',
  gray:   'bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)] border-[var(--rz-border)]',
  blue:   'bg-[var(--rz-info-bg)]    text-[var(--rz-info-text)]    border-[var(--rz-info-text)]/25',
  purple: 'bg-[var(--rz-premium-bg)]  text-[var(--rz-premium-text)]  border-[var(--rz-premium-text)]/25',
  premium:'bg-[var(--rz-premium-bg)]  text-[var(--rz-premium-text)]  border-[var(--rz-premium-text)]/25',
}

export function Badge({ label, variant = 'gray' }: { label: string; variant?: Variant }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border', styles[variant])}>
      {label}
    </span>
  )
}
