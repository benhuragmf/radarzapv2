import { useEffect, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Users, RefreshCw, Crown, CreditCard } from 'lucide-react'
import type { AuthUser } from '../lib/auth'
import { can } from '../lib/auth'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../lib/notify'
import { RadarPageShell, PageHeader, LoadingState } from '@/design-system'

interface UserData {
  _id: string
  discordUserId: string | null
  email?: string | null
  displayName: string
  organizationId?: string | null
  organizationName?: string | null
  plan: 'free' | 'starter' | 'pro' | 'enterprise'
  limits: { messagesPerDay: number; groupsMax: number; templatesMax: number }
  usage: { messagesUsed: number; lastReset: string }
  createdAt?: string
}

interface PlanCatalogEntry {
  id: string
  name: string
  description: string
  purchasable?: boolean
  comingSoon?: boolean
  priceMonthlyCents?: number
  currency?: string
  features?: string[]
}

interface BillingPricing {
  plans: PlanCatalogEntry[]
  stripeEnabled: boolean
  stripeConfigured: boolean
  stripeTestMode: boolean
  devBillingEnabled: boolean
  setup: { ready: boolean; hasSecretKey: boolean }
}

interface BillingSubscription {
  plan: string
  planId: string
  status: 'free' | 'active' | 'expiring_soon' | 'expired'
  isActive: boolean
  expiresAtLabel?: string | null
  timeRemaining?: string
  limits: UserData['limits']
  usage: UserData['usage']
  orders?: { id: string; status: string; planName: string; amountCents: number; createdAt: string }[]
}

