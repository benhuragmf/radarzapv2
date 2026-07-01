import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { Button } from '../ui/Button'
import { mutationError, notifyInfo } from '../../lib/notify'

interface CatalogSalesOrder {
  id: string
  orderCode?: string | null
  productName: string
  amount?: string
  deliveryFee?: string
  deliveryAddress?: string
  deliveryDistanceKm?: number
  deliveryTierKm?: number
  deliveryLocationLat?: number
  deliveryLocationLng?: number
  deliveryLocationPendingConfirm?: boolean
  status: string
  lastNotificationStatus?: string
  lastNotificationError?: string
  proofs: Array<{ mediaUrl: string; receivedAt: string }>
}

const STATUS_TITLE: Record<string, string> = {
  aguardando_endereco: '📍 Pedido aguardando endereço',
  aguardando_pagamento: '💳 Pedido aguardando pagamento',
  comprovante_recebido: '🧾 Comprovante PIX recebido',
  em_conferencia: '🔍 Pagamento em conferência',
  pagamento_aprovado: '✅ Pagamento aprovado',
  pagamento_recusado: '❌ Pagamento recusado',
  pedido_confirmado: '✅ Pedido confirmado',
  cancelado: '🚫 Pedido cancelado',
  falha_notificacao_whatsapp: '⚠️ Falha notificação WhatsApp',
  pendente_configuracao_whatsapp: '⏳ Aguardando configuração WhatsApp',
  comprovante_sem_pedido: '🧾 Comprovante sem pedido vinculado',
}

function orderPanelTitle(status: string): string {
  return STATUS_TITLE[status] ?? '📦 Pedido de catálogo'
}

function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`
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
  const orderDeepLink = active.orderCode
    ? `/platform/produtos#pedidos?order=${encodeURIComponent(active.orderCode)}`
    : `/platform/produtos#pedidos`

  return (
    <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 space-y-2 text-sm">
      <p className="font-medium text-amber-100">{orderPanelTitle(active.status)}</p>
      {active.orderCode && (
        <p className="text-xs">
          Código:{' '}
          <Link to={orderDeepLink} className="text-brand-400 hover:underline font-mono">
            {active.orderCode}
          </Link>
        </p>
      )}
      <p className="text-xs text-[var(--rz-text-muted)]">
        Produto: {active.productName} · Valor: {active.amount || 'não informado'}
        {active.deliveryFee ? ` · Entrega: ${active.deliveryFee}` : ''}
      </p>
      {active.deliveryAddress && (
        <p className="text-xs text-[var(--rz-text-muted)]">Endereço: {active.deliveryAddress}</p>
      )}
      {active.deliveryLocationLat != null && active.deliveryLocationLng != null && (
        <div className="rounded-md border border-emerald-800/40 bg-emerald-950/30 p-2 space-y-1 text-xs">
          <p className="text-emerald-100 font-medium">📍 Localização recebida para cálculo de frete</p>
          <p className="font-mono text-[var(--rz-text-muted)]">
            {active.deliveryLocationLat.toFixed(6)}, {active.deliveryLocationLng.toFixed(6)}
          </p>
          {active.deliveryLocationPendingConfirm && (
            <p className="text-amber-300/90">Aguardando confirmação de rua e número.</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={googleMapsUrl(active.deliveryLocationLat, active.deliveryLocationLng)}
              target="_blank"
              rel="noreferrer"
              className="underline text-brand-400"
            >
              Google Maps
            </a>
            <button
              type="button"
              className="underline text-brand-400"
              onClick={() =>
                void navigator.clipboard?.writeText(
                  `${active.deliveryLocationLat}, ${active.deliveryLocationLng}`,
                )
              }
            >
              Copiar coordenadas
            </button>
          </div>
        </div>
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
      <p className="text-xs">Status: {active.status}</p>
      {active.lastNotificationStatus === 'failed' && (
        <p className="text-xs text-red-400">Falha WhatsApp interno: {active.lastNotificationError}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Link
          to={orderDeepLink}
          className="inline-flex items-center justify-center rounded-md border border-[var(--rz-border)] px-2.5 py-1 text-xs hover:bg-[var(--rz-surface-muted)]"
        >
          Abrir pedido
        </Link>
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
