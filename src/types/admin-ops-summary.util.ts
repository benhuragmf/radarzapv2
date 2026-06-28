import type { AdminOpsAlert, AdminOpsAlertLevel, AdminOpsServiceStatus } from './admin-ops-summary';

export type AdminOpsOverallStatus = 'ok' | 'attention' | 'critical';

const ALERT_ORDER: Record<AdminOpsAlertLevel, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const SENSITIVE_PATTERNS = [
  /STRIPE_SECRET_KEY/i,
  /STRIPE_WEBHOOK_SECRET/i,
  /OPENAI_API_KEY/i,
  /GEMINI_API_KEY/i,
  /SESSION_ENCRYPTION_KEY/i,
  /JWT_SECRET/i,
  /sk_test_/i,
  /sk_live_/i,
  /whsec_/i,
  /sessionData/i,
  /publicAccessToken/i,
  /Bearer/i,
  /Authorization/i,
  /Cookie/i,
];

export function formatOpsNumber(value: number | undefined | null): string {
  return (value ?? 0).toLocaleString('pt-BR');
}

export function formatOpsUptime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${s % 60}s`;
}

export function formatOpsDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return iso;
  }
}

export function formatOptionalMetric(value: number | undefined): string {
  if (value === undefined) return 'Não calculado nesta etapa';
  return formatOpsNumber(value);
}

export function serviceStatusLabel(status: AdminOpsServiceStatus): string {
  switch (status) {
    case 'ok':
      return 'OK';
    case 'degraded':
      return 'Degradado';
    case 'down':
      return 'Offline';
    case 'not_configured':
      return 'Não configurado';
    default:
      return status;
  }
}

export function serviceStatusVariant(
  status: AdminOpsServiceStatus,
): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  switch (status) {
    case 'ok':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'down':
      return 'danger';
    case 'not_configured':
      return 'neutral';
    default:
      return 'info';
  }
}

export function deriveOverallStatus(alerts: AdminOpsAlert[]): AdminOpsOverallStatus {
  if (alerts.some(a => a.level === 'critical')) return 'critical';
  if (alerts.some(a => a.level === 'warning')) return 'attention';
  return 'ok';
}

export function overallStatusLabel(status: AdminOpsOverallStatus): string {
  switch (status) {
    case 'ok':
      return 'OK';
    case 'attention':
      return 'Atenção';
    case 'critical':
      return 'Crítico';
  }
}

export function overallStatusVariant(status: AdminOpsOverallStatus): 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'ok':
      return 'success';
    case 'attention':
      return 'warning';
    case 'critical':
      return 'danger';
  }
}

export function sortAlertsBySeverity(alerts: AdminOpsAlert[]): AdminOpsAlert[] {
  return [...alerts].sort((a, b) => ALERT_ORDER[a.level] - ALERT_ORDER[b.level]);
}

export function countCriticalAlerts(alerts: AdminOpsAlert[]): number {
  return alerts.filter(a => a.level === 'critical').length;
}

/** Verifica se texto contém padrões sensíveis — uso em testes e sanitização. */
export function containsSensitiveOpsContent(text: string): boolean {
  return SENSITIVE_PATTERNS.some(re => re.test(text));
}

export function sanitizeOpsDisplayText(text: string): string {
  if (containsSensitiveOpsContent(text)) {
    return '[conteúdo omitido]';
  }
  return text;
}
