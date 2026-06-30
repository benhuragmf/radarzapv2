/**
 * Remove locks dev após npm run dev:stop (taskkill não dispara graceful shutdown).
 * Não use manualmente para contornar uma segunda instância — use dev:stop.
 */
require('dotenv').config();

const Redis = require('ioredis');

const DEV_LOCK_KEY = 'radarchat:dev:instance-lock';
const WA_LOCK_PREFIX = 'radarchat:wa:socket-lock:';
const url = process.env.REDIS_URL || 'redis://localhost:6380';

async function main() {
  const redis = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
  try {
    const removedDev = await redis.del(DEV_LOCK_KEY);
    console.log(removedDev ? 'Lock dev removido do Redis.' : 'Nenhum lock dev no Redis.');

    let cursor = '0';
    let waRemoved = 0;
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${WA_LOCK_PREFIX}*`, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) {
        waRemoved += await redis.del(...keys);
      }
    } while (cursor !== '0');

    console.log(
      waRemoved > 0
        ? `${waRemoved} lock(s) WhatsApp removido(s) do Redis.`
        : 'Nenhum lock WhatsApp no Redis.',
    );
  } catch (err) {
    console.warn('Redis indisponível — locks podem expirar sozinho:', err.message);
  } finally {
    redis.disconnect();
  }
}

main();
