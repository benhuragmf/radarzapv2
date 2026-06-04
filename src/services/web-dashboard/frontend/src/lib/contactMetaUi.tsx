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

/** Metadados extras do contato (import VCF/CSV ou edição futura) */
export function ContactExtraMeta({ c }: { c: ContactExtraFields }) {
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

  return (
    <div className="mt-1.5 space-y-1 text-[11px] text-gray-500">
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {c.organization && (
          <span>
            <span className="text-gray-600">Empresa:</span> {c.organization}
          </span>
        )}
        {c.email && (
          <span className="truncate max-w-[220px]">
            <span className="text-gray-600">E-mail:</span> {c.email}
          </span>
        )}
        {c.birthday && (
          <span>
            <span className="text-gray-600">Aniv.:</span> {formatBirthdayDisplay(c.birthday)}
          </span>
        )}
        {c.tags && c.tags.length > 0 && (
          <span>
            <span className="text-gray-600">Tags:</span> {c.tags.join(', ')}
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
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              {c.phoneType === 'whatsapp' && <MessageCircle size={10} />}
              {typeLabel}
            </span>
          )}
          {c.secondaryPhone && (
            <span>
              <span className="text-gray-600 font-sans">2º tel.:</span>{' '}
              {formatPhone(c.secondaryPhone)}
            </span>
          )}
        </div>
      )}
      {notesShort && (
        <p className="text-gray-600 italic truncate max-w-full" title={c.notes}>
          {notesShort}
        </p>
      )}
    </div>
  )
}
