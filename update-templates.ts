/**
 * Atualiza templates legados radarzap-* no Mongo (conteúdo do v1).
 * Uso: npm run update:templates
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Template } from './src/models/Template';

const MONGODB_URL =
  process.env.MONGODB_URL ||
  'mongodb://localhost:27017/discord-whatsapp';

/** Conteúdo alinhado ao v1 — variáveis preenchidas por buildDiscordWhatsAppVariables */
const LEGACY_UPDATES = [
  {
    name: 'radarzap-live',
    content: `🔴 *{streamer} está ao vivo!*

{descricao}

{link_bloco}

_{rodape}_`,
  },
  {
    name: 'radarzap-video',
    content: `▶️ *Novo vídeo* — {plataforma}

*{titulo}*

{descricao}

{link_bloco}

_{rodape}_`,
  },
  {
    name: 'radarzap-jogo',
    content: `🎮 *{titulo}*

{descricao}

{link_bloco}

_{rodape}_`,
  },
  {
    name: 'radarzap-com-embed',
    content: `📰 *{embed_titulo}*

{descricao}

{link_bloco}

_{rodape}_`,
  },
];

async function main() {
  await mongoose.connect(MONGODB_URL);
  for (const t of LEGACY_UPDATES) {
    const existing = await Template.findOne({ name: t.name, clientId: null });
    if (existing) {
      existing.content = t.content;
      await existing.save();
      console.log(`~ ${t.name}`);
    } else {
      console.log(`  (skip) ${t.name} — não existe no Mongo`);
    }
  }
  console.log('Concluído.');
  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
