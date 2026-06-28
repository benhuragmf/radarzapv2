import { RedisManager } from '@/cache/RedisManager';
import { acquireBridgeForwardDedup } from '../bridge-forward-dedup.service';

jest.mock('@/cache/RedisManager');

describe('bridge-forward-dedup.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('usa Redis SET NX quando conectado — primeira vez OK', async () => {
    const key = 'org-a:conv-a:msg-a';
    const setIfNotExists = jest.fn().mockResolvedValue(true);
    (RedisManager.getInstance as jest.Mock).mockReturnValue({
      isConnected: () => true,
      setIfNotExists,
    });

    await expect(acquireBridgeForwardDedup(key, 1000)).resolves.toBe(true);
    expect(setIfNotExists).toHaveBeenCalledTimes(1);
    expect(setIfNotExists.mock.calls[0][0]).toMatch(/^rz:bridge:fwd:/);
    expect(setIfNotExists.mock.calls[0][2]).toBeGreaterThanOrEqual(8);
  });

  it('Redis SET NX falha → duplicata bloqueada', async () => {
    const key = 'org-b:conv-b:msg-b';
    (RedisManager.getInstance as jest.Mock).mockReturnValue({
      isConnected: () => true,
      setIfNotExists: jest.fn().mockResolvedValue(false),
    });

    await expect(acquireBridgeForwardDedup(key, 1000)).resolves.toBe(false);
  });

  it('Redis indisponível → fallback in-memory', async () => {
    const key = 'org-c:conv-c:msg-c';
    (RedisManager.getInstance as jest.Mock).mockReturnValue({
      isConnected: () => false,
    });

    await expect(acquireBridgeForwardDedup(key, 1000)).resolves.toBe(true);
    await expect(acquireBridgeForwardDedup(key, 2000)).resolves.toBe(false);
  });
});
