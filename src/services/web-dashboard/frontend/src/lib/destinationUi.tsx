import { useState, type ReactNode } from 'react'
import { Button } from '../components/ui/Button'
import {
  Check,
  Copy,
  Trash2,
  History,
  RotateCcw,
  ShieldOff,
  Pencil,
  ListOrdered,
} from 'lucide-react'
import {
  ConsentBadge,
  ConsentDot,
  CONSENT_STATUS_META,
  effectiveConsentStatus,
  type ConsentStatus,
} from './consentUi'
import { formatContactIdentifier } from './destinationFormat'
import { ContactAvatar } from '../components/contacts/ContactAvatar'
import { ContactExtraMeta } from './contactMetaUi'

export interface Destination {
  _id: string
  name: string
  identifier: string
  type: 'contact' | 'group'
  isActive: boolean
  lastMessageSent?: string
  consentStatus?: ConsentStatus
  pendingOutboundCount?: number
  consent?: { granted?: boolean }
  birthday?: string
  tags?: string[]
  contactGroupIds?: string[]
  email?: string
  notes?: string
  organization?: string
  secondaryPhone?: string
  phoneType?: string
  hasProfilePicture?: boolean
  profilePictureUpdatedAt?: string
}

export { inputCls, selectCls, textareaCls } from '@/design-system/formClasses'

