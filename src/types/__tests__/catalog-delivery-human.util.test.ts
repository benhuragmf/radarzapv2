import {
  buildManualDeliveryCopyText,
  evaluatePinAddressDivergence,
  haversineDistanceMeters,
  PIN_ADDRESS_DIVERGENCE_WARN_METERS,
} from '@/types/catalog-delivery-human.util';

describe('catalog-delivery-human.util', () => {
  it('haversineDistanceMeters calcula metros', () => {
    const m = haversineDistanceMeters(-16.4709, -54.6358, -16.4715, -54.6365);
    expect(m).toBeGreaterThan(50);
    expect(m).toBeLessThan(200);
  });

  it('evaluatePinAddressDivergence sem pin retorna none', () => {
    expect(evaluatePinAddressDivergence({})).toEqual({ level: 'none' });
  });

  it('evaluatePinAddressDivergence com pin sem endereço confirmado alerta manual', () => {
    const r = evaluatePinAddressDivergence({
      pinLat: -16.47,
      pinLng: -54.63,
      addressV1: { status: 'needs_confirmation' },
    });
    expect(r.level).toBe('manual');
    expect(r.message).toMatch(/Confirme manualmente/i);
  });

  it('evaluatePinAddressDivergence distância pequena não alerta', () => {
    const r = evaluatePinAddressDivergence({
      pinLat: -16.4709,
      pinLng: -54.6358,
      addressV1: {
        status: 'confirmed',
        latitude: -16.471,
        longitude: -54.636,
      },
      warnThresholdMeters: PIN_ADDRESS_DIVERGENCE_WARN_METERS,
    });
    expect(r.level).toBe('ok');
  });

  it('evaluatePinAddressDivergence distância grande alerta', () => {
    const r = evaluatePinAddressDivergence({
      pinLat: -16.47,
      pinLng: -54.63,
      addressV1: {
        status: 'confirmed',
        latitude: -16.5,
        longitude: -54.7,
      },
      warnThresholdMeters: 400,
    });
    expect(r.level).toBe('warn');
    expect(r.message).toMatch(/distante/i);
    expect(r.distanceMeters).toBeGreaterThan(400);
  });

  it('buildManualDeliveryCopyText monta bloco copiável', () => {
    const text = buildManualDeliveryCopyText({
      orderCode: 'DX-1234',
      contactName: 'Maria',
      deliveryAddressV1: {
        status: 'confirmed',
        formattedAddress: 'Rua A, nº 1, Cidade-MT',
        complement: 'casa 2',
        latitude: -16.47,
        longitude: -54.63,
      },
      deliveryFee: 'R$ 15,00',
      totalAmount: 'R$ 115,00',
      pinLat: -16.47,
      pinLng: -54.63,
    });
    expect(text).toContain('DX-1234');
    expect(text).toContain('Maria');
    expect(text).toContain('Rua A');
    expect(text).toContain('casa 2');
    expect(text).toContain('google.com/maps');
    expect(text).toContain('R$ 15,00');
    expect(text).toMatch(/pin enviado/i);
  });
});
