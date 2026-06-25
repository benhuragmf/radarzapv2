import { DEFAULT_TICKET_TEAM_RESPONSE_HOURS } from '@/services/inbox/ticket-team-sla';

/** Prioridade de produto (referência TOP 08) — campo ainda não persistido em InboxTicket. */
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TicketSlaTargets {
  /** Primeira resposta da equipe (referência comercial). */
  firstResponseHours: number;
  /** Resolução alvo (referência comercial). */
  resolutionHours: number;
}

/** Metas de SLA por prioridade — referência oficial TOP 08 (calendário 24/7 simples). */
export const TICKET_SLA_TARGETS: Record<TicketPriority, TicketSlaTargets> = {
  low: { firstResponseHours: 24, resolutionHours: 24 * 5 },
  normal: { firstResponseHours: 8, resolutionHours: 24 * 3 },
  high: { firstResponseHours: 2, resolutionHours: 24 },
  urgent: { firstResponseHours: 0.5, resolutionHours: 4 },
};

const MS_PER_HOUR = 60 * 60 * 1000;

export function computeSlaDueAt(from: Date, hours: number): Date {
  return new Date(from.getTime() + hours * MS_PER_HOUR);
}

/**
 * SLA operacional atual: prazo da equipe após mensagem do cliente no ticket.
 * Usa `DEFAULT_TICKET_TEAM_RESPONSE_HOURS` (24h) até existir `priority` no modelo.
 */
export function getOperationalTeamResponseHours(_priority?: TicketPriority): number {
  return DEFAULT_TICKET_TEAM_RESPONSE_HOURS;
}

export function getSlaTargetsForPriority(priority: TicketPriority = 'normal'): TicketSlaTargets {
  return TICKET_SLA_TARGETS[priority];
}
