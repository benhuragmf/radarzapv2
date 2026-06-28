import { FetchTimeoutError, fetchWithTimeout } from '../fetch-with-timeout';

describe('fetchWithTimeout (AH-S03)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('propaga resposta quando fetch completa a tempo', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const res = await fetchWithTimeout('https://example.com', { timeoutMs: 5000 });
    expect(res.status).toBe(200);
  });

  it('lança FetchTimeoutError quando excede timeout', async () => {
    global.fetch = jest.fn((_url, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    await expect(fetchWithTimeout('https://example.com', { timeoutMs: 50 })).rejects.toBeInstanceOf(
      FetchTimeoutError,
    );
  });
});
