import { config } from '@/config/environment';
import { Organization } from '@/models/Organization';
import { WebChatWidget } from '@/models/WebChatWidget';
import { resolveEmbedAllowedDomains } from '@/utils/embed-allowed-domains.util';
import { hostFromUrl, isLocalDevHost, isWebChatOriginAllowed } from './webchat-token.util';

const EMBED_ORIGIN_CACHE_MS = 60_000;

let embedOriginCache: { at: number; effectiveDomains: string[][] } | null = null;

/** Origens fixas do painel (Socket.IO credentialed). */
export function dashboardSocketOrigins(): string[] {
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5174',
    config.DASHBOARD.FRONTEND_URL,
    config.CORS_ORIGIN,
  ]
    .filter(Boolean)
    .map(v => String(v).replace(/\/$/, ''));
}

async function loadActiveWidgetEffectiveDomains(): Promise<string[][]> {
  const now = Date.now();
  if (embedOriginCache && now - embedOriginCache.at < EMBED_ORIGIN_CACHE_MS) {
    return embedOriginCache.effectiveDomains;
  }

  const widgets = await WebChatWidget.find({ active: true })
    .select('allowedDomains includeCompanyWebsite clientId')
    .lean();

  const clientIds = [...new Set(widgets.map(w => String(w.clientId)))];
  const orgs =
    clientIds.length > 0
      ? await Organization.find({ _id: { $in: clientIds } })
          .select('website')
          .lean()
      : [];
  const websiteByClient = new Map(orgs.map(o => [String(o._id), o.website]));

  const effectiveDomains = widgets.map(w =>
    resolveEmbedAllowedDomains(w.allowedDomains ?? [], {
      companyWebsite: websiteByClient.get(String(w.clientId)),
      includeCompanyWebsite: w.includeCompanyWebsite,
    }),
  );

  embedOriginCache = { at: now, effectiveDomains };
  return effectiveDomains;
}

/** Valida origem HTTP do handshake Socket.IO (painel + embed WebChat). */
export async function isSocketIoOriginAllowed(origin?: string | null): Promise<boolean> {
  const normalized = origin?.replace(/\/$/, '');
  const allowedDashboard = dashboardSocketOrigins();

  if (!normalized) {
    return config.NODE_ENV !== 'production';
  }

  if (allowedDashboard.includes(normalized)) return true;

  if (config.NODE_ENV !== 'production') {
    const host = hostFromUrl(normalized);
    if (host && isLocalDevHost(host)) return true;
  }

  const effectiveDomains = await loadActiveWidgetEffectiveDomains();
  if (!effectiveDomains.length) return false;
  return effectiveDomains.some(domains => isWebChatOriginAllowed(domains, normalized, null));
}

/** Invalida cache após PATCH de widget (testes / painel). */
export function resetSocketEmbedOriginCache(): void {
  embedOriginCache = null;
}
