import { useMemo, useCallback } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { SectionCard, StatusBadge, DataTable, EmptyState } from '@/design-system'
import { useCatalogForm } from './CatalogFormContext'
import { ProductFormPanel } from './ProductFormPanel'
import { productRowFromItem, SALE_MODE_LABELS } from '@/lib/catalog/productDisplay'

type ProductRow = ReturnType<typeof productRowFromItem>

function stockBadge(status: ProductRow['stockStatus']) {
  if (status === 'ok') return <StatusBadge status="success" text="Em estoque" size="sm" />
  if (status === 'zero') return <StatusBadge status="danger" text="Sem estoque" size="sm" />
  if (status === 'uncertain')
    return <StatusBadge status="warning" text="Estoque a confirmar" size="sm" />
  return <StatusBadge status="neutral" text="Sem cadastro" size="sm" />
}

export function ProductsItemsTab() {
  const {
    productItems,
    startEditProduct,
    startDuplicateProduct,
    removeProductItem,
  } = useCatalogForm()

  const rows = useMemo(() => productItems.map(productRowFromItem), [productItems])

  const duplicateProduct = useCallback(
    (item: ProductRow['item']) => startDuplicateProduct(item),
    [startDuplicateProduct],
  )

  const columns = useMemo<ColumnDef<ProductRow>[]>(
    () => [
      {
        id: 'title',
        header: 'Produto',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.title}</p>
            {row.original.sku && (
              <p className="text-xs text-[var(--rz-text-muted)]">SKU: {row.original.sku}</p>
            )}
          </div>
        ),
      },
      {
        id: 'price',
        header: 'Preço',
        cell: ({ row }) =>
          row.original.priceStatus === 'ok' ? (
            row.original.price
          ) : (
            <StatusBadge status="warning" text="Sem preço" size="sm" />
          ),
      },
      {
        id: 'stock',
        header: 'Estoque',
        cell: ({ row }) => stockBadge(row.original.stockStatus),
      },
      {
        id: 'sale',
        header: 'Modo',
        cell: ({ row }) => (
          <span className="text-xs text-[var(--rz-text-secondary)]">
            {SALE_MODE_LABELS[row.original.saleMode] ?? row.original.saleMode}
          </span>
        ),
      },
      {
        id: 'fulfillment',
        header: 'Entrega',
        cell: ({ row }) => (
          <span className="text-xs text-[var(--rz-text-secondary)]">
            {row.original.requiresDelivery ? 'Endereço obrig.' : 'Padrão empresa'}
            {row.original.madeToOrder ? ' · Encomenda' : ''}
          </span>
        ),
      },
      {
        id: 'ia',
        header: 'IA',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.aiActive ? 'info' : 'neutral'}
            text={row.original.aiActive ? 'Ativa' : 'Inativa'}
            size="sm"
          />
        ),
      },
      {
        id: 'pix',
        header: 'PIX auto',
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.canAutoPix ? 'success' : 'warning'}
            text={row.original.canAutoPix ? 'Permitido' : 'Bloqueado'}
            size="sm"
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => startEditProduct(row.original.item)}
              aria-label="Editar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => duplicateProduct(row.original.item)}
              aria-label="Duplicar"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => removeProductItem(row.original.item)}
              aria-label="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [duplicateProduct, removeProductItem, startEditProduct],
  )

  return (
    <div className="space-y-6 mt-4">
      <ProductFormPanel />

      <SectionCard
        title="Catálogo cadastrado"
        description="Produtos usados pela IA no WhatsApp e WebChat."
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Nenhum produto cadastrado"
            description="Use Novo produto acima. Depois clique em Salvar configurações no rodapé."
            size="sm"
            align="start"
          />
        ) : (
          <DataTable columns={columns} data={rows} ariaLabel="Lista de produtos" />
        )}
      </SectionCard>
    </div>
  )
}
