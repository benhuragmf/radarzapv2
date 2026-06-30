import type { LeadContactClassification } from '@radarchat-types/lead-form'
import type { ContactClassificationView } from '../../lib/contactClassificationUi'
import { ContactClassificationBadges } from '../contacts/ContactClassificationBadges'

export function LeadClassificationBadges({
  classification,
  compact = true,
}: {
  classification?: LeadContactClassification | ContactClassificationView
  compact?: boolean
}) {
  if (!classification) return null
  return <ContactClassificationBadges classification={classification as ContactClassificationView} compact={compact} />
}
