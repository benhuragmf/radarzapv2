/**
 * Prepara ambiente dev para QA manual WebChat + fallback/bridge WhatsApp.
 *
 * Uso:
 *   QA_WA_PHONE=5511999999999 npm run qa:webchat-wa:setup
 *   npm run qa:webchat-wa:setup -- 5511999999999
 *
 * Opcional: QA_WA_ALERT_PHONES=5511...,120363...@g.us (vírgula ou quebra de linha)
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { InboxSettings } from '@/models/InboxSettings';
import { WebChatWidget } from '@/models/WebChatWidget';
import { CompanyMember } from '@/models/CompanyMember';
import { CompanyRole } from '@/auth/rbac/roles';

const MONGODB_URL =
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/discord-whatsapp';

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 20);
}

function parsePhones(): { agentPhone: string; alertPhones: string[] } | null {
  const fromArg = process.argv[2]?.trim();
  const fromEnv = process.env.QA_WA_PHONE?.trim();
  const agentRaw = fromArg || fromEnv;
  if (!agentRaw) return null;

  const agentPhone = normalizePhone(agentRaw);
  if (agentPhone.length < 10) {
    console.error('Número inválido — use DDI + DDD + número (ex.: 5511999999999).');
    process.exit(1);
  }

  const alertRaw = process.env.QA_WA_ALERT_PHONES?.trim();
  const alertPhones = alertRaw
    ? alertRaw
        .split(/[\n,;]+/)
        .map(s => s.trim())
        .filter(Boolean)
    : [agentRaw.trim()];

  return { agentPhone, alertPhones };
}

async function main() {
  const phones = parsePhones();
  if (!phones) {
    console.log('=== Radar Chat — QA WebChat/WA setup ===\n');
    console.log('Informe o WhatsApp pessoal do atendente de teste:\n');
    console.log('  QA_WA_PHONE=5511999999999 npm run qa:webchat-wa:setup');
    console.log('  npm run qa:webchat-wa:setup -- 5511999999999\n');
    console.log('Opcional — alertas para outros números/grupos:');
    console.log('  QA_WA_ALERT_PHONES=5511999999999,120363012345678901@g.us\n');
    process.exit(1);
  }

  const { agentPhone, alertPhones } = phones;

  await mongoose.connect(MONGODB_URL);
  console.log('=== Radar Chat — QA WebChat/WA setup ===\n');

  const widget = await WebChatWidget.findOne({ active: true }).sort({ updatedAt: -1 }).lean();
  if (!widget) {
    console.error('Nenhum widget WebChat ativo — crie em /platform/webchat');
    await mongoose.disconnect();
    process.exit(1);
  }

  const clientId = widget.clientId as mongoose.Types.ObjectId;
  const settings = await InboxSettings.getOrCreate(clientId);

  settings.whatsappFallbackEnabled = true;
  settings.whatsappFallbackAlertPhones = alertPhones;
  if (!settings.whatsappFallbackVisitorMessage?.trim()) {
    settings.whatsappFallbackVisitorMessage =
      'No momento não há atendentes online no chat. Enviamos um alerta à equipe no WhatsApp — você será atendido em breve.';
  }
  if (!settings.agentPresenceTimeoutSeconds || settings.agentPresenceTimeoutSeconds < 30) {
    settings.agentPresenceTimeoutSeconds = 90;
  }
  await settings.save();

  const rolePriority = [
    CompanyRole.OWNER,
    CompanyRole.ADMIN,
    CompanyRole.MANAGER,
    CompanyRole.ATTENDANT,
  ];
  let member =
    (await CompanyMember.findOne({
      organizationId: clientId,
      isActive: true,
      companyRole: CompanyRole.OWNER,
    })) ??
    (await CompanyMember.findOne({
      organizationId: clientId,
      isActive: true,
      companyRole: { $in: rolePriority },
    }).sort({ companyRole: 1 }));

  if (!member) {
    member = await CompanyMember.findOne({ organizationId: clientId, isActive: true });
  }
  if (!member) {
    console.error('Nenhum membro ativo na organização do widget.');
    await mongoose.disconnect();
    process.exit(1);
  }

  member.whatsappPhone = agentPhone;
  await member.save();

  console.log('✓ Fallback WhatsApp habilitado');
  console.log(`  Alertas: ${alertPhones.join(', ')}`);
  console.log(`✓ WhatsApp cadastrado em Equipe (${member.companyRole}): ${agentPhone}`);
  console.log(`✓ Widget: ${widget.name ?? 'padrão'} · publicKey=${widget.publicKey}`);
  console.log('\nPróximo passo:');
  console.log('  1. npm run qa:webchat-wa');
  console.log('  2. docs/legacy/QA-WEBCHAT-WA-FALLBACK-BRIDGE.md (§0 já parcialmente feito)\n');

  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
