/**
 * Sincroniza templates Plataforma → WhatsApp (pw-*) no MongoDB.
 * Uso: npm run seed:platform-templates
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { PLATFORM_WHATSAPP_TEMPLATES } from './src/constants/platform-whatsapp-templates';

const MONGODB_URL =
  process.env.MONGODB_URL ||
  'mongodb://localhost:27017/discord-whatsapp';

async function main() {
  await mongoose.connect(MONGODB_URL);
  console.log('Sincronizando templates Plataforma → WhatsApp…');

  const col = mongoose.connection.collection('platformTemplates');

  for (const def of PLATFORM_WHATSAPP_TEMPLATES) {
    const category =
      def.platformKind === 'auto' ? 'informative' : def.platformKind;
    const variables = [...new Set(def.variables)];
    const result = await col.updateOne(
      { name: def.name, clientId: null },
      {
        $set: {
          name: def.name,
          content: def.content,
          description: def.description,
          category,
          variables,
          isDefault: true,
          clientId: null,
          organizationId: null,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          usage: { timesUsed: 0, lastUsed: new Date() },
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    const tag = result.upsertedCount ? '+' : '~';
    console.log(`  ${tag} ${def.name}`);
  }

  console.log(`Concluído: ${PLATFORM_WHATSAPP_TEMPLATES.length} templates.`);
  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
