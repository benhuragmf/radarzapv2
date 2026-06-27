import {
  ClassificationBadge,
  COMMERCIAL_STATUS_LABELS,
  CONTACT_ORIGIN_LABELS,
  formatRelativeContactTime,
  PHONE_QUALITY_LABELS,
  QUALITY_BADGE_CLASS,
  TEMPERATURE_BADGE_CLASS,
  TEMPERATURE_LABELS,
  type ContactClassificationView,
} from '../../lib/contactClassificationUi'
import { ContactClassificationBadges } from './ContactClassificationBadges'

interface Props {
  classification?: ContactClassificationView
  tags?: string[]
  listLabels?: string[]
  lastMessageSent?: string
  compact?: boolean
}

export function ContactClassificationCard({
  classification,
  tags,
  listLabels,
  lastMessageSent,
  compact = false,
}: Props) {
  if (!classification) return null

  return (
    <div className="rounded-lg border border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/30 p-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]">
        Classificação
      </p>
      <ContactClassificationBadges classification={classification} compact={compact} />
      {!compact && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] pt-1">
          <div>
            <span className="text-[var(--rz-text-muted)]">Origem</span>
            <p className="text-[var(--rz-text-secondary)]">{CONTACT_ORIGIN_LABELS[classification.origin]}</p>
          </div>
          <div>
            <span className="text-[var(--rz-text-muted)]">Funil</span>
            <p className="text-[var(--rz-text-secondary)]">
              {COMMERCIAL_STATUS_LABELS[classification.commercialStatus]}
            </p>
          </div>
          <div>
            <span className="text-[var(--rz-text-muted)]">Temperatura</span>
            <p className={TEMPERATURE_BADGE_CLASS[classification.temperature]}>
              {TEMPERATURE_LABELS[classification.temperature]}
            </p>
          </div>
          <div>
            <span className="text-[var(--rz-text-muted)]">Número</span>
            <ClassificationBadge
              label={PHONE_QUALITY_LABELS[classification.phoneQuality]}
              className={QUALITY_BADGE_CLASS[classification.phoneQuality]}
            />
          </div>
          {lastMessageSent && (
            <div className="col-span-2">
              <span className="text-[var(--rz-text-muted)]">Último envio</span>
              <p className="text-[var(--rz-text-secondary)]">{formatRelativeContactTime(lastMessageSent)}</p>
            </div>
          )}
          {listLabels && listLabels.length > 0 && (
            <div className="col-span-2">
              <span className="text-[var(--rz-text-muted)]">Listas</span>
              <p className="text-[var(--rz-text-secondary)] truncate">{listLabels.join(', ')}</p>
            </div>
          )}
          {tags && tags.length > 0 && (
            <div className="col-span-2">
              <span className="text-[var(--rz-text-muted)]">Tags</span>
              <p className="text-[var(--rz-text-secondary)] truncate">{tags.join(', ')}</p>
            </div>
          )}
        </div>
      )}
      {!classification.campaignSelectable && classification.sendBlockReason && (
        <p className="text-[10px] text-red-400/90 border border-red-900/40 bg-red-950/20 rounded px-2 py-1.5">
          Campanha: {classification.sendBlockReason}
        </p>
      )}
    </div>
  )
}
