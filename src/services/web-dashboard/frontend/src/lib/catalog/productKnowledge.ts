import type { CatalogProductSalesMeta } from './catalogSalesTypes'

export const COMPANY_PROFILE_TITLE = 'O que a empresa faz'
export const PAYMENT_GUIDE_TITLE = 'Pagamento por PIX e comprovantes'
export const PRODUCT_CATEGORY = 'Produtos e estoque'
export const COMPANY_CATEGORY = 'Empresa'
export const PAYMENT_CATEGORY = 'Pagamentos'

export type KnowledgeBaseItem = {
  id: string
  title: string
  content: string
  category: string
  active: boolean
  keywords: string[]
  links: Array<{ label: string; url: string; openInNewTab?: boolean }>
  showAsQuickReply: boolean
  quickReplyLabel: string
  salesMeta?: CatalogProductSalesMeta
  _delete?: boolean
}

export type ProductDraft = {
  name: string
  sku: string
  price: string
  stock: string
  link: string
  description: string
  paymentNotes: string
  deliveryFee: string
  salesMeta: CatalogProductSalesMeta
}

export const emptyProductDraft: ProductDraft = {
  name: '',
  sku: '',
  price: '',
  stock: '',
  link: '',
  description: '',
  paymentNotes: '',
  deliveryFee: '',
  salesMeta: {
    aiSellable: true,
    saleMode: 'link_or_pix',
    acceptsPix: true,
    useCompanyWhatsapp: true,
    requireHumanReview: true,
    requiresDeliveryAddress: false,
  },
}

export function makeKnowledgeBaseItem(partial: Partial<KnowledgeBaseItem>): KnowledgeBaseItem {
  return {
    id: '',
    title: partial.title ?? 'Novo item',
    content: partial.content ?? '',
    category: partial.category ?? 'Geral',
    active: partial.active ?? true,
    keywords: partial.keywords ?? [],
    links: partial.links ?? [],
    showAsQuickReply: partial.showAsQuickReply ?? false,
    quickReplyLabel: partial.quickReplyLabel ?? '',
    salesMeta: partial.salesMeta,
  }
}

export function parseProductContentField(content: string, prefix: string): string {
  const line = content.split('\n').find(row => row.startsWith(prefix))
  return line ? line.slice(prefix.length).trim() : ''
}

export function knowledgeItemToProductDraft(item: KnowledgeBaseItem): ProductDraft {
  const content = item.content ?? ''
  return {
    name: item.title,
    sku: parseProductContentField(content, 'SKU/código:'),
    price: parseProductContentField(content, 'Valor atual:'),
    stock: parseProductContentField(content, 'Estoque disponível:'),
    description: parseProductContentField(content, 'Descrição:'),
    paymentNotes: parseProductContentField(content, 'Pagamento/condições:'),
    deliveryFee: parseProductContentField(content, 'Taxa de entrega:'),
    link: item.links?.[0]?.url ?? '',
    salesMeta: {
      aiSellable: item.salesMeta?.aiSellable !== false,
      saleMode: item.salesMeta?.saleMode ?? (item.links?.[0]?.url ? 'link_or_pix' : 'pix'),
      acceptsPix: item.salesMeta?.acceptsPix !== false,
      useCompanyWhatsapp: item.salesMeta?.useCompanyWhatsapp !== false,
      productWhatsapp: item.salesMeta?.productWhatsapp ?? '',
      responsibleSector: item.salesMeta?.responsibleSector ?? '',
      requireHumanReview: item.salesMeta?.requireHumanReview !== false,
      madeToOrder: item.salesMeta?.madeToOrder === true,
      deliveryFee: item.salesMeta?.deliveryFee ?? parseProductContentField(content, 'Taxa de entrega:'),
      requiresDeliveryAddress: item.salesMeta?.requiresDeliveryAddress === true,
    },
  }
}

