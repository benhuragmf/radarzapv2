import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { AdminOpsSummary } from '@radarzap-types/admin-ops-summary'
import AdminOpsDashboardView from './AdminOpsDashboardView'

export default function AdminDashboard() {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['admin-ops-summary'],
    queryFn: () => api.get<AdminOpsSummary>('/admin/ops/summary'),
    refetchInterval: 30_000,
  })

  const handleRefresh = async () => {
    try {
      const fresh = await api.get<AdminOpsSummary>('/admin/ops/summary?refresh=1')
      queryClient.setQueryData(['admin-ops-summary'], fresh)
    } catch {
      await refetch()
    }
  }

  return (
    <AdminOpsDashboardView
      data={data}
      isLoading={isLoading}
      isError={isError}
      isFetching={isFetching}
      onRefresh={() => void handleRefresh()}
      onRetry={() => void refetch()}
    />
  )
}
