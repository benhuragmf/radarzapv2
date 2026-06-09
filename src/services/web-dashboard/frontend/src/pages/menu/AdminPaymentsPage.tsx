import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { CreditCard, RefreshCw } from 'lucide-react'

interface AdminOrder {
  _id: string
  status: string
  planId: string
  amountCents: number
  currency: string
  stripeSessionId?: string
  paidAt?: string
  createdAt: string
  organizationId?: { _id: string; name?: string; plan?: string }
  userId?: { email?: string; displayName?: string }
}

function formatBrl(cents: number, currency = 'BRL') {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency })
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  cancelled: 'Cancelado',
}

export default function AdminPaymentsPage() {
  const qc = useQueryClient()

  const { data: orders = [], isLoading } = useQuery<AdminOrder[]>({
    queryKey: ['billing-admin-orders'],
    queryFn: () => api.get('/billing/admin/orders'),
  })

  const sweep = useMutation({
    mutationFn: () => api.post('/billing/subscriptions/sweep', {}),
    onSuccess: (res: { organizationsExpired?: number }) => {
      alert(`Sweep: ${res.organizationsExpired ?? 0} organização(ões) expirada(s)`)
      qc.invalidateQueries({ queryKey: ['billing-admin-orders'] })
    },
    onError: (e: Error) => alert(e.message),
  })

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <CreditCard size={20} className="text-brand-400" />
            Pagamentos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pedidos Stripe e assinaturas das organizações RadarZap.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={sweep.isPending}
          onClick={() => sweep.mutate()}
        >
          {sweep.isPending ? <Spinner size={12} /> : <RefreshCw size={12} />}
          Varrer expirados
        </Button>
      </div>

      <Card className="text-xs text-gray-500 space-y-1">
        <p>
          Configure <code className="text-gray-400">STRIPE_SECRET_KEY</code>, price IDs e webhook em{' '}
          <code className="text-gray-400">.env</code>. Ver{' '}
          <Link to="/admin/plans" className="text-brand-400 hover:underline">
            Planos
          </Link>{' '}
          para override manual.
        </p>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size={28} />
        </div>
      ) : orders.length === 0 ? (
        <Card className="text-sm text-gray-500">Nenhum pedido registrado ainda.</Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-900/80 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Plano</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o._id} className="border-t border-gray-800/80 hover:bg-gray-900/40">
                  <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-gray-200">
                    {typeof o.organizationId === 'object'
                      ? o.organizationId?.name ?? '—'
                      : '—'}
                  </td>
                  <td className="px-3 py-2 capitalize">{o.planId}</td>
                  <td className="px-3 py-2">{formatBrl(o.amountCents, o.currency)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        o.status === 'paid'
                          ? 'text-brand-400'
                          : o.status === 'pending'
                            ? 'text-amber-500'
                            : 'text-gray-500'
                      }
                    >
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
