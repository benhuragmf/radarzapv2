import net from 'net';

import { RedisManager } from '@/cache/RedisManager';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('DevInstanceLock');
const LOCK_KEY = 'radarzap:dev:instance-lock';
const LOCK_TTL_SEC = 86_400;
const RESTART_WAIT_MS = 6_000;

type DevLock = {
  pid: number;
  port?: number;
  cwd?: string;
  startedAt?: string;
};

let exitHandlersRegistered = false;

function isDevProcess(): boolean {
  return (
    process.env.npm_lifecycle_event === 'dev' ||
    process.env.RADARZAP_DEV === '1' ||
    process.env.NODE_ENV === 'development'
  );
}

function parseLock(raw: string | null): DevLock | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as DevLock;
    if (typeof data.pid === 'number') return data;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPidExit(pid: number, maxMs: number): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return true;
    await sleep(200);
  }
  return !isPidAlive(pid);
}

function isPortListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: NodeJS.ErrnoException) => {
      resolve(err.code === 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '127.0.0.1');
  });
}

function registerDevLockExitHandlers(): void {
  if (exitHandlersRegistered || !isDevProcess()) return;
  exitHandlersRegistered = true;

  const releaseOnSignal = (signal: string) => {
    logger.info(`Sinal ${signal} — liberando lock dev`);
    void releaseDevInstanceLock();
  };

  process.once('SIGTERM', () => releaseOnSignal('SIGTERM'));
  process.once('SIGINT', () => releaseOnSignal('SIGINT'));
  process.once('SIGUSR2', () => releaseOnSignal('SIGUSR2'));
}

function isSameDevProject(existing: DevLock): boolean {
  if (!existing.cwd) return true;
  return existing.cwd === process.cwd();
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
    if (isSameDevProject(existing)) {
      logger.warn('Aguardando encerramento do processo anterior (restart dev)...', {
        stalePid: existing.pid,
        thisPid: process.pid,
      });
      const gone = await waitForPidExit(existing.pid, RESTART_WAIT_MS);
      if (!gone) {
        const portBusy = await isPortListening(existing.port ?? apiPort);
        if (portBusy) {
          logger.error(
            'Já existe outro RadarZap rodando nesta máquina. Feche o outro terminal ou execute: npm run dev:stop',
            { otherPid: existing.pid, otherPort: existing.port, thisPid: process.pid }
          );
          const msg =
            `RadarZap já em execução (PID ${existing.pid}, porta ${existing.port ?? '?'}). ` +
            'Não é permitido duas instâncias em dev. Feche o outro terminal ou execute: npm run dev:stop';
          throw new Error(msg);
        }
        logger.warn('PID anterior ainda vivo mas porta livre — substituindo lock', {
          stalePid: existing.pid,
          thisPid: process.pid,
        });
      }
    } else {
      logger.error(
        'Já existe outro RadarZap rodando nesta máquina. Feche o outro terminal ou execute: npm run dev:stop',
        { otherPid: existing.pid, otherPort: existing.port, thisPid: process.pid }
      );
      const msg =
        `RadarZap já em execução (PID ${existing.pid}, porta ${existing.port ?? '?'}). ` +
        'Não é permitido duas instâncias em dev. Feche o outro terminal ou execute: npm run dev:stop';
      throw new Error(msg);
    }
  }

  if (existing && existing.pid !== process.pid && !isPidAlive(existing.pid)) {
    logger.warn('Lock dev órfão (processo encerrado) — substituindo', {
      stalePid: existing.pid,
      thisPid: process.pid,
    });
  }

  await redis.setWithTTL(LOCK_KEY, payload, LOCK_TTL_SEC);
  registerDevLockExitHandlers();
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
