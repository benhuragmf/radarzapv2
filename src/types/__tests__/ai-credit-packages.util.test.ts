import { findAiCreditPackById, listAiCreditPackCatalog } from '@/types/ai-credit-packages.util';

describe('ai-credit-packages.util', () => {
  it('lista pacotes do catálogo com preços referência', () => {
    const packs = listAiCreditPackCatalog();
    expect(packs.length).toBeGreaterThanOrEqual(3);
    const pack1k = packs.find(p => p.credits === 1000);
    const pack5k = packs.find(p => p.credits === 5000);
    const pack15k = packs.find(p => p.credits === 15000);
    expect(pack1k?.priceCents).toBe(2900);
    expect(pack5k?.priceCents).toBe(9900);
    expect(pack15k?.priceCents).toBe(24900);
    expect(pack1k?.priceLabel).toMatch(/R\$/);
    expect(pack1k?.status).toBe('documented_future');
  });

  it('findAiCreditPackById', () => {
    expect(findAiCreditPackById('pack_1k')?.credits).toBe(1000);
    expect(findAiCreditPackById('missing')).toBeUndefined();
  });
});
