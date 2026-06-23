/**
 * Prepara QA manual § B.1 — formulário de Leads embed.
 *
 * Uso:
 *   npm run qa:leads:setup
 *
 * Requer MongoDB + backend (`npm run dev`) para abrir a preview.
 */
import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import mongoose from 'mongoose';
import { LeadForm } from '@/models/LeadForm';
import { Organization } from '@/models/Organization';

const MONGODB_URL =
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/discord-whatsapp';

const DASHBOARD_PORT = Number(process.env.DASHBOARD_PORT || 3001);
const PREVIEW_HOSTS = ['localhost', '127.0.0.1'];

function previewBaseUrl(): string {
  const explicit = process.env.DASHBOARD_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  return `http://localhost:${DASHBOARD_PORT}`;
}

function panelLeadsUrl(): string {
  const panel = process.env.PANEL_PUBLIC_URL?.trim();
  if (panel) return `${panel.replace(/\/$/, '')}/platform/leads`;
  const vitePort = process.env.VITE_DEV_PORT || '5174';
  return `http://localhost:${vitePort}/platform/leads`;
}

async function ensureLocalhostAllowed(form: typeof LeadForm.prototype): Promise<void> {
  const current = [...(form.allowedDomains ?? [])];
  let changed = false;
  for (const h of PREVIEW_HOSTS) {
    if (!current.includes(h)) {
      current.push(h);
      changed = true;
    }
  }
  if (changed) {
    form.allowedDomains = current;
    await form.save();
  }
}

async function main() {
  console.log('=== RadarZap — QA Leads (formulário embed) ===\n');

  await mongoose.connect(MONGODB_URL);

  let form = await LeadForm.findOne({ active: true }).sort({ updatedAt: -1 });

  if (!form) {
    const org = await Organization.findOne().sort({ createdAt: 1 });
    if (!org) {
      console.error('Nenhuma organização no banco — faça login no painel primeiro.');
      await mongoose.disconnect();
      process.exit(1);
    }
    form = await LeadForm.create({
      clientId: org._id,
      name: 'Formulário QA Fase 1',
      publicKey: `lfm_${crypto.randomBytes(16).toString('hex')}`,
      active: true,
      allowedDomains: [...PREVIEW_HOSTS],
    });
    console.log('✓ Formulário de teste criado (nenhum ativo encontrado)\n');
  } else {
    await ensureLocalhostAllowed(form);
    console.log(`✓ Formulário ativo: ${form.name}\n`);
  }

  const base = previewBaseUrl();
  const previewUrl = `${base}/leads/preview.html?key=${encodeURIComponent(form.publicKey)}`;

  console.log(`Chave pública: ${form.publicKey}`);
  console.log(`Preview QA:    ${previewUrl}`);
  console.log(`Painel Leads:  ${panelLeadsUrl()}`);
  console.log('\nChecklist: docs/QA-FASE1-RAPIDO.md § B.1');
  console.log('Requisitos: npm run dev (backend) — a preview é servida pelo dashboard API.\n');

  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
