import { config } from '@/config/environment';
import { WebChatWidget } from '@/models/WebChatWidget';
import { hostFromUrl, isLocalDevHost, isWebChatOriginAllowed } from './webchat-token.util';

const EMBED_ORIGIN_CACHE_MS = 60_000;

let embedOriginCache: { at: number; widgets: Array<{ allowedDomains: string[] }> } | null = null;

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

async function loadActiveWidgetsForOrigin(): Promise<Array<{ allowedDomains: string[] }>> {
  const now = Date.now();
  if (embedOriginCache && now - embedOriginCache.at < EMBED_ORIGIN_CACHE_MS) {
    return embedOriginCache.widgets;
  }
  const widgets = await WebChatWidget.find({ active: true }).select('allowedDomains').lean();
  embedOriginCache = {
    at: now,
    widgets: widgets.map(w => ({ allowedDomains: w.allowedDomains ?? [] })),
  };
  return embedOriginCache.widgets;
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

  const widgets = await loadActiveWidgetsForOrigin();
  if (!widgets.length) return false;
  return widgets.some(w => isWebChatOriginAllowed(w.allowedDomains, normalized, null));
}

/** Invalida cache após PATCH de widget (testes / painel). */
export function resetSocketEmbedOriginCache(): void {
  embedOriginCache = null;
}
