import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { api } from '../../lib/api'
import { RadarPageShell, PageHeader, LoadingState } from '@/design-system'

export default function AdminSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['services-health'],
    queryFn: () => api.get<Record<string, unknown>>('/services/health'),
  })

  return (
    <RadarPageShell>
      <PageHeader title="Configurações gerais" subtitle="Parâmetros globais e saúde dos serviços." />

      {isLoading ? (
        <LoadingState rows={4} className="pt-4" />
      ) : (
        <Card className="text-xs font-mono text-[var(--rz-text-secondary)] overflow-x-auto">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </Card>
      )}
    </RadarPageShell>
  )
}
