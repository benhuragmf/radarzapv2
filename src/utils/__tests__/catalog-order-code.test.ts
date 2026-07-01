import {
  generateCatalogOrderCodeCandidate,
  isValidCatalogOrderCode,
  normalizeCatalogOrderCode,
} from '@/utils/catalog-order-code.util';

describe('catalog order code', () => {
  it('gera código DX-####', () => {
    const code = generateCatalogOrderCodeCandidate();
    expect(code).toMatch(/^DX-\d{4}$/);
    expect(isValidCatalogOrderCode(code)).toBe(true);
  });

  it('normaliza código', () => {
    expect(normalizeCatalogOrderCode('dx-1045')).toBe('DX-1045');
  });
});
