import { MessageCircle } from 'lucide-react'
import { formatPhone } from './destinationFormat'

const PHONE_TYPE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  cell: 'Celular',
  home: 'Residencial',
  work: 'Trabalho',
  other: 'Outro',
}

export interface ContactExtraFields {
  organization?: string
  secondaryPhone?: string
  phoneType?: string
  birthday?: string
  email?: string
  tags?: string[]
  notes?: string
}

function formatBirthdayDisplay(iso?: string): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  if (m[1] === '0000') return `${m[3]}/${m[2]}`
  return `${m[3]}/${m[2]}/${m[1]}`
}

function phoneTypeLabel(t?: string): string | null {
  if (!t) return null
  return PHONE_TYPE_LABELS[t] ?? t
}

/** Metadados extras do contato (import VCF/CSV ou edição) */
export function ContactExtraMeta({
  c,
  compact = false,
}: {
  c: ContactExtraFields
  compact?: boolean
}) {
  const has =
    c.organization ||
    c.email ||
    c.birthday ||
    (c.tags?.length ?? 0) > 0 ||
    c.notes ||
    c.secondaryPhone ||
    c.phoneType

  if (!has) return null

  const typeLabel = phoneTypeLabel(c.phoneType)
  const notesShort =
    c.notes && c.notes.length > 80 ? `${c.notes.slice(0, 77)}…` : c.notes

  if (compact) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--rz-text-muted)]">
        {typeLabel && (
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${
              c.phoneType === 'whatsapp'
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                : 'bg-[var(--rz-surface-muted)]/80 text-[var(--rz-text-muted)] border border-[var(--rz-border)]'
            }`}
          >
            {c.phoneType === 'whatsapp' && <MessageCircle size={10} />}
            {typeLabel}
          </span>
        )}
        {c.organization && (
          <span className="truncate max-w-[140px]" title={c.organization}>
            {c.organization}
          </span>
        )}
        {c.email && (
          <span className="truncate max-w-[160px] text-[var(--rz-text-muted)]" title={c.email}>
            {c.email}
          </span>
        )}
        {c.birthday && (
          <span className="text-[var(--rz-text-muted)]">Aniv. {formatBirthdayDisplay(c.birthday)}</span>
        )}
        {c.secondaryPhone && (
          <span className="font-mono text-[var(--rz-text-muted)]">{formatPhone(c.secondaryPhone)}</span>
        )}
        {notesShort && (
          <span className="text-[var(--rz-text-muted)] italic truncate max-w-[200px]" title={c.notes}>
            {notesShort}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="mt-1.5 space-y-1 text-[11px] text-[var(--rz-text-muted)]">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {c.organization && (
          <span>
            <span className="text-[var(--rz-text-muted)]">Empresa:</span> {c.organization}
          </span>
        )}
        {c.email && (
          <span className="truncate max-w-[220px]">
            <span className="text-[var(--rz-text-muted)]">E-mail:</span> {c.email}
          </span>
        )}
        {c.birthday && (
          <span>
            <span className="text-[var(--rz-text-muted)]">Aniv.:</span> {formatBirthdayDisplay(c.birthday)}
          </span>
        )}
        {c.tags && c.tags.length > 0 && (
          <span>
            <span className="text-[var(--rz-text-muted)]">Tags:</span> {c.tags.join(', ')}
          </span>
        )}
      </div>
      {(c.secondaryPhone || typeLabel) && (
        <div className="flex flex-wrap items-center gap-2 font-mono">
          {typeLabel && (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-sans ${
                c.phoneType === 'whatsapp'
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                  : 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)] border border-[var(--rz-border)]'
              }`}
            >
              {c.phoneType === 'whatsapp' && <MessageCircle size={10} />}
              {typeLabel}
            </span>
          )}
          {c.secondaryPhone && (
            <span>
              <span className="text-[var(--rz-text-muted)] font-sans">2º tel.:</span>{' '}
              {formatPhone(c.secondaryPhone)}
            </span>
          )}
        </div>
      )}
      {notesShort && (
        <p className="text-[var(--rz-text-muted)] italic truncate max-w-full" title={c.notes}>
          {notesShort}
        </p>
      )}
    </div>
  )
}
