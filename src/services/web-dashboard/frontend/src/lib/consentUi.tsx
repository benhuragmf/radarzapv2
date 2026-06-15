import { cn } from '@/lib/utils'

export type ConsentStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REFUSED_FIRST'
  | 'REFUSED_SECOND'
  | 'REFUSED_THREE'
  | 'MANUALLY_BLOCKED'

export const CONSENT_STATUS_META: Record<
  ConsentStatus,
  { label: string; dotClass: string; badgeClass: string; borderColor: string }
> = {
  PENDING: {
    label: 'Aguardando aceite',
    dotClass: 'bg-[var(--rz-warning)]',
    badgeClass:
      'bg-[var(--rz-warning-bg)] text-[var(--rz-warning-text)] border-[var(--rz-warning-text)]/35',
    borderColor: 'var(--rz-warning-text)',
  },
  ACCEPTED: {
    label: 'Aceito',
    dotClass: 'bg-[var(--rz-success)]',
    badgeClass:
      'bg-[var(--rz-success-bg)] text-[var(--rz-success-text)] border-[var(--rz-success-text)]/35',
    borderColor: 'var(--rz-success-text)',
  },
  REFUSED_FIRST: {
    label: 'Recusou (1x)',
    dotClass: 'bg-[var(--rz-danger-text)]',
    badgeClass:
      'bg-[var(--rz-danger-bg)] text-[var(--rz-danger-text)] border-[var(--rz-danger-text)]/35',
    borderColor: 'var(--rz-danger-text)',
  },
  REFUSED_SECOND: {
    label: 'Recusou (2x)',
    dotClass: 'bg-[var(--rz-danger)]',
    badgeClass:
      'bg-[var(--rz-danger-bg)] text-[var(--rz-danger-text)] border-[var(--rz-danger)]/40',
    borderColor: 'var(--rz-danger)',
  },
  REFUSED_THREE: {
    label: 'Recusou (3x)',
    dotClass: 'bg-[var(--rz-text-muted)]',
    badgeClass:
      'bg-[var(--rz-surface-muted)] text-[var(--rz-text-primary)] border-[var(--rz-border)]',
    borderColor: 'var(--rz-text-muted)',
  },
  MANUALLY_BLOCKED: {
    label: 'Bloqueado',
    dotClass: 'bg-[var(--rz-danger)]',
    badgeClass:
      'bg-[var(--rz-danger-bg)] text-[var(--rz-danger-text)] border-[var(--rz-danger)]/50',
    borderColor: 'var(--rz-danger)',
  },
}

export function effectiveConsentStatus(
  status?: ConsentStatus | null,
  granted?: boolean,
): ConsentStatus {
  if (status) return status
  return granted ? 'ACCEPTED' : 'PENDING'
}

export function canSelectForSend(status: ConsentStatus, pendingOutboundCount = 0): boolean {
  if (status === 'ACCEPTED') return true
  if (status === 'PENDING' && pendingOutboundCount < 3) return true
  return false
}

export function ConsentDot({ status }: { status: ConsentStatus }) {
  const meta = CONSENT_STATUS_META[status]
  return (
    <span
      title={meta.label}
      className={cn(
        'inline-block w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-[var(--rz-surface)]',
        meta.dotClass,
      )}
    />
  )
}

export function ConsentBadge({ status }: { status: ConsentStatus }) {
  const meta = CONSENT_STATUS_META[status]
  return (
    <span
      className={cn(
        'text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap border',
        meta.badgeClass,
      )}
    >
      {meta.label}
    </span>
  )
}
