import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

type InlineNoticeTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

interface InlineNoticeProps {
  tone?: InlineNoticeTone
  title?: ReactNode
  children: ReactNode
  icon?: LucideIcon
  className?: string
}

const toneClass: Record<InlineNoticeTone, string> = {
  info: 'border-[var(--rz-info-text)]/25 bg-[var(--rz-info-bg)] text-[var(--rz-info-text)]',
  success: 'border-[var(--rz-success-text)]/25 bg-[var(--rz-success-bg)] text-[var(--rz-success-text)]',
  warning: 'border-[var(--rz-warning-text)]/25 bg-[var(--rz-warning-bg)] text-[var(--rz-warning-text)]',
  danger: 'border-[var(--rz-danger-text)]/25 bg-[var(--rz-danger-bg)] text-[var(--rz-danger-text)]',
  neutral: 'border-[var(--rz-border)] bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)]',
}

const toneIcon: Record<InlineNoticeTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: ShieldAlert,
  neutral: Info,
}

export function InlineNotice({
  tone = 'info',
  title,
  children,
  icon,
  className,
}: InlineNoticeProps) {
  const Icon = icon ?? toneIcon[tone]

  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border px-3 py-2.5 text-sm',
        toneClass[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="font-medium text-current">{title}</p> : null}
        <div className="text-xs leading-relaxed text-[var(--rz-text-secondary)]">{children}</div>
      </div>
    </div>
  )
}
