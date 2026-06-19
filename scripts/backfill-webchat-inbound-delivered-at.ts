/**
 * Backfill deliveredAt em mensagens inbound antigas (pré-2.10.86).
 * Uso: npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/backfill-webchat-inbound-delivered-at.ts
 */
import mongoose from 'mongoose';
import { config } from '@/config/environment';
import { WebChatMessage } from '@/models/WebChatMessage';

async function main(): Promise<void> {
  await mongoose.connect(config.DATABASE.MONGODB_URL);
  const filter = {
    direction: 'inbound' as const,
    deliveredAt: { $exists: false },
  };
  const pending = await WebChatMessage.countDocuments(filter);
  if (!pending) {
    console.log('Nenhuma mensagem inbound sem deliveredAt.');
    await mongoose.disconnect();
    return;
  }

  const result = await WebChatMessage.updateMany(filter, [
    { $set: { deliveredAt: '$createdAt' } },
  ]);

  console.log(`Backfill concluído: ${result.modifiedCount}/${pending} mensagens inbound.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
