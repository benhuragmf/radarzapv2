import {
  PlanConfigService,
  type PlanCommercialLimits,
} from '@/services/billing/plan-config';

export const PLAN_LIMIT_MESSAGES = {
  webchatWidgets:
    'Limite de widgets WebChat do plano atingido. Faça upgrade ou desative um widget existente.',
  contacts:
    'Limite de contatos do plano atingido. Faça upgrade para adicionar mais contatos.',
  leadsPerMonth:
    'Limite mensal de leads do plano atingido. Faça upgrade para continuar capturando leads.',
  ticketsPerMonth:
    'Limite mensal de chamados do plano atingido. Faça upgrade para abrir novos chamados.',
  whatsappDestinations:
    'Limite de destinos WhatsApp do plano atingido. Faça upgrade para adicionar mais números/grupos.',
  templatesMax:
    'Limite de templates do plano atingido. Faça upgrade ou remova templates antigos.',
} as const;

export function resolvePlanLimit(
  planId: string,
  limitKey: keyof PlanCommercialLimits,
): number {
  const commercial = PlanConfigService.getInstance().getCommercialLimits(planId);
  if (commercial && commercial[limitKey] != null) return commercial[limitKey];
  const free = PlanConfigService.getInstance().getCommercialLimits('free');
  return free?.[limitKey] ?? 0;
}

export function canCreateResourceUnderPlanLimit(
  currentCount: number,
  limit: number,
): boolean {
  if (!Number.isFinite(limit) || limit < 0) return true;
  return currentCount < limit;
}

export function checkPlanResourceLimit(
  currentCount: number,
  planId: string,
  limitKey: keyof PlanCommercialLimits,
  message: string,
): { ok: true } | { ok: false; message: string } {
  const limit = resolvePlanLimit(planId, limitKey);
  if (canCreateResourceUnderPlanLimit(currentCount, limit)) return { ok: true };
  return { ok: false, message };
}

export function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
