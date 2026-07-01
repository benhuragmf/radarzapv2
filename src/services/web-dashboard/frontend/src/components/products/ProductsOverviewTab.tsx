import { Link } from 'react-router-dom'
import { Package, CreditCard, Truck, ClipboardList, Settings, Sparkles } from 'lucide-react'
import { Card } from '../ui/Card'
import { useCatalogForm } from './CatalogFormContext'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can } from '../../lib/auth'
import { InlineNotice } from '@/design-system'

interface CatalogOrderRow {
  id: string
  status: string
  productName: string
}

export function ProductsOverviewTab() {
  const { productStats, catalogSales, me } = useCatalogForm()

  const { data: ordersData } = useQuery({
    queryKey: ['catalog-sales-orders-overview'],
    queryFn: () => api.get<{ orders: CatalogOrderRow[] }>('/platform/catalog-sales/orders?limit=100'),
    enabled: Boolean(me && can(me, 'orders:view')),
  })

  const orders = ordersData?.orders ?? []
  const pendingProof = orders.filter(o =>
    ['comprovante_recebido', 'em_conferencia', 'aguardando_pagamento'].includes(o.status),
  ).length

  const pixIncomplete =
    catalogSales.pixEnabled && !(catalogSales.pixKey?.trim() || catalogSales.pixInstructions?.trim())

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-[var(--rz-text-muted)]">Produtos ativos</p>
          <p className="text-2xl font-semibold">{productStats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--rz-text-muted)]">Sem preço</p>
          <p className="text-2xl font-semibold text-amber-400">{productStats.withoutPrice}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--rz-text-muted)]">Estoque zerado</p>
          <p className="text-2xl font-semibold">{productStats.zeroStock}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--rz-text-muted)]">Aguardando conferência</p>
          <p className="text-2xl font-semibold">{pendingProof}</p>
        </Card>
      </div>

      {pixIncomplete && (
        <InlineNotice tone="warning" title="PIX incompleto">
          Configure a chave PIX em{' '}
          <Link to="/platform/produtos#configuracoes" className="underline font-medium">
            Configurações
          </Link>
          .
        </InlineNotice>
      )}

      {catalogSales.useDistanceBasedDelivery && !catalogSales.deliveryOriginAddress?.trim() && (
        <InlineNotice tone="warning" title="Entrega incompleta">
          Informe o endereço de origem em{' '}
          <Link to="/platform/produtos#entrega" className="underline font-medium">
            Entrega e frete
          </Link>
          .
        </InlineNotice>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Atalhos</h3>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/platform/produtos#itens"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--rz-border)] px-3 py-1.5 text-sm hover:bg-[var(--rz-surface-muted)]"
          >
            <Package className="w-4 h-4" /> Cadastrar produto
          </Link>
          <Link
            to="/platform/produtos#pedidos"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--rz-border)] px-3 py-1.5 text-sm hover:bg-[var(--rz-surface-muted)]"
          >
            <ClipboardList className="w-4 h-4" /> Ver pedidos
          </Link>
          <Link
            to="/platform/produtos#configuracoes"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--rz-border)] px-3 py-1.5 text-sm hover:bg-[var(--rz-surface-muted)]"
          >
            <CreditCard className="w-4 h-4" /> Configurar PIX
          </Link>
          <Link
            to="/platform/produtos#entrega"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--rz-border)] px-3 py-1.5 text-sm hover:bg-[var(--rz-surface-muted)]"
          >
            <Truck className="w-4 h-4" /> Entrega e frete
          </Link>
          <Link
            to="/platform/inbox/ia#empresa"
            className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-brand-400 hover:underline"
          >
            <Sparkles className="w-4 h-4" /> IA e perfil comercial
          </Link>
        </div>
      </Card>
    </div>
  )
}
