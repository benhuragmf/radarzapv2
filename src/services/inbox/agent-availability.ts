import type { AgentOperationalStatus } from '@/types/agent-presence';
import { isQueueEligibleStatus } from '@/types/agent-presence';
import { isAgentAvailableForQueue } from '@/services/inbox/inbox-agent-presence';
import { isAgentAtCapacity } from '@/services/inbox/inbox-queue-priority';
import { PlanConfigService, type CatalogPlanId } from '@/services/billing/plan-config';

export { isQueueEligibleStatus };

const PLAN_MAX_CONCURRENT_DEFAULT: Record<CatalogPlanId, number> = {
  trial: 1,
  free: 1,
  starter: 3,
  pro: 5,
  enterprise: 10,
};

/** Teto de atendimentos simultâneos por atendente conforme plano (TOP 03/05). */
export function resolveMaxConcurrentChatsForPlan(
  planId: string,
  settingsValue?: number,
): number {
  const commercial = PlanConfigService.getInstance().getCommercialLimits(planId);
  const planCap =
    commercial?.maxConcurrentChatsPerAgent ??
    PLAN_MAX_CONCURRENT_DEFAULT[planId as CatalogPlanId] ??
    1;
  const configured = Math.max(1, settingsValue ?? planCap);
  return Math.min(configured, planCap);
}

/** Somente `online` + conectado recebe fila automática. */
export function canAgentReceiveNewAssignmentByPresence(
  clientId: string,
  userId: string,
): boolean {
  return isAgentAvailableForQueue(clientId, userId);
}

/** Presença + capacidade simultânea para nova atribuição automática. */
export async function canAgentReceiveNewAssignment(
  clientId: string,
  userId: string,
  maxConcurrent: number,
  exclude?: { inboxConversationId?: string; webChatConversationId?: string },
): Promise<boolean> {
  if (!canAgentReceiveNewAssignmentByPresence(clientId, userId)) {
    return false;
  }
  const atCapacity = await isAgentAtCapacity(clientId, userId, maxConcurrent, exclude);
  return !atCapacity;
}

export function isManualBusyStatus(status: AgentOperationalStatus): boolean {
  return status === 'ocupado' || status === 'supervisor_online';
}

/** Ausência automática não deve sobrescrever status manual ocupado/supervisor. */
export function shouldApplyAutoAusente(
  currentStatus: AgentOperationalStatus,
  nextStatus: AgentOperationalStatus,
  source: 'manual' | 'auto',
): boolean {
  if (source !== 'auto' || nextStatus !== 'ausente') return true;
  if (currentStatus === 'online') return true;
  return false;
}
