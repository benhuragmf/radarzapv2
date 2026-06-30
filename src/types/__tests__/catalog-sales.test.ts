import {
  detectPurchaseConfirmation,
  isValidCatalogSalesPhone,
  normalizeCatalogSalesConfig,
  productHasClearPrice,
  productStockIsZero,
  shouldOpenPixOrderFlow,
} from '@/types/catalog-sales';

describe('catalog-sales types', () => {
  it('normaliza config com defaults de segurança', () => {
    const cfg = normalizeCatalogSalesConfig({});
    expect(cfg.requireHumanApproval).toBe(true);
    expect(cfg.enabled).toBe(false);
    expect(cfg.escalateOnProof).toBe(true);
  });

  it('valida telefone BR com DDI', () => {
    expect(isValidCatalogSalesPhone('5566999999999')).toBe(true);
    expect(isValidCatalogSalesPhone('66999999999')).toBe(false);
    expect(isValidCatalogSalesPhone('5511')).toBe(false);
  });

  it('detecta confirmação de compra', () => {
    expect(detectPurchaseConfirmation('quero comprar esse produto')).toBe(true);
    expect(detectPurchaseConfirmation('qual o horário?')).toBe(false);
  });

  it('exige preço claro para venda automática', () => {
    expect(productHasClearPrice('R$ 149,90')).toBe(true);
    expect(productHasClearPrice('sob consulta')).toBe(false);
    expect(productHasClearPrice('')).toBe(false);
  });

  it('identifica estoque zero', () => {
    expect(productStockIsZero('0 unidades')).toBe(true);
    expect(productStockIsZero('sob encomenda')).toBe(false);
    expect(productStockIsZero('12 unidades')).toBe(false);
  });

  it('nao abre PIX quando cliente pede link da loja', () => {
    expect(
      shouldOpenPixOrderFlow({
        saleMode: 'link_or_pix',
        clientText: 'manda o link da loja',
        companyPixEnabled: true,
      }),
    ).toBe(false);
  });

  it('abre PIX quando cliente pede pix explicitamente', () => {
    expect(
      shouldOpenPixOrderFlow({
        saleMode: 'link_or_pix',
        clientText: 'quero pagar no pix',
        companyPixEnabled: true,
      }),
    ).toBe(true);
  });

  it('modo link nunca abre pedido PIX', () => {
    expect(
      shouldOpenPixOrderFlow({
        saleMode: 'link',
        clientText: 'quero comprar',
        structuredWantsOrder: true,
        companyPixEnabled: true,
      }),
    ).toBe(false);
  });
});
