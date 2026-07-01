import {
  detectDeliveryFulfillmentChoice,
  detectPurchaseConfirmation,
  isValidCatalogSalesPhone,
  normalizeCatalogSalesConfig,
  productHasClearPrice,
  productStockIsZero,
  shouldOpenPixOrderFlow,
} from '@/types/catalog-sales';
import {
  buildCatalogPixInstructions,
  enrichCatalogSalesPixFields,
  resolveCatalogPixInstructions,
} from '@/types/catalog-sales-pix';

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

  it('monta instruções PIX a partir de chave e titular', () => {
    const text = buildCatalogPixInstructions({
      pixKey: 'benhur@email.com',
      pixHolderName: 'Benhur Ltda',
      pixInstructions: 'Envie o comprovante após pagar.',
    });
    expect(text).toContain('Chave PIX: benhur@email.com');
    expect(text).toContain('Titular: Benhur Ltda');
    expect(text).toContain('comprovante');
  });

  it('extrai chave PIX legada de pixInstructions', () => {
    const enriched = enrichCatalogSalesPixFields({
      pixInstructions: 'Chave PIX: 5566999999999\nTitular: Loja\nPague e envie print.',
    });
    expect(enriched.pixKey).toBe('5566999999999');
    expect(enriched.pixHolderName).toBe('Loja');
    expect(resolveCatalogPixInstructions(enriched)).toContain('Pague e envie print');
  });

  it('detecta confirmação de compra', () => {
    expect(detectPurchaseConfirmation('quero comprar esse produto')).toBe(true);
    expect(detectPurchaseConfirmation('qual o horário?')).toBe(false);
  });

  it('detecta escolha de entrega após oferta de compra', () => {
    expect(detectDeliveryFulfillmentChoice('quero que entregue')).toBe(true);
    expect(detectDeliveryFulfillmentChoice('vou retirar na loja')).toBe(true);
    expect(detectDeliveryFulfillmentChoice('qual o horário?')).toBe(false);
  });

  it('abre PIX quando cliente escolhe entrega no fluxo de compra', () => {
    expect(
      shouldOpenPixOrderFlow({
        saleMode: 'link_or_pix',
        clientText: 'quero que entregue',
        threadContext: 'gostaria de comprar um zaad',
        companyPixEnabled: true,
      }),
    ).toBe(true);
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
