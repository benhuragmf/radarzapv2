import { DatabaseManager } from '@/database/DatabaseManager';
import { RedisManager } from '@/cache/RedisManager';
import { QueueManager } from '@/cache/QueueManager';
import { buildInfraHealthSnapshot, toPublicLivenessHealth } from '../infra-health.service';

jest.mock('@/database/DatabaseManager');
jest.mock('@/cache/RedisManager');
jest.mock('@/cache/QueueManager');

describe('buildInfraHealthSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (DatabaseManager.getInstance as jest.Mock).mockReturnValue({
      healthCheck: jest.fn().mockResolvedValue(true),
    });
    (RedisManager.getInstance as jest.Mock).mockReturnValue({
      healthCheck: jest.fn().mockResolvedValue(true),
    });
    (QueueManager.getInstance as jest.Mock).mockReturnValue({
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, details: {} }),
    });
  });

  it('healthy=true quando Mongo e Redis OK', async () => {
    const snap = await buildInfraHealthSnapshot();
    expect(snap.healthy).toBe(true);
    expect(snap.dependencies.mongodb.ok).toBe(true);
    expect(snap.dependencies.redis.ok).toBe(true);
    expect(snap.dependencies.queues.ok).toBe(true);
    expect(typeof snap.uptime).toBe('number');
    expect(snap.checkedAt).toMatch(/^\d{4}-/);
  });

  it('healthy=false quando Mongo indisponível', async () => {
    (DatabaseManager.getInstance as jest.Mock).mockReturnValue({
      healthCheck: jest.fn().mockResolvedValue(false),
    });
    const snap = await buildInfraHealthSnapshot();
    expect(snap.healthy).toBe(false);
    expect(snap.dependencies.mongodb.ok).toBe(false);
    expect(snap.dependencies.redis.ok).toBe(true);
  });

  it('healthy=false quando Redis indisponível', async () => {
    (RedisManager.getInstance as jest.Mock).mockReturnValue({
      healthCheck: jest.fn().mockResolvedValue(false),
    });
    const snap = await buildInfraHealthSnapshot();
    expect(snap.healthy).toBe(false);
    expect(snap.dependencies.redis.ok).toBe(false);
  });

  it('queues ok=false não derruba healthy se Mongo+Redis OK', async () => {
    (QueueManager.getInstance as jest.Mock).mockReturnValue({
      healthCheck: jest.fn().mockResolvedValue({ healthy: false, details: {} }),
    });
    const snap = await buildInfraHealthSnapshot();
    expect(snap.healthy).toBe(true);
    expect(snap.dependencies.queues.ok).toBe(false);
  });
});

describe('toPublicLivenessHealth (AH-R07)', () => {
  it('remove nodeEnv e dependencies do payload público', async () => {
    const snap = await buildInfraHealthSnapshot();
    const pub = toPublicLivenessHealth(snap);
    expect(pub.healthy).toBe(snap.healthy);
    expect(pub.uptime).toBe(snap.uptime);
    expect(pub.version).toBe(snap.version);
    expect(pub).not.toHaveProperty('nodeEnv');
    expect(pub).not.toHaveProperty('dependencies');
  });
});
