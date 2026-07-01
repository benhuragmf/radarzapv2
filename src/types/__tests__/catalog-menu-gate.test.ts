import {
  canShowCatalogActivationCta,
  isCatalogProductsMenuEnabled,
  isCatalogProductsRouteBlocked,
} from '../catalog-menu-gate'

describe('catalog-menu-gate', () => {
  it('menu desligado quando perfil none', () => {
    expect(isCatalogProductsMenuEnabled({ businessCatalogProfile: 'none', enabled: true })).toBe(
      false,
    )
    expect(canShowCatalogActivationCta({ businessCatalogProfile: 'none' })).toBe(false)
  })

  it('menu desligado quando perfil varejo mas enabled false', () => {
    expect(
      isCatalogProductsMenuEnabled({ businessCatalogProfile: 'retail_delivery', enabled: false }),
    ).toBe(false)
    expect(
      canShowCatalogActivationCta({ businessCatalogProfile: 'retail_delivery', enabled: false }),
    ).toBe(true)
  })

  it('menu ligado quando perfil varejo e enabled true', () => {
    expect(
      isCatalogProductsMenuEnabled({ businessCatalogProfile: 'retail_delivery', enabled: true }),
    ).toBe(true)
    expect(isCatalogProductsRouteBlocked({ businessCatalogProfile: 'retail_delivery', enabled: true })).toBe(
      false,
    )
  })

  it('rota bloqueada sem catálogo ativo', () => {
    expect(isCatalogProductsRouteBlocked({ businessCatalogProfile: 'catalog_general' })).toBe(true)
  })

  it('CTA desligado quando catálogo já ativo', () => {
    expect(
      canShowCatalogActivationCta({ businessCatalogProfile: 'retail_delivery', enabled: true }),
    ).toBe(false)
  })
})
