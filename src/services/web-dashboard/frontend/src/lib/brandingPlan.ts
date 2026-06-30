export const RADAR_CHAT_BRAND_URL = 'https://radarchat.com.br'

const PLANS_WITH_REMOVE_BRANDING = new Set(['pro', 'enterprise'])

export function canRemoveBranding(planId: string | null | undefined): boolean {
  const id = (planId ?? 'free').trim().toLowerCase() || 'free'
  return PLANS_WITH_REMOVE_BRANDING.has(id)
}

export function resolveProductBrandingVisible(
  planId: string | null | undefined,
  userWantsVisible: boolean | undefined,
): boolean {
  if (!canRemoveBranding(planId)) return true
  return userWantsVisible !== false
}
