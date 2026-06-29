import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import AdminOpsHubLink from '../admin/AdminOpsHubLink'
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
    mutationFn: () =>
      api.post<{ organizationsExpired?: number }>('/billing/subscriptions/sweep', {}),
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
        subtitle="Pedidos Stripe e assinaturas das organizações Radar Chat."
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

      <AdminOpsHubLink tab="billing" label="KPIs de billing e Stripe no dashboard:" />

      <Card className="text-xs text-[var(--rz-text-muted)] space-y-1">
        <p>
          Configure <code className="text-[var(--rz-text-secondary)]">STRIPE_SECRET_KEY</code>, price IDs e webhook em{' '}
          <code className="text-[var(--rz-text-secondary)]">.env</code>. Ver{' '}
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
        <div className="overflow-x-auto rounded-xl border border-[var(--rz-border)]">
          <table className="w-full text-sm text-left">
            <thead className="bg-[var(--rz-surface-muted)]/80 text-[var(--rz-text-muted)] text-xs uppercase">
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
                <tr key={o._id} className="border-t border-[var(--rz-border)]/80 hover:bg-[var(--rz-surface-muted)]/40">
                  <td className="px-3 py-2 text-[var(--rz-text-muted)] whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-[var(--rz-text-primary)]">
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
                            : 'text-[var(--rz-text-muted)]'
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
