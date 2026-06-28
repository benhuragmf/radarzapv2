import { AuthContext } from '../../lib/authContext'
import { can } from '../../lib/auth'
import AdminOpsLegacyBanner from './AdminOpsLegacyBanner'
import type { AdminOpsTab } from './adminOpsTabs'

interface Props {
  tab: AdminOpsTab
  label?: string
}

/** Banner hub Ops — só renderiza se o staff tiver `dashboard:global`. */
export default function AdminOpsHubLink({ tab, label }: Props) {
  if (!can(AuthContext.user, 'dashboard:global')) return null
  return <AdminOpsLegacyBanner tab={tab} label={label} />
}
