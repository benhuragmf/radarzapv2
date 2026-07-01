import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { CreditCard, ExternalLink } from 'lucide-react'
import { api } from '../../lib/api'
import { can, getMe } from '../../lib/auth'
import { Button } from '../ui/Button'
import {
  LoadingState,
  inputCls,
  DataTable,
  EmptyState,
  FilterBar,
  StatusBadge,
  DetailsDrawer,
  SectionCard,
} from '@/design-system'
import { mutationError, notifyInfo } from '../../lib/notify'
import { CatalogDeliveryHumanPanel } from '../catalog/CatalogDeliveryHumanPanel'

export interface CatalogOrderListItem {
  id: string
  orderCode?: string | null
  productName: string
  amount?: string
  subtotalAmount?: string
  deliveryFee?: string
  totalAmount?: string
  status: string
  channel?: string
  contactName?: string
  contactIdentifier?: string
  conversationId?: string
  deliveryAddress?: string
  deliveryLocationLat?: number
  deliveryLocationLng?: number
  deliveryLocationPendingConfirm?: boolean
  deliveryDistanceKm?: number
  deliveryTierKm?: number
  deliveryAddressV1?: {
    status?: string
    source?: string
    formattedAddress?: string
    confidence?: string
    street?: string
    number?: string
    neighborhood?: string
    city?: string
    uf?: string
    zipCode?: string
    complement?: string
    reference?: string
    confirmedAt?: string
    confirmedBy?: string
    latitude?: number
    longitude?: number
    mapsUrl?: string
  } | null
  deliveryAddressSnapshot?: {
    formattedAddress: string
    deliveryFee?: string
    totalAmount?: string
    deliveryDistanceKm?: number
    deliveryTierKm?: number
  } | null
  createdAt?: string
  updatedAt?: string
  proofs?: Array<{ receivedAt: string }>
}

const STATUS_LABEL: Record<string, { text: string; variant: 'info' | 'warning' | 'success' | 'danger' | 'neutral' }> = {
  aguardando_endereco: { text: 'Aguardando endereço', variant: 'info' },
  pendente_humano_endereco: { text: 'Endereço — humano', variant: 'warning' },
  aguardando_pagamento: { text: 'Aguardando pagamento', variant: 'warning' },
  comprovante_recebido: { text: 'Comprovante recebido', variant: 'info' },
  em_conferencia: { text: 'Em conferência', variant: 'warning' },
  pagamento_aprovado: { text: 'Aprovado', variant: 'success' },
  pagamento_recusado: { text: 'Recusado', variant: 'danger' },
  pedido_confirmado: { text: 'Confirmado', variant: 'success' },
  cancelado: { text: 'Cancelado', variant: 'neutral' },
  comprovante_sem_pedido: { text: 'Sem pedido', variant: 'neutral' },
  falha_notificacao_whatsapp: { text: 'Falha WA interno', variant: 'danger' },
}

const PROOF_STATUSES = [
  'comprovante_recebido',
  'em_conferencia',
  'comprovante_sem_pedido',
  'falha_notificacao_whatsapp',
]

const PAYMENT_REVIEW_STATUSES = ['comprovante_recebido', 'em_conferencia']

function formatChannel(channel?: string) {
  if (channel === 'whatsapp') return 'WhatsApp'
  if (channel === 'webchat') return 'WebChat'
  return channel ?? '—'
}

