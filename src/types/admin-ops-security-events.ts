/** Feed global sanitizado — GET /api/admin/ops/security-events */

export type AdminOpsSecurityEventLevel = 'info' | 'warning' | 'critical' | 'error';

export type AdminOpsSecurityEventSource =
  | 'attendance'
  | 'system'
  | 'audit'
  | 'billing'
  | 'webhook'
  | 'ai'
  | 'bridge'
  | 'ticket'
  | 'form'
  | 'unknown';

export interface AdminOpsSecurityEventRow {
  id: string;
  source: AdminOpsSecurityEventSource;
  level: AdminOpsSecurityEventLevel;
  kind: string;
  title: string;
  message: string;
  organizationId?: string;
  organizationName?: string;
  createdAt: string;
}

export interface AdminOpsSecurityEventsPage {
  items: AdminOpsSecurityEventRow[];
  limit: number;
  total: number;
  generatedAt: string;
  window: {
    from: string;
    to: string;
  };
}

export type ListAdminOpsSecurityEventsParams = {
  limit?: unknown;
  kind?: unknown;
  level?: unknown;
  source?: unknown;
  from?: unknown;
  to?: unknown;
};
