/**
 * Limpa filas Bull, deduplicação Redis e mensagens pendentes no Mongo — para testar do zero.
 * Uso: npm run clear:test
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Queue } from 'bullmq';
import { config } from '../src/config/environment';

const MONGODB_URL =
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/discord-whatsapp';

const QUEUE_NAMES = [
  'message-processing',
  'whatsapp-sending',
  'whatsapp-connection',
  'discord-notifications',
  'discord-monitoring',
  'session-cleanup',
  'rate-limiting',
  'notifications',
];

function bullConnection() {
  const url = config.REDIS.URL;
  if (url.includes('://')) {
    const parsed = new URL(
      url.replace(/^rediss?:\/\//, m => (m === 'rediss://' ? 'https://' : 'http://'))
    );
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 6379,
      password: parsed.password ? decodeURIComponent(parsed.password) : config.REDIS.PASSWORD,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      tls: url.startsWith('rediss://') ? {} : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }
  return {
    host: url || '127.0.0.1',
    port: 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

async function clearRedisDedup(): Promise<number> {
  const Redis = (await import('ioredis')).default;
  const client = new Redis(config.REDIS.URL);
  const patterns = ['dedup:*', 'wa-content:*'];
  let removed = 0;

  for (const pattern of patterns) {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      removed += await client.del(...keys);
    }
    console.log(`  Redis ${pattern}: ${keys.length} chave(s)`);
  }

  await client.quit();
  return removed;
}

async function cleanFailedWhatsAppJobs(): Promise<void> {
  const connection = bullConnection();
  const prefix = config.QUEUE.REDIS_KEY_PREFIX;
  const q = new Queue('whatsapp-sending', { connection, prefix });
  const failed = await q.getJobs(['failed'], 0, 500);
  for (const j of failed) {
    await j.remove();
  }
  console.log(`  whatsapp-sending failed removidos: ${failed.length}`);
  await q.close();
}

async function clearBullQueues(): Promise<void> {
  const connection = bullConnection();
  const prefix = config.QUEUE.REDIS_KEY_PREFIX;

  for (const name of QUEUE_NAMES) {
    const queue = new Queue(name, { connection, prefix });
    try {
      await queue.obliterate({ force: true });
      console.log(`  Fila ${name}: limpa`);
    } catch (e) {
      console.log(`  Fila ${name}: (vazia ou inexistente)`);
    } finally {
      await queue.close();
    }
  }
}

async function clearMongoPending(): Promise<number> {
  await mongoose.connect(MONGODB_URL);
  const col = mongoose.connection.collection('messagequeues');
  const result = await col.deleteMany({
    status: { $in: ['pending', 'processing', 'scheduled'] },
  });
  await mongoose.disconnect();
  return result.deletedCount ?? 0;
}

async function main() {
  const wipeQueues = process.argv.includes('--queues');

  console.log('Limpando estado de teste…\n');
  if (wipeQueues) {
    console.log(
      '⚠️  Com --queues: pare o "npm run dev" ANTES ou reinicie DEPOIS.\n' +
        '   Esvaziar filas com o servidor ligado trava o envio ao WhatsApp.\n'
    );
  }

  console.log('Redis (dedup / wa-content):');
  const redisRemoved = await clearRedisDedup();
  console.log(`  Total removido: ${redisRemoved}\n`);

  if (wipeQueues) {
    console.log('Filas Bull (--queues):');
    await clearBullQueues();
    console.log('');
  } else {
    console.log('Filas Bull: removendo só jobs failed de whatsapp-sending…');
    await cleanFailedWhatsAppJobs();
    console.log('');
  }

  console.log('Mongo (messagequeues pendentes):');
  const mongoRemoved = await clearMongoPending();
  console.log(`  Removidos: ${mongoRemoved}\n`);

  console.log('Pronto — reinicie npm run dev se usou --queues, depois teste no #live-on.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
