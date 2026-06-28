import { useQuery } from '@tanstack/react-query'
import type { AdminOpsSummary } from '@radarzap-types/admin-ops-summary'
import { api } from '../../lib/api'

export function useAdminOpsSummary(enabled = true) {
  return useQuery({
    queryKey: ['admin-ops-summary'],
    queryFn: () => api.get<AdminOpsSummary>('/admin/ops/summary'),
    refetchInterval: 30_000,
    enabled,
  })
}

export async function refreshAdminOpsSummary(
  setQueryData: (data: AdminOpsSummary) => void,
  refetch: () => Promise<unknown>,
): Promise<void> {
  try {
    const fresh = await api.get<AdminOpsSummary>('/admin/ops/summary?refresh=1')
    setQueryData(fresh)
  } catch {
    await refetch()
  }
}
