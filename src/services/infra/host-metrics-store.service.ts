import { RedisManager } from '@/cache/RedisManager';
import type {
  AdminOpsHostMetricsIngestBody,
  AdminOpsHostSnapshot,
} from '@/types/admin-ops-host';

const REDIS_KEY = 'radarchat:admin:ops:host-metrics:v1';
const TTL_SECONDS = 900;

export function hostMetricsRedisKey(): string {
  return REDIS_KEY;
}

export function hostMetricsTtlSeconds(): number {
  return TTL_SECONDS;
}

function parseCpuPercent(raw: string | number | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, raw);
  if (typeof raw !== 'string') return 0;
  const n = parseFloat(raw.replace('%', '').trim());
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function parseMb(raw: string | number | undefined): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') return undefined;
  const m = raw.match(/([\d.]+)\s*([KMG]?i?B)?/i);
  if (!m) return undefined;
  const val = parseFloat(m[1]);
  if (!Number.isFinite(val)) return undefined;
  const unit = (m[2] ?? 'B').toUpperCase();
  if (unit.startsWith('G')) return val * 1024;
  if (unit.startsWith('M')) return val;
  if (unit.startsWith('K')) return val / 1024;
  return val / (1024 * 1024);
}

export function normalizeHostMetricsIngest(body: AdminOpsHostMetricsIngestBody): AdminOpsHostSnapshot {
  const reportedAt =
    typeof body.reportedAt === 'string' && body.reportedAt.trim()
      ? body.reportedAt.trim()
      : new Date().toISOString();

  const host = body.host ?? { load1: 0, load5: 0, load15: 0 };
  const containers = (body.containers ?? []).map(c => ({
    name: String(c.name ?? '').slice(0, 128),
    cpuPercent: parseCpuPercent(c.cpuPercent),
    memUsedMb: parseMb(c.memUsedMb) ?? 0,
    memLimitMb: c.memLimitMb != null ? parseMb(c.memLimitMb) : undefined,
    memPercent: c.memPercent != null ? parseCpuPercent(c.memPercent) : undefined,
  })).filter(c => c.name.length > 0);

  const issues = Array.isArray(body.issues)
    ? body.issues.map(i => String(i).slice(0, 200)).slice(0, 20)
    : undefined;

  return {
    reportedAt,
    host: {
      uptimeSeconds: host.uptimeSeconds,
      load1: Number(host.load1) || 0,
      load5: Number(host.load5) || 0,
      load15: Number(host.load15) || 0,
      memoryTotalMb: host.memoryTotalMb,
      memoryUsedMb: host.memoryUsedMb,
      memoryAvailableMb: host.memoryAvailableMb,
      swapUsedMb: host.swapUsedMb,
      cpuCount: host.cpuCount,
    },
    containers,
    issues,
  };
}

export async function saveHostMetricsSnapshot(snapshot: AdminOpsHostSnapshot): Promise<boolean> {
  const redis = RedisManager.getInstance();
  if (!redis.isConnected()) return false;
  await redis.setWithTTL(REDIS_KEY, JSON.stringify(snapshot), TTL_SECONDS);
  return true;
}

export async function loadHostMetricsSnapshot(): Promise<AdminOpsHostSnapshot | null> {
  const redis = RedisManager.getInstance();
  if (!redis.isConnected()) return null;
  const raw = await redis.get(REDIS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminOpsHostSnapshot;
  } catch {
    return null;
  }
}