export function productMatchesRef(
  item: KnowledgeBaseItem,
  ref: { id?: string; title: string },
): boolean {
  if (item._delete) return false
  if ((item.category ?? 'Geral') !== PRODUCT_CATEGORY) return false
  if (ref.id && item.id) return item.id === ref.id
  return item.title.trim().toLowerCase() === ref.title.trim().toLowerCase()
}

export function productDraftToKnowledgeItem(product: ProductDraft): KnowledgeBaseItem {
  const title = product.name.trim() || 'Novo produto'
  const content = [
    `Produto: ${title}`,
    product.sku.trim() ? `SKU/código: ${product.sku.trim()}` : '',
    product.price.trim() ? `Valor atual: ${product.price.trim()}` : '',
    product.stock.trim() ? `Estoque disponível: ${product.stock.trim()}` : '',
    product.description.trim() ? `Descrição: ${product.description.trim()}` : '',
    product.paymentNotes.trim() ? `Pagamento/condições: ${product.paymentNotes.trim()}` : '',
    product.deliveryFee.trim() || product.salesMeta.deliveryFee?.trim()
      ? `Taxa de entrega: ${(product.deliveryFee.trim() || product.salesMeta.deliveryFee?.trim()) ?? ''}`
      : '',
    'Regra para a IA: informe preço, disponibilidade e link somente com base neste item. Se o produto tiver link de loja, envie o link quando o cliente preferir comprar pelo site. Para PIX no chat, colete endereço se necessário, informe taxa de entrega e oriente pagamento conforme configuração. Nunca confirme pagamento apenas com imagem de comprovante.',
  ]
    .filter(Boolean)
    .join('\n')

  return makeKnowledgeBaseItem({
    title,
    content,
    category: PRODUCT_CATEGORY,
    active: true,
    keywords: [title, product.sku, 'produto', 'estoque', 'comprar', 'valor']
      .map(k => k.trim())
      .filter(Boolean),
    links: product.link.trim()
      ? [{ label: `Ver ${title}`.slice(0, 80), url: product.link.trim(), openInNewTab: true }]
      : [],
    showAsQuickReply: true,
    quickReplyLabel: title.slice(0, 60),
    salesMeta: {
      ...product.salesMeta,
      deliveryFee: product.deliveryFee.trim() || product.salesMeta.deliveryFee,
    },
  })
}

export function upsertProductInKnowledgeBase(
  knowledgeBase: KnowledgeBaseItem[],
  product: ProductDraft,
  editingRef?: { id?: string; title: string } | null,
): KnowledgeBaseItem[] {
  const next = [...knowledgeBase]
  const newItem = productDraftToKnowledgeItem(product)
  const normalizedName = product.name.trim().toLowerCase()

  if (editingRef) {
    const idx = next.findIndex(item => productMatchesRef(item, editingRef))
    if (idx >= 0) {
      next[idx] = { ...next[idx], ...newItem, id: next[idx].id || newItem.id }
      return next
    }
  }

  const dupIdx = next.findIndex(
    item =>
      !item._delete &&
      (item.category ?? 'Geral') === PRODUCT_CATEGORY &&
      item.title.trim().toLowerCase() === normalizedName,
  )
  if (dupIdx >= 0) {
    next[dupIdx] = { ...next[dupIdx], ...newItem, id: next[dupIdx].id }
    return next
  }

  next.push(newItem)
  return next
}

export function listProductItems(knowledgeBase: KnowledgeBaseItem[]): KnowledgeBaseItem[] {
  return knowledgeBase.filter(
    item => !item._delete && (item.category ?? 'Geral') === PRODUCT_CATEGORY,
  )
}

export function productStatsFromItems(items: KnowledgeBaseItem[]) {
  let withoutPrice = 0
  let zeroStock = 0
  for (const item of items) {
    const price = parseProductContentField(item.content ?? '', 'Valor atual:')
    if (!price || !/\d/.test(price)) withoutPrice += 1
    const stock = parseProductContentField(item.content ?? '', 'Estoque disponível:')
    if (stock && /^0\b|0 un/i.test(stock)) zeroStock += 1
  }
  return { total: items.length, withoutPrice, zeroStock }
}
