/** Espelho leve do backend para exibição e resumo no painel. */

export function hostsFromWebsiteUrl(website?: string | null): string[] {
  const raw = website?.trim()
  if (!raw) return []
  try {
    const url = raw.includes('://') ? raw : `https://${raw}`
    const host = new URL(url).hostname.toLowerCase()
    if (!host) return []
    const hosts = new Set<string>([host])
    if (host.startsWith('www.')) {
      hosts.add(host.slice(4))
    } else {
      const parts = host.split('.')
      if (parts.length >= 2) hosts.add(`www.${host}`)
    }
    return [...hosts]
  } catch {
    return []
  }
}

export function formatCompanyWebsiteHosts(website?: string | null): string {
  const hosts = hostsFromWebsiteUrl(website)
  return hosts.length ? hosts.join(', ') : ''
}

/** URL absoluta para iframe de prévia a partir do campo Site da empresa. */
export function companyWebsitePreviewUrl(website?: string | null): string | undefined {
  const raw = website?.trim()
  if (!raw) return undefined
  return raw.includes('://') ? raw : `https://${raw}`
}

export function normalizeAllowedDomainEntry(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return ''
  if (trimmed === '*') return '*'
  if (trimmed.startsWith('*.')) {
    const rest = trimmed.slice(2).trim()
    try {
      const host = new URL(rest.includes('://') ? rest : `https://${rest}`).hostname.toLowerCase()
      return host ? `*.${host}` : ''
    } catch {
      const host = rest.split('/')[0]?.replace(/^\.+/, '') ?? ''
      return host ? `*.${host}` : ''
    }
  }
  if (trimmed.includes('://')) {
    try {
      return new URL(trimmed).hostname.toLowerCase()
    } catch {
      return ''
    }
  }
  return trimmed.split('/')[0]?.replace(/^\.+/, '') ?? ''
}

export function resolveEmbedAllowedDomains(
  extraDomains: string[] | undefined,
  options?: {
    companyWebsite?: string | null
    includeCompanyWebsite?: boolean
  },
): string[] {
  const merged: string[] = []
  const seen = new Set<string>()

  const add = (entry: string) => {
    const key = entry.toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    merged.push(entry)
  }

  if (options?.includeCompanyWebsite !== false) {
    for (const h of hostsFromWebsiteUrl(options?.companyWebsite)) {
      add(h)
    }
  }

  for (const raw of extraDomains ?? []) {
    const normalized = normalizeAllowedDomainEntry(raw)
    if (normalized) add(normalized)
  }

  return merged
}

export function isEmbedWildcardOpen(extraDomains: string[] | undefined): boolean {
  return (extraDomains ?? []).some(raw => normalizeAllowedDomainEntry(raw) === '*')
}

/**
 * Texto do header "Sites permitidos".
 * "Qualquer domínio" só quando o cliente colocou * nos domínios adicionais.
 */
export function formatEmbedAllowedSitesSummary(
  extraDomains: string[] | undefined,
  includeCompanyWebsite: boolean,
  companyWebsite?: string | null,
  maxHosts = 3,
): string {
  if (isEmbedWildcardOpen(extraDomains)) {
    return 'Qualquer domínio'
  }

  const effective = resolveEmbedAllowedDomains(extraDomains, {
    companyWebsite,
    includeCompanyWebsite,
  })

  if (!effective.length) {
    return 'Nenhum domínio configurado'
  }

  const shown = effective.slice(0, maxHosts).join(', ')
  return effective.length > maxHosts ? `${shown}…` : shown
}