const planVariant: Record<string, 'gray' | 'blue' | 'yellow' | 'green'> = {
  free: 'gray',
  starter: 'blue',
  pro: 'yellow',
  enterprise: 'green',
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function usageBar(used: number, limit: number) {
  if (limit === -1) return null
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-brand-500'
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-[var(--rz-text-muted)] mb-1">
        <span>{used} / {limit} mensagens hoje</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-[var(--rz-surface-muted)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function planRank(id: string) {
  if (id === 'enterprise') return 3
  if (id === 'pro') return 2
  if (id === 'starter') return 1
  return 0
}

interface Props {
  user: AuthUser
  admin?: boolean
}

export default function Plans({ user, admin }: Props) {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null)
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null)
  const [planModal, setPlanModal] = useState<{
    orgId: string
    plan: string
    userName: string
    previousPlan: string
  } | null>(null)
  const [planReason, setPlanReason] = useState('')
  const isAdmin = admin && can(user, 'system:plans:manage')

  const { data: pricing } = useQuery<BillingPricing>({
    queryKey: ['billing-pricing'],
    queryFn: () => api.get('/billing/pricing'),
    enabled: !isAdmin,
  })

  const { data: subscription, isLoading: subLoading } = useQuery<BillingSubscription>({
    queryKey: ['billing-subscription'],
    queryFn: () => api.get('/billing/subscription'),
    enabled: !isAdmin,
    refetchInterval: 30_000,
  })

  const { data: users = [], isLoading } = useQuery<UserData[]>({
    queryKey: isAdmin ? ['users'] : ['billing-me'],
    queryFn: () =>
      isAdmin
        ? api.get('/users')
        : api.get('/billing/me').then(me => [me as UserData]),
    enabled: isAdmin,
    refetchInterval: 30_000,
  })

  const confirmCheckout = useCallback(async () => {
    const sessionId = searchParams.get('session_id')
    const checkout = searchParams.get('checkout')
    if (checkout !== 'success' || !sessionId) return

    setCheckoutMsg('Confirmando pagamento…')
    try {
      await api.post('/billing/confirm', { sessionId })
      setCheckoutMsg('Plano ativado com sucesso!')
      qc.invalidateQueries({ queryKey: ['billing-subscription'] })
      qc.invalidateQueries({ queryKey: ['billing-me'] })
    } catch (e) {
      const err = e as Error
      try {
        await qc.fetchQuery({
          queryKey: ['billing-subscription'],
          queryFn: () => api.get('/billing/subscription'),
        })
        setCheckoutMsg('Plano já estava ativo (webhook processou antes).')
      } catch {
        setCheckoutMsg(err.message || 'Falha ao confirmar pagamento')
      }
    } finally {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, qc])

  useEffect(() => {
    void confirmCheckout()
  }, [confirmCheckout])

  const startCheckout = async (planId: string) => {
    setCheckoutBusy(planId)
    setCheckoutMsg(null)
    try {
      const res = await api.post<{ mode: string; url?: string; message?: string; alreadySubscribed?: boolean }>(
        '/billing/checkout',
        { planId },
      )
      if (res.alreadySubscribed) {
        setCheckoutMsg(res.message ?? 'Plano já ativo')
        return
      }
      if (res.mode === 'stripe' && res.url) {
        window.location.href = res.url
        return
      }
      setCheckoutMsg(res.message ?? 'Stripe não configurado — use modo dev ou configure .env')
    } catch (e) {
      setCheckoutMsg((e as Error).message)
    } finally {
      setCheckoutBusy(null)
    }
  }

  const devActivate = useMutation({
    mutationFn: (planId: string) => api.post('/billing/dev/activate', { planId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-subscription'] })
      setCheckoutMsg('Plano ativado (modo dev)')
    },
    onError: (e: Error) => setCheckoutMsg(e.message),
  })

  const changeOrgPlan = useMutation({
    mutationFn: (payload: { orgId: string; plan: string; reason: string }) =>
      api.patch(`/admin/ops/organizations/${payload.orgId}/plan`, {
        plan: payload.plan,
        reason: payload.reason,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      notifySuccess('Plano da empresa atualizado')
      setPlanModal(null)
      setPlanReason('')
    },
    onError: (e: Error) => notifyError(e.message),
  })

  const resetUsage = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/reset-usage`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  if (isAdmin && isLoading) {
    return (
      <RadarPageShell>
        <LoadingState rows={4} className="pt-12" />
      </RadarPageShell>
    )
  }

  if (!isAdmin && subLoading) {
    return (
      <RadarPageShell>
        <LoadingState rows={4} className="pt-12" />
      </RadarPageShell>
    )
  }

  const currentPlanId = subscription?.planId ?? user.plan ?? 'free'
  const catalog = pricing?.plans ?? []

  return (
    <RadarPageShell>
      <PageHeader
        title={isAdmin ? 'Planos e assinaturas' : 'Planos'}
        subtitle={
          isAdmin
            ? 'Gerencie planos, preços e assinaturas dos clientes.'
            : 'Escolha ou altere o plano da sua empresa.'
        }
      />
      <div className="space-y-6">
      {checkoutMsg && (
        <div className="text-sm px-4 py-3 rounded-lg bg-brand-500/10 border border-brand-500/30 text-brand-300">
          {checkoutMsg}
        </div>
      )}

      {!isAdmin && subscription && (
        <Card className="p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium text-white">Assinatura da empresa</h2>
            <Badge
              label={subscription.status === 'free' ? 'Free' : subscription.status}
              variant={subscription.status === 'expired' ? 'red' : 'green'}
            />
            {pricing?.stripeTestMode && (
              <span className="text-[10px] text-amber-500 uppercase">Stripe teste</span>
            )}
          </div>
          <p className="text-sm text-[var(--rz-text-muted)]">
            Plano atual: <span className="text-white capitalize font-medium">{subscription.plan}</span>
            {subscription.timeRemaining && subscription.planId !== 'free' && (
              <span className="text-[var(--rz-text-muted)]"> · {subscription.timeRemaining}</span>
            )}
          </p>
          {usageBar(subscription.usage.messagesUsed, subscription.limits.messagesPerDay)}
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {catalog.map(p => {
          const isCurrent = currentPlanId === p.id
          const canBuy =
            p.purchasable &&
            !p.comingSoon &&
            planRank(p.id) > planRank(currentPlanId)
          const showDev =
            !isAdmin &&
            pricing?.devBillingEnabled &&
            p.purchasable &&
            planRank(p.id) > planRank(currentPlanId)

          return (
            <Card key={p.id} className={isCurrent ? 'ring-1 ring-brand-500/40' : ''}>
              <div className="flex items-center gap-2 mb-2">
                {p.id === 'enterprise' && <Crown size={14} className="text-brand-400" />}
                <span className="font-semibold text-sm">{p.name}</span>
                {isCurrent && !isAdmin && <Badge label="Atual" variant="green" />}
              </div>
              <p className="text-xs text-[var(--rz-text-muted)] mb-2">{p.description}</p>
              {p.priceMonthlyCents != null && p.priceMonthlyCents > 0 && (
                <p className="text-lg font-semibold text-[var(--rz-text-primary)] mb-2">
                  {formatBrl(p.priceMonthlyCents)}
                  <span className="text-xs text-[var(--rz-text-muted)] font-normal">/mês</span>
                </p>
              )}
              <ul className="text-xs text-[var(--rz-text-muted)] space-y-0.5 mb-3">
                {(p.features ?? []).slice(0, 4).map(f => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
              {!isAdmin && canBuy && (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={checkoutBusy === p.id}
                  onClick={() => startCheckout(p.id)}
                >
                  {checkoutBusy === p.id ? (
                    <Spinner size={12} />
                  ) : (
                    <CreditCard size={12} />
                  )}{' '}
                  Assinar
                </Button>
              )}
              {!isAdmin && showDev && !pricing?.stripeEnabled && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full mt-2"
                  disabled={devActivate.isPending}
                  onClick={() => devActivate.mutate(p.id)}
                >
                  Ativar (dev)
                </Button>
              )}
              {p.comingSoon && (
                <p className="text-xs text-[var(--rz-text-muted)] mt-2">Em breve — contate suporte</p>
              )}
            </Card>
          )
        })}
      </div>

      {isAdmin ? (
        <div>
          <Card className="border-brand-800/30 bg-brand-950/10 text-xs text-[var(--rz-text-muted)] mb-4">
            <p>
              Plano da <strong className="text-[var(--rz-text-secondary)]">empresa</strong> (não do usuário).
              Preferência: aba{' '}
              <Link to="/admin/dashboard#tenants" className="text-brand-400 hover:underline">
                Empresas
              </Link>{' '}
              no Dashboard global (trial + audit completo).
            </p>
          </Card>
          <h2 className="text-sm font-medium text-[var(--rz-text-muted)] mb-3 flex items-center gap-2">
            <Users size={14} /> Usuários ({users.length})
          </h2>
          <div className="space-y-3">
            {users.map(u => (
              <Card key={u._id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{u.displayName}</span>
                      <Badge label={u.plan} variant={planVariant[u.plan] ?? 'gray'} />
                    </div>
                    {(u.organizationName || u.discordUserId || u.email) && (
                      <p className="text-xs text-[var(--rz-text-muted)] truncate mb-1">
                        {[u.organizationName, u.discordUserId, u.email].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {usageBar(u.usage.messagesUsed, u.limits.messagesPerDay)}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <select
                      value={u.plan}
                      onChange={e => {
                        const next = e.currentTarget.value
                        if (next === u.plan) return
                        if (!u.organizationId) {
                          notifyError('Usuário sem empresa vinculada')
                          return
                        }
                        setPlanModal({
                          orgId: u.organizationId,
                          plan: next,
                          userName: u.displayName,
                          previousPlan: u.plan,
                        })
                        setPlanReason('')
                      }}
                      disabled={changeOrgPlan.isPending || !u.organizationId}
                      className="bg-[var(--rz-surface-muted)] border border-[var(--rz-border)] rounded-lg px-2 py-1 text-xs text-[var(--rz-text-secondary)]"
                      aria-label={`Plano da empresa de ${u.displayName}`}
                    >
                      {['free', 'starter', 'pro', 'enterprise'].map(id => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => resetUsage.mutate(u._id)}
                      disabled={resetUsage.isPending}
                    >
                      <RefreshCw size={11} /> Resetar uso
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {planModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-4 space-y-3">
            <h3 className="text-sm font-medium text-[var(--rz-text-primary)]">Alterar plano da empresa</h3>
            <p className="text-xs text-[var(--rz-text-muted)]">
              {planModal.userName}: {planModal.previousPlan} → <strong>{planModal.plan}</strong>
            </p>
            <label className="block text-xs text-[var(--rz-text-muted)]">
              Motivo (obrigatório, mín. 5 caracteres)
              <textarea
                value={planReason}
                onChange={e => setPlanReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)] px-3 py-2 text-sm text-[var(--rz-text-secondary)]"
                data-testid="admin-plans-plan-reason"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPlanModal(null)
                  setPlanReason('')
                }}
                disabled={changeOrgPlan.isPending}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={changeOrgPlan.isPending || planReason.trim().length < 5}
                onClick={() =>
                  changeOrgPlan.mutate({
                    orgId: planModal.orgId,
                    plan: planModal.plan,
                    reason: planReason.trim(),
                  })
                }
                data-testid="admin-plans-plan-confirm"
              >
                Confirmar
              </Button>
            </div>
          </Card>
        </div>
      )}
      </div>
    </RadarPageShell>
  )
}
