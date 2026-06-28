import {
  containsSensitiveOpsContent,
  deriveOverallStatus,
  formatOpsUptime,
  sortAlertsBySeverity,
} from '@/types/admin-ops-summary.util';
import type { AdminOpsAlert } from '@/types/admin-ops-summary';

describe('admin-ops-summary.util', () => {
  it('formata uptime em pt-BR', () => {
    expect(formatOpsUptime(3661)).toContain('1h');
  });

  it('deriva status crítico quando há alerta critical', () => {
    const alerts: AdminOpsAlert[] = [
      { level: 'info', kind: 'a', title: 'Info', message: 'ok' },
      { level: 'critical', kind: 'b', title: 'Crit', message: 'fail' },
    ];
    expect(deriveOverallStatus(alerts)).toBe('critical');
  });

  it('ordena alertas por severidade', () => {
    const alerts: AdminOpsAlert[] = [
      { level: 'info', kind: 'i', title: 'I', message: '' },
      { level: 'critical', kind: 'c', title: 'C', message: '' },
      { level: 'warning', kind: 'w', title: 'W', message: '' },
    ];
    expect(sortAlertsBySeverity(alerts).map(a => a.level)).toEqual(['critical', 'warning', 'info']);
  });

  it('detecta conteúdo sensível', () => {
    expect(containsSensitiveOpsContent('sk_test_abc123')).toBe(true);
    expect(containsSensitiveOpsContent('sessionData encrypted')).toBe(true);
    expect(containsSensitiveOpsContent('42 empresas')).toBe(false);
  });
});
