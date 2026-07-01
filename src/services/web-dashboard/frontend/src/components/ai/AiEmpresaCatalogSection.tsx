import { Link } from 'react-router-dom'
import {
  Package,
  CreditCard,
  Truck,
  ClipboardList,
  Settings,
  Sparkles,
  Brain,
} from 'lucide-react'
import type { CatalogSalesCompanyConfig } from '@/lib/catalog/catalogSalesTypes'
import { InlineNotice } from '@/design-system'
import { Card } from '../ui/Card'

import type { KnowledgeBaseItem } from '../../lib/catalog/productKnowledge'
import { productStatsFromItems } from '../../lib/catalog/productKnowledge'

type Props = {
  catalogSales: CatalogSalesCompanyConfig
  updateCatalogSales: (patch: Partial<CatalogSalesCompanyConfig>) => void
  productItems: KnowledgeBaseItem[]
}

export function AiEmpresaCatalogSection({
  catalogSales,
  updateCatalogSales,
  productItems,
}: Props) {
  const { withoutPrice, zeroStock } = productStatsFromItems(productItems)
  const pixIncomplete =
    catalogSales.pixEnabled && !(catalogSales.pixKey?.trim() || catalogSales.pixInstructions?.trim())
  const catalogActive = catalogSales.enabled === true

  return (
    <>
      <div className="rounded-lg border border-[var(--rz-border)] p-4 space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Catálogo e pedidos na IA
        </h3>
        <p className="text-xs text-[var(--rz-text-muted)]">
          Ative para a IA usar produtos da base, oferecer compra no chat e seguir o fluxo PIX com
          conferência humana. Cadastro de produtos, PIX, frete e pedidos ficam no menu{' '}
          <strong>Produtos</strong>.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={catalogActive}
            onChange={e => updateCatalogSales({ enabled: e.target.checked })}
          />
          Permitir pedidos via IA / catálogo
        </label>
        {!catalogActive && (
          <p className="text-xs text-amber-300/90">
            Perfil comercial selecionado — ative o toggle acima para liberar o menu Produtos e o fluxo
            de compra.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-brand-800/30 bg-brand-950/15 p-4 space-y-2 text-xs text-[var(--rz-text-secondary)]">
        <h3 className="text-sm font-medium flex items-center gap-2 text-[var(--rz-text-primary)]">
          <Brain className="w-4 h-4" /> Como a IA se comporta
        </h3>
        <ul className="list-disc pl-4 space-y-1">
          <li>Responde sobre produtos cadastrados em Produtos e estoque — sem inventar preço ou estoque.</li>
          <li>Se o nome for parecido, sugere o produto e pede confirmação antes de abrir PIX.</li>
          <li>Saudações e mensagens vagas não abrem catálogo automaticamente.</li>
          <li>Frete e total com entrega por distância são calculados pelo sistema, não pela IA.</li>
          <li>Comprovante PIX sempre passa por conferência humana — a IA não confirma pagamento sozinha.</li>
          <li>Sem produto, preço ou estoque compatível, escala para humano em vez de forçar venda.</li>
        </ul>
      </div>

      {catalogActive && (
        <div className="space-y-2">
          {productItems.length === 0 && (
            <InlineNotice tone="warning" title="Catálogo vazio">
              Cadastre produtos em{' '}
              <Link to="/platform/produtos#itens" className="underline font-medium">
                Produtos e estoque
              </Link>
              .
            </InlineNotice>
          )}
          {withoutPrice > 0 && (
            <InlineNotice tone="warning" title={`${withoutPrice} produto(s) sem preço`}>
              A IA não abre PIX sem preço cadastrado.{' '}
              <Link to="/platform/produtos#itens" className="underline font-medium">
                Corrigir produtos
              </Link>
            </InlineNotice>
          )}
          {zeroStock > 0 && (
            <InlineNotice tone="info" title={`${zeroStock} produto(s) com estoque zerado`}>
              Venda bloqueada até repor estoque.{' '}
              <Link to="/platform/produtos#itens" className="underline font-medium">
                Ver estoque
              </Link>
            </InlineNotice>
          )}
          {pixIncomplete && (
            <InlineNotice tone="warning" title="PIX incompleto">
              <Link to="/platform/produtos#configuracoes" className="underline font-medium">
                Configurar PIX
              </Link>{' '}
              antes de vender pelo chat.
            </InlineNotice>
          )}
          {catalogSales.useDistanceBasedDelivery && !catalogSales.deliveryOriginAddress?.trim() && (
            <InlineNotice tone="warning" title="Entrega incompleta">
              <Link to="/platform/produtos#entrega" className="underline font-medium">
                Informar endereço de origem
              </Link>{' '}
              para frete por km.
            </InlineNotice>
          )}
        </div>
      )}

      {catalogActive && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Gerenciar no menu Produtos</h3>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/platform/produtos#itens"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--rz-border)] px-3 py-1.5 text-sm hover:bg-[var(--rz-surface-muted)]"
            >
              <Package className="w-4 h-4" /> Produtos e estoque
            </Link>
            <Link
              to="/platform/produtos#configuracoes"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--rz-border)] px-3 py-1.5 text-sm hover:bg-[var(--rz-surface-muted)]"
            >
              <CreditCard className="w-4 h-4" /> PIX e pagamentos
            </Link>
            <Link
              to="/platform/produtos#pedidos"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--rz-border)] px-3 py-1.5 text-sm hover:bg-[var(--rz-surface-muted)]"
            >
              <ClipboardList className="w-4 h-4" /> Pedidos
            </Link>
            <Link
              to="/platform/produtos#comprovantes"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--rz-border)] px-3 py-1.5 text-sm hover:bg-[var(--rz-surface-muted)]"
            >
              <CreditCard className="w-4 h-4" /> Comprovantes
            </Link>
            <Link
              to="/platform/produtos#entrega"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--rz-border)] px-3 py-1.5 text-sm hover:bg-[var(--rz-surface-muted)]"
            >
              <Truck className="w-4 h-4" /> Entrega e frete
            </Link>
            <Link
              to="/platform/produtos#configuracoes"
              className="inline-flex items-center gap-1 rounded-md border border-[var(--rz-border)] px-3 py-1.5 text-sm hover:bg-[var(--rz-surface-muted)]"
            >
              <Settings className="w-4 h-4" /> Configurações
            </Link>
          </div>
        </Card>
      )}
    </>
  )
}
