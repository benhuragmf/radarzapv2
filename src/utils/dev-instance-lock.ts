import { RedisManager } from '@/cache/RedisManager';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('DevInstanceLock');
const LOCK_KEY = 'radarzap:dev:instance-lock';
const LOCK_TTL_SEC = 86_400;

function isDevProcess(): boolean {
  return (
    process.env.npm_lifecycle_event === 'dev' ||
    process.env.RADARZAP_DEV === '1' ||
    process.env.NODE_ENV === 'development'
  );
}

function parseLock(raw: string | null): { pid: number; port?: number } | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { pid?: number; port?: number };
    if (typeof data.pid === 'number') return { pid: data.pid, port: data.port };
  } catch {
    const pid = parseInt(raw, 10);
    if (!Number.isNaN(pid)) return { pid };
  }
  return null;
}

/** Windows: verifica se o PID ainda existe. */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code !== 'ESRCH';
  }
}

/**
 * Em dev, só uma instância do backend (Discord + filas + WhatsApp) por máquina.
 * Evita envios duplicados/incompletos com dois `npm run dev`.
 */
export async function acquireDevInstanceLock(apiPort: number): Promise<void> {
  if (!isDevProcess()) return;

  const redis = RedisManager.getInstance();
  const payload = JSON.stringify({
    pid: process.pid,
    port: apiPort,
    startedAt: new Date().toISOString(),
    cwd: process.cwd(),
  });

  const existingRaw = await redis.get(LOCK_KEY);
  const existing = parseLock(existingRaw);
  if (existing && existing.pid !== process.pid && isPidAlive(existing.pid)) {
    logger.error(
      'Já existe outro RadarZap rodando nesta máquina. Feche o outro terminal ou execute: npm run dev:stop',
      { otherPid: existing.pid, otherPort: existing.port, thisPid: process.pid }
    );
    const msg =
      `RadarZap já em execução (PID ${existing.pid}, porta ${existing.port ?? '?'}). ` +
      'Não é permitido duas instâncias em dev. Feche o outro terminal ou execute: npm run dev:stop';
    throw new Error(msg);
  }

  if (existing && existing.pid !== process.pid && !isPidAlive(existing.pid)) {
    logger.warn('Lock dev órfão (processo encerrado) — substituindo', {
      stalePid: existing.pid,
      thisPid: process.pid,
    });
  }

  await redis.setWithTTL(LOCK_KEY, payload, LOCK_TTL_SEC);
  logger.info('Lock de instância dev adquirido', { pid: process.pid, port: apiPort });
}

export async function releaseDevInstanceLock(): Promise<void> {
  if (!isDevProcess()) return;
  try {
    const redis = RedisManager.getInstance();
    const raw = await redis.get(LOCK_KEY);
    const lock = parseLock(raw);
    if (!lock || lock.pid === process.pid) {
      await redis.deleteKey(LOCK_KEY);
    }
  } catch {
    /* ignore */
  }
}
