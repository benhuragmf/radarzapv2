import { isAgentAvailableForQueue } from '@/services/inbox/inbox-agent-presence';

/** Filtra candidatos elegíveis para round-robin (somente `online` — TOP 05). */
export function filterQueueEligibleAgentIds(
  clientId: string,
  candidateIds: string[],
): string[] {
  return candidateIds.filter(id => isAgentAvailableForQueue(clientId, id));
}
