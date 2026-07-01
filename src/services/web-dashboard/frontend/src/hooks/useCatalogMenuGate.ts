import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { CatalogSalesCompanyConfig } from '@/lib/catalog/catalogSalesTypes'

type AiSettingsGate = {
  catalogSales?: CatalogSalesCompanyConfig
}

/** Menu Produtos visível quando perfil comercial ≠ none e pedidos via IA ativos. */
export function isCatalogProductsMenuEnabled(cfg?: CatalogSalesCompanyConfig | null): boolean {
  const profile = cfg?.businessCatalogProfile ?? 'none'
  if (profile === 'none') return false
  return cfg?.enabled === true
}

/** Perfil comercial escolhido mas catálogo ainda não ativado — CTA na IA. */
export function canShowCatalogActivationCta(cfg?: CatalogSalesCompanyConfig | null): boolean {
  const profile = cfg?.businessCatalogProfile ?? 'none'
  return profile !== 'none' && cfg?.enabled !== true
}

export function useCatalogMenuGate(enabled = true) {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-settings-catalog-gate'],
    queryFn: () => api.get<AiSettingsGate>('/platform/ai/settings'),
    enabled,
    staleTime: 60_000,
  })
  const catalogSales = data?.catalogSales
  return {
    loading: isLoading,
    catalogSales,
    menuEnabled: isCatalogProductsMenuEnabled(catalogSales),
    showActivationCta: canShowCatalogActivationCta(catalogSales),
    profile: catalogSales?.businessCatalogProfile ?? 'none',
  }
}
