import { Package, Pencil, Trash2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { inputCls, textareaCls } from '@/design-system'
import { useCatalogForm } from './CatalogFormContext'

const textareaClsAi = `${textareaCls} min-h-[100px]`

export function ProductsItemsTab() {
  const {
    productDraft,
    setProductDraft,
    editingProductRef,
    saveProductDraft,
    cancelEditProduct,
    productItems,
    startEditProduct,
    removeProductItem,
  } = useCatalogForm()

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Package className="w-5 h-5" /> Produtos e estoque
          </h2>
          <p className="text-xs text-[var(--rz-text-muted)] mt-1">
            Artigos na categoria <strong>Produtos e estoque</strong> — usados pela IA no fluxo de compra.
          </p>
          {editingProductRef && (
            <p className="text-xs text-amber-400/90 mt-2">
              Editando: <strong>{editingProductRef.title}</strong>
            </p>
          )}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            className={inputCls}
            value={productDraft.name}
            onChange={e => setProductDraft(p => ({ ...p, name: e.target.value }))}
            placeholder="Nome do produto"
          />
          <input
            className={inputCls}
            value={productDraft.sku}
            onChange={e => setProductDraft(p => ({ ...p, sku: e.target.value }))}
            placeholder="SKU/código opcional"
          />
          <input
            className={inputCls}
            value={productDraft.price}
            onChange={e => setProductDraft(p => ({ ...p, price: e.target.value }))}
            placeholder="Valor atual. Ex.: R$ 149,90"
          />
          <input
            className={inputCls}
            value={productDraft.stock}
            onChange={e => setProductDraft(p => ({ ...p, stock: e.target.value }))}
            placeholder="Estoque. Ex.: 12 unidades"
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
            placeholder="Descrição do produto"
          />
          <select
            className={inputCls}
            value={productDraft.salesMeta.saleMode ?? 'link_or_pix'}
            onChange={e =>
              setProductDraft(p => ({
                ...p,
                salesMeta: { ...p.salesMeta, saleMode: e.target.value as 'link' | 'pix' | 'link_or_pix' },
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!productDraft.name.trim() && !productDraft.description.trim()}
            onClick={saveProductDraft}
          >
            {editingProductRef ? 'Salvar produto' : 'Adicionar produto'}
          </Button>
          {editingProductRef && (
            <Button type="button" variant="ghost" onClick={cancelEditProduct}>
              Cancelar
            </Button>
          )}
        </div>
      </Card>

      {productItems.length > 0 && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-medium">Cadastrados ({productItems.length})</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {productItems.map(item => (
              <div
                key={item.id || item.title}
                className="rounded-lg bg-[var(--rz-surface-muted)]/50 p-3 space-y-2"
              >
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => startEditProduct(item)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button type="button" variant="danger" size="sm" onClick={() => removeProductItem(item)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-[var(--rz-text-muted)] line-clamp-2">{item.content}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
