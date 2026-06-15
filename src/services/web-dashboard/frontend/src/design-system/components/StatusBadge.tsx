import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StatusVariant } from '../tokens'

export interface StatusBadgeProps {
  status: StatusVariant
  text: string
  icon?: LucideIcon
  className?: string
}

const statusClass: Record<StatusVariant, string> = {
  success: 'bg-[var(--rz-success-bg)] text-[var(--rz-success-text)] border-[var(--rz-success-text)]/20',
  warning: 'bg-[var(--rz-warning-bg)] text-[var(--rz-warning-text)] border-[var(--rz-warning-text)]/20',
  danger: 'bg-[var(--rz-danger-bg)] text-[var(--rz-danger-text)] border-[var(--rz-danger-text)]/20',
  info: 'bg-[var(--rz-info-bg)] text-[var(--rz-info-text)] border-[var(--rz-info-text)]/20',
  neutral: 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)] border-[var(--rz-border)]',
  premium: 'bg-[var(--rz-premium-bg)] text-[var(--rz-premium-text)] border-[var(--rz-premium-text)]/20',
}

export function StatusBadge({ status, text, icon: Icon, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        statusClass[status],
        className,
      )}
    >
      {Icon ? <Icon className="size-3 shrink-0" aria-hidden /> : null}
      {text}
    </span>
  )
}
