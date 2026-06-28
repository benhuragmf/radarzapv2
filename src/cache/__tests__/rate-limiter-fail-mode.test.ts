/** Testes AH-S02 — fail-closed em produção quando Redis indisponível */

jest.mock('@/cache/RedisManager', () => ({
  RedisManager: {
    getInstance: () => ({
      evalScript: jest.fn().mockRejectedValue(new Error('Redis down')),
    }),
  },
}));

describe('RateLimiter fail mode (AH-S02)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  async function loadLimiter(failOpen: boolean) {
    process.env.RATE_LIMIT_FAIL_OPEN = failOpen ? 'true' : 'false';
    const { RateLimiter } = await import('@/cache/RateLimiter');
    return RateLimiter.getInstance();
  }

  it('fail-open quando RATE_LIMIT_FAIL_OPEN=true', async () => {
    const limiter = await loadLimiter(true);
    const result = await limiter.checkRateLimit('test:key', 10, 10);
    expect(result.allowed).toBe(true);
  });

  it('fail-closed quando RATE_LIMIT_FAIL_OPEN=false', async () => {
    const limiter = await loadLimiter(false);
    const result = await limiter.checkRateLimit('test:key', 10, 10);
    expect(result.allowed).toBe(false);
    expect(result.tokensRemaining).toBe(0);
  });
});
