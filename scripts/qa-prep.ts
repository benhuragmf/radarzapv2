/**
 * Verifica pré-requisitos para QA manual Fase 1 (estabilização).
 * Uso: npm run qa:prep
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { InboxSettings } from '@/models/InboxSettings';
import { WhatsAppSession } from '@/models/WhatsAppSession';
import { WebChatWidget } from '@/models/WebChatWidget';

const MONGODB_URL =
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/discord-whatsapp';

function maskUrl(url: string): string {
  return url.replace(/\/\/([^@/]+)@/, '//***@');
}

async function main() {
  console.log('=== RadarZap — QA Fase 1: pré-requisitos ===\n');

  try {
    await mongoose.connect(MONGODB_URL);
    console.log(`MongoDB: conectado (${maskUrl(MONGODB_URL)})`);
  } catch (e) {
    console.error('MongoDB: falha na conexão —', (e as Error).message);
    process.exit(1);
  }

  const [activeSessions, csatOrgs, totalSettings, activeWidgets] = await Promise.all([
    WhatsAppSession.countDocuments({ status: 'active' }),
    InboxSettings.countDocuments({ csatEnabled: true }),
    InboxSettings.countDocuments(),
    WebChatWidget.countDocuments({ active: true }),
  ]);

  const checks: Array<{ ok: boolean; label: string; hint?: string }> = [
    {
      ok: activeSessions > 0,
      label: `Sessão WhatsApp ativa: ${activeSessions}`,
      hint: 'Conecte em /sessions antes do roteiro § A',
    },
    {
      ok: csatOrgs > 0,
      label: `CSAT habilitado: ${csatOrgs}/${totalSettings} org(s)`,
      hint: 'Ative em /platform/inbox/bot → Pesquisa de satisfação',
    },
    {
      ok: activeWidgets > 0,
      label: `Widgets WebChat ativos: ${activeWidgets}`,
      hint: 'Opcional para § C — crie em /platform/webchat',
    },
  ];

  let blockers = 0;
  for (const c of checks) {
    const icon = c.ok ? '✓' : '✗';
    console.log(`${icon} ${c.label}`);
    if (!c.ok && c.hint) console.log(`  → ${c.hint}`);
    if (!c.ok && (c.label.includes('WhatsApp') || c.label.includes('CSAT'))) blockers++;
  }

  console.log('\nDocs: docs/QA-FASE1-ROTEIRO.md (passo a passo) · docs/QA-FASE1-CHECKLIST.md (marcar OK/fail)');

  await mongoose.disconnect();
  process.exit(blockers > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
