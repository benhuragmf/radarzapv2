/** VPS / Coolify — GET /api/admin/ops/host e ingest via cron no servidor */

export type AdminOpsHostDataStatus = 'ok' | 'stale' | 'not_configured' | 'unreachable';

export interface AdminOpsHostContainerMetric {
  name: string;
  cpuPercent: number;
  memUsedMb: number;
  memLimitMb?: number;
  memPercent?: number;
}

export interface AdminOpsHostSnapshot {
  reportedAt: string;
  host: {
    uptimeSeconds?: number;
    load1: number;
    load5: number;
    load15: number;
    memoryTotalMb?: number;
    memoryUsedMb?: number;
    memoryAvailableMb?: number;
    swapUsedMb?: number;
    cpuCount?: number;
  };
  containers: AdminOpsHostContainerMetric[];
  issues?: string[];
}

export interface AdminOpsCoolifyServiceInfo {
  uuid: string;
  name?: string;
  status?: string;
  fqdn?: string;
}

export interface AdminOpsCoolifyServerInfo {
  uuid: string;
  name?: string;
  status?: string;
  ip?: string;
}

export interface AdminOpsCoolifyInfo {
  status: AdminOpsHostDataStatus;
  url?: string;
  version?: string;
  service?: AdminOpsCoolifyServiceInfo;
  servers?: AdminOpsCoolifyServerInfo[];
  message?: string;
}

export interface AdminOpsHostReport {
  generatedAt: string;
  hostMetrics: {
    status: AdminOpsHostDataStatus;
    snapshot?: AdminOpsHostSnapshot;
    staleAfterSeconds: number;
    message?: string;
  };
  coolify: AdminOpsCoolifyInfo;
}

/** Body POST /api/admin/ops/host-metrics/ingest (cron VPS) */
export interface AdminOpsHostMetricsIngestBody {
  reportedAt?: string;
  host: AdminOpsHostSnapshot['host'];
  containers: AdminOpsHostContainerMetric[];
  issues?: string[];
}
