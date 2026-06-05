/** Intervalo do planejador de regras recorrentes (pré-enfileira na fila de campanhas). */
export const AUTOMATION_RECURRING_PLAN_MS = 5 * 60 * 1000;

/** Intervalo para envios únicos / iminentes (ex.: automação daqui 5 min). */
export const AUTOMATION_IMMINENT_PLAN_MS = 60 * 1000;

export const QUEUED_RUN_PREFIX = {
  recurring: 'rec:',
  once: 'once:',
} as const;

export function parseQueuedRunKey(key?: string): { kind: 'recurring' | 'once' | 'legacy'; raw: string } | null {
  if (!key?.trim()) return null;
  if (key.startsWith(QUEUED_RUN_PREFIX.recurring)) {
    return { kind: 'recurring', raw: key.slice(QUEUED_RUN_PREFIX.recurring.length) };
  }
  if (key.startsWith(QUEUED_RUN_PREFIX.once)) {
    return { kind: 'once', raw: key.slice(QUEUED_RUN_PREFIX.once.length) };
  }
  return { kind: 'legacy', raw: key };
}
