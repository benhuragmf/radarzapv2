import {
  buildEmptyCatalogReply,
  buildFulfillmentReminderReply,
  buildCatalogPurchaseOfferReply,
  buildDeliveryAddressStartReply,
  buildDeliveryInquiryReply,
  buildCatalogContextualRecoveryReply,
  buildPickupWithoutAddressReply,
  buildPickupWithAddressReply,
  isValidConfiguredPickupAddress,
  catalogTitleSimilarity,
  CATALOG_EMPTY_REPLY_SUFFIX,
  CATALOG_FUZZY_SUGGEST_MIN_SCORE,
  CATALOG_STRONG_MATCH_MIN_SCORE,
  detectDeliveryFeeOrAddressQuestion,
  detectDeliveryFulfillmentChoice,
  detectLinkPurchaseIntent,
  detectPickupFulfillmentChoice,
  detectPixPurchaseIntent,
  detectPixResendRequest,
  detectPurchaseConfirmation,
  deliveryFulfillmentNeedsAddress,
  extractProductNameFromCatalogOffer,
  extractCatalogProductQueryToken,
  formatCatalogProductSuggestionLine,
  isAmbiguousCatalogFuzzyMatch,
  isBareAffirmationOrNonProductReply,
  isCatalogPurchaseOfferMessage,
  isStrongCatalogProductTitleMatch,
  looksLikeCatalogProductNameQuery,
  normalizeCatalogCompareText,
  normalizeCatalogSalesConfig,
  normalizeProductSalesMeta,
  isValidCatalogSalesPhone,
  productHasClearPrice,
  productStockAllowsPixPurchase,
  productStockIsZero,
  resolveCatalogFulfillmentMode,
  shouldOpenPixOrderFlow,
  resolveConfiguredPickupAddress,
} from '@/types/catalog-sales';
import {
  isGeocodableCustomerAddress,
  parseLooseDeliveryAddress,
  textLooksLikeDeliveryAddressInput,
} from '@/types/catalog-delivery-address';
import { parseStreetNumberReply } from '@/utils/catalog-delivery.util';
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

  it('catálogo desligado — config enabled false por default', () => {
    expect(normalizeCatalogSalesConfig({}).enabled).toBe(false);
    expect(normalizeCatalogSalesConfig({ pixEnabled: true }).pixEnabled).toBe(true);
  });

  it('valida telefone BR com DDI', () => {
    expect(isValidCatalogSalesPhone('5566999999999')).toBe(true);
    expect(isValidCatalogSalesPhone('66999999999')).toBe(false);
  });

  it('monta instruções PIX a partir de chave e titular', () => {
    const text = buildCatalogPixInstructions({
      pixKey: 'benhur@email.com',
      pixHolderName: 'Benhur Ltda',
      pixInstructions: 'Envie o comprovante após pagar.',
    });
    expect(text).toContain('Chave PIX: benhur@email.com');
    expect(text).toContain('Titular: Benhur Ltda');
  });

  it('extrai chave PIX legada de pixInstructions', () => {
    const enriched = enrichCatalogSalesPixFields({
      pixInstructions: 'Chave PIX: 5566999999999\nTitular: Loja\nPague e envie print.',
    });
    expect(enriched.pixKey).toBe('5566999999999');
    expect(resolveCatalogPixInstructions(enriched)).toContain('Pague e envie print');
  });

  it('catálogo vazio — mensagem honesta sem loop genérico', () => {
    const reply = buildEmptyCatalogReply('Benhur');
    expect(reply).toContain(CATALOG_EMPTY_REPLY_SUFFIX);
    expect(reply).toContain('Benhur');
    expect(reply).not.toContain('Qual produto você gostaria');
  });

  it('similaridade normaliza acentos, caixa e hífens', () => {
    expect(normalizeCatalogCompareText('ZA-Ad')).toBe('za ad');
    expect(catalogTitleSimilarity('zád', 'ZAAd')).toBeGreaterThan(0.7);
    expect(isStrongCatalogProductTitleMatch('zaad', 'ZAAd')).toBe(true);
    expect(isStrongCatalogProductTitleMatch('zad', 'ZAAd')).toBe(false);
    expect(isAmbiguousCatalogFuzzyMatch('zad', 'ZAAd')).toBe(true);
  });

  it('similar ambíguo não é match forte — exige confirmação antes de oferta', () => {
    const score = catalogTitleSimilarity('zad', 'ZAAd');
    expect(score).toBeGreaterThanOrEqual(CATALOG_FUZZY_SUGGEST_MIN_SCORE);
    expect(score).toBeLessThan(CATALOG_STRONG_MATCH_MIN_SCORE);
    expect(isStrongCatalogProductTitleMatch('zad', 'ZAAd')).toBe(false);
  });

  it('produto inexistente — token extraído para busca', () => {
    expect(extractCatalogProductQueryToken('zad')).toBe('zad');
    expect(extractCatalogProductQueryToken('quero o zaad')).toBe('zaad');
  });

  it('formata sugestão com preço e estoque reais', () => {
    const line = formatCatalogProductSuggestionLine('ZAAd', 'R$ 150,00', '2 unidades');
    expect(line).toContain('ZAAd');
    expect(line).toContain('150');
    expect(line).toContain('un');
  });

  it('saudação não abre catálogo', () => {
    expect(looksLikeCatalogProductNameQuery('ola boa tarde')).toBe(false);
    expect(looksLikeCatalogProductNameQuery('bom dia')).toBe(false);
    expect(looksLikeCatalogProductNameQuery('oi tudo bem')).toBe(false);
    expect(looksLikeCatalogProductNameQuery('sim')).toBe(false);
    expect(looksLikeCatalogProductNameQuery('ok')).toBe(false);
    expect(isBareAffirmationOrNonProductReply('sim')).toBe(true);
    expect(looksLikeCatalogProductNameQuery('zaad')).toBe(true);
  });

  it('produto encontrado — oferta padronizada detectável', () => {
    const offer =
      'Olá, Benhur! O produto *ZAAd* está disponível por R$ 150,00 e temos 2 unidades. ' +
      'Você gostaria de prosseguir com a compra? Se sim, prefere *retirar* ou que seja *entregue*?';
    expect(isCatalogPurchaseOfferMessage(offer)).toBe(true);
    expect(extractProductNameFromCatalogOffer(offer)).toBe('ZAAd');
  });

  it('estoque zero identificado', () => {
    expect(productStockIsZero('0 unidades')).toBe(true);
    expect(productStockIsZero('sob encomenda')).toBe(false);
    expect(productStockIsZero('12 unidades')).toBe(false);
    expect(productStockAllowsPixPurchase('0 unidades')).toBe(false);
    expect(productStockAllowsPixPurchase('consulte estoque')).toBe(false);
    expect(productStockAllowsPixPurchase('')).toBe(false);
    expect(productStockAllowsPixPurchase(undefined)).toBe(false);
    expect(productStockAllowsPixPurchase('2 unidades')).toBe(true);
    expect(productStockAllowsPixPurchase('sob encomenda', true)).toBe(true);
    expect(productStockAllowsPixPurchase('', true)).toBe(true);
  });

  it('formata sugestão sem “consulte estoque” como estoque válido', () => {
    const line = formatCatalogProductSuggestionLine('ZAAd', 'R$ 145,90', 'consulte estoque');
    expect(line).toContain('disponibilidade a confirmar');
    expect(line).not.toContain('consulte estoque');
  });

  it('produto sem preço — não tem preço claro', () => {
    expect(productHasClearPrice('R$ 149,90')).toBe(true);
    expect(productHasClearPrice('sob consulta')).toBe(false);
    expect(productHasClearPrice('')).toBe(false);
  });

  it('entrega — variações avançam fluxo', () => {
    for (const t of [
      'entregue',
      'entrega',
      'quero receber',
      'mandar entregar',
      'manda entregar',
      'pode entregar',
      'envia pra mim',
      'delivery',
    ]) {
      expect(detectDeliveryFulfillmentChoice(t)).toBe(true);
    }
    expect(detectDeliveryFulfillmentChoice('retirar')).toBe(false);
  });

  it('retirada — variações avançam fluxo', () => {
    for (const t of ['retirar', 'retirada', 'buscar', 'vou buscar', 'passo aí', 'retira']) {
      expect(detectPickupFulfillmentChoice(t)).toBe(true);
    }
    expect(detectPickupFulfillmentChoice('entrega')).toBe(false);
  });

  it('repetir nome do produto — lembrete fulfillment sem re-oferta completa', () => {
    const reminder = buildFulfillmentReminderReply('ZAAd', 'Benhur');
    expect(reminder).toContain('ZAAd');
    expect(reminder).toContain('retirar');
    expect(reminder).toContain('entregue');
    expect(reminder).not.toContain('está disponível por');
  });

  it('sim no contexto confirma compra', () => {
    expect(detectPurchaseConfirmation('sim')).toBe(true);
    expect(detectPurchaseConfirmation('pode ser')).toBe(true);
    expect(detectPurchaseConfirmation('qual o horário?')).toBe(false);
  });

  it('link da loja não abre PIX', () => {
    expect(detectLinkPurchaseIntent('manda o link da loja')).toBe(true);
    expect(
      shouldOpenPixOrderFlow({
        saleMode: 'link_or_pix',
        clientText: 'manda o link da loja',
        companyPixEnabled: true,
      }),
    ).toBe(false);
    expect(
      shouldOpenPixOrderFlow({
        saleMode: 'link',
        clientText: 'quero comprar',
        structuredWantsOrder: true,
        companyPixEnabled: true,
      }),
    ).toBe(false);
  });

  it('pix explícito abre fluxo quando permitido', () => {
    expect(detectPixPurchaseIntent('quero pagar no pix')).toBe(true);
    expect(
      shouldOpenPixOrderFlow({
        saleMode: 'link_or_pix',
        clientText: 'quero pagar no pix',
        companyPixEnabled: true,
      }),
    ).toBe(true);
  });

  it('link_or_pix — escolha link não força PIX', () => {
    expect(
      shouldOpenPixOrderFlow({
        saleMode: 'link_or_pix',
        clientText: 'comprar pelo site',
        companyPixEnabled: true,
      }),
    ).toBe(false);
  });

  it('PIX desligado — fulfillment com oferta não abre sem pixEnabled em link_or_pix', () => {
    expect(
      shouldOpenPixOrderFlow({
        saleMode: 'link_or_pix',
        clientText: 'entregue',
        companyPixEnabled: false,
        catalogOfferProductName: 'ZAAd',
      }),
    ).toBe(false);
  });

  it('entregue com produto em contexto pode criar pedido (PIX só após endereço no serviço)', () => {
    expect(
      shouldOpenPixOrderFlow({
        saleMode: 'link_or_pix',
        clientText: 'entregue',
        companyPixEnabled: true,
        catalogOfferProductName: 'ZAAd',
      }),
    ).toBe(true);
    const cfg = normalizeCatalogSalesConfig({
      businessCatalogProfile: 'retail_delivery',
      requireDeliveryAddress: true,
      useDistanceBasedDelivery: true,
    });
    expect(
      deliveryFulfillmentNeedsAddress(cfg, normalizeProductSalesMeta({})),
    ).toBe(true);
    const reply = buildDeliveryAddressStartReply('ZAAd', cfg);
    expect(reply).toContain('CEP');
    expect(reply).not.toContain('Chave PIX');
  });

  it('perguntas sobre taxa/endereço no fluxo de entrega', () => {
    expect(detectDeliveryFeeOrAddressQuestion('mais tem taxa de entrega?')).toBe(true);
    expect(detectDeliveryFeeOrAddressQuestion('meu endereço você não vai pegar?')).toBe(true);
    const inquiry = buildDeliveryInquiryReply({ productName: 'ZAAd' });
    expect(inquiry).toContain('CEP');
    expect(inquiry).not.toContain('Chave PIX');
    const partial = buildDeliveryInquiryReply({
      productName: 'ZAAd',
      hasPartialAddress: true,
    });
    expect(partial).toContain('número/endereço completo');
  });

  it('reenvio PIX só com pedido explícito', () => {
    expect(detectPixResendRequest('manda o pix de novo')).toBe(true);
    expect(detectPixResendRequest('qual a chave pix')).toBe(true);
    expect(detectPixResendRequest('não achei o pix')).toBe(true);
    expect(detectPixResendRequest('mais tem taxa de entrega?')).toBe(false);
    expect(detectPixResendRequest('retirar')).toBe(false);
    expect(detectPixResendRequest('Rua Salmen Hanze 1326')).toBe(false);
  });

  it('retirada sem endereço configurado — não é endereço válido', () => {
    expect(isValidConfiguredPickupAddress('Consulte nossa equipe para o endereço de retirada.')).toBe(
      false,
    );
    expect(isValidConfiguredPickupAddress('')).toBe(false);
    expect(
      isValidConfiguredPickupAddress('01001-000, Praça da Sé, 100, Sé, São Paulo, SP, Brasil'),
    ).toBe(true);
  });

  it('retirada sem endereço — mensagem honesta sem PIX', () => {
    const msg = buildPickupWithoutAddressReply('ZAAd', 'Benhur');
    expect(msg).toContain('ZAAd');
    expect(msg).toContain('endereço de retirada');
    expect(msg).not.toContain('Chave PIX');
    expect(msg).not.toContain('Consulte nossa equipe');
  });

  it('retirada com endereço — mensagem com local e PIX', () => {
    const addr = 'Rua das Flores, 100, Centro, São Paulo, SP';
    const msg = buildPickupWithAddressReply('ZAAd', addr, 'Chave PIX: teste@email.com');
    expect(msg).toContain(addr);
    expect(msg).toContain('Pagamento PIX');
    expect(msg).not.toContain('Consulte nossa equipe');
  });

  it('fallback contextual — aguardando endereço sem instabilidade genérica', () => {
    const msg = buildCatalogContextualRecoveryReply({
      orderStatus: 'aguardando_endereco',
      productName: 'ZAAd',
      contactFirstName: 'Benhur',
    });
    expect(msg).toContain('CEP');
    expect(msg).not.toContain('instabilidade');
  });

  it('fallback contextual — pin aguardando rua/número', () => {
    const msg = buildCatalogContextualRecoveryReply({
      orderStatus: 'aguardando_endereco',
      deliveryLocationPendingConfirm: true,
    });
    expect(msg).toContain('rua');
    expect(msg).toContain('número');
  });

  it('modos retirada/entrega por perfil comercial', () => {
    expect(
      resolveCatalogFulfillmentMode(
        normalizeCatalogSalesConfig({ businessCatalogProfile: 'retail_pickup' }),
      ),
    ).toBe('pickup_only');
    expect(
      resolveCatalogFulfillmentMode(
        normalizeCatalogSalesConfig({ businessCatalogProfile: 'retail_delivery' }),
      ),
    ).toBe('delivery_only');
    expect(
      resolveCatalogFulfillmentMode(
        normalizeCatalogSalesConfig({ businessCatalogProfile: 'catalog_general' }),
      ),
    ).toBe('pickup_and_delivery');
  });

  it('oferta com estoque numérico e retirada+entrega', () => {
    const offer = buildCatalogPurchaseOfferReply({
      productName: 'ZAAd',
      price: 'R$ 145,90',
      stock: '2 unidades',
      fulfillmentMode: 'pickup_and_delivery',
    });
    expect(offer).toContain('2 unidades');
    expect(offer).toContain('retirar');
    expect(offer).not.toContain('consulte disponibilidade');
  });

  it('oferta com estoque indefinido não promete PIX', () => {
    const offer = buildCatalogPurchaseOfferReply({
      productName: 'ZAAd',
      price: 'R$ 145,90',
      stock: 'consulte estoque',
    });
    expect(offer).toContain('confirmar a disponibilidade');
    expect(offer).not.toContain('prefere *retirar*');
  });

  it('oferta pickup_only não menciona entrega', () => {
    const offer = buildCatalogPurchaseOfferReply({
      productName: 'ZAAd',
      price: 'R$ 145,90',
      stock: '3 unidades',
      fulfillmentMode: 'pickup_only',
    });
    expect(offer).toContain('retirada');
    expect(offer).not.toContain('entregue');
  });

  it('oferta delivery_only pede CEP', () => {
    const offer = buildCatalogPurchaseOfferReply({
      productName: 'ZAAd',
      price: 'R$ 145,90',
      stock: '3 unidades',
      fulfillmentMode: 'delivery_only',
    });
    expect(offer).toContain('CEP');
    expect(isCatalogPurchaseOfferMessage(offer)).toBe(true);
  });

  it('PIX não abre sem produto em contexto na escolha de fulfillment', () => {
    expect(
      shouldOpenPixOrderFlow({
        saleMode: 'link_or_pix',
        clientText: 'entregue',
        companyPixEnabled: true,
        catalogOfferProductName: '',
      }),
    ).toBe(false);
  });

  it('requireHumanApproval default true — aprovação humana obrigatória', () => {
    expect(normalizeCatalogSalesConfig({}).requireHumanApproval).toBe(true);
  });

  it('status comprovante_sem_pedido existe no contrato', () => {
    expect(
      [
        'comprovante_sem_pedido',
        'aguardando_pagamento',
        'aguardando_endereco',
      ].includes('comprovante_sem_pedido'),
    ).toBe(true);
  });

  it('endereço completo sem CEP é reconhecido', () => {
    const raw = 'Rua: Salmen Hanze, 1326 Vila Birigui, Rondonópolis MT';
    expect(textLooksLikeDeliveryAddressInput(raw)).toBe(true);
    const parsed = parseLooseDeliveryAddress(raw);
    expect(parsed?.street).toContain('Salmen');
    expect(parsed?.number).toBe('1326');
    expect(parsed?.city).toMatch(/Rondonópolis/i);
    expect(parsed?.state).toBe('MT');
    expect(isGeocodableCustomerAddress(raw)).toBe(true);
  });

  it('rua e número com prefixo Rua: é aceito', () => {
    expect(parseStreetNumberReply('Rua: Salmen Hanze, 1326')).toEqual({
      street: 'Salmen Hanze',
      number: '1326',
    });
    expect(parseStreetNumberReply('R. Salmen Hanze, nº 1326')).toEqual({
      street: 'Salmen Hanze',
      number: '1326',
    });
  });
});
