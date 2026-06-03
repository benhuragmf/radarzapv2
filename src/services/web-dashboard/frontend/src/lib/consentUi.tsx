export type ConsentStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REFUSED_FIRST'
  | 'REFUSED_SECOND'
  | 'REFUSED_THREE'
  | 'MANUALLY_BLOCKED'

export const CONSENT_STATUS_META: Record<
  ConsentStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  PENDING: {
    label: 'Aguardando aceite',
    color: '#ca8a04',
    bg: 'rgba(234, 179, 8, 0.15)',
    border: 'rgba(234, 179, 8, 0.35)',
  },
  ACCEPTED: {
    label: 'Aceito',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.12)',
    border: 'rgba(34, 197, 94, 0.35)',
  },
  REFUSED_FIRST: {
    label: 'Recusou (1x)',
    color: '#f87171',
    bg: 'rgba(248, 113, 113, 0.12)',
    border: 'rgba(248, 113, 113, 0.35)',
  },
  REFUSED_SECOND: {
    label: 'Recusou (2x)',
    color: '#dc2626',
    bg: 'rgba(220, 38, 38, 0.15)',
    border: 'rgba(220, 38, 38, 0.4)',
  },
  REFUSED_THREE: {
    label: 'Recusou (3x)',
    color: '#fafafa',
    bg: 'rgba(0, 0, 0, 0.55)',
    border: 'rgba(255, 255, 255, 0.15)',
  },
  MANUALLY_BLOCKED: {
    label: 'Bloqueado',
    color: '#fafafa',
    bg: 'rgba(0, 0, 0, 0.7)',
    border: 'rgba(239, 68, 68, 0.5)',
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
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-gray-900"
      style={{ backgroundColor: meta.color }}
    />
  )
}

export function ConsentBadge({ status }: { status: ConsentStatus }) {
  const meta = CONSENT_STATUS_META[status]
  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: meta.color, backgroundColor: meta.bg, border: `1px solid ${meta.border}` }}
    >
      {meta.label}
    </span>
  )
}
