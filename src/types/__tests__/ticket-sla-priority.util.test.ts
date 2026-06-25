import {
  TICKET_SLA_TARGETS,
  computeSlaDueAt,
  getOperationalTeamResponseHours,
  getSlaTargetsForPriority,
} from '@/types/ticket-sla-priority.util';

describe('ticket-sla-priority.util', () => {
  it('define metas por prioridade conforme TOP 08', () => {
    expect(TICKET_SLA_TARGETS.normal.firstResponseHours).toBe(8);
    expect(TICKET_SLA_TARGETS.normal.resolutionHours).toBe(72);
    expect(TICKET_SLA_TARGETS.urgent.firstResponseHours).toBe(0.5);
    expect(TICKET_SLA_TARGETS.urgent.resolutionHours).toBe(4);
  });

  it('calcula dueAt a partir de horas', () => {
    const from = new Date('2026-06-24T10:00:00Z');
    const due = computeSlaDueAt(from, 8);
    expect(due.toISOString()).toBe('2026-06-24T18:00:00.000Z');
  });

  it('usa SLA operacional de 24h até existir priority no modelo', () => {
    expect(getOperationalTeamResponseHours()).toBe(24);
    expect(getOperationalTeamResponseHours('urgent')).toBe(24);
  });

  it('retorna metas comerciais por prioridade', () => {
    expect(getSlaTargetsForPriority('high').firstResponseHours).toBe(2);
    expect(getSlaTargetsForPriority().resolutionHours).toBe(72);
  });
});
