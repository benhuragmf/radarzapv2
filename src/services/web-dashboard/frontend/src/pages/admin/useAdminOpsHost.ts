import { useQuery } from '@tanstack/react-query'
import type { AdminOpsHostReport } from '@radarchat-types/admin-ops-host'
import { api } from '../../lib/api'

export function useAdminOpsHost(enabled = true) {
  return useQuery({
    queryKey: ['admin-ops-host'],
    queryFn: () => api.get<AdminOpsHostReport>('/admin/ops/host'),
    refetchInterval: 60_000,
    enabled,
  })
}
