import net from 'net';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { RedisManager } from '@/cache/RedisManager';
import { createServiceLogger } from '@/utils/logger';

const execFileAsync = promisify(execFile);

const logger = createServiceLogger('DevInstanceLock');
const LOCK_KEY = 'radarzap:dev:instance-lock';
const LOCK_TTL_SEC = 86_400;
const RESTART_WAIT_MS = 15_000;
const POST_KILL_SETTLE_MS = 2_500;

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

/** Encerra processo dev órfão (ex.: ts-node-dev após hot-reload sem fechar WA). */
async function terminateStaleProcess(pid: number): Promise<void> {
  if (!isPidAlive(pid)) return;
  try {
    if (process.platform === 'win32') {
      await execFileAsync('taskkill', ['/F', '/PID', String(pid), '/T']);
    } else {
      process.kill(pid, 'SIGTERM');
      const gone = await waitForPidExit(pid, 5_000);
      if (!gone && isPidAlive(pid)) {
        process.kill(pid, 'SIGKILL');
      }
    }
  } catch {
    /* processo já encerrado */
  }
  await waitForPidExit(pid, 8_000);
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

/** Mata processo que segura a porta da API (ex.: node órfão após hot-reload). */
async function freeDevApiPort(apiPort: number, ownerPid: number): Promise<void> {
  const busy = await isPortListening(apiPort);
  if (!busy) return;

  const foreignPids = new Set<number>();
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('netstat', ['-ano']);
      for (const line of stdout.split('\n')) {
        if (!line.includes('LISTENING') || !line.includes(`:${apiPort}`)) continue;
        const pid = parseInt(line.trim().split(/\s+/).pop() ?? '', 10);
        if (!Number.isNaN(pid) && pid > 0 && pid !== ownerPid) foreignPids.add(pid);
      }
    }
  } catch {
    /* netstat indisponível */
  }

  if (foreignPids.size === 0) {
    logger.warn(`Porta ${apiPort} ocupada mas PID não identificado — execute: npm run dev:stop`);
    return;
  }

  for (const pid of foreignPids) {
    logger.warn(`Liberando porta ${apiPort} — encerrando PID ${pid}`, { ownerPid });
    await terminateStaleProcess(pid);
  }

  const stillBusy = await isPortListening(apiPort);
  if (stillBusy) {
    throw new Error(
      `Porta ${apiPort} ainda em uso (API do painel). Execute: npm run dev:stop`,
    );
  }
}

/** Lock dev é liberado só no GracefulShutdown — handlers aqui causavam 440 no hot-reload. */
function registerDevLockExitHandlers(): void {
  if (exitHandlersRegistered || !isDevProcess()) return;
  exitHandlersRegistered = true;
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
        logger.warn('PID anterior ainda vivo mas porta livre — encerrando processo órfão (evita WA 440)', {
          stalePid: existing.pid,
          thisPid: process.pid,
        });
        await terminateStaleProcess(existing.pid);
        await sleep(POST_KILL_SETTLE_MS);
        const goneAfterKill = await waitForPidExit(existing.pid, 8_000);
        if (!goneAfterKill) {
          logger.error(
            'Não foi possível encerrar o processo anterior. Execute: npm run dev:stop',
            { stalePid: existing.pid, thisPid: process.pid },
          );
          throw new Error(
            `Processo RadarZap anterior (PID ${existing.pid}) ainda ativo — causa desconexão WhatsApp (440). ` +
              'Execute: npm run dev:stop',
          );
        }
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
  await freeDevApiPort(apiPort, process.pid);
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
