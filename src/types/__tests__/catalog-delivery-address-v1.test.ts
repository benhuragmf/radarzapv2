import {
  backfillDeliveryAddressV1FromLegacy,
  buildAddressConfirmationRequestMessage,
  createDeliveryAddressSnapshot,
  formatAddressConfirmationLine,
  isDeliveryAddressV1Confirmed,
  parseInlineAddressCorrectionAfterNo,
  refreshV1AfterInlineCorrection,
  structuredToDeliveryAddressV1,
  textIsAddressConfirmationNo,
  textIsAddressConfirmationYes,
} from '@/types/catalog-delivery-address-v1';
import { CatalogDeliveryAddressService } from '@/services/catalog/CatalogDeliveryAddressService';
import { lookupBrCep } from '@/utils/br-cep.util';

jest.mock('@/utils/br-cep.util', () => ({
  lookupBrCep: jest.fn(),
}));

const mockedLookupBrCep = lookupBrCep as jest.MockedFunction<typeof lookupBrCep>;

describe('catalog-delivery-address-v1', () => {
  it('textIsAddressConfirmationYes aceita sim/correto/confirmo', () => {
    expect(textIsAddressConfirmationYes('sim')).toBe(true);
    expect(textIsAddressConfirmationYes('Correto')).toBe(true);
    expect(textIsAddressConfirmationYes('confirmo')).toBe(true);
    expect(textIsAddressConfirmationYes('talvez')).toBe(false);
  });

  it('textIsAddressConfirmationNo aceita não/errado/corrigir', () => {
    expect(textIsAddressConfirmationNo('não')).toBe(true);
    expect(textIsAddressConfirmationNo('errado')).toBe(true);
    expect(textIsAddressConfirmationNo('sim')).toBe(false);
    expect(textIsAddressConfirmationNo('não, é número 120')).toBe(false);
    expect(textIsAddressConfirmationNo('não é numero 120')).toBe(false);
  });

  it('parseInlineAddressCorrectionAfterNo extrai número, rua, CEP, bairro e complemento', () => {
    expect(parseInlineAddressCorrectionAfterNo('não, é número 120')).toEqual({
      kind: 'number',
      number: '120',
    });
    expect(parseInlineAddressCorrectionAfterNo('não é numero 120')).toEqual({
      kind: 'number',
      number: '120',
    });
    expect(parseInlineAddressCorrectionAfterNo('errado, é número 120')).toEqual({
      kind: 'number',
      number: '120',
    });
    expect(parseInlineAddressCorrectionAfterNo('não, é 120')).toEqual({
      kind: 'number',
      number: '120',
    });
    expect(parseInlineAddressCorrectionAfterNo('não é 1326 é 120')).toEqual({
      kind: 'number',
      number: '120',
    });
    expect(parseInlineAddressCorrectionAfterNo('não, é Rua José Pinto, 120')).toEqual({
      kind: 'street_number',
      street: 'Rua José Pinto',
      number: '120',
    });
    expect(parseInlineAddressCorrectionAfterNo('não, cep 78705022')).toEqual({
      kind: 'cep',
      zipCode: '78705-022',
    });
    expect(parseInlineAddressCorrectionAfterNo('não, bairro é Vila Birigui')).toEqual({
      kind: 'neighborhood',
      neighborhood: 'Vila Birigui',
    });
    expect(parseInlineAddressCorrectionAfterNo('não, complemento casa 2')).toEqual({
      kind: 'complement',
      complement: 'casa 2',
    });
    expect(parseInlineAddressCorrectionAfterNo('sim')).toBeNull();
  });

  it('refreshV1AfterInlineCorrection limpa confirmação e mantém needs_confirmation', () => {
    const refreshed = refreshV1AfterInlineCorrection({
      street: 'Rua José Pinto',
      number: '120',
      city: 'Rondonópolis',
      uf: 'MT',
      status: 'confirmed',
      confirmedAt: new Date(),
      confirmedBy: 'customer',
    });
    expect(refreshed.status).toBe('needs_confirmation');
    expect(refreshed.confirmedAt).toBeUndefined();
    expect(refreshed.confirmedBy).toBeUndefined();
    expect(refreshed.number).toBe('120');
  });

  it('structuredToDeliveryAddressV1 monta formattedAddress', () => {
    const v1 = structuredToDeliveryAddressV1(
      {
        cep: '78705022',
        street: 'Rua Salmen Hanze',
        number: '1326',
        neighborhood: 'Vila Birigui',
        city: 'Rondonópolis',
        state: 'MT',
        country: 'Brasil',
      },
      { source: 'text', status: 'needs_confirmation', confidence: 'high' },
    );
    expect(v1.street).toBe('Rua Salmen Hanze');
    expect(v1.number).toBe('1326');
    expect(v1.status).toBe('needs_confirmation');
    expect(v1.formattedAddress).toContain('78705-022');
  });

  it('buildAddressConfirmationRequestMessage inclui endereço', () => {
    const msg = buildAddressConfirmationRequestMessage({
      street: 'Rua José Pinto',
      number: '120',
      city: 'Rondonópolis',
      uf: 'MT',
      status: 'needs_confirmation',
    });
    expect(msg).toContain('José Pinto');
    expect(msg).toContain('sim');
  });

  it('formatAddressConfirmationLine formata rua e número', () => {
    const line = formatAddressConfirmationLine({
      street: 'Rua José Pinto',
      number: '120',
      city: 'Rondonópolis',
      uf: 'MT',
    });
    expect(line).toContain('120');
    expect(line).toContain('Rondonópolis');
  });

  it('isDeliveryAddressV1Confirmed só após confirmed/freight', () => {
    expect(isDeliveryAddressV1Confirmed({ status: 'needs_confirmation' })).toBe(false);
    expect(isDeliveryAddressV1Confirmed({ status: 'confirmed' })).toBe(true);
    expect(isDeliveryAddressV1Confirmed({ status: 'freight_confirmed' })).toBe(true);
  });

  it('backfillDeliveryAddressV1FromLegacy preserva legado', () => {
    const v1 = backfillDeliveryAddressV1FromLegacy({
      deliveryAddress: '78705-022, Rua X, 10, Centro, Rondonópolis, MT, Brasil',
      status: 'aguardando_pagamento',
    });
    expect(v1?.source).toBe('legacy_backfill');
    expect(v1?.number).toBe('10');
  });

  it('createDeliveryAddressSnapshot congela frete e total', () => {
    const snap = createDeliveryAddressSnapshot({
      v1: {
        formattedAddress: 'Rua A, nº 1, Cidade-MT',
        status: 'freight_confirmed',
        confirmedBy: 'customer',
      },
      order: {
        deliveryDistanceKm: 3.2,
        deliveryTierKm: 4,
        deliveryFee: 'R$ 15,00',
        totalAmount: 'R$ 115,00',
      },
    });
    expect(snap.deliveryFee).toBe('R$ 15,00');
    expect(snap.deliveryTierKm).toBe(4);
    expect(snap.formattedAddress).toContain('Rua A');
  });
});

