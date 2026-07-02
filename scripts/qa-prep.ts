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
import { LeadForm } from '@/models/LeadForm';
import { CompanyMember } from '@/models/CompanyMember';

const MONGODB_URL =
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/discord-whatsapp';

function maskUrl(url: string): string {
  return url.replace(/\/\/([^@/]+)@/, '//***@');
}

async function main() {
  console.log('=== Radar Chat — QA Fase 1: pré-requisitos ===\n');

  try {
    await mongoose.connect(MONGODB_URL);
    console.log(`MongoDB: conectado (${maskUrl(MONGODB_URL)})`);
  } catch (e) {
    console.error('MongoDB: falha na conexão —', (e as Error).message);
    process.exit(1);
  }

  const [activeSessions, csatOrgs, totalSettings, activeWidgets, fallbackOrgs, agentsWithWa, activeLeadForms] =
    await Promise.all([
    WhatsAppSession.countDocuments({ status: 'active' }),
    InboxSettings.countDocuments({ csatEnabled: true }),
    InboxSettings.countDocuments(),
    WebChatWidget.countDocuments({ active: true }),
    InboxSettings.countDocuments({ whatsappFallbackEnabled: true }),
    CompanyMember.countDocuments({
      isActive: true,
      whatsappPhone: { $exists: true, $nin: [null, ''] },
    }),
    LeadForm.countDocuments({ active: true }),
  ]);

  const checks: Array<{ ok: boolean; label: string; hint?: string; optional?: boolean }> = [
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
    {
      ok: fallbackOrgs > 0,
      label: `Fallback WhatsApp habilitado: ${fallbackOrgs}/${totalSettings} org(s)`,
      hint: 'Ative em /platform/inbox/bot → Chat do site — fallback WhatsApp (QA § C)',
      optional: true,
    },
    {
      ok: agentsWithWa > 0,
      label: `Membros com WhatsApp em Equipe: ${agentsWithWa}`,
      hint: 'Cadastre WhatsApp pessoal em Configurações → Equipe (comandos !assumir)',
      optional: true,
    },
    {
      ok: activeLeadForms > 0,
      label: `Formulários Leads ativos: ${activeLeadForms}`,
      hint: 'Crie em /platform/leads ou rode npm run qa:leads:setup (QA § B.1)',
      optional: true,
    },
  ];

  let blockers = 0;
  for (const c of checks) {
    const icon = c.ok ? '✓' : '✗';
    console.log(`${icon} ${c.label}`);
    if (!c.ok && c.hint) console.log(`  → ${c.hint}`);
    if (!c.ok && !c.optional && (c.label.includes('WhatsApp ativa') || c.label.includes('CSAT'))) {
      blockers++;
    }
  }

  console.log(
    '\nDocs: docs/RADARCHAT-QA-HUMANO-REAL-CHECKLIST-COMPLETO-2.17.61.md (master) · docs/RADARCHAT-EXTRAIDOS-LEGACY-2.17.61.md · legacy/QA-FASE1-ROTEIRO.md · legacy/QA-WEBCHAT-WA-FALLBACK-BRIDGE.md',
  );

  await mongoose.disconnect();
  process.exit(blockers > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
