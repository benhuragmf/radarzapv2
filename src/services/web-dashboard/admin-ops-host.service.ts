import type {
  AdminOpsHostDataStatus,
  AdminOpsHostMetricsIngestBody,
  AdminOpsHostReport,
} from '@/types/admin-ops-host';
import { fetchCoolifyOpsInfo } from '@/services/infra/coolify-api.service';
import {
  hostMetricsTtlSeconds,
  loadHostMetricsSnapshot,
  normalizeHostMetricsIngest,
  saveHostMetricsSnapshot,
} from '@/services/infra/host-metrics-store.service';

const STALE_AFTER_SECONDS = 600;

function resolveHostMetricsStatus(reportedAt: string | undefined): AdminOpsHostDataStatus {
  if (!reportedAt) return 'not_configured';
  const ageMs = Date.now() - new Date(reportedAt).getTime();
  if (!Number.isFinite(ageMs)) return 'stale';
  return ageMs > STALE_AFTER_SECONDS * 1000 ? 'stale' : 'ok';
}

export async function buildAdminOpsHostReport(): Promise<AdminOpsHostReport> {
  const [snapshot, coolify] = await Promise.all([
    loadHostMetricsSnapshot(),
    fetchCoolifyOpsInfo(),
  ]);

  const hostStatus = snapshot ? resolveHostMetricsStatus(snapshot.reportedAt) : 'not_configured';

  return {
    generatedAt: new Date().toISOString(),
    hostMetrics: {
      status: hostStatus,
      snapshot: snapshot ?? undefined,
      staleAfterSeconds: STALE_AFTER_SECONDS,
      message:
        hostStatus === 'not_configured'
          ? 'Configure cron no VPS (scripts/vps-push-host-metrics.sh) com OPS_HOST_METRICS_SECRET.'
          : hostStatus === 'stale'
            ? 'Último reporte do host expirou — verifique cron no VPS.'
            : undefined,
    },
    coolify,
  };
}

export async function ingestAdminOpsHostMetrics(
  body: AdminOpsHostMetricsIngestBody,
): Promise<{ ok: true; ttlSeconds: number }> {
  const snapshot = normalizeHostMetricsIngest(body);
  const saved = await saveHostMetricsSnapshot(snapshot);
  if (!saved) {
    throw new Error('Redis indisponível — métricas não persistidas');
  }
  return { ok: true, ttlSeconds: hostMetricsTtlSeconds() };
}

export function verifyOpsHostMetricsSecret(headerValue: string | undefined): boolean {
  const expected = process.env.OPS_HOST_METRICS_SECRET?.trim();
  if (!expected) return false;
  return constantTimeEqual(headerValue?.trim() ?? '', expected);
}

/** Comparação constant-time simples — evita timing leak em secret curto. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
