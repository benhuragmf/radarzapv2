/** Espelho leve de hostsFromWebsiteUrl (backend) para exibição no painel. */
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
