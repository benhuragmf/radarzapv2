import type { KnowledgeBaseItem } from './productKnowledge'
import { parseProductContentField } from './productKnowledge'
import type { CatalogSalesCompanyConfig } from './catalogSalesTypes'

export type CatalogFulfillmentMode = 'pickup_only' | 'delivery_only' | 'pickup_and_delivery'

export type ProductStockStatus = 'ok' | 'zero' | 'uncertain' | 'missing'
export type ProductPriceStatus = 'ok' | 'missing'

function hasClearPrice(price: string): boolean {
  return Boolean(price?.trim() && /\d/.test(price))
}

function stockIsZero(stock: string): boolean {
  const m = stock.toLowerCase().match(/(\d+)/)
  return m ? parseInt(m[1], 10) === 0 : false
}

function stockAllowsPix(stock: string, madeToOrder?: boolean): boolean {
  if (madeToOrder) return true
  if (!stock.trim()) return false
  if (stockIsZero(stock)) return false
  const s = stock.toLowerCase()
  if (/consulte|sob consulta|confirmar|verificar|indefinido/i.test(s)) return false
  if (s.includes('sob encomenda') || s.includes('encomenda')) return true
  if (!/\d/.test(s)) return false
  const m = s.match(/(\d+)/)
  return m ? parseInt(m[1], 10) > 0 : false
}

export function getProductStockStatus(stock: string, madeToOrder?: boolean): ProductStockStatus {
  if (madeToOrder) return 'ok'
  if (!stock.trim()) return 'missing'
  if (stockIsZero(stock)) return 'zero'
  if (!stockAllowsPix(stock, madeToOrder)) return 'uncertain'
  return 'ok'
}

export function getProductPriceStatus(price: string): ProductPriceStatus {
  return hasClearPrice(price) ? 'ok' : 'missing'
}

export function productRowFromItem(item: KnowledgeBaseItem) {
  const content = item.content ?? ''
  const price = parseProductContentField(content, 'Valor atual:')
  const stock = parseProductContentField(content, 'Estoque disponível:')
  const sku = parseProductContentField(content, 'SKU/código:')
  const madeToOrder = item.salesMeta?.madeToOrder === true
  const stockStatus = getProductStockStatus(stock, madeToOrder)
  const priceStatus = getProductPriceStatus(price)
  const saleMode = item.salesMeta?.saleMode ?? (item.links?.[0]?.url ? 'link_or_pix' : 'pix')
  const aiActive = item.salesMeta?.aiSellable !== false

  return {
    item,
    title: item.title,
    price,
    stock,
    sku,
    stockStatus,
    priceStatus,
    saleMode,
    aiActive,
    madeToOrder,
    canAutoPix: aiActive && priceStatus === 'ok' && (madeToOrder || stockStatus === 'ok'),
    requiresDelivery: item.salesMeta?.requiresDeliveryAddress === true,
  }
}

export function resolveCatalogFulfillmentMode(
  cfg: CatalogSalesCompanyConfig,
): CatalogFulfillmentMode {
  const profile = cfg.businessCatalogProfile ?? 'none'
  if (profile === 'retail_pickup') return 'pickup_only'
  if (profile === 'retail_delivery') return 'delivery_only'
  return 'pickup_and_delivery'
}

/** @deprecated use resolveCatalogFulfillmentMode */
export const fulfillmentModeFromConfig = resolveCatalogFulfillmentMode

export function profileFromFulfillmentMode(
  mode: CatalogFulfillmentMode,
): CatalogSalesCompanyConfig['businessCatalogProfile'] {
  if (mode === 'pickup_only') return 'retail_pickup'
  if (mode === 'delivery_only') return 'retail_delivery'
  return 'catalog_general'
}

export function applyFulfillmentModePatch(
  mode: CatalogFulfillmentMode,
): Partial<CatalogSalesCompanyConfig> {
  const profile = profileFromFulfillmentMode(mode)
  const patch: Partial<CatalogSalesCompanyConfig> = { businessCatalogProfile: profile }
  if (mode === 'delivery_only') {
    patch.requireDeliveryAddress = true
    patch.forceCollectAddress = true
  }
  return patch
}

export const FULFILLMENT_MODE_LABELS: Record<CatalogFulfillmentMode, string> = {
  pickup_only: 'Apenas retirada',
  delivery_only: 'Apenas entrega',
  pickup_and_delivery: 'Retirada e entrega',
}

export const SALE_MODE_LABELS: Record<string, string> = {
  link: 'Link da loja',
  pix: 'PIX no chat',
  link_or_pix: 'Link ou PIX',
}
