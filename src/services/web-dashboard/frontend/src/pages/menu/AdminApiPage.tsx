import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { api } from '../../lib/api'
import { Key } from 'lucide-react'

export default function AdminApiPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-integrations-overview'],
    queryFn: () =>
      api.get<{
        apiKeysActive: number
        webhooksActive: number
        organizations: number
        billingOrdersPaid: number
        stripeMode: string
      }>('/admin/integrations-overview'),
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <Key size={20} className="text-brand-400" />
        API global
      </h1>
      <p className="text-sm text-gray-500">
        Visão administrativa das integrações em todo o RadarZap.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size={28} />
        </div>
      ) : (
        <Card>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500 text-xs">Chaves API ativas</dt>
              <dd className="text-white font-mono">{data?.apiKeysActive ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs">Webhooks ativos</dt>
              <dd className="text-white font-mono">{data?.webhooksActive ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs">Organizações</dt>
              <dd className="text-white font-mono">{data?.organizations ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs">Pedidos pagos</dt>
              <dd className="text-white font-mono">{data?.billingOrdersPaid ?? 0}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-gray-500 text-xs">Stripe</dt>
              <dd className="text-white capitalize">{data?.stripeMode ?? '—'}</dd>
            </div>
          </dl>
        </Card>
      )}

      <Card className="text-sm text-gray-400 space-y-2">
        <p>Operações:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <Link to="/admin/errors" className="text-brand-400 hover:underline">
              Erros do sistema
            </Link>
          </li>
          <li>
            <Link to="/admin/queue" className="text-brand-400 hover:underline">
              Fila global
            </Link>
          </li>
          <li>
            <Link to="/admin/monitoring" className="text-brand-400 hover:underline">
              Monitoramento
            </Link>
          </li>
        </ul>
      </Card>
    </div>
  )
}
