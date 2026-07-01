export type WaRegistrationStatus =
  | 'pending'
  | 'verified'
  | 'not_on_whatsapp'
  | 'check_failed'

const LABELS: Record<WaRegistrationStatus, string> = {
  pending: 'Aguardando validação',
  verified: 'No WhatsApp',
  not_on_whatsapp: 'Sem WhatsApp',
  check_failed: 'Falha na checagem',
}

const STYLE: Record<WaRegistrationStatus, string> = {
  pending: 'bg-amber-950/40 text-amber-300/95 border-amber-800/50',
  verified: 'bg-emerald-950/35 text-emerald-300/90 border-emerald-800/40',
  not_on_whatsapp: 'bg-red-950/35 text-red-300/90 border-red-900/50',
  check_failed: 'bg-orange-950/35 text-orange-300/90 border-orange-900/50',
}

export function ContactWaRegistrationBadge({
  status,
  compact,
}: {
  status?: WaRegistrationStatus | string | null
  compact?: boolean
}) {
  const st = (status ?? 'pending') as WaRegistrationStatus
  if (st === 'verified' && compact) return null

  return (
    <span
      className={`inline-flex items-center border rounded px-1.5 py-0.5 font-medium ${
        compact ? 'text-[9px]' : 'text-[10px]'
      } ${STYLE[st] ?? STYLE.pending}`}
      title={LABELS[st] ?? st}
    >
      {LABELS[st] ?? st}
    </span>
  )
}
