/** Status operacional do atendente no painel — controla recebimento de fila. */
export type AgentOperationalStatus =
  | 'online'
  | 'ausente'
  | 'ocupado'
  | 'offline'
  | 'supervisor_online';

export type AgentStatusSource = 'manual' | 'auto';

export const AGENT_OPERATIONAL_STATUS_LABELS: Record<AgentOperationalStatus, string> = {
  online: 'Online',
  ausente: 'Ausente',
  ocupado: 'Ocupado / Não receber',
  offline: 'Offline',
  supervisor_online: 'Online sem receber atendimento',
};

/** Status que permitem receber novos chats na fila. */
export const QUEUE_ELIGIBLE_STATUSES: AgentOperationalStatus[] = ['online'];

/** Status disponíveis para atendentes comuns (sem supervisão). */
export const ATTENDANT_SELECTABLE_STATUSES: AgentOperationalStatus[] = [
  'online',
  'ausente',
  'ocupado',
  'offline',
];

/** Status extras para quem tem inbox:supervise. */
export const SUPERVISOR_SELECTABLE_STATUSES: AgentOperationalStatus[] = [
  ...ATTENDANT_SELECTABLE_STATUSES,
  'supervisor_online',
];

export function isQueueEligibleStatus(status: AgentOperationalStatus): boolean {
  return QUEUE_ELIGIBLE_STATUSES.includes(status);
}

export function operationalStatusLabel(status: AgentOperationalStatus): string {
  return AGENT_OPERATIONAL_STATUS_LABELS[status] ?? status;
}
