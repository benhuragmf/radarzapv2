import mongoose from 'mongoose';
import { ConsentService } from '@/services/consent/ConsentService';
import { InboxDepartment, IInboxDepartment } from '@/models/InboxDepartment';

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
      memberUserIds: [],
    })),
  );
  return docs;
}

export async function buildInboxTriageMenu(clientId: string): Promise<string> {
  const company = await ConsentService.getInstance().resolveCompanyName(clientId);
  const depts = await loadActiveDepartments(clientId);
  const header = company
    ? `Olá! Bem-vindo ao atendimento *${company}*.\n\n`
    : 'Olá! Bem-vindo ao nosso atendimento.\n\n';
  const lines = depts.map(d => `${d.menuKey} - ${d.name}`).join('\n');
  return (
    `${header}Escolha o setor:\n\n${lines}\n\n` +
    '_Responda com o número ou o nome do setor._'
  );
}

/** Interpreta escolha do menu de triagem (número ou nome do setor). */
export async function parseInboxMenuChoice(
  clientId: string,
  text: string,
): Promise<string | null> {
  const depts = await loadActiveDepartments(clientId);
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

export function buildQueueConfirmation(departmentName: string): string {
  return (
    `Você foi direcionado para *${departmentName}*.\n` +
    'Um atendente responderá em breve. Enquanto isso, pode descrever sua solicitação.'
  );
}

export async function buildInvalidMenuHint(clientId: string): Promise<string> {
  const depts = await loadActiveDepartments(clientId);
  const keys = depts.map(d => d.menuKey).join(', ');
  return `Opção inválida. Responda com ${keys} ou o nome do setor.`;
}

export function buildAgentJoinMessage(agentName: string): string {
  return `Olá! Sou *${agentName}* e vou dar continuidade ao seu atendimento.`;
}
