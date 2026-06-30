import { describe, expect, it } from 'vitest';
import {
  deliveryFeeForTier,
  distanceKmToTier,
  formatKmRatesForAiPrompt,
  haversineDistanceKm,
  normalizeKmRates,
} from '../catalog-delivery.util';

describe('catalog-delivery.util', () => {
  it('normaliza faixas km 1-8', () => {
    expect(normalizeKmRates({ km1: ' R$ 5 ', km9: 'x', km2: '' })).toEqual({ km1: 'R$ 5' });
  });

  it('calcula distância haversine', () => {
    const km = haversineDistanceKm(-23.5505, -46.6333, -23.5629, -46.6544);
    expect(km).toBeGreaterThan(2);
    expect(km).toBeLessThan(4);
  });

  it('arredonda distância para faixa 1-8', () => {
    expect(distanceKmToTier(0.2)).toBe(1);
    expect(distanceKmToTier(1.1)).toBe(2);
    expect(distanceKmToTier(7.2)).toBe(8);
    expect(distanceKmToTier(12)).toBe(8);
  });

  it('retorna taxa por faixa', () => {
    const rates = { km3: 'R$ 12,00' };
    expect(deliveryFeeForTier(3, rates)).toBe('R$ 12,00');
    expect(deliveryFeeForTier(4, rates)).toBeNull();
  });

  it('formata tabela para prompt da IA', () => {
    const text = formatKmRatesForAiPrompt('Rua A, 1', { km1: 'R$ 5' });
    expect(text).toContain('Origem da entrega');
    expect(text).toContain('Até 1 km: R$ 5');
    expect(text).toContain('Até 8 km:');
  });
});
