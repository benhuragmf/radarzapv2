import { PlanConfigService } from '@/services/billing/plan-config';

export const RADAR_CHAT_BRAND_URL = 'https://radarchat.com.br';
export const RADAR_CHAT_BRAND_NAME = 'Radar Chat';

/** Rodapé de crédito pode ser removido apenas em planos com `removeBranding` no catálogo (Pro+). */
export function canRemoveBranding(planId: string | null | undefined): boolean {
  const id = (planId ?? 'free').trim() || 'free';
  const flags = PlanConfigService.getInstance().findPlan(id)?.featuresFlags;
  return flags?.removeBranding === true;
}

/** Crédito visível no embed público — forçado em Free/Starter/Trial. */
export function resolveProductBrandingVisible(
  planId: string | null | undefined,
  userWantsVisible: boolean | undefined,
): boolean {
  if (!canRemoveBranding(planId)) return true;
  return userWantsVisible !== false;
}

export async function getOrganizationPlanId(clientId: string): Promise<string> {
  const { Organization } = await import('@/models/Organization');
  const org = await Organization.findById(clientId).select('plan').lean();
  return (org?.plan as string | undefined)?.trim() || 'free';
}
