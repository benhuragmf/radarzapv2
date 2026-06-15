import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { CreditCard, RefreshCw } from 'lucide-react'
import { mutationError, notifySuccess } from '../../lib/notify'
import { RadarPageShell, PageHeader, LoadingState, EmptyState } from '@/design-system'

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
      notifySuccess(`Sweep: ${res.organizationsExpired ?? 0} organização(ões) expirada(s)`)
      qc.invalidateQueries({ queryKey: ['billing-admin-orders'] })
    },
    onError: mutationError,
  })

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Pagamentos"
        subtitle="Pedidos Stripe e assinaturas das organizações RadarZap."
        actions={
          <Button
            size="sm"
            variant="secondary"
            disabled={sweep.isPending}
            onClick={() => sweep.mutate()}
          >
            {sweep.isPending ? <Spinner size={12} /> : <RefreshCw size={12} />}
            Varrer expirados
          </Button>
        }
      />

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
        <LoadingState rows={5} className="pt-4" />
      ) : orders.length === 0 ? (
        <EmptyState title="Nenhum pedido" description="Nenhum pedido registrado ainda." />
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
    </RadarPageShell>
  )
}
