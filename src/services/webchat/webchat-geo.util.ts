import { RedisManager } from '@/cache/RedisManager';

const GEO_CACHE_TTL_SEC = 86_400;

function isPrivateIp(ip: string): boolean {
  if (!ip || ip === '::1' || ip === '127.0.0.1') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true;
  return false;
}

export function clientIpFromRequest(
  headers: Record<string, string | string[] | undefined>,
  socketIp?: string,
): string | undefined {
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(',')[0]?.trim();
  }
  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  return socketIp?.trim() || undefined;
}

export async function resolveGeoFromIp(ip?: string): Promise<{
  city?: string;
  region?: string;
  country?: string;
}> {
  if (!ip || isPrivateIp(ip)) {
    return { city: 'Local', region: undefined, country: 'Dev' };
  }

  const cacheKey = `webchat:geoip:${ip}`;
  try {
    const redis = RedisManager.getInstance();
    if (redis.isConnected()) {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as { city?: string; region?: string; country?: string };
    }
  } catch {
    /* ignore cache read */
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country`,
      { signal: AbortSignal.timeout(2500) },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      status?: string;
      city?: string;
      regionName?: string;
      country?: string;
    };
    if (data.status !== 'success') return {};
    const geo = {
      city: data.city?.trim() || undefined,
      region: data.regionName?.trim() || undefined,
      country: data.country?.trim() || undefined,
    };
    try {
      const redis = RedisManager.getInstance();
      if (redis.isConnected()) {
        await redis.setWithTTL(cacheKey, JSON.stringify(geo), GEO_CACHE_TTL_SEC);
      }
    } catch {
      /* ignore cache write */
    }
    return geo;
  } catch {
    return {};
  }
}
