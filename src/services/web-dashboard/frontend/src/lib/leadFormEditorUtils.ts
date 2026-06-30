import {
  hostsFromWebsiteUrl,
  formatEmbedAllowedSitesSummary,
} from '@/lib/embedAllowedDomains'
import type { LeadFormAppearance, LeadFormListItem } from '@radarzap-types/lead-form'

export type LeadFormEditorSectionId =
  | 'overview'
  | 'fields'
  | 'appearance'
  | 'dest'
  | 'security'
  | 'instalacao'

export type SectionStatusKind = 'complete' | 'incomplete' | 'optional' | 'attention'

export interface SectionStatus {
  kind: SectionStatusKind
  hint: string
}

function embedSitesHint(form: LeadFormListItem, companyWebsite?: string): string {
  return formatEmbedAllowedSitesSummary(
    form.allowedDomains,
    form.includeCompanyWebsite !== false,
    companyWebsite,
    2,
  )
}

function fieldsSummary(form: LeadFormListItem): string {
  const custom = (form.appearance.customFields ?? []).filter(f => f.type !== 'hidden')
  let count = custom.length
  if (form.appearance.askEmail) count += 1
  if (form.appearance.askMessage) count += 1
  if (count === 0) return 'Nome e telefone (padrão)'
  const required = custom.filter(f => f.required).length
  const reqEmail = form.appearance.requireEmail ? 1 : 0
  const reqMsg = form.appearance.requireMessage ? 1 : 0
  const reqTotal = required + reqEmail + reqMsg
  return `${count} campo(s) · ${reqTotal} obrigatório(s)`
}

function appearanceSummary(form: LeadFormListItem): string {
  const theme = form.appearance.theme ?? 'auto'
  const size = form.appearance.size ?? 'default'
  const themeLabel = theme === 'auto' ? 'Automático' : theme === 'light' ? 'Claro' : 'Escuro'
  const sizeLabel = size === 'compact' ? 'Compacto' : size === 'wide' ? 'Largo' : 'Padrão'
  return `${themeLabel} · ${sizeLabel}`
}

export function getLeadFormSectionStatuses(
  form: LeadFormListItem,
  companyWebsite?: string,
): Record<LeadFormEditorSectionId, SectionStatus> {
  const hasDomains =
    (form.includeCompanyWebsite !== false && hostsFromWebsiteUrl(companyWebsite).length > 0) ||
    (form.allowedDomains ?? []).length > 0

  return {
    overview: {
      kind: form.name.trim() && hasDomains ? 'complete' : hasDomains ? 'attention' : 'incomplete',
      hint: form.name.trim() ? embedSitesHint(form, companyWebsite) : 'Nome e domínios',
    },
    fields: {
      kind: 'complete',
      hint: fieldsSummary(form),
    },
    appearance: {
      kind: form.appearance.title?.trim() ? 'complete' : 'incomplete',
      hint: appearanceSummary(form),
    },
    dest: {
      kind: (form.routing?.defaultContactGroupIds?.length ?? 0) > 0 ? 'complete' : 'optional',
      hint:
        (form.routing?.defaultContactGroupIds?.length ?? 0) > 0
          ? `${form.routing!.defaultContactGroupIds!.length} lista(s)`
          : 'Padrão do sistema',
    },
    security: {
      kind: form.appearance.requireConsent ? 'complete' : 'optional',
      hint: form.appearance.requireConsent ? 'LGPD ativo' : 'Honeypot padrão',
    },
    instalacao: {
      kind: 'optional',
      hint: 'Copie o script no site',
    },
  }
}

export function isLeadFormDirty(baseline: LeadFormListItem, draft: LeadFormListItem): boolean {
  return JSON.stringify(normalizeFormSnapshot(baseline)) !== JSON.stringify(normalizeFormSnapshot(draft))
}

function normalizeFormSnapshot(form: LeadFormListItem) {
  return {
    name: form.name,
    active: form.active,
    allowedDomains: form.allowedDomains ?? [],
    includeCompanyWebsite: form.includeCompanyWebsite !== false,
    redirectUrl: form.redirectUrl ?? '',
    appearance: form.appearance,
    routing: form.routing,
  }
}

export const LEAD_FORM_PREVIEW_DEFAULT_SECTION = 3
export const LEAD_FORM_PREVIEW_MAX_SECTION = 12

export type LeadFormPreviewAppearance = Pick<
  LeadFormAppearance,
  'theme' | 'size' | 'borderRadius' | 'showLogo' | 'primaryColor'
>

export function leadFormPreviewSectionStorageKey(publicKey: string): string {
  return `rz-lead-preview-section:${publicKey}`
}

export function loadLeadFormPreviewSection(publicKey: string): number {
  try {
    const raw = sessionStorage.getItem(leadFormPreviewSectionStorageKey(publicKey))
    if (!raw) return LEAD_FORM_PREVIEW_DEFAULT_SECTION
    const n = parseInt(raw, 10)
    return Number.isFinite(n)
      ? Math.max(0, Math.min(LEAD_FORM_PREVIEW_MAX_SECTION, n))
      : LEAD_FORM_PREVIEW_DEFAULT_SECTION
  } catch {
    return LEAD_FORM_PREVIEW_DEFAULT_SECTION
  }
}

export function saveLeadFormPreviewSection(publicKey: string, section: number): void {
  try {
    sessionStorage.setItem(
      leadFormPreviewSectionStorageKey(publicKey),
      String(Math.max(0, Math.min(LEAD_FORM_PREVIEW_MAX_SECTION, section))),
    )
  } catch {
    /* ignore */
  }
}

export function leadFormPreviewUrl(
  publicKey: string,
  reloadKey?: number,
  companyWebsite?: string | null,
  section = LEAD_FORM_PREVIEW_DEFAULT_SECTION,
  appearance?: LeadFormPreviewAppearance,
): string {
  const q = new URLSearchParams()
  if (reloadKey) q.set('_r', String(reloadKey))

  if (companyWebsite?.trim()) {
    q.set('section', String(Math.max(0, Math.min(20, section))))
    if (appearance?.theme) q.set('theme', appearance.theme)
    if (appearance?.size) q.set('size', appearance.size)
    if (typeof appearance?.borderRadius === 'number') {
      q.set('borderRadius', String(appearance.borderRadius))
    }
    if (typeof appearance?.showLogo === 'boolean') {
      q.set('showLogo', appearance.showLogo ? '1' : '0')
    }
    if (appearance?.primaryColor) q.set('primaryColor', appearance.primaryColor)
    const qs = q.toString()
    return `/api/leads/public/forms/${encodeURIComponent(publicKey)}/preview-page${qs ? `?${qs}` : ''}#form-mount`
  }

  q.set('key', publicKey)
  return `/leads/preview.html?${q.toString()}`
}
