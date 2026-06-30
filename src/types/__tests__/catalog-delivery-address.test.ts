import { describe, expect, it } from 'vitest';
import {
  CATALOG_DELIVERY_ADDRESS_EXAMPLE,
  deliveryAddressValidationError,
  isCompleteDeliveryAddress,
  normalizeAddressForGeocode,
} from '../catalog-delivery-address';

describe('catalog-delivery-address', () => {
  it('aceita endereço completo BR', () => {
    expect(isCompleteDeliveryAddress(CATALOG_DELIVERY_ADDRESS_EXAMPLE)).toBe(true);
    expect(deliveryAddressValidationError(CATALOG_DELIVERY_ADDRESS_EXAMPLE)).toBeNull();
  });

  it('rejeita endereço incompleto', () => {
    expect(isCompleteDeliveryAddress('Rua A, São Paulo')).toBe(false);
    expect(deliveryAddressValidationError('Rua A, São Paulo')).toMatch(/CEP|vírgulas/i);
  });

  it('exige país Brasil', () => {
    const noCountry = 'Rua B, 10, Centro, 01001-000, São Paulo, SP';
    expect(isCompleteDeliveryAddress(noCountry)).toBe(false);
    expect(deliveryAddressValidationError(noCountry)).toMatch(/país/i);
  });

  it('normaliza país para geocoding', () => {
    expect(normalizeAddressForGeocode('Rua X, 1, Centro, 01001-000, SP')).toContain('Brasil');
    expect(normalizeAddressForGeocode('Rua X, Brasil')).toBe('Rua X, Brasil');
  });
});
