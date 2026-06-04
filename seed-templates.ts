/**
 * Sincroniza templates Discord → WhatsApp (dw-*) no MongoDB.
 * Uso: npm run seed:templates
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { DISCORD_WHATSAPP_TEMPLATES } from './src/constants/discord-whatsapp-templates';

const MONGODB_URL =
  process.env.MONGODB_URL ||
  'mongodb://localhost:27017/discord-whatsapp';

async function main() {
  await mongoose.connect(MONGODB_URL);
  console.log('Sincronizando templates Discord → WhatsApp…');

  const col = mongoose.connection.collection('templates');

  for (const def of DISCORD_WHATSAPP_TEMPLATES) {
    const variables = [...new Set(def.variables)];
    const result = await col.updateOne(
      { name: def.name, clientId: null },
      {
        $set: {
          name: def.name,
          content: def.content,
          description: def.description,
          discordKind: def.discordKind,
          variables,
          isDefault: true,
          clientId: null,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          usage: { timesUsed: 0, lastUsed: new Date() },
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    const tag = result.upsertedCount ? '+' : '~';
    console.log(`  ${tag} ${def.name}`);
  }

  console.log(`Concluído: ${DISCORD_WHATSAPP_TEMPLATES.length} templates.`);
  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
