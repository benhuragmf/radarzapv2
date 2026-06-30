import type { LeadCaptureStatus } from '@radarzap-types/lead-form'
import { LEAD_STATUS_DISPLAY } from '../../lib/leadUi'
import { cn } from '@/lib/utils'

const PIPELINE: { status: LeadCaptureStatus; short: string }[] = [
  { status: 'new', short: 'Novo' },
  { status: 'in_review', short: 'Tentando' },
  { status: 'in_progress', short: 'Atendimento' },
  { status: 'qualified', short: 'Qualificado' },
  { status: 'converted', short: 'Ganho' },
]

const CLOSED: { status: LeadCaptureStatus; short: string; tone: string }[] = [
  { status: 'lost', short: 'Perdido', tone: 'text-amber-400 border-amber-500/40 hover:bg-amber-500/10' },
  { status: 'spam', short: 'Spam', tone: 'text-red-400 border-red-500/40 hover:bg-red-500/10' },
]

export function LeadStatusPipeline({
  status,
  disabled,
  onChange,
  compact,
}: {
  status: LeadCaptureStatus
  disabled?: boolean
  onChange: (status: LeadCaptureStatus) => void
  compact?: boolean
}) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]">
        Etapa do funil
      </p>
      <div className={cn('flex flex-wrap gap-1.5', compact && 'gap-1')}>
        {PIPELINE.map(step => {
          const active = status === step.status
          return (
            <button
              key={step.status}
              type="button"
              disabled={disabled || active}
              title={LEAD_STATUS_DISPLAY[step.status]}
              onClick={() => onChange(step.status)}
              className={cn(
                'rounded-lg border text-xs font-medium transition-colors disabled:cursor-default',
                compact ? 'px-2 py-1' : 'px-2.5 py-1.5',
                active
                  ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/15 text-[var(--rz-primary)]'
                  : 'border-[var(--rz-border)] text-[var(--rz-text-secondary)] hover:bg-[var(--rz-surface-muted)] hover:border-[var(--rz-primary)]/30',
              )}
            >
              {step.short}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CLOSED.map(step => {
          const active = status === step.status
          return (
            <button
              key={step.status}
              type="button"
              disabled={disabled || active}
              onClick={() => onChange(step.status)}
              className={cn(
                'rounded-lg border text-[11px] font-medium px-2 py-1 transition-colors disabled:cursor-default',
                active ? 'border-current bg-current/10' : step.tone,
              )}
            >
              {step.short}
            </button>
          )
        })}
      </div>
    </div>
  )
}
