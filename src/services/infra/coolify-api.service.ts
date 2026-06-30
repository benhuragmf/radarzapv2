import type {
  AdminOpsCoolifyInfo,
  AdminOpsCoolifyServerInfo,
  AdminOpsCoolifyServiceInfo,
  AdminOpsHostDataStatus,
} from '@/types/admin-ops-host';

const FETCH_TIMEOUT_MS = 4000;

function coolifyConfig(): { url: string; token: string; serviceUuid: string } | null {
  const url = process.env.COOLIFY_URL?.trim().replace(/\/$/, '');
  const token = process.env.COOLIFY_API_TOKEN?.trim();
  const serviceUuid = process.env.COOLIFY_SERVICE_UUID?.trim() || 'h143brhw5f8tgfj9trj0f3bd';
  if (!url || !token) return null;
  return { url, token, serviceUuid };
}

async function coolifyFetch(path: string): Promise<unknown | null> {
  const cfg = coolifyConfig();
  if (!cfg) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pickArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown[] }).data)) {
    return (data as { data: unknown[] }).data;
  }
  return [];
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

export async function fetchCoolifyOpsInfo(): Promise<AdminOpsCoolifyInfo> {
  const cfg = coolifyConfig();
  if (!cfg) {
    return {
      status: 'not_configured',
      message: 'Defina COOLIFY_URL e COOLIFY_API_TOKEN no ambiente do app.',
    };
  }

  const versionRaw = await coolifyFetch('/api/v1/version');
  const version =
    versionRaw && typeof versionRaw === 'object'
      ? pickString(versionRaw as Record<string, unknown>, 'version', 'coolify_version')
      : undefined;

  const serviceRaw = await coolifyFetch(`/api/v1/services/${cfg.serviceUuid}`);
  let service: AdminOpsCoolifyServiceInfo | undefined;
  if (serviceRaw && typeof serviceRaw === 'object') {
    const s = serviceRaw as Record<string, unknown>;
    service = {
      uuid: cfg.serviceUuid,
      name: pickString(s, 'name'),
      status: pickString(s, 'status', 'service_status'),
      fqdn: pickString(s, 'fqdn'),
    };
  }

  const serversRaw = await coolifyFetch('/api/v1/servers');
  const servers: AdminOpsCoolifyServerInfo[] = pickArray(serversRaw)
    .slice(0, 5)
    .map(row => {
      if (!row || typeof row !== 'object') return null;
      const s = row as Record<string, unknown>;
      const uuid = pickString(s, 'uuid', 'id');
      if (!uuid) return null;
      const info: AdminOpsCoolifyServerInfo = {
        uuid,
        name: pickString(s, 'name'),
        status: pickString(s, 'status', 'server_status'),
        ip: pickString(s, 'ip', 'host'),
      };
      return info;
    })
    .filter((x): x is AdminOpsCoolifyServerInfo => x != null);

  let status: AdminOpsHostDataStatus = 'ok';
  let message: string | undefined;
  if (!version && !service) {
    status = 'unreachable';
    message = 'API Coolify indisponível a partir do container (verifique COOLIFY_URL).';
  }

  return {
    status,
    url: cfg.url,
    version,
    service,
    servers,
    message,
  };
}
