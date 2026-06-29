import {
  hostFromUrl,
  isWebChatOriginAllowed,
  normalizeAllowedDomainEntry,
} from '@/services/webchat/webchat-token.util';

export type EmbedAllowedDomainsOptions = {
  companyWebsite?: string | null;
  /** Padrão true quando omitido — inclui hosts do site em Configurações → Empresa */
  includeCompanyWebsite?: boolean;
};

/** Extrai host(s) do campo Site da empresa (com/sem protocolo; inclui www e apex). */
export function hostsFromWebsiteUrl(website?: string | null): string[] {
  const raw = website?.trim();
  if (!raw) return [];
  const url = raw.includes('://') ? raw : `https://${raw}`;
  const host = hostFromUrl(url);
  if (!host) return [];
  const hosts = new Set<string>([host]);
  if (host.startsWith('www.')) {
    hosts.add(host.slice(4));
  } else {
    const parts = host.split('.');
    if (parts.length >= 2) hosts.add(`www.${host}`);
  }
  return [...hosts];
}

/** Domínios efetivos = site da empresa (opcional) + lista adicional do embed. */
export function resolveEmbedAllowedDomains(
  extraDomains: string[] | undefined,
  options?: EmbedAllowedDomainsOptions,
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  const add = (entry: string) => {
    const key = entry.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(entry);
  };

  if (options?.includeCompanyWebsite !== false) {
    for (const h of hostsFromWebsiteUrl(options?.companyWebsite)) {
      add(h);
    }
  }

  for (const raw of extraDomains ?? []) {
    const normalized = normalizeAllowedDomainEntry(raw);
    if (normalized) add(normalized);
  }

  return merged;
}

export function isEmbedOriginAllowed(
  extraDomains: string[] | undefined,
  origin?: string | null,
  referer?: string | null,
  options?: EmbedAllowedDomainsOptions,
): boolean {
  return isWebChatOriginAllowed(
    resolveEmbedAllowedDomains(extraDomains, options),
    origin,
    referer,
  );
}

export async function getOrganizationWebsite(clientId: string): Promise<string | undefined> {
  const { Organization } = await import('@/models/Organization');
  const org = await Organization.findById(clientId).select('website').lean();
  const website = org?.website?.trim();
  return website || undefined;
}
