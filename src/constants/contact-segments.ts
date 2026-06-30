/** Segmentos (ContactGroup) criados automaticamente pelo Radar Chat. */
export const SYSTEM_CONTACT_GROUPS = {
  ATENDIMENTO: {
    name: 'Atendimento',
    description: 'Contatos que iniciaram conversa pelo WhatsApp (Inbox / primeiro contato).',
  },
  LEAD: {
    name: 'Lead',
    description:
      'Potenciais clientes com interesse comercial — triagem Comercial ou origem de formulário.',
  },
} as const;

export type SystemContactGroupKey = keyof typeof SYSTEM_CONTACT_GROUPS;

/** Nomes de setor Inbox que classificam o contato como Lead (comparação normalizada). */
export const LEAD_INBOX_DEPARTMENT_KEYWORDS = [
  'comercial',
  'vendas',
  'sales',
  'lead',
  'marketing',
] as const;

export function isLeadInboxDepartment(departmentName: string): boolean {
  const norm = departmentName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return LEAD_INBOX_DEPARTMENT_KEYWORDS.some(kw => norm.includes(kw));
}
