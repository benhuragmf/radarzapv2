import type { CatalogSalesCompanyConfig } from './catalog-sales';

/** Menu Produtos visível quando perfil comercial ≠ none e pedidos via IA ativos. */
export function isCatalogProductsMenuEnabled(cfg?: CatalogSalesCompanyConfig | null): boolean {
  const profile = cfg?.businessCatalogProfile ?? 'none';
  if (profile === 'none') return false;
  return cfg?.enabled === true;
}

/** Perfil comercial escolhido mas catálogo ainda não ativado — CTA na IA. */
export function canShowCatalogActivationCta(cfg?: CatalogSalesCompanyConfig | null): boolean {
  const profile = cfg?.businessCatalogProfile ?? 'none';
  return profile !== 'none' && cfg?.enabled !== true;
}

/** Acesso direto a /platform/produtos sem catálogo ativo. */
export function isCatalogProductsRouteBlocked(cfg?: CatalogSalesCompanyConfig | null): boolean {
  return !isCatalogProductsMenuEnabled(cfg);
}
