export class FetchTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Timeout após ${timeoutMs}ms`);
    this.name = 'FetchTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export type FetchWithTimeoutInit = RequestInit & { timeoutMs?: number };

/**
 * fetch com AbortSignal — evita workers IA travados indefinidamente (AH-S03).
 */
export async function fetchWithTimeout(
  input: string | URL,
  init: FetchWithTimeoutInit = {},
): Promise<Response> {
  const { timeoutMs = 30_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FetchTimeoutError(timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
