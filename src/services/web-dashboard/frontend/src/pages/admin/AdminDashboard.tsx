import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { AdminOpsSummary } from '@radarzap-types/admin-ops-summary'
import AdminOpsDashboardView from './AdminOpsDashboardView'
import { parseAdminOpsTab } from './adminOpsTabs'
import { refreshAdminOpsSummary, useAdminOpsSummary } from './useAdminOpsSummary'
import { useAdminOpsHost } from './useAdminOpsHost'

export default function AdminDashboard() {
  const [searchParams] = useSearchParams()
  const initialTab = parseAdminOpsTab(searchParams.get('tab'))
  const queryClient = useQueryClient()

  const { data, isLoading, isError, isFetching, refetch } = useAdminOpsSummary()
  const hostQuery = useAdminOpsHost(!isLoading && !isError)

  const handleRefresh = async () => {
    await refreshAdminOpsSummary(
      fresh => queryClient.setQueryData(['admin-ops-summary'], fresh),
      refetch,
    )
  }

  return (
    <AdminOpsDashboardView
      data={data}
      isLoading={isLoading}
      isError={isError}
      isFetching={isFetching}
      onRefresh={() => void handleRefresh()}
      onRetry={() => void refetch()}
      initialTab={initialTab}
      hostData={hostQuery.data}
      hostLoading={hostQuery.isLoading}
      hostError={hostQuery.isError}
    />
  )
}
