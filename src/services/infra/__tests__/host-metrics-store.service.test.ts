import {
  normalizeHostMetricsIngest,
  saveHostMetricsSnapshot,
  loadHostMetricsSnapshot,
} from '@/services/infra/host-metrics-store.service';
import {
  ingestAdminOpsHostMetrics,
  verifyOpsHostMetricsSecret,
} from '@/services/web-dashboard/admin-ops-host.service';

jest.mock('@/cache/RedisManager', () => {
  const store = new Map<string, string>();
  return {
    RedisManager: {
      getInstance: () => ({
        isConnected: () => true,
        setWithTTL: async (key: string, val: string) => {
          store.set(key, val);
          return true;
        },
        get: async (key: string) => store.get(key) ?? null,
        __store: store,
      }),
    },
  };
});

describe('host-metrics-store', () => {
  it('normaliza ingest e persiste no Redis', async () => {
    const snapshot = normalizeHostMetricsIngest({
      host: { load1: 1.5, load5: 1.2, load15: 0.8, memoryTotalMb: 1900, memoryUsedMb: 1200 },
      containers: [
        { name: 'coolify', cpuPercent: 42.5, memUsedMb: 352, memPercent: 17.9 },
        { name: 'h143-app-1', cpuPercent: 0.19, memUsedMb: 219 },
      ],
      issues: ['legacy-mongo Exited'],
    });

    expect(snapshot.host.load1).toBe(1.5);
    expect(snapshot.containers).toHaveLength(2);
    expect(snapshot.containers[0].cpuPercent).toBe(42.5);

    await saveHostMetricsSnapshot(snapshot);
    const loaded = await loadHostMetricsSnapshot();
    expect(loaded?.containers[1].name).toBe('h143-app-1');
  });
});

describe('verifyOpsHostMetricsSecret', () => {
  const prev = process.env.OPS_HOST_METRICS_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.OPS_HOST_METRICS_SECRET;
    else process.env.OPS_HOST_METRICS_SECRET = prev;
  });

  it('rejeita secret ausente ou errado', () => {
    process.env.OPS_HOST_METRICS_SECRET = 'test-secret-123';
    expect(verifyOpsHostMetricsSecret(undefined)).toBe(false);
    expect(verifyOpsHostMetricsSecret('wrong')).toBe(false);
    expect(verifyOpsHostMetricsSecret('test-secret-123')).toBe(true);
  });
});

describe('ingestAdminOpsHostMetrics', () => {
  it('retorna ok quando Redis salva', async () => {
    const result = await ingestAdminOpsHostMetrics({
      host: { load1: 0.5, load5: 0.4, load15: 0.3 },
      containers: [],
    });
    expect(result.ok).toBe(true);
    expect(result.ttlSeconds).toBeGreaterThan(0);
  });
});
