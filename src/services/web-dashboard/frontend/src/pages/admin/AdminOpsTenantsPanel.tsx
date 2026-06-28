import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminOpsSummary } from '@radarzap-types/admin-ops-summary'
import type {
  AdminOpsOrganizationRow,
  AdminOpsOrganizationsPage,
} from '@radarzap-types/admin-ops-organizations'
import {
  formatOpsDate,
  formatOpsNumber,
  sanitizeOpsDisplayText,
} from '@radarzap-types/admin-ops-summary.util'
import { Building2 } from 'lucide-react'
import { api } from '../../lib/api'
import { AuthContext } from '../../lib/authContext'
import { can as hasPermission } from '../../lib/auth'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  SectionCard,
  StatusBadge,
} from '@/design-system'
import { toastError, toastSuccess } from '@/design-system/toast'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/shadcn/dialog'

type PlanFilter = '' | 'free' | 'starter' | 'pro' | 'enterprise'
type StatusFilter = '' | AdminOpsOrganizationRow['billingStatus']

const PLAN_OPTIONS: Array<{ value: PlanFilter; label: string }> = [
  { value: '', label: 'Todos os planos' },
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'pro', label: 'Pro' },
  { value: 'enterprise', label: 'Enterprise' },
]

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: 'Todos os status' },
  { value: 'free', label: 'Free' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Ativa' },
  { value: 'past_due', label: 'Past due' },
  { value: 'canceled', label: 'Cancelada' },
  { value: 'unpaid', label: 'Inadimplente' },
  { value: 'manual', label: 'Manual' },
]

function billingStatusVariant(
  status: AdminOpsOrganizationRow['billingStatus'],
): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  switch (status) {
    case 'active':
    case 'manual':
      return 'success'
    case 'trialing':
      return 'info'
    case 'past_due':
      return 'warning'
    case 'canceled':
    case 'unpaid':
    case 'incomplete':
      return 'danger'
    default:
      return 'neutral'
  }
}

function billingStatusLabel(status: AdminOpsOrganizationRow['billingStatus']): string {
  const map: Record<string, string> = {
    free: 'Free',
    trialing: 'Trialing',
    active: 'Ativa',
    past_due: 'Past due',
    canceled: 'Cancelada',
    unpaid: 'Inadimplente',
    paused: 'Pausada',
    incomplete: 'Incompleta',
    manual: 'Manual',
  }
  return map[status] ?? status
}

function sanitizeOrgDisplayText(value: string): string {
  return sanitizeOpsDisplayText(value)
}

function buildOrgsQuery(params: {
  page: number
  plan: PlanFilter
  status: StatusFilter
  search: string
}) {
  const qs = new URLSearchParams()
  qs.set('page', String(params.page))
  qs.set('limit', '25')
  if (params.plan) qs.set('plan', params.plan)
  if (params.status) qs.set('status', params.status)
  if (params.search.trim()) qs.set('search', params.search.trim())
  return `/admin/ops/organizations?${qs.toString()}`
}

type ModalKind = 'extend' | 'plan' | 'cancel' | null

interface Props {
  tenants: AdminOpsSummary['tenants']
}

