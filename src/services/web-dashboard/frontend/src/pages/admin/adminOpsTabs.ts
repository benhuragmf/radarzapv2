export type AdminOpsTab =
  | 'overview'
  | 'infra'
  | 'tenants'
  | 'atendimento'
  | 'billing'
  | 'ai'
  | 'security'
  | 'golive'

const VALID_TABS: AdminOpsTab[] = [
  'overview',
  'infra',
  'tenants',
  'atendimento',
  'billing',
  'ai',
  'security',
  'golive',
]

export function parseAdminOpsTab(value: string | null | undefined): AdminOpsTab | undefined {
  if (!value) return undefined
  return VALID_TABS.includes(value as AdminOpsTab) ? (value as AdminOpsTab) : undefined
}

export function adminDashboardTabUrl(tab: AdminOpsTab): string {
  return tab === 'overview' ? '/admin/dashboard' : `/admin/dashboard#${tab}`
}
