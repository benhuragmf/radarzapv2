import { useState } from 'react'
import { Package, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '../ui/Button'
import { inputCls, textareaCls, InlineNotice } from '@/design-system'
import { useCatalogForm } from './CatalogFormContext'

const textareaClsAi = `${textareaCls} min-h-[100px]`

export function ProductFormPanel() {
  const [open, setOpen] = useState(false)
  const {
    productDraft,
    setProductDraft,
    editingProductRef,
    saveProductDraft,
    cancelEditProduct,
  } = useCatalogForm()

  const stockUncertain =
    productDraft.stock.trim() &&
    (/consulte|sob consulta/i.test(productDraft.stock) || !/\d/.test(productDraft.stock)) &&
    !productDraft.salesMeta.madeToOrder

  return (
    <div className="space-y-3">
      {!open && !editingProductRef ? (
        <Button type="button" onClick={() => setOpen(true)}>
          <Package className="w-4 h-4 mr-1.5" />
          Novo produto
        </Button>
      ) : null}

      {(open || editingProductRef) && (
        <div className="rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)] p-5 space-y-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-medium">
                {editingProductRef ? `Editar: ${editingProductRef.title}` : 'Novo produto'}
              </h3>
              <p className="text-xs text-[var(--rz-text-muted)] mt-0.5">
                Campos salvos na base de conhecimento — usados pela IA no fluxo de compra.
              </p>
            </div>
            {!editingProductRef && (
              <button
                type="button"
                className="text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)]"
                onClick={() => setOpen(false)}
                aria-label="Fechar formulário"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
            )}
          </div>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--rz-text-muted)]">
              Dados do produto
            </legend>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                className={inputCls}
                value={productDraft.name}
                onChange={e => setProductDraft(p => ({ ...p, name: e.target.value }))}
                placeholder="Nome do produto *"
              />
              <input
                className={inputCls}
                value={productDraft.sku}
                onChange={e => setProductDraft(p => ({ ...p, sku: e.target.value }))}
                placeholder="SKU/código"
              />
              <input
                className={`${inputCls} md:col-span-2`}
                value={productDraft.link}
                onChange={e => setProductDraft(p => ({ ...p, link: e.target.value }))}
                placeholder="Link da loja (opcional)"
              />
              <textarea
                className={`${textareaClsAi} md:col-span-2`}
                value={productDraft.description}
                onChange={e => setProductDraft(p => ({ ...p, description: e.target.value }))}
                placeholder="Descrição"
              />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--rz-text-muted)]">
              Venda
            </legend>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                className={inputCls}
                value={productDraft.price}
                onChange={e => setProductDraft(p => ({ ...p, price: e.target.value }))}
                placeholder="Preço — ex.: R$ 149,90"
              />
              <input
                className={inputCls}
                value={productDraft.stock}
                onChange={e => setProductDraft(p => ({ ...p, stock: e.target.value }))}
                placeholder="Estoque — ex.: 12 unidades"
              />
              <select
                className={inputCls}
                value={productDraft.salesMeta.saleMode ?? 'link_or_pix'}
                onChange={e =>
                  setProductDraft(p => ({
                    ...p,
                    salesMeta: {
                      ...p.salesMeta,
                      saleMode: e.target.value as 'link' | 'pix' | 'link_or_pix',
                    },
                  }))
                }
              >
                <option value="link_or_pix">Link ou PIX no chat</option>
                <option value="link">Somente link da loja</option>
                <option value="pix">Somente PIX no chat</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={productDraft.salesMeta.aiSellable !== false}
                  onChange={e =>
                    setProductDraft(p => ({
                      ...p,
                      salesMeta: { ...p.salesMeta, aiSellable: e.target.checked },
                    }))
                  }
                />
                Vendável pela IA
              </label>
            </div>
            {stockUncertain && (
              <InlineNotice tone="warning" title="Estoque a confirmar">
                Este produto não gera PIX automático até a disponibilidade ser confirmada. Marque
                &quot;Sob encomenda&quot; se a venda sem estoque numérico for intencional.
              </InlineNotice>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--rz-text-muted)]">
              Fulfillment e segurança
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={productDraft.salesMeta.madeToOrder === true}
                  onChange={e =>
                    setProductDraft(p => ({
                      ...p,
                      salesMeta: { ...p.salesMeta, madeToOrder: e.target.checked },
                    }))
                  }
                />
                Produto sob encomenda
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={productDraft.salesMeta.requiresDeliveryAddress === true}
                  onChange={e =>
                    setProductDraft(p => ({
                      ...p,
                      salesMeta: {
                        ...p.salesMeta,
                        requiresDeliveryAddress: e.target.checked,
                      },
                    }))
                  }
                />
                Exigir endereço para entrega
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={productDraft.salesMeta.requireHumanReview !== false}
                  onChange={e =>
                    setProductDraft(p => ({
                      ...p,
                      salesMeta: { ...p.salesMeta, requireHumanReview: e.target.checked },
                    }))
                  }
                />
                Requer confirmação humana
              </label>
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!productDraft.name.trim() && !productDraft.description.trim()}
              onClick={() => {
                saveProductDraft()
                if (!editingProductRef) setOpen(false)
              }}
            >
              {editingProductRef ? 'Salvar alterações' : 'Adicionar à lista'}
            </Button>
            {(editingProductRef || open) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  cancelEditProduct()
                  setOpen(false)
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      {!open && !editingProductRef && (
        <button
          type="button"
          className="text-xs text-[var(--rz-text-muted)] hover:text-brand-400 flex items-center gap-1"
          onClick={() => setOpen(true)}
        >
          <ChevronDown className="w-3.5 h-3.5" />
          Expandir formulário de cadastro
        </button>
      )}
    </div>
  )
}