function IconBtn({
  title,
  onClick,
  disabled,
  children,
  danger,
}: {
  title: string
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${
        danger
          ? 'text-[var(--rz-text-muted)] hover:text-red-400 hover:bg-red-950/30'
          : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)] hover:bg-[var(--rz-surface-muted)]'
      }`}
    >
      {children}
    </button>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <IconBtn
      title="Copiar número"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setOk(true)
        setTimeout(() => setOk(false), 1500)
      }}
    >
      {ok ? <Check size={15} className="text-brand-500" /> : <Copy size={15} />}
    </IconBtn>
  )
}

export function DestinationRow({
  d,
  onRemove,
  removing,
  onRequestRenewal,
  onClearRefusal,
  onShowHistory,
  onEdit,
  canEdit,
  canRequestRenewal,
  canClearRefusal,
  canDelete,
  requestingRenewal,
  clearingRefusal,
  segmentLabels,
  selected,
  onToggleSelect,
  selectDisabled,
}: {
  d: Destination
  onRemove: () => void
  removing: boolean
  onRequestRenewal?: () => void
  onClearRefusal?: () => void
  onShowHistory?: () => void
  onEdit?: () => void
  canEdit?: boolean
  canRequestRenewal?: boolean
  canClearRefusal?: boolean
  canDelete?: boolean
  requestingRenewal?: boolean
  clearingRefusal?: boolean
  /** Nomes dos segmentos/listas (contact groups) */
  segmentLabels?: string[]
  selected?: boolean
  onToggleSelect?: () => void
  selectDisabled?: boolean
}) {
  const consentSt =
    d.type === 'contact'
      ? effectiveConsentStatus(d.consentStatus, d.consent?.granted)
      : null

  const showRenewal =
    canRequestRenewal &&
    onRequestRenewal &&
    consentSt &&
    consentSt !== 'ACCEPTED' &&
    consentSt !== 'REFUSED_THREE' &&
    consentSt !== 'MANUALLY_BLOCKED' &&
    (consentSt.startsWith('REFUSED') ||
      (consentSt === 'PENDING' && (d.pendingOutboundCount ?? 0) >= 3))

  const showClearRefusal =
    canClearRefusal &&
    onClearRefusal &&
    (consentSt === 'REFUSED_FIRST' || consentSt === 'REFUSED_SECOND')

  const hasFooter =
    (segmentLabels?.length ?? 0) > 0 || (d.tags?.length ?? 0) > 0

  return (
    <div
      className={`rounded-xl border bg-[var(--rz-surface)]/50 hover:border-[var(--rz-border)] transition-colors overflow-hidden ${
        selected ? 'border-brand-600/40 ring-1 ring-brand-600/20' : 'border-[var(--rz-border)]'
      }`}
      style={
        consentSt
          ? {
              borderLeftWidth: 4,
              borderLeftColor: CONSENT_STATUS_META[consentSt].borderColor,
            }
          : undefined
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 sm:p-4">
        <div className="flex gap-3 min-w-0 flex-1">
          {onToggleSelect && (
            <label
              className={`flex items-start pt-2.5 shrink-0 ${
                selectDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selected ?? false}
                disabled={selectDisabled}
                onChange={onToggleSelect}
                className="rounded border-[var(--rz-border)]"
                aria-label={`Selecionar ${d.name}`}
              />
            </label>
          )}
          <ContactAvatar
            name={d.name}
            destinationId={d._id}
            hasProfilePicture={d.hasProfilePicture}
            profilePictureUpdatedAt={d.profilePictureUpdatedAt}
            size={44}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-[var(--rz-text-primary)] truncate">{d.name}</p>
              {consentSt && <ConsentBadge status={consentSt} />}
              {consentSt === 'PENDING' && (d.pendingOutboundCount ?? 0) > 0 && (
                <span className="text-[10px] text-amber-400/90 bg-amber-950/40 px-1.5 py-0.5 rounded">
                  {d.pendingOutboundCount}/3 tentativas
                </span>
              )}
              {d.type === 'group' && (
                <span className="text-[10px] text-emerald-400/90 bg-emerald-950/40 px-1.5 py-0.5 rounded">
                  Grupo WA
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--rz-text-muted)] font-mono mt-0.5 truncate">
              {d.type === 'contact' ? formatContactIdentifier(d.identifier, d.name) : d.identifier}
            </p>
            {d.type === 'contact' && (
              <ContactExtraMeta
                c={{
                  organization: d.organization,
                  secondaryPhone: d.secondaryPhone,
                  phoneType: d.phoneType,
                  birthday: d.birthday,
                  email: d.email,
                  tags: undefined,
                  notes: d.notes,
                }}
                compact
              />
            )}
            {d.lastMessageSent && (
              <p className="text-[11px] text-[var(--rz-text-muted)] mt-1">
                Último envio: {new Date(d.lastMessageSent).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:shrink-0 sm:pt-0.5 pl-[52px] sm:pl-0">
          {canEdit && onEdit && d.type === 'contact' && (
            <IconBtn title="Editar contato e segmentos" onClick={onEdit}>
              <Pencil size={15} />
            </IconBtn>
          )}
          {onShowHistory && d.type === 'contact' && (
            <IconBtn title="Histórico de consentimento" onClick={onShowHistory}>
              <History size={15} />
            </IconBtn>
          )}
          <CopyBtn text={d.identifier} />
          {canDelete !== false && (
            <IconBtn
              title="Remover contato"
              danger
              disabled={removing}
              onClick={() => {
                if (window.confirm(`Remover "${d.name}"?`)) onRemove()
              }}
            >
              <Trash2 size={15} />
            </IconBtn>
          )}
        </div>
      </div>

      {(showRenewal || showClearRefusal) && (
        <div className="px-4 pb-3 flex flex-wrap gap-2 border-t border-[var(--rz-border)]/60 pt-2">
          {showRenewal && (
            <Button
              size="sm"
              variant="secondary"
              disabled={requestingRenewal}
              onClick={onRequestRenewal}
            >
              <RotateCcw size={12} /> Solicitar novo aceite
            </Button>
          )}
          {showClearRefusal && (
            <Button
              size="sm"
              variant="secondary"
              disabled={clearingRefusal}
              onClick={onClearRefusal}
            >
              <ShieldOff size={12} /> Apagar recusa
            </Button>
          )}
        </div>
      )}

      {hasFooter && (
        <div className="px-4 py-2.5 flex flex-wrap items-center gap-1.5 border-t border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/40">
          {segmentLabels?.map(label => (
            <span
              key={label}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-brand-800/50 bg-brand-950/50 text-brand-300/90"
            >
              <ListOrdered size={9} />
              {label}
            </span>
          ))}
          {d.tags?.map(tag => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/80 text-[var(--rz-text-muted)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export { ConsentDot, effectiveConsentStatus }
