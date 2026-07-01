import { Link } from 'react-router-dom'
import {
  Package,
  CreditCard,
  Truck,
  ClipboardList,
  Settings,
  Sparkles,
  MapPin,
  AlertTriangle,
} from 'lucide-react'
import { useCatalogForm } from './CatalogFormContext'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can } from '../../lib/auth'
import {
  MetricCard,
  SectionCard,
  InlineNotice,
  StatusBadge,
} from '@/design-system'
import { fulfillmentModeFromConfig } from '@/lib/catalog/productDisplay'

interface CatalogOrderRow {
  id: string
  status: string
  productName: string
}

interface SessionRow {
  status: string
}

export function ProductsOverviewTab() {
  const { productStats, catalogSales, me } = useCatalogForm()
  const fulfillment = fulfillmentModeFromConfig(catalogSales)

  const { data: ordersData } = useQuery({
    queryKey: ['catalog-sales-orders-overview'],
    queryFn: () => api.get<{ orders: CatalogOrderRow[] }>('/platform/catalog-sales/orders?limit=200'),
    enabled: Boolean(me && can(me, 'orders:view')),
  })

  const { data: sessions = [] } = useQuery<SessionRow[]>({
    queryKey: ['sessions', 'tenant'],
    queryFn: () => api.get('/sessions'),
    enabled: Boolean(me),
  })

  const orders = ordersData?.orders ?? []
  const pendingProof = orders.filter(o =>
    ['comprovante_recebido', 'em_conferencia'].includes(o.status),
  ).length
  const awaitingPayment = orders.filter(o => o.status === 'aguardando_pagamento').length
  const awaitingAddress = orders.filter(o => o.status === 'aguardando_endereco').length
  const approvedToday = orders.filter(o => {
    if (!['pagamento_aprovado', 'pedido_confirmado'].includes(o.status)) return false
    return true
  }).length

  const pixIncomplete =
    catalogSales.pixEnabled && !(catalogSales.pixKey?.trim() || catalogSales.pixInstructions?.trim())
  const deliveryIncomplete =
    (catalogSales.useDistanceBasedDelivery || fulfillment !== 'pickup_only') &&
    catalogSales.requireDeliveryAddress &&
    !catalogSales.deliveryOriginAddress?.trim()
  const kmIncomplete =
    catalogSales.useDistanceBasedDelivery &&
    [1, 2, 3, 4, 5, 6, 7, 8].some(
      km =>
        !catalogSales.deliveryKmRates?.[
          `km${km}` as keyof typeof catalogSales.deliveryKmRates
        ]?.trim(),
    )
  const waOffline = !sessions.some(s => s.status === 'connected')
  const conferenciaMissing =
    catalogSales.notifyWhatsapp && !catalogSales.internalWhatsapp?.trim()

  return (
    <div className="space-y-6 mt-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Produtos ativos" value={productStats.total} icon={Package} />
        <MetricCard
          title="Sem preço"
          value={productStats.withoutPrice}
          icon={AlertTriangle}
          status={
            productStats.withoutPrice > 0
              ? { status: 'warning', text: 'Revisar cadastro' }
              : undefined
          }
        />
        <MetricCard title="Sem estoque" value={productStats.zeroStock} />
        <MetricCard
          title="Estoque a confirmar"
          value={productStats.uncertainStock ?? 0}
          status={
            (productStats.uncertainStock ?? 0) > 0
              ? { status: 'warning', text: 'Sem PIX automático' }
              : undefined
          }
        />
        <MetricCard title="Aguardando pagamento" value={awaitingPayment} icon={CreditCard} />
        <MetricCard title="Comprovantes pendentes" value={pendingProof} icon={ClipboardList} />
        <MetricCard title="Aguardando endereço" value={awaitingAddress} icon={MapPin} />
        <MetricCard title="Aprovados / confirmados" value={approvedToday} />
      </div>

      <SectionCard title="Fluxo operacional">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--rz-text-secondary)]">
          <StatusBadge status="info" text="WhatsApp da loja" size="sm" />
          <span>→</span>
          <StatusBadge status="neutral" text="Pedido reservado" size="sm" />
          <span>→</span>
          <StatusBadge status="warning" text="PIX / comprovante" size="sm" />
          <span>→</span>
          <StatusBadge status="premium" text="Conferência" size="sm" />
          <span>→</span>
          <StatusBadge status="success" text="Retirada ou entrega" size="sm" />
        </div>
      </SectionCard>

      {(pixIncomplete ||
        deliveryIncomplete ||
        kmIncomplete ||
        waOffline ||
        conferenciaMissing ||
        productStats.withoutPrice > 0 ||
        (productStats.uncertainStock ?? 0) > 0) && (
        <SectionCard title="Alertas" description="Itens que podem bloquear vendas automáticas.">
          <div className="space-y-2">
            {pixIncomplete && (
              <InlineNotice tone="warning" title="PIX incompleto">
                Configure chave e titular em{' '}
                <Link to="/platform/produtos#configuracoes" className="underline">
                  Configurações
                </Link>
                .
              </InlineNotice>
            )}
            {deliveryIncomplete && (
              <InlineNotice tone="warning" title="Entrega incompleta">
                Informe o endereço de origem em{' '}
                <Link to="/platform/produtos#entrega" className="underline">
                  Entrega e frete
                </Link>
                .
              </InlineNotice>
            )}
            {kmIncomplete && (
              <InlineNotice tone="warning" title="Tabela de frete incompleta">
                Preencha as faixas de km 1–8 em Entrega e frete.
              </InlineNotice>
            )}
            {waOffline && (
              <InlineNotice tone="danger" title="WhatsApp da loja offline">
                <Link to="/sessions" className="underline">
                  Conecte o WhatsApp
                </Link>{' '}
                para vendas no chat.
              </InlineNotice>
            )}
            {conferenciaMissing && (
              <InlineNotice tone="warning" title="Conferência sem número">
                Configure o WhatsApp do responsável em Configurações.
              </InlineNotice>
            )}
            {productStats.withoutPrice > 0 && (
              <InlineNotice tone="warning" title="Produtos sem preço">
                {productStats.withoutPrice} produto(s) sem preço — a IA não gera PIX automático.
              </InlineNotice>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Ações rápidas">
        <div className="flex flex-wrap gap-2">
          <Link
            to="/platform/produtos#itens"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rz-border)] px-3 py-2 text-sm hover:bg-[var(--rz-surface-muted)]"
          >
            <Package className="w-4 h-4" /> Cadastrar produto
          </Link>
          <Link
            to="/platform/produtos#pedidos"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rz-border)] px-3 py-2 text-sm hover:bg-[var(--rz-surface-muted)]"
          >
            <ClipboardList className="w-4 h-4" /> Ver pedidos
          </Link>
          <Link
            to="/platform/produtos#comprovantes"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rz-border)] px-3 py-2 text-sm hover:bg-[var(--rz-surface-muted)]"
          >
            <CreditCard className="w-4 h-4" /> Comprovantes
          </Link>
          <Link
            to="/platform/produtos#configuracoes"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rz-border)] px-3 py-2 text-sm hover:bg-[var(--rz-surface-muted)]"
          >
            <Settings className="w-4 h-4" /> Configurar PIX
          </Link>
          <Link
            to="/platform/produtos#entrega"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rz-border)] px-3 py-2 text-sm hover:bg-[var(--rz-surface-muted)]"
          >
            <Truck className="w-4 h-4" /> Entrega e frete
          </Link>
          <Link
            to="/platform/inbox/ia#empresa"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-brand-400 hover:underline"
          >
            <Sparkles className="w-4 h-4" /> IA e perfil comercial
          </Link>
        </div>
      </SectionCard>
    </div>
  )
}
