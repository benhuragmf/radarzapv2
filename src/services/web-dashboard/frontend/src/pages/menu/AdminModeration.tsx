import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { api } from '../../lib/api'
import { Shield, UserX, Ban } from 'lucide-react'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'
import { RadarPageShell, PageHeader, LoadingState, selectCls } from '@/design-system'

interface AdminOrg {
  _id: string
  name?: string
  plan?: string
  planExpiresAt?: string
  createdAt?: string
}

const PLANS = ['free', 'starter', 'pro', 'enterprise'] as const

export default function AdminModeration() {
  const qc = useQueryClient()

  const { data: orgs = [], isLoading } = useQuery<AdminOrg[]>({
    queryKey: ['admin-organizations'],
    queryFn: () => api.get('/admin/organizations'),
  })

  const setPlan = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) =>
      api.patch(`/admin/organizations/${id}/plan`, { plan }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-organizations'] }),
    onError: mutationError,
  })

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Moderação"
        subtitle="Empresas cadastradas, planos e atalhos para consentimento."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex gap-3">
          <UserX size={20} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-200">Bloqueio manual</p>
            <p className="text-xs text-gray-500 mt-1">
              <Link to="/contact?consent=blocked" className="text-brand-400 hover:underline">
                Contatos → Bloqueados
              </Link>
            </p>
          </div>
        </Card>
        <Card className="flex gap-3">
          <Ban size={20} className="text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-200">Consentimento recusado</p>
            <p className="text-xs text-gray-500 mt-1">
              <Link to="/contact?consent=refused" className="text-brand-400 hover:underline">
                Contatos → Recusados
              </Link>
            </p>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <LoadingState rows={5} className="pt-4" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-900/80 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Plano</th>
                <th className="px-3 py-2">Expira</th>
                <th className="px-3 py-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(o => (
                <tr key={o._id} className="border-t border-gray-800/80">
                  <td className="px-3 py-2 text-gray-200">{o.name ?? o._id}</td>
                  <td className="px-3 py-2 capitalize">{o.plan ?? 'free'}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {o.planExpiresAt
                      ? new Date(o.planExpiresAt).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className={`${selectCls} text-xs py-1`}
                      value={o.plan ?? 'free'}
                      disabled={setPlan.isPending}
                      onChange={e => setPlan.mutate({ id: o._id, plan: e.target.value })}
                    >
                      {PLANS.map(p => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-600">
        <Link to="/admin/payments" className="text-brand-400 hover:underline">
          Pagamentos Stripe
        </Link>
        {' · '}
        <Link to="/admin/monitoring" className="text-brand-400 hover:underline">
          Monitoramento
        </Link>
      </p>
    </RadarPageShell>
  )
}
