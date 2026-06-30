import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { Button } from '../ui/Button'
import { mutationError, notifyInfo } from '../../lib/notify'

interface CatalogSalesOrder {
  id: string
  productName: string
  amount?: string
  deliveryFee?: string
  deliveryAddress?: string
  deliveryDistanceKm?: number
  deliveryTierKm?: number
  status: string
  lastNotificationStatus?: string
  lastNotificationError?: string
  proofs: Array<{ mediaUrl: string; receivedAt: string }>
}

interface Props {
  conversationId: string
}

export function CatalogSalesOrderPanel({ conversationId }: Props) {
  const qc = useQueryClient()
  const { data: me } = useQuery<AuthUser | null>({ queryKey: ['auth-me'], queryFn: getMe })

  const { data, isLoading } = useQuery({
    queryKey: ['catalog-sales-orders', conversationId],
    queryFn: () =>
      api.get<{ orders: CatalogSalesOrder[] }>(
        `/platform/catalog-sales/orders?conversationId=${encodeURIComponent(conversationId)}`,
      ),
    enabled: Boolean(conversationId),
  })

  const orders = data?.orders ?? []
  const active = orders.find(o =>
    ['aguardando_endereco', 'aguardando_pagamento', 'comprovante_recebido', 'em_conferencia', 'falha_notificacao_whatsapp', 'pendente_configuracao_whatsapp', 'comprovante_sem_pedido'].includes(o.status),
  )

  const action = useMutation({
    mutationFn: (path: string) => api.post<CatalogSalesOrder>(path, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-sales-orders', conversationId] })
      notifyInfo('Pedido atualizado.')
    },
    onError: mutationError,
  })

  if (isLoading || !active) return null

  const proofUrl = active.proofs.length
    ? `/api/platform/catalog-sales/orders/${active.id}/proof`
    : null

  return (
    <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 space-y-2 text-sm">
      <p className="font-medium text-amber-100">🧾 Comprovante PIX recebido</p>
      <p className="text-xs text-[var(--rz-text-muted)]">
        Produto: {active.productName} · Valor: {active.amount || 'não informado'}
        {active.deliveryFee ? ` · Entrega: ${active.deliveryFee}` : ''}
      </p>
      {active.deliveryAddress && (
        <p className="text-xs text-[var(--rz-text-muted)]">Endereço: {active.deliveryAddress}</p>
      )}
      {active.deliveryDistanceKm != null && (
        <p className="text-xs text-[var(--rz-text-muted)]">
          Distância: ~{active.deliveryDistanceKm} km
          {active.deliveryTierKm != null ? ` (faixa ${active.deliveryTierKm} km)` : ''}
        </p>
      )}
      {active.status === 'aguardando_endereco' && (
        <p className="text-xs text-amber-300/90">Aguardando endereço de entrega do cliente.</p>
      )}
      <p className="text-xs">Status: Aguardando conferência ({active.status})</p>
      {active.lastNotificationStatus === 'failed' && (
        <p className="text-xs text-red-400">Falha WhatsApp interno: {active.lastNotificationError}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {proofUrl && me && can(me, 'orders:view-payment-proof') && (
          <a
            href={proofUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-[var(--rz-border)] px-2.5 py-1 text-xs hover:bg-[var(--rz-surface-muted)]"
          >
            Ver comprovante
          </a>
        )}
        {me && can(me, 'orders:approve-payment') && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={action.isPending}
            onClick={() => action.mutate(`/platform/catalog-sales/orders/${active.id}/approve`)}
          >
            Aprovar pagamento
          </Button>
        )}
        {me && can(me, 'orders:reject-payment') && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={action.isPending}
            onClick={() => {
              const reason = window.prompt('Motivo da recusa (opcional):') ?? undefined
              void api
                .post(`/platform/catalog-sales/orders/${active.id}/reject`, { reason })
                .then(() => {
                  qc.invalidateQueries({ queryKey: ['catalog-sales-orders', conversationId] })
                  notifyInfo('Pagamento recusado.')
                })
                .catch(mutationError)
            }}
          >
            Recusar
          </Button>
        )}
        {me && can(me, 'orders:update-status') && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={action.isPending}
            onClick={() =>
              action.mutate(`/platform/catalog-sales/orders/${active.id}/request-new-proof`)
            }
          >
            Pedir novo comprovante
          </Button>
        )}
        {me && can(me, 'orders:resend-pix-notification') && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={action.isPending}
            onClick={() =>
              action.mutate(`/platform/catalog-sales/orders/${active.id}/resend-notification`)
            }
          >
            Reenviar WhatsApp
          </Button>
        )}
      </div>
    </div>
  )
}