export default function AdminOpsTenantsPanel({ tenants }: Props) {
  const queryClient = useQueryClient()
  const canManagePlans = hasPermission(AuthContext.user, 'system:plans:manage')

  const [page, setPage] = useState(1)
  const [planFilter, setPlanFilter] = useState<PlanFilter>('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')

  const [modal, setModal] = useState<ModalKind>(null)
  const [activeRow, setActiveRow] = useState<AdminOpsOrganizationRow | null>(null)
  const [reason, setReason] = useState('')
  const [extendDays, setExtendDays] = useState('7')
  const [extendPlan, setExtendPlan] = useState<'starter' | 'pro' | 'enterprise'>('starter')
  const [changePlan, setChangePlan] = useState<AdminOpsOrganizationRow['plan']>('starter')
  const [changeExpiresAt, setChangeExpiresAt] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearchDebounced(searchInput)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const queryKey = useMemo(
    () => ['admin-ops-organizations', page, planFilter, statusFilter, searchDebounced] as const,
    [page, planFilter, statusFilter, searchDebounced],
  )

  const orgsQuery = useQuery({
    queryKey,
    queryFn: () =>
      api.get<AdminOpsOrganizationsPage>(
        buildOrgsQuery({ page, plan: planFilter, status: statusFilter, search: searchDebounced }),
      ),
  })

  const invalidateAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-ops-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-ops-organizations'] }),
    ])
  }, [queryClient])

  const extendMutation = useMutation({
    mutationFn: (payload: { id: string; days: number; reason: string; plan?: string }) =>
      api.post<{ ok: true }>(`/admin/ops/organizations/${payload.id}/trial/extend`, {
        days: payload.days,
        reason: payload.reason,
        plan: payload.plan,
      }),
    onSuccess: async () => {
      toastSuccess('Trial estendido com sucesso')
      setModal(null)
      setReason('')
      await invalidateAll()
    },
    onError: (e: Error) => toastError(e.message),
  })

  const planMutation = useMutation({
    mutationFn: (payload: {
      id: string
      plan: string
      reason: string
      expiresAt?: string
    }) =>
      api.patch<{ ok: true }>(`/admin/ops/organizations/${payload.id}/plan`, {
        plan: payload.plan,
        reason: payload.reason,
        expiresAt: payload.expiresAt || undefined,
      }),
    onSuccess: async () => {
      toastSuccess('Plano atualizado')
      setModal(null)
      setReason('')
      await invalidateAll()
    },
    onError: (e: Error) => toastError(e.message),
  })

  const cancelMutation = useMutation({
    mutationFn: (payload: { id: string; reason: string }) =>
      api.post<{ ok: true }>(`/admin/ops/organizations/${payload.id}/trial/cancel`, {
        reason: payload.reason,
      }),
    onSuccess: async () => {
      toastSuccess('Trial cancelado — empresa em Free')
      setModal(null)
      setReason('')
      await invalidateAll()
    },
    onError: (e: Error) => toastError(e.message),
  })

  const openModal = (kind: ModalKind, row: AdminOpsOrganizationRow) => {
    setActiveRow(row)
    setReason('')
    setExtendDays('7')
    setExtendPlan(row.plan === 'free' ? 'starter' : row.plan)
    setChangePlan(row.plan)
    setChangeExpiresAt(row.planExpiresAt ? row.planExpiresAt.slice(0, 10) : '')
    setModal(kind)
  }

  const submitExtend = () => {
    if (!activeRow) return
    const days = Number(extendDays)
    extendMutation.mutate({
      id: activeRow.id,
      days,
      reason,
      plan: activeRow.plan === 'free' || extendPlan !== activeRow.plan ? extendPlan : undefined,
    })
  }

  const submitPlan = () => {
    if (!activeRow) return
    planMutation.mutate({
      id: activeRow.id,
      plan: changePlan,
      reason,
      expiresAt: changeExpiresAt ? new Date(changeExpiresAt).toISOString() : undefined,
    })
  }

  const submitCancel = () => {
    if (!activeRow) return
    cancelMutation.mutate({ id: activeRow.id, reason })
  }

  const isSubmitting =
    extendMutation.isPending || planMutation.isPending || cancelMutation.isPending

  return (
    <div data-testid="admin-ops-tenants" className="mt-4 space-y-4">
      <SectionCard title="Empresas por plano e status">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <MetricCard title="Total" value={formatOpsNumber(tenants.totalOrganizations)} icon={Building2} />
          <MetricCard title="Free" value={formatOpsNumber(tenants.freeOrganizations)} />
          <MetricCard title="Starter" value={formatOpsNumber(tenants.starterOrganizations)} />
          <MetricCard title="Pro" value={formatOpsNumber(tenants.proOrganizations)} />
          <MetricCard title="Enterprise" value={formatOpsNumber(tenants.enterpriseOrganizations)} />
          <MetricCard title="Pagas (ativas)" value={formatOpsNumber(tenants.paidOrganizations)} />
          <MetricCard title="Trialing" value={formatOpsNumber(tenants.trialingOrganizations)} />
          <MetricCard title="Expiradas/canceladas" value={formatOpsNumber(tenants.expiredOrganizations)} />
          <MetricCard
            title="Past due"
            value={formatOpsNumber(tenants.pastDueOrganizations)}
            status={
              tenants.pastDueOrganizations > 0
                ? { status: 'warning', text: 'Atenção' }
                : undefined
            }
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Listagem de empresas"
        description={
          canManagePlans
            ? 'Ações de trial e plano disponíveis para staff autorizado.'
            : 'Somente leitura — sem permissão system:plans:manage.'
        }
      >
        <div className="flex flex-wrap gap-2 mb-4" data-testid="admin-ops-orgs-filters">
          <input
            type="search"
            placeholder="Buscar por nome…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] px-3 py-1.5 text-sm min-w-[180px] flex-1"
            data-testid="admin-ops-orgs-search"
          />
          <select
            value={planFilter}
            onChange={e => {
              setPlanFilter(e.target.value as PlanFilter)
              setPage(1)
            }}
            className="rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] px-3 py-1.5 text-sm"
            data-testid="admin-ops-orgs-plan-filter"
          >
            {PLAN_OPTIONS.map(o => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value as StatusFilter)
              setPage(1)
            }}
            className="rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] px-3 py-1.5 text-sm"
            data-testid="admin-ops-orgs-status-filter"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value || 'all-status'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {orgsQuery.isLoading ? (
          <LoadingState rows={5} />
        ) : orgsQuery.isError ? (
          <ErrorState
            title="Não foi possível carregar empresas."
            message="Verifique permissões ou tente novamente."
            onRetry={() => void orgsQuery.refetch()}
          />
        ) : !orgsQuery.data?.items.length ? (
          <EmptyState
            title="Nenhuma empresa encontrada"
            description="Nenhuma empresa encontrada para os filtros."
          />
        ) : (
          <>
            <div className="overflow-x-auto" data-testid="admin-ops-orgs-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--rz-border)] text-left text-[var(--rz-text-muted)]">
                    <th className="py-2 pr-3 font-medium">Empresa</th>
                    <th className="py-2 pr-3 font-medium">Plano</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Expira em</th>
                    <th className="py-2 pr-3 font-medium">Criada em</th>
                    <th className="py-2 pr-3 font-medium">WhatsApp</th>
                    {canManagePlans ? <th className="py-2 font-medium">Ações</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {orgsQuery.data.items.map(row => (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--rz-border)]/60 last:border-0"
                      data-testid={`admin-ops-org-row-${row.id}`}
                    >
                      <td className="py-2 pr-3 font-medium text-[var(--rz-text-primary)]">
                        {sanitizeOrgDisplayText(row.name)}
                      </td>
                      <td className="py-2 pr-3 capitalize">{row.plan}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge
                          status={billingStatusVariant(row.billingStatus)}
                          text={billingStatusLabel(row.billingStatus)}
                        />
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {row.planExpiresAt ? formatOpsDate(row.planExpiresAt) : '—'}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{formatOpsDate(row.createdAt)}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge
                          status={row.waConnected ? 'success' : 'neutral'}
                          text={row.waConnected ? 'Conectado' : 'Sem sessão'}
                        />
                      </td>
                      {canManagePlans ? (
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className="rounded border border-[var(--rz-border)] px-2 py-0.5 text-xs hover:bg-[var(--rz-surface-muted)]"
                              onClick={() => openModal('extend', row)}
                              data-testid="admin-ops-action-extend"
                            >
                              Estender
                            </button>
                            <button
                              type="button"
                              className="rounded border border-[var(--rz-border)] px-2 py-0.5 text-xs hover:bg-[var(--rz-surface-muted)]"
                              onClick={() => openModal('plan', row)}
                              data-testid="admin-ops-action-plan"
                            >
                              Plano
                            </button>
                            <button
                              type="button"
                              className="rounded border border-[var(--rz-border)] px-2 py-0.5 text-xs text-[var(--rz-danger-text)] hover:bg-[var(--rz-surface-muted)]"
                              onClick={() => openModal('cancel', row)}
                              data-testid="admin-ops-action-cancel"
                            >
                              Cancelar trial
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 text-xs text-[var(--rz-text-muted)]">
              <span>
                Página {orgsQuery.data.page} de {orgsQuery.data.totalPages} ·{' '}
                {formatOpsNumber(orgsQuery.data.total)} empresas
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="rounded border border-[var(--rz-border)] px-2 py-1 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= orgsQuery.data.totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="rounded border border-[var(--rz-border)] px-2 py-1 disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      <Dialog open={modal === 'extend'} onOpenChange={open => !open && setModal(null)}>
        <DialogContent data-testid="admin-ops-modal-extend">
          <DialogHeader>
            <DialogTitle>Estender trial — {sanitizeOrgDisplayText(activeRow?.name ?? '')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  type="button"
                  className="rounded border border-[var(--rz-border)] px-2 py-1 text-xs"
                  onClick={() => setExtendDays(String(d))}
                >
                  +{d} dias
                </button>
              ))}
            </div>
            <label className="block">
              <span className="text-[var(--rz-text-muted)]">Dias</span>
              <input
                type="number"
                min={1}
                max={90}
                value={extendDays}
                onChange={e => setExtendDays(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--rz-border)] px-3 py-1.5"
              />
            </label>
            {activeRow?.plan === 'free' ? (
              <label className="block">
                <span className="text-[var(--rz-text-muted)]">Plano do trial</span>
                <select
                  value={extendPlan}
                  onChange={e =>
                    setExtendPlan(e.target.value as 'starter' | 'pro' | 'enterprise')
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--rz-border)] px-3 py-1.5"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
            ) : null}
            <label className="block">
              <span className="text-[var(--rz-text-muted)]">Motivo *</span>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-[var(--rz-border)] px-3 py-1.5"
                data-testid="admin-ops-reason-input"
              />
            </label>
          </div>
          <DialogFooter>
            <button
              type="button"
              disabled={isSubmitting || reason.trim().length < 5}
              onClick={submitExtend}
              className="rounded-lg bg-[var(--rz-primary)] px-4 py-2 text-sm text-white disabled:opacity-50"
              data-testid="admin-ops-modal-submit"
            >
              Confirmar extensão
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'plan'} onOpenChange={open => !open && setModal(null)}>
        <DialogContent data-testid="admin-ops-modal-plan">
          <DialogHeader>
            <DialogTitle>Alterar plano — {sanitizeOrgDisplayText(activeRow?.name ?? '')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="text-[var(--rz-text-muted)]">Plano</span>
              <select
                value={changePlan}
                onChange={e => setChangePlan(e.target.value as AdminOpsOrganizationRow['plan'])}
                className="mt-1 w-full rounded-lg border border-[var(--rz-border)] px-3 py-1.5"
              >
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
            {changePlan !== 'free' ? (
              <label className="block">
                <span className="text-[var(--rz-text-muted)]">Expira em (opcional)</span>
                <input
                  type="date"
                  value={changeExpiresAt}
                  onChange={e => setChangeExpiresAt(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--rz-border)] px-3 py-1.5"
                />
              </label>
            ) : null}
            <label className="block">
              <span className="text-[var(--rz-text-muted)]">Motivo *</span>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                data-testid="admin-ops-plan-reason"
                className="mt-1 w-full rounded-lg border border-[var(--rz-border)] px-3 py-1.5"
              />
            </label>
          </div>
          <DialogFooter>
            <button
              type="button"
              disabled={isSubmitting || reason.trim().length < 5}
              onClick={submitPlan}
              data-testid="admin-ops-plan-submit"
              className="rounded-lg bg-[var(--rz-primary)] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Salvar plano
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === 'cancel'} onOpenChange={open => !open && setModal(null)}>
        <DialogContent data-testid="admin-ops-modal-cancel">
          <DialogHeader>
            <DialogTitle>Cancelar trial e mover para Free?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--rz-text-secondary)]">
            A empresa <strong>{sanitizeOrgDisplayText(activeRow?.name ?? '')}</strong> será movida para o plano Free. Dados e
            histórico são preservados.
          </p>
          <label className="block text-sm">
            <span className="text-[var(--rz-text-muted)]">Motivo *</span>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-[var(--rz-border)] px-3 py-1.5"
            />
          </label>
          <DialogFooter>
            <button
              type="button"
              disabled={isSubmitting || reason.trim().length < 5}
              onClick={submitCancel}
              className="rounded-lg bg-[var(--rz-danger-text)] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Confirmar cancelamento
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
