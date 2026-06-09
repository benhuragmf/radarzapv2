import type { AiContactContext } from '@/services/ai/AiContextService';

export interface AiPromptVarContext {
  companyName: string;
  agentName: string;
  contact?: AiContactContext;
}

export function applyAiPromptVars(template: string, ctx: AiPromptVarContext): string {
  const c = ctx.contact;
  const openTicket = c?.recentTickets?.find(t => t.status === 'open' || t.status === 'in_progress');
  const vars: Record<string, string> = {
    agentName: ctx.agentName,
    companyName: ctx.companyName,
    customerName: c?.name ?? '(não informado)',
    customerPhone: c?.phone ?? '(não informado)',
    customerEmail: c?.email ?? '(não informado)',
    customerDocument: '(não informado)',
    customerCompany: c?.organization ?? '(não informado)',
    customerPlan: '(não informado)',
    customerStatus: c?.tags?.length ? c.tags.join(', ') : '(não informado)',
    openTicket: openTicket ? `${openTicket.ref} [${openTicket.status}]` : 'nenhum',
    lastDepartment: '(não informado)',
    customerHistory: c?.recentTickets?.length
      ? c.recentTickets.map(t => `${t.ref}${t.subject ? `: ${t.subject}` : ''}`).join('; ')
      : '(sem histórico)',
  };

  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return out;
}
