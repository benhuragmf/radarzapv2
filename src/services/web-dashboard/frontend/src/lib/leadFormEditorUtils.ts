import {
  hostsFromWebsiteUrl,
  formatEmbedAllowedSitesSummary,
} from '@/lib/embedAllowedDomains'
import type { LeadFormListItem } from '@radarzap-types/lead-form'

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

export function leadFormPreviewUrl(
  publicKey: string,
  reloadKey?: number,
  _companyWebsite?: string | null,
): string {
  const q = new URLSearchParams({ key: publicKey })
  if (reloadKey) q.set('_r', String(reloadKey))
  return `/leads/preview.html?${q.toString()}`
}