function formatOrderDate(iso?: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

type OrdersFilterProps = {
  proofOnly?: boolean
}

export function ProductsOrdersTab({ proofOnly = false }: OrdersFilterProps) {
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [codeFilter, setCodeFilter] = useState('')
  const [selected, setSelected] = useState<CatalogOrderListItem | null>(null)
  const { data: me } = useQuery({ queryKey: ['auth-me'], queryFn: getMe })

  const deepLinkOrder = searchParams.get('order')?.trim() ?? ''

  const { data, isLoading } = useQuery({
    queryKey: ['catalog-sales-orders-list', statusFilter, proofOnly, codeFilter],
    queryFn: () => {
      const p = new URLSearchParams()
      if (statusFilter) p.set('status', statusFilter)
      if (codeFilter) p.set('orderCode', codeFilter)
      p.set('limit', '80')
      return api.get<{ orders: CatalogOrderListItem[] }>(
        `/platform/catalog-sales/orders?${p.toString()}`,
      )
    },
    enabled: Boolean(me && can(me, 'orders:view')),
  })

  const orders = useMemo(() => {
    let raw = data?.orders ?? []
    if (proofOnly) raw = raw.filter(o => PROOF_STATUSES.includes(o.status))
    if (channelFilter) raw = raw.filter(o => o.channel === channelFilter)
    return raw
  }, [data?.orders, proofOnly, channelFilter])

  useEffect(() => {
    if (!deepLinkOrder || orders.length === 0) return
    const match = orders.find(
      o =>
        o.orderCode?.toUpperCase() === deepLinkOrder.toUpperCase() ||
        o.id === deepLinkOrder,
    )
    if (match) setSelected(match)
  }, [deepLinkOrder, orders])

  const action = useMutation({
    mutationFn: (path: string) => api.post(path, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-sales-orders-list'] })
      qc.invalidateQueries({ queryKey: ['catalog-sales-orders-overview'] })
      notifyInfo('Pedido atualizado.')
      setSelected(null)
    },
    onError: mutationError,
  })

  const columns = useMemo<ColumnDef<CatalogOrderListItem>[]>(
    () => [
      {
        id: 'code',
        header: 'Código',
        cell: ({ row }) =>
          row.original.orderCode ? (
            <button
              type="button"
              className="font-mono text-xs text-brand-400 hover:underline"
              onClick={() => setSelected(row.original)}
            >
              {row.original.orderCode}
            </button>
          ) : (
            '—'
          ),
      },
      {
        id: 'product',
        header: 'Produto',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.productName}</p>
            <p className="text-xs text-[var(--rz-text-muted)]">
              {row.original.contactName ?? row.original.contactIdentifier ?? '—'}
            </p>
          </div>
        ),
      },
      {
        id: 'channel',
        header: 'Canal',
        cell: ({ row }) => (
          <span className="text-xs">{formatChannel(row.original.channel)}</span>
        ),
      },
      {
        id: 'when',
        header: 'Quando',
        cell: ({ row }) => (
          <span className="text-xs text-[var(--rz-text-muted)]">
            {formatOrderDate(row.original.createdAt ?? row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: 'amount',
        header: 'Total',
        cell: ({ row }) => row.original.totalAmount ?? row.original.amount ?? '—',
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const meta = STATUS_LABEL[row.original.status] ?? {
            text: row.original.status,
            variant: 'neutral' as const,
          }
          return <StatusBadge status={meta.variant} text={meta.text} size="sm" />
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(row.original)}>
            Detalhes
          </Button>
        ),
      },
    ],
    [],
  )

  if (!me || !can(me, 'orders:view')) {
    return (
      <SectionCard title="Pedidos">
        <p className="text-sm text-[var(--rz-text-muted)]">Sem permissão para ver pedidos.</p>
      </SectionCard>
    )
  }

  if (isLoading) return <LoadingState label="Carregando pedidos…" />

  return (
    <div className="space-y-4 mt-4">
      {!proofOnly && (
        <FilterBar>
          <select
            className={inputCls}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v.text}
              </option>
            ))}
          </select>
          <select
            className={inputCls}
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value)}
          >
            <option value="">Todos os canais</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="webchat">WebChat</option>
          </select>
          <input
            className={inputCls}
            placeholder="Código DX-1234"
            value={codeFilter}
            onChange={e => setCodeFilter(e.target.value.toUpperCase())}
          />
        </FilterBar>
      )}

      {orders.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={
            proofOnly
              ? 'Nenhum comprovante aguardando conferência'
              : 'Nenhum pedido encontrado'
          }
          description={
            proofOnly
              ? 'Quando um cliente enviar comprovante pelo WhatsApp ou WebChat, ele aparecerá aqui para análise.'
              : 'Pedidos criados pela IA ou operação aparecerão nesta lista.'
          }
        />
      ) : (
        <DataTable columns={columns} data={orders} ariaLabel="Lista de pedidos" />
      )}

      <DetailsDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.orderCode ? `${selected.orderCode} · ${selected.productName}` : selected?.productName ?? 'Pedido'}
        description={selected ? STATUS_LABEL[selected.status]?.text ?? selected.status : undefined}
        footer={
          selected ? (
            <div className="flex flex-wrap gap-2">
              {selected.conversationId && (
                <Link
                  to={`/platform/inbox?conv=${selected.conversationId}`}
                  className="inline-flex items-center gap-1 text-sm text-brand-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir no Inbox
                </Link>
              )}
              {can(me, 'orders:view-payment-proof') && selected.proofs?.length ? (
                <a
                  href={`/api/platform/catalog-sales/orders/${selected.id}/proof`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm px-3 py-1.5 border rounded-md hover:bg-[var(--rz-surface-muted)]"
                >
                  Ver comprovante
                </a>
              ) : null}
              {can(me, 'orders:approve-payment') &&
                PAYMENT_REVIEW_STATUSES.includes(selected.status) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate(`/platform/catalog-sales/orders/${selected.id}/approve`)
                    }
                  >
                    Aprovar pagamento
                  </Button>
                )}
              {can(me, 'orders:reject-payment') &&
                PAYMENT_REVIEW_STATUSES.includes(selected.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={action.isPending}
                    onClick={() => {
                      const reason = window.prompt('Motivo (opcional):') ?? undefined
                      void api
                        .post(`/platform/catalog-sales/orders/${selected.id}/reject`, { reason })
                        .then(() => {
                          qc.invalidateQueries({ queryKey: ['catalog-sales-orders-list'] })
                          qc.invalidateQueries({ queryKey: ['catalog-sales-orders-overview'] })
                          notifyInfo('Recusado.')
                          setSelected(null)
                        })
                        .catch(mutationError)
                    }}
                  >
                    Recusar
                  </Button>
                )}
              {can(me, 'orders:update-status') &&
                [
                  'aguardando_pagamento',
                  'comprovante_recebido',
                  'em_conferencia',
                  'pagamento_recusado',
                ].includes(selected.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate(
                        `/platform/catalog-sales/orders/${selected.id}/request-new-proof`,
                      )
                    }
                  >
                    Pedir novo comprovante
                  </Button>
                )}
              {can(me, 'orders:resend-pix-notification') && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate(
                      `/platform/catalog-sales/orders/${selected.id}/resend-notification`,
                    )
                  }
                >
                  Reenviar notificação
                </Button>
              )}
            </div>
          ) : null
        }
      >
        {selected && (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[var(--rz-text-muted)]">Cliente</dt>
              <dd>{selected.contactName ?? selected.contactIdentifier ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--rz-text-muted)]">Canal</dt>
              <dd className="uppercase">{selected.channel ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--rz-text-muted)]">Produto</dt>
              <dd>{selected.productName}</dd>
            </div>
            <div>
              <dt className="text-[var(--rz-text-muted)]">Valor produto</dt>
              <dd>{selected.subtotalAmount ?? selected.amount ?? '—'}</dd>
            </div>
            {selected.deliveryFee && (
              <div>
                <dt className="text-[var(--rz-text-muted)]">Entrega</dt>
                <dd>{selected.deliveryFee}</dd>
              </div>
            )}
            <div>
              <dt className="text-[var(--rz-text-muted)]">Total</dt>
              <dd className="font-medium">{selected.totalAmount ?? selected.amount ?? '—'}</dd>
            </div>
            <div className="pt-2 border-t border-[var(--rz-border)]">
              <CatalogDeliveryHumanPanel
                orderCode={selected.orderCode}
                contactName={selected.contactName ?? selected.contactIdentifier}
                channel={selected.channel}
                deliveryAddress={selected.deliveryAddress}
                deliveryAddressV1={selected.deliveryAddressV1}
                deliveryAddressSnapshot={selected.deliveryAddressSnapshot}
                deliveryLocationLat={selected.deliveryLocationLat}
                deliveryLocationLng={selected.deliveryLocationLng}
                deliveryLocationPendingConfirm={selected.deliveryLocationPendingConfirm}
                deliveryFee={selected.deliveryFee}
                totalAmount={selected.totalAmount ?? selected.amount}
                deliveryDistanceKm={selected.deliveryDistanceKm}
                deliveryTierKm={selected.deliveryTierKm}
              />
            </div>
            {can(me, 'orders:update-status') &&
              ['aguardando_endereco', 'pendente_humano_endereco'].includes(selected.status) && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate(
                        `/platform/catalog-sales/orders/${selected.id}/delivery-address/confirm`,
                      )
                    }
                  >
                    Confirmar endereço
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate(
                        `/platform/catalog-sales/orders/${selected.id}/delivery-address/request-correction`,
                      )
                    }
                  >
                    Solicitar correção
                  </Button>
                </div>
              )}
            <div>
              <dt className="text-[var(--rz-text-muted)]">Comprovante</dt>
              <dd>
                {selected.proofs?.length
                  ? `${selected.proofs.length} envio(s)`
                  : 'Nenhum comprovante ainda'}
              </dd>
            </div>
          </dl>
        )}
      </DetailsDrawer>
    </div>
  )
}
