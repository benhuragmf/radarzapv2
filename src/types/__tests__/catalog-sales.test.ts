import {
  detectDeliveryFulfillmentChoice,
  detectPickupFulfillmentChoice,
  detectPurchaseConfirmation,
  extractProductNameFromCatalogOffer,
  isCatalogPurchaseOfferMessage,
  catalogTitleSimilarity,
  extractCatalogProductQueryToken,
  looksLikeCatalogProductNameQuery,
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
    expect(cfg.requireDeliveryAddress).toBe(true);
    expect(cfg.businessCatalogProfile).toBe('none');
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
    expect(detectDeliveryFulfillmentChoice('entregue')).toBe(true);
    expect(detectDeliveryFulfillmentChoice('me entregue')).toBe(true);
    expect(detectDeliveryFulfillmentChoice('vou retirar na loja')).toBe(false);
    expect(detectPickupFulfillmentChoice('vou retirar na loja')).toBe(true);
    expect(detectDeliveryFulfillmentChoice('qual o horário?')).toBe(false);
  });

  it('extrai produto da oferta padronizada', () => {
    const offer =
      'Olá, Benhur! O produto *zaad* está disponível por R$ 1 e temos 2. Você gostaria de prosseguir com a compra? Se sim, prefere *retirar* ou que seja *entregue*?';
    expect(isCatalogPurchaseOfferMessage(offer)).toBe(true);
    expect(extractProductNameFromCatalogOffer(offer)).toBe('zaad');
  });

  it('abre PIX quando cliente escolhe entrega só com oferta anterior', () => {
    expect(
      shouldOpenPixOrderFlow({
        saleMode: 'link_or_pix',
        clientText: 'entregue',
        threadContext: '',
        companyPixEnabled: true,
        catalogOfferProductName: 'zaad',
      }),
    ).toBe(true);
  });

  it('calcula similaridade entre nomes de produto', () => {
    expect(catalogTitleSimilarity('zaad', 'zaad')).toBe(1);
    expect(catalogTitleSimilarity('zad', 'zaad')).toBeGreaterThan(0.7);
    expect(catalogTitleSimilarity('xyz', 'zaad')).toBeLessThan(0.5);
  });

  it('detecta consulta curta por nome de produto', () => {
    expect(looksLikeCatalogProductNameQuery('zaad')).toBe(true);
    expect(looksLikeCatalogProductNameQuery('qual o horário?')).toBe(false);
    expect(extractCatalogProductQueryToken('quero o zaad')).toBe('zaad');
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
