import { Check } from 'lucide-react'
import { formatContactIdentifier } from '../../lib/destinationFormat'
import {
  ClassificationBadge,
  COMMERCIAL_STATUS_LABELS,
  CONTACT_KIND_LABELS,
  CONTACT_ORIGIN_LABELS,
  formatRelativeContactTime,
  KIND_BADGE_CLASS,
  PERMISSION_BADGE_CLASS,
  PHONE_QUALITY_LABELS,
  QUALITY_BADGE_CLASS,
  SEND_PERMISSION_LABELS,
  TEMPERATURE_BADGE_CLASS,
  TEMPERATURE_LABELS,
  type ContactClassificationView,
} from '../../lib/contactClassificationUi'

export interface SendRecipientRow {
  _id: string
  name: string
  identifier: string
  type: 'contact' | 'group'
  tags?: string[]
  lastMessageSent?: string
  participantsCount?: number
  classification?: ContactClassificationView
}

interface Props {
  rows: SendRecipientRow[]
  selectedIds: Set<string>
  groupNameById: Map<string, string>
  contactGroupIdsByDest?: Map<string, string[]>
  onToggle: (id: string) => void
  isBlocked?: (row: SendRecipientRow) => boolean
  rowError?: (row: SendRecipientRow) => string | null
  compact?: boolean
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { first: full.trim(), last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function GreenSelectButton({
  checked,
  disabled,
  onClick,
  label,
  title,
}: {
  checked: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  title?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
        disabled
          ? 'opacity-40 cursor-not-allowed border-[var(--rz-border)]'
          : checked
            ? 'bg-emerald-500 border-emerald-500 text-white'
            : 'border-emerald-600/50 hover:border-emerald-500 hover:bg-emerald-950/30'
      }`}
    >
      {checked && <Check size={14} strokeWidth={3} />}
    </button>
  )
}

export function SendRecipientsTable({
  rows,
  selectedIds,
  groupNameById,
  contactGroupIdsByDest,
  onToggle,
  isBlocked,
  rowError,
  compact = false,
}: Props) {
  if (rows.length === 0) return null

  const isContactTable = rows.some(r => r.type === 'contact')

  return (
    <div className="border border-[var(--rz-border)] rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[22rem] overflow-y-auto">
        <table className="w-full text-sm border-collapse min-w-[880px]">
          <thead className="sticky top-0 z-10 bg-[var(--rz-surface-muted)] border-b border-[var(--rz-border)]">
            <tr className="text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)]">
              <th className="w-10 px-2 py-2 text-left font-medium" />
              <th className="px-3 py-2 text-left font-medium min-w-[150px]">Nome</th>
              <th className="px-3 py-2 text-left font-medium min-w-[110px]">Telefone</th>
              {isContactTable && (
                <>
                  <th className="px-3 py-2 text-left font-medium">Tipo</th>
                  <th className="px-3 py-2 text-left font-medium">Permissão</th>
                  <th className="px-3 py-2 text-left font-medium">Origem</th>
                  {!compact && (
                    <>
                      <th className="px-3 py-2 text-left font-medium">Lista / tags</th>
                      <th className="px-3 py-2 text-left font-medium">Último envio</th>
                      <th className="px-3 py-2 text-left font-medium">Qualidade</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-left font-medium min-w-[90px]">Risco</th>
                </>
              )}
              {!isContactTable && (
                <th className="px-3 py-2 text-left font-medium">Grupo WA</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const cls = row.classification
              const blocked = isBlocked?.(row) ?? (cls ? !cls.campaignSelectable : false)
              const error = rowError?.(row) ?? cls?.sendBlockReason
              const selected = selectedIds.has(row._id)
              const { first, last } = splitName(row.name)
              const groupIds = contactGroupIdsByDest?.get(row._id) ?? []
              const groupLabels = groupIds
                .map(id => groupNameById.get(id))
                .filter((n): n is string => Boolean(n))
              const tagPreview = row.tags?.slice(0, 3).join(', ')

              return (
                <tr
                  key={row._id}
                  className={`border-b border-[var(--rz-border)]/60 transition-colors align-top ${
                    blocked
                      ? 'opacity-55 bg-red-950/5'
                      : selected
                        ? 'bg-brand-600/10'
                        : 'hover:bg-[var(--rz-surface-muted)]/60'
                  }`}
                >
                  <td className="px-2 py-2.5 align-middle">
                    <GreenSelectButton
                      checked={selected}
                      disabled={blocked}
                      onClick={() => onToggle(row._id)}
                      label={`Selecionar ${row.name}`}
                      title={blocked ? error ?? 'Não pode receber campanha' : undefined}
                    />
                  </td>
                  <td className="px-3 py-2.5 align-middle min-w-0">
                    <p className="font-medium text-[var(--rz-text-primary)]">
                      {first}
                      {last && (
                        <span className="font-normal text-[var(--rz-text-secondary)]"> {last}</span>
                      )}
                    </p>
                    {cls && row.type === 'contact' && (
                      <p className="text-[10px] text-[var(--rz-text-muted)] mt-0.5 flex flex-wrap gap-1 items-center">
                        <span className={TEMPERATURE_BADGE_CLASS[cls.temperature]}>
                          {TEMPERATURE_LABELS[cls.temperature]}
                        </span>
                        <span className="text-[var(--rz-text-muted)]">·</span>
                        <span>{COMMERCIAL_STATUS_LABELS[cls.commercialStatus]}</span>
                      </p>
                    )}
                    {row.type === 'group' && (
                      <p className="text-[10px] text-emerald-400/90 mt-0.5">
                        {row.participantsCount != null
                          ? `${row.participantsCount} membros`
                          : 'Grupo WhatsApp'}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle font-mono text-xs text-[var(--rz-text-muted)] whitespace-nowrap">
                    {row.type === 'contact'
                      ? formatContactIdentifier(row.identifier, row.name)
                      : row.identifier}
                  </td>
                  {isContactTable && row.type === 'contact' && cls && (
                    <>
                      <td className="px-3 py-2.5 align-middle">
                        <ClassificationBadge
                          label={CONTACT_KIND_LABELS[cls.kind]}
                          className={KIND_BADGE_CLASS[cls.kind]}
                        />
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <ClassificationBadge
                          label={SEND_PERMISSION_LABELS[cls.permission]}
                          className={PERMISSION_BADGE_CLASS[cls.permission]}
                          title={error}
                        />
                      </td>
                      <td className="px-3 py-2.5 align-middle text-xs text-[var(--rz-text-secondary)]">
                        {CONTACT_ORIGIN_LABELS[cls.origin]}
                      </td>
                      {!compact && (
                        <>
                          <td className="px-3 py-2.5 align-middle text-xs text-[var(--rz-text-muted)] max-w-[140px]">
                            {groupLabels.length > 0 && (
                              <p className="truncate" title={groupLabels.join(', ')}>
                                {groupLabels.join(', ')}
                              </p>
                            )}
                            {tagPreview && (
                              <p className="truncate text-[10px] mt-0.5" title={row.tags?.join(', ')}>
                                {tagPreview}
                              </p>
                            )}
                            {!groupLabels.length && !tagPreview && (
                              <span className="text-[var(--rz-text-muted)]/50">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-middle text-xs text-[var(--rz-text-muted)] whitespace-nowrap">
                            {formatRelativeContactTime(row.lastMessageSent)}
                          </td>
                          <td className="px-3 py-2.5 align-middle">
                            <ClassificationBadge
                              label={PHONE_QUALITY_LABELS[cls.phoneQuality]}
                              className={QUALITY_BADGE_CLASS[cls.phoneQuality]}
                            />
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2.5 align-middle">
                        {cls.temperature === 'risk' || cls.permission === 'opt_out' || blocked ? (
                          <span className="text-[10px] text-red-400 font-medium">
                            {cls.temperature === 'risk'
                              ? 'Alto'
                              : blocked
                                ? 'Bloqueado'
                                : '—'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-500/80">Baixo</span>
                        )}
                        {error && blocked && (
                          <p className="text-[10px] text-red-400/90 mt-0.5 max-w-[120px] leading-snug">
                            {error}
                          </p>
                        )}
                      </td>
                    </>
                  )}
                  {isContactTable && row.type === 'contact' && !cls && (
                    <td colSpan={compact ? 4 : 7} className="px-3 py-2.5 text-xs text-[var(--rz-text-muted)]">
                      Classificação indisponível
                    </td>
                  )}
                  {!isContactTable && (
                    <td className="px-3 py-2.5 text-xs text-[var(--rz-text-muted)]">
                      {row.name}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
