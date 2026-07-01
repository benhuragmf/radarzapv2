import {
  applyFulfillmentModePatch,
  fulfillmentModeFromConfig,
  getProductStockStatus,
  productRowFromItem,
  profileFromFulfillmentMode,
} from '../../services/web-dashboard/frontend/src/lib/catalog/productDisplay'

describe('product-display util (Produtos UX)', () => {
  it('estoque indefinido não permite PIX automático', () => {
    expect(getProductStockStatus('consulte estoque')).toBe('uncertain')
    expect(getProductStockStatus('')).toBe('missing')
    expect(getProductStockStatus('2 unidades')).toBe('ok')
    expect(getProductStockStatus('', true)).toBe('ok')
  })

  it('modos retirada/entrega por perfil', () => {
    expect(fulfillmentModeFromConfig({ businessCatalogProfile: 'retail_pickup' })).toBe(
      'pickup_only',
    )
    expect(profileFromFulfillmentMode('delivery_only')).toBe('retail_delivery')
    expect(applyFulfillmentModePatch('delivery_only').requireDeliveryAddress).toBe(true)
  })

  it('linha de produto bloqueia PIX com estoque consulte', () => {
    const row = productRowFromItem({
      id: '1',
      title: 'ZAAd',
      content: 'Valor atual: R$ 145,90\nEstoque disponível: consulte',
      category: 'Produtos e estoque',
      active: true,
      keywords: [],
      links: [],
      showAsQuickReply: false,
      quickReplyLabel: '',
    })
    expect(row.canAutoPix).toBe(false)
  })

  it('entregadores permanece recurso futuro — sem envio no patch', () => {
    expect(applyFulfillmentModePatch('pickup_only').businessCatalogProfile).toBe('retail_pickup')
  })
})
