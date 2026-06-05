/**
 * Remove o lock dev do Redis após npm run dev:stop (taskkill não dispara graceful shutdown).
 * Não use manualmente para contornar uma segunda instância — use dev:stop.
 */
require('dotenv').config();

const Redis = require('ioredis');

const LOCK_KEY = 'radarzap:dev:instance-lock';
const url = process.env.REDIS_URL || 'redis://localhost:6380';

async function main() {
  const redis = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
  try {
    const removed = await redis.del(LOCK_KEY);
    console.log(removed ? 'Lock dev removido do Redis.' : 'Nenhum lock dev no Redis.');
  } catch (err) {
    console.warn('Redis indisponível — lock pode expirar sozinho:', err.message);
  } finally {
    redis.disconnect();
  }
}

main();
