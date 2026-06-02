import { DatabaseManager } from '@/database/DatabaseManager';
import { Template } from '@/models/Template';

const templates = [
  { name: 'radarzap-padrao',  content: '📢 *{canal}* — {servidor}\n\n{mensagem}\n\n🔗 {link}\n\n_Enviado em {data} às {hora}_' },
  { name: 'radarzap-jogo',    content: '🎮 *Jogo encontrado!*\n\n{mensagem}\n\n🔗 {link}\n\n_Via {canal} • {data}_' },
  { name: 'radarzap-live',    content: '🔴 *Live ao vivo!*\n\n{mensagem}\n\n🔗 {link}\n\n_Por {autor} em {canal}_' },
  { name: 'radarzap-link',    content: '🔗 *{canal}*\n\n{mensagem}\n\n{link}\n\n_{data} às {hora}_' },
  { name: 'radarzap-simples', content: '{mensagem}' },
  { name: 'radarzap-alerta',  content: '🚨 *ALERTA — {canal}*\n\n{mensagem}\n\n_Por {autor} em {data} às {hora}_' },
];

async function main() {
  await DatabaseManager.getInstance().connect();

  for (const t of templates) {
    const existing = await Template.findOne({ name: t.name });
    if (!existing) {
      await Template.createTemplate(t.name, t.content, undefined, true);
      console.log(`✅ Created: ${t.name}`);
    } else {
      console.log(`⏭  Already exists: ${t.name}`);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
