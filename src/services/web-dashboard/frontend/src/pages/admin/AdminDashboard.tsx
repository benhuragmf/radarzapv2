import { useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import AdminOpsDashboardView from './AdminOpsDashboardView'
import { parseAdminOpsTab } from './adminOpsTabs'
import { useAdminOpsHost } from './useAdminOpsHost'
import { refreshAdminOpsSummary, useAdminOpsSummary } from './useAdminOpsSummary'
import { useQueryClient } from '@tanstack/react-query'

export default function AdminDashboard() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const legacyTab = parseAdminOpsTab(searchParams.get('tab'))

  useEffect(() => {
    if (!legacyTab || location.hash) return
    const params = new URLSearchParams(location.search)
    params.delete('tab')
    const nextSearch = params.toString()
    navigate(
      {
        pathname: location.pathname,
        hash: legacyTab === 'overview' ? undefined : `#${legacyTab}`,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    )
  }, [legacyTab, location.hash, location.pathname, location.search, navigate])

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
      initialTab={legacyTab}
      hostData={hostQuery.data}
      hostLoading={hostQuery.isLoading}
      hostError={hostQuery.isError}
    />
  )
}
