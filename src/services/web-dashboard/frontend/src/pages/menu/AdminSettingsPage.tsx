import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { api } from '../../lib/api'
import { Settings } from 'lucide-react'

export default function AdminSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['services-health'],
    queryFn: () => api.get<Record<string, unknown>>('/services/health'),
  })

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <Settings size={20} />
        Configurações do sistema
      </h1>
      <p className="text-sm text-gray-500">Parâmetros globais e saúde dos serviços.</p>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      ) : (
        <Card className="text-xs font-mono text-gray-400 overflow-x-auto">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </Card>
      )}
    </div>
  )
}
