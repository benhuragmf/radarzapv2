import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { can, getMe } from '../../lib/auth'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { LoadingState, inputCls } from '@/design-system'
import { mutationError, notifyInfo } from '../../lib/notify'

export interface CatalogOrderListItem {
  id: string
  productName: string
  amount?: string
  status: string
  channel?: string
  contactName?: string
  contactIdentifier?: string
  conversationId?: string
  createdAt?: string
  proofs?: Array<{ receivedAt: string }>
}

const STATUS_LABEL: Record<string, string> = {
  aguardando_endereco: 'Aguardando endereço',
  aguardando_pagamento: 'Aguardando pagamento',
  comprovante_recebido: 'Comprovante recebido',
  em_conferencia: 'Em conferência',
  pagamento_aprovado: 'Aprovado',
  pagamento_recusado: 'Recusado',
  comprovante_sem_pedido: 'Sem pedido',
  falha_notificacao_whatsapp: 'Falha WA interno',
}

type OrdersFilterProps = {
  proofOnly?: boolean
}

export function ProductsOrdersTab({ proofOnly = false }: OrdersFilterProps) {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const { data: me } = useQuery({ queryKey: ['auth-me'], queryFn: getMe })

  const queryKey = ['catalog-sales-orders-list', statusFilter, proofOnly]
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const p = new URLSearchParams()
      if (statusFilter) p.set('status', statusFilter)
      p.set('limit', '50')
      return api.get<{ orders: CatalogOrderListItem[] }>(
        `/platform/catalog-sales/orders?${p.toString()}`,
      )
    },
    enabled: Boolean(me && can(me, 'orders:view')),
  })

  const orders = useMemo(() => {
    const raw = data?.orders ?? []
    if (!proofOnly) return raw
    return raw.filter(o =>
      [
        'comprovante_recebido',
        'em_conferencia',
        'comprovante_sem_pedido',
        'falha_notificacao_whatsapp',
      ].includes(o.status),
    )
  }, [data?.orders, proofOnly])

  const action = useMutation({
    mutationFn: (path: string) => api.post(path, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog-sales-orders-list'] })
      notifyInfo('Pedido atualizado.')
    },
    onError: mutationError,
  })

  if (!me || !can(me, 'orders:view')) {
    return (
      <Card className="p-6">
        <p className="text-sm text-[var(--rz-text-muted)]">Sem permissão para ver pedidos.</p>
      </Card>
    )
  }

  if (isLoading) return <LoadingState label="Carregando pedidos…" />

  return (
    <div className="space-y-4">
      {!proofOnly && (
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className={inputCls}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )}

      {orders.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--rz-text-muted)]">
          Nenhum pedido encontrado.
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map(order => (
            <Card key={order.id} className="p-4 space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">{order.productName}</p>
                  <p className="text-xs text-[var(--rz-text-muted)]">
                    {STATUS_LABEL[order.status] ?? order.status}
                    {order.amount ? ` · ${order.amount}` : ''}
                    {order.channel ? ` · ${order.channel}` : ''}
                  </p>
                  {order.contactName && (
                    <p className="text-xs text-[var(--rz-text-muted)]">{order.contactName}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {can(me, 'orders:view-payment-proof') && order.proofs?.length ? (
                    <a
                      href={`/api/platform/catalog-sales/orders/${order.id}/proof`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-2 py-1 border rounded-md hover:bg-[var(--rz-surface-muted)]"
                    >
                      Comprovante
                    </a>
                  ) : null}
                  {order.conversationId && (
                    <Link
                      to={`/platform/inbox?conv=${order.conversationId}`}
                      className="text-xs px-2 py-1 border rounded-md hover:bg-[var(--rz-surface-muted)]"
                    >
                      Inbox
                    </Link>
                  )}
                  {can(me, 'orders:approve-payment') && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={action.isPending}
                      onClick={() => action.mutate(`/platform/catalog-sales/orders/${order.id}/approve`)}
                    >
                      Aprovar
                    </Button>
                  )}
                  {can(me, 'orders:reject-payment') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={action.isPending}
                      onClick={() => {
                        const reason = window.prompt('Motivo (opcional):') ?? undefined
                        void api
                          .post(`/platform/catalog-sales/orders/${order.id}/reject`, { reason })
                          .then(() => {
                            qc.invalidateQueries({ queryKey: ['catalog-sales-orders-list'] })
                            notifyInfo('Recusado.')
                          })
                          .catch(mutationError)
                      }}
                    >
                      Recusar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
