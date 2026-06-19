import mongoose from 'mongoose';
import { ConsentService } from '@/services/consent/ConsentService';
import { InboxDepartment, IInboxDepartment } from '@/models/InboxDepartment';
import { InboxSettings, IInboxSettings } from '@/models/InboxSettings';
import { DEFAULT_INBOX_BOT_TEXTS } from '@/types/inbox-settings';
import { setAgentPresenceTimeout } from '@/services/inbox/inbox-agent-presence';

export const DEFAULT_INBOX_DEPARTMENTS = [
  { name: 'Comercial', menuKey: '1', sortOrder: 1, description: 'Vendas e propostas' },
  { name: 'Financeiro', menuKey: '2', sortOrder: 2, description: 'Cobranças e pagamentos' },
  { name: 'Suporte', menuKey: '3', sortOrder: 3, description: 'Dúvidas técnicas' },
  { name: 'Geral', menuKey: '4', sortOrder: 4, description: 'Atendimento geral' },
] as const;

function normalizeChoiceText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ');
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}

export async function loadInboxSettings(clientId: string): Promise<IInboxSettings> {
  const doc = await InboxSettings.getOrCreate(clientId);
  setAgentPresenceTimeout(clientId, doc.agentPresenceTimeoutSeconds ?? 90);
  return doc;
}

export async function loadActiveDepartments(clientId: string): Promise<IInboxDepartment[]> {
  const clientOid = new mongoose.Types.ObjectId(clientId);
  const existing = await InboxDepartment.find({ clientId: clientOid, isActive: true }).sort({
    sortOrder: 1,
    menuKey: 1,
  });
  if (existing.length > 0) return existing;

  const docs = await InboxDepartment.insertMany(
    DEFAULT_INBOX_DEPARTMENTS.map(d => ({
      clientId: clientOid,
      name: d.name,
      description: d.description,
      menuKey: d.menuKey,
      sortOrder: d.sortOrder,
      isActive: true,
      clientVisible: true,
      memberUserIds: [],
    })),
  );
  return docs;
}

/** Setores exibidos no menu WhatsApp do cliente (triagem). */
export async function loadClientVisibleDepartments(clientId: string): Promise<IInboxDepartment[]> {
  const depts = await loadActiveDepartments(clientId);
  return depts.filter(d => d.clientVisible !== false);
}

export async function buildInboxTriageMenu(clientId: string): Promise<string> {
  const [company, depts, settings] = await Promise.all([
    ConsentService.getInstance().resolveCompanyName(clientId),
    loadClientVisibleDepartments(clientId),
    loadInboxSettings(clientId),
  ]);

  const welcome = company
    ? applyTemplate(settings.welcomeWithCompany, { company })
    : settings.welcomeGeneric;
  const lines = depts.map(d => `${d.menuKey} - ${d.name}`).join('\n');
  return `${welcome}\n\n${settings.menuIntro}\n\n${lines}\n\n${settings.menuFooter}`;
}

/** Interpreta escolha do menu de triagem (número ou nome do setor). */
export async function parseInboxMenuChoice(
  clientId: string,
  text: string,
): Promise<string | null> {
  const depts = await loadClientVisibleDepartments(clientId);
  const norm = normalizeChoiceText(text);
  if (!norm) return null;

  const byKey = depts.find(d => d.menuKey === norm);
  if (byKey) return byKey.menuKey;

  const byName = depts.find(d => normalizeChoiceText(d.name) === norm);
  if (byName) return byName.menuKey;

  for (const d of depts) {
    const name = normalizeChoiceText(d.name);
    if (norm.includes(name) || name.includes(norm)) return d.menuKey;
  }

  return null;
}

export async function buildQueueConfirmation(
  clientId: string,
  departmentName: string,
): Promise<string> {
  const settings = await loadInboxSettings(clientId);
  return applyTemplate(settings.queueMessage, {
    department: departmentName,
    waiting: settings.waitingMessage,
  });
}

export async function buildInvalidMenuHint(clientId: string): Promise<string> {
  const [depts, settings] = await Promise.all([
    loadClientVisibleDepartments(clientId),
    loadInboxSettings(clientId),
  ]);
  const keys = depts.map(d => d.menuKey).join(', ');
  return applyTemplate(settings.invalidMenuHint, { options: keys });
}

export async function buildOutsideHoursMessage(clientId: string): Promise<string> {
  const settings = await loadInboxSettings(clientId);
  return settings.outsideHoursMessage || DEFAULT_INBOX_BOT_TEXTS.outsideHoursMessage;
}

export async function buildResolvedMessage(clientId: string): Promise<string> {
  const settings = await loadInboxSettings(clientId);
  return settings.resolvedMessage || DEFAULT_INBOX_BOT_TEXTS.resolvedMessage;
}

export async function buildTransferMessage(
  clientId: string,
  departmentName: string,
): Promise<string> {
  const settings = await loadInboxSettings(clientId);
  return applyTemplate(settings.transferMessage, { department: departmentName });
}

export function buildAgentJoinMessage(agentName: string): string {
  return `Olá! Sou *${agentName}* e vou dar continuidade ao seu atendimento.`;
}
