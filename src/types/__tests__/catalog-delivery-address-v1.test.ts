import {
  backfillDeliveryAddressV1FromLegacy,
  buildAddressConfirmationRequestMessage,
  createDeliveryAddressSnapshot,
  formatAddressConfirmationLine,
  isDeliveryAddressV1Confirmed,
  structuredToDeliveryAddressV1,
  textIsAddressConfirmationNo,
  textIsAddressConfirmationYes,
} from '@/types/catalog-delivery-address-v1';
import { CatalogDeliveryAddressService } from '@/services/catalog/CatalogDeliveryAddressService';

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

  it('canProceedToFreight exige endereço confirmado', () => {
    expect(svc.canProceedToFreight({ status: 'needs_confirmation' })).toBe(false);
    expect(svc.canProceedToFreight({ status: 'confirmed' })).toBe(true);
  });

  it('processClientInput confirma endereço com sim', async () => {
    const order = mockOrder({
      deliveryAddressV1: {
        street: 'Rua José Pinto',
        number: '120',
        city: 'Rondonópolis',
        uf: 'MT',
        status: 'needs_confirmation',
        formattedAddress: 'Rua José Pinto, 120, Rondonópolis-MT',
      },
    });
    const result = await svc.processClientInput(order, { clientText: 'sim' });
    expect(result.handled).toBe(true);
    expect(result.action).toBe('confirmed');
    expect(order.deliveryAddressV1?.status).toBe('confirmed');
  });

  it('processClientInput nega endereço e pede correção', async () => {
    const order = mockOrder({
      deliveryAddressV1: {
        status: 'needs_confirmation',
        formattedAddress: 'Rua X, 1',
      },
    });
    const result = await svc.processClientInput(order, { clientText: 'não, errado' });
    expect(result.action).toBe('request_correction');
    expect(result.reply).toMatch(/corrigido/i);
  });
});