describe('CatalogDeliveryAddressService', () => {
  const svc = new CatalogDeliveryAddressService();

  beforeEach(() => {
    mockedLookupBrCep.mockReset();
  });

  function mockOrder(overrides: Record<string, unknown> = {}) {
    return {
      clientId: '507f1f77bcf86cd799439011',
      conversationId: '507f1f77bcf86cd799439012',
      channel: 'whatsapp',
      productName: 'ZAAd',
      status: 'aguardando_endereco',
      history: [],
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as unknown as import('@/models/CatalogSalesOrder').ICatalogSalesOrder;
  }

  function baseNeedsConfirmationV1(overrides: Record<string, unknown> = {}) {
    return {
      street: 'Rua José Pinto',
      number: '1326',
      city: 'Rondonópolis',
      uf: 'MT',
      status: 'needs_confirmation',
      formattedAddress: 'Rua José Pinto, nº 1326, Rondonópolis-MT',
      ...overrides,
    };
  }

  it('canProceedToFreight exige endereço confirmado', () => {
    expect(svc.canProceedToFreight({ status: 'needs_confirmation' })).toBe(false);
    expect(svc.canProceedToFreight({ status: 'confirmed' })).toBe(true);
  });

  it('processClientInput confirma endereço com sim', async () => {
    const order = mockOrder({
      deliveryAddressV1: baseNeedsConfirmationV1({ number: '120' }),
    });
    const result = await svc.processClientInput(order, { clientText: 'sim' });
    expect(result.handled).toBe(true);
    expect(result.action).toBe('confirmed');
    expect(order.deliveryAddressV1?.status).toBe('confirmed');
  });

  it('processClientInput nega endereço simples e pede endereço correto', async () => {
    const order = mockOrder({
      deliveryAddressV1: baseNeedsConfirmationV1(),
    });
    const result = await svc.processClientInput(order, { clientText: 'não' });
    expect(result.action).toBe('request_correction');
    expect(result.reply).toMatch(/endereço correto/i);
  });

  it('processClientInput corrige número inline após não', async () => {
    const order = mockOrder({
      deliveryAddressV1: baseNeedsConfirmationV1(),
      deliveryFee: 'R$ 15,00',
      deliveryDistanceKm: 3,
    });
    const result = await svc.processClientInput(order, { clientText: 'não, é número 120' });
    expect(result.action).toBe('inline_corrected');
    expect(order.deliveryAddressV1?.number).toBe('120');
    expect(order.deliveryAddressV1?.status).toBe('needs_confirmation');
    expect(order.deliveryFee).toBeUndefined();
    expect(result.reply).toMatch(/Atualizei o número/i);
    expect(result.reply).toMatch(/120/);
    expect(svc.canProceedToFreight(order.deliveryAddressV1)).toBe(false);
  });

  it('processClientInput corrige rua e número inline', async () => {
    const order = mockOrder({
      deliveryAddressV1: baseNeedsConfirmationV1(),
    });
    const result = await svc.processClientInput(order, {
      clientText: 'não, é Rua José Pinto, 120',
    });
    expect(result.action).toBe('inline_corrected');
    expect(order.deliveryAddressV1?.street).toBe('Rua José Pinto');
    expect(order.deliveryAddressV1?.number).toBe('120');
    expect(result.reply).toMatch(/Atualizei o endereço/i);
  });

  it('processClientInput corrige CEP inline e pede número se faltar', async () => {
    mockedLookupBrCep.mockResolvedValue({
      cep: '78705-022',
      street: 'Rua Salmen Hanze',
      neighborhood: 'Vila Birigui',
      city: 'Rondonópolis',
      state: 'MT',
      complement: '',
    });
    const order = mockOrder({
      deliveryAddressV1: baseNeedsConfirmationV1({ number: undefined, missingFields: ['number'] }),
    });
    const result = await svc.processClientInput(order, { clientText: 'não, cep 78705022' });
    expect(result.action).toBe('inline_corrected');
    expect(order.deliveryAddressV1?.zipCode).toBe('78705-022');
    expect(order.deliveryAddressV1?.status).toBe('partial');
    expect(result.reply).toMatch(/CEP informado/i);
  });

  it('processClientInput corrige bairro inline e reconfirma', async () => {
    const order = mockOrder({
      deliveryAddressV1: baseNeedsConfirmationV1(),
    });
    const result = await svc.processClientInput(order, {
      clientText: 'não, bairro é Vila Birigui',
    });
    expect(result.action).toBe('inline_corrected');
    expect(order.deliveryAddressV1?.neighborhood).toBe('Vila Birigui');
    expect(order.deliveryAddressV1?.status).toBe('needs_confirmation');
  });

  it('processClientInput corrige complemento inline e reconfirma', async () => {
    const order = mockOrder({
      deliveryAddressV1: baseNeedsConfirmationV1(),
    });
    const result = await svc.processClientInput(order, {
      clientText: 'não, complemento casa 2',
    });
    expect(result.action).toBe('inline_corrected');
    expect(order.deliveryAddressV1?.complement).toBe('casa 2');
    expect(order.deliveryAddressV1?.status).toBe('needs_confirmation');
  });

  it('processClientInput após inline e sim confirma para frete', async () => {
    const order = mockOrder({
      deliveryAddressV1: baseNeedsConfirmationV1(),
    });
    await svc.processClientInput(order, { clientText: 'não, é número 120' });
    const confirmed = await svc.processClientInput(order, { clientText: 'sim' });
    expect(confirmed.action).toBe('confirmed');
    expect(svc.canProceedToFreight(order.deliveryAddressV1)).toBe(true);
  });

  it('processClientInput bloqueia correção inline em pedido pago', async () => {
    const order = mockOrder({
      status: 'pagamento_aprovado',
      deliveryAddressV1: baseNeedsConfirmationV1(),
    });
    const result = await svc.processClientInput(order, { clientText: 'não, é número 120' });
    expect(result.action).toBe('escalate_human');
    expect(order.deliveryAddressV1?.number).toBe('1326');
  });
});
