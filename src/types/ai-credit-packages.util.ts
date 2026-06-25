import { PlanConfigService } from '@/services/billing/plan-config';

export interface AiCreditPackCatalogItem {
  id: string;
  credits: number;
  priceCents: number;
  currency: string;
  /** `documented_future` até TOP 17 integrar cobrança. */
  status: string;
  priceLabel: string;
}

/** Catálogo estático de pacotes extras (sem checkout nesta etapa). */
export function listAiCreditPackCatalog(): AiCreditPackCatalogItem[] {
  const packs = PlanConfigService.getInstance().getMeta().aiCreditPacks ?? [];
  return packs.map(p => ({
    id: p.id,
    credits: p.credits,
    priceCents: p.priceCents,
    currency: p.currency,
    status: p.status,
    priceLabel: formatPackPriceBrl(p.priceCents),
  }));
}

export function findAiCreditPackById(id: string): AiCreditPackCatalogItem | undefined {
  return listAiCreditPackCatalog().find(p => p.id === id);
}

function formatPackPriceBrl(priceCents: number): string {
  const value = priceCents / 100;
  return `R$${value.toFixed(value % 1 === 0 ? 0 : 2).replace('.', ',')}`;
}
