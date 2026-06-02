import { DatabaseManager } from '@/database/DatabaseManager';
import { Template } from '@/models/Template';

const templates = [
  {
    name: 'radarzap-live',
    // streamer = embed.author.name (ex: "skulksgamer")
    // titulo   = embed.title (ex: "Fizemos TUDO errado... || ENDLESS Space 2 #04")
    // descricao = embed.description (ex: "O SkulksGamer está jogando PUBG")
    // link     = embed.url (ex: "https://twitch.tv/skulksgamer")
    content: `🔴 *{streamer} está ao vivo!*

📺 {titulo}

{descricao}

🔗 {link}

_Ao vivo agora • {hora}_`,
  },
  {
    name: 'radarzap-video',
    content: `▶️ *Novo vídeo de {streamer}!*

📹 {titulo}

{descricao}

🔗 {link}

_Publicado em {data}_`,
  },
  {
    name: 'radarzap-jogo',
    content: `🎮 *{titulo}*

{descricao}

🔗 {link}

_Via {canal} • {data}_`,
  },
];

async function main() {
  await DatabaseManager.getInstance().connect();
  for (const t of templates) {
    const existing = await Template.findOne({ name: t.name });
    if (existing) {
      existing.content = t.content;
      await existing.save();
      console.log(`✅ Updated: ${t.name}`);
    }
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
