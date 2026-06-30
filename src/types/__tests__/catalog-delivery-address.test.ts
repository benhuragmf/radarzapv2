import { describe, expect, it } from 'vitest';
import {
  CATALOG_DELIVERY_ADDRESS_EXAMPLE,
  deliveryAddressValidationError,
  formatDeliveryAddress,
  isCompleteDeliveryAddress,
  normalizeAddressForGeocode,
  parseDeliveryAddress,
} from '../catalog-delivery-address';

describe('catalog-delivery-address', () => {
  it('aceita endereço completo com CEP primeiro', () => {
    expect(isCompleteDeliveryAddress(CATALOG_DELIVERY_ADDRESS_EXAMPLE)).toBe(true);
    expect(deliveryAddressValidationError(CATALOG_DELIVERY_ADDRESS_EXAMPLE)).toBeNull();
  });

  it('formata e interpreta endereço estruturado', () => {
    const canonical = formatDeliveryAddress({
      cep: '01001000',
      street: 'Praça da Sé',
      number: '100',
      neighborhood: 'Sé',
      city: 'São Paulo',
      state: 'SP',
      country: 'Brasil',
    });
    expect(canonical.startsWith('01001-000,')).toBe(true);
    const parsed = parseDeliveryAddress(canonical);
    expect(parsed?.number).toBe('100');
    expect(parsed?.city).toBe('São Paulo');
  });

  it('aceita formato legado (CEP no meio)', () => {
    const legacy = 'Rua B, 10, Centro, 01001-000, São Paulo, SP, Brasil';
    expect(isCompleteDeliveryAddress(legacy)).toBe(true);
  });

  it('rejeita endereço incompleto', () => {
    expect(isCompleteDeliveryAddress('Rua A, São Paulo')).toBe(false);
  });

  it('normaliza país para geocoding', () => {
    expect(normalizeAddressForGeocode(CATALOG_DELIVERY_ADDRESS_EXAMPLE)).toContain('Brasil');
  });
});
