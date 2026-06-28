import { Link } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import { adminDashboardTabUrl, type AdminOpsTab } from './adminOpsTabs'

interface Props {
  tab: AdminOpsTab
  label?: string
}

/** Banner nas páginas admin legadas — aponta para a visão consolidada no Dashboard Ops. */
export default function AdminOpsLegacyBanner({ tab, label }: Props) {
  const dest = adminDashboardTabUrl(tab)
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--rz-primary)]/25 bg-[var(--rz-primary)]/5 px-4 py-3 text-sm"
      data-testid="admin-ops-legacy-banner"
    >
      <LayoutDashboard className="size-4 shrink-0 text-[var(--rz-primary)]" aria-hidden />
      <p className="text-[var(--rz-text-secondary)]">
        {label ?? 'Visão consolidada com alertas e métricas atualizadas:'}{' '}
        <Link to={dest} className="font-medium text-[var(--rz-primary)] hover:underline">
          Dashboard global → {tab}
        </Link>
      </p>
    </div>
  )
}
