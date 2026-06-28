/**
 * AH-R02 — helpers para isolar jobs BullMQ por tenant (clientId no payload).
 */

export function extractJobClientId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const raw = (data as Record<string, unknown>).clientId;
  if (raw == null) return undefined;
  const s = String(raw).trim();
  return s.length > 0 ? s : undefined;
}

export type SanitizedFailedJob = {
  id: string;
  queue: string;
  name: string;
  failedReason?: string;
  timestamp?: number;
  /** Somente staff global — nunca payload bruto */
  clientId?: string;
};

export function sanitizeFailedJob(
  job: {
    id?: string | number;
    name: string;
    failedReason?: string;
    timestamp?: number;
    data?: unknown;
  },
  queueName: string,
  opts: { includeClientId: boolean },
): SanitizedFailedJob {
  const clientId = extractJobClientId(job.data);
  return {
    id: String(job.id),
    queue: queueName,
    name: job.name,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
    ...(opts.includeClientId && clientId ? { clientId } : {}),
  };
}

export function jobBelongsToClient(data: unknown, clientId: string): boolean {
  const jobClient = extractJobClientId(data);
  if (!jobClient) return false;
  return jobClient === clientId;
}
