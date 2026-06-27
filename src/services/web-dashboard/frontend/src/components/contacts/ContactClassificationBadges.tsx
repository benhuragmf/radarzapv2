import {
  ClassificationBadge,
  COMMERCIAL_STATUS_LABELS,
  CONTACT_KIND_LABELS,
  CONTACT_ORIGIN_LABELS,
  KIND_BADGE_CLASS,
  PERMISSION_BADGE_CLASS,
  PHONE_QUALITY_LABELS,
  QUALITY_BADGE_CLASS,
  SEND_PERMISSION_LABELS,
  TEMPERATURE_BADGE_CLASS,
  TEMPERATURE_LABELS,
  type ContactClassificationView,
} from '../../lib/contactClassificationUi'

export function ContactClassificationBadges({
  classification,
  compact = false,
}: {
  classification?: ContactClassificationView
  compact?: boolean
}) {
  if (!classification) return null

  return (
    <div className={`flex flex-wrap gap-1 ${compact ? '' : 'mt-1'}`}>
      <ClassificationBadge
        label={CONTACT_KIND_LABELS[classification.kind]}
        className={KIND_BADGE_CLASS[classification.kind]}
      />
      <ClassificationBadge
        label={SEND_PERMISSION_LABELS[classification.permission]}
        className={PERMISSION_BADGE_CLASS[classification.permission]}
        title={classification.sendBlockReason}
      />
      {!compact && (
        <>
          <ClassificationBadge
            label={CONTACT_ORIGIN_LABELS[classification.origin]}
            className="bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)] border-[var(--rz-border)]"
          />
          <span className={`text-[10px] self-center ${TEMPERATURE_BADGE_CLASS[classification.temperature]}`}>
            {TEMPERATURE_LABELS[classification.temperature]}
          </span>
          <ClassificationBadge
            label={PHONE_QUALITY_LABELS[classification.phoneQuality]}
            className={QUALITY_BADGE_CLASS[classification.phoneQuality]}
          />
        </>
      )}
      {!compact && (
        <span className="text-[10px] text-[var(--rz-text-muted)] self-center">
          {COMMERCIAL_STATUS_LABELS[classification.commercialStatus]}
        </span>
      )}
      {classification.sendBlockReason && !classification.campaignSelectable && (
        <span className="text-[10px] text-red-400/90 w-full">{classification.sendBlockReason}</span>
      )}
    </div>
  )
}
