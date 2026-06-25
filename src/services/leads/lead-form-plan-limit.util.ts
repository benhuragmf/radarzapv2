import { PlanConfigService } from '@/services/billing/plan-config';

export const LEAD_FORM_LIMIT_MESSAGE =
  'Limite de formulários do plano atingido. Faça upgrade do plano ou desative um formulário existente.';

/** Limite `leadForms` do catálogo comercial (TOP 03). */
export function resolveLeadFormsPlanLimit(planId: string): number {
  const commercial = PlanConfigService.getInstance().getCommercialLimits(planId);
  if (commercial?.leadForms != null) return commercial.leadForms;
  const free = PlanConfigService.getInstance().getCommercialLimits('free');
  return free?.leadForms ?? 1;
}

/** Bloqueia criação quando `currentCount >= limit`. Edição de existentes não usa esta regra. */
export function canCreateLeadFormAtPlanLimit(currentCount: number, limit: number): boolean {
  if (!Number.isFinite(limit) || limit < 0) return true;
  return currentCount < limit;
}

export function checkLeadFormPlanLimit(
  currentCount: number,
  planId: string,
): { ok: true } | { ok: false; message: string } {
  const limit = resolveLeadFormsPlanLimit(planId);
  if (canCreateLeadFormAtPlanLimit(currentCount, limit)) return { ok: true };
  return { ok: false, message: LEAD_FORM_LIMIT_MESSAGE };
}
