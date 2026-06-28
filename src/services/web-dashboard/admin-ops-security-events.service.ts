import mongoose from 'mongoose';
import { AttendanceEvent, type AttendanceEventKind } from '@/models/AttendanceEvent';
import { SystemLog, type ISystemLog } from '@/models/SystemLog';
import { AuditLog, type IAuditLog } from '@/models/AuditLog';
import { Organization } from '@/models/Organization';
import { containsSensitiveOpsContent } from '@/types/admin-ops-summary.util';
import { maskSecretInText } from '@/utils/mask-secret.util';
import type {
  AdminOpsSecurityEventLevel,
  AdminOpsSecurityEventRow,
  AdminOpsSecurityEventSource,
  AdminOpsSecurityEventsPage,
  ListAdminOpsSecurityEventsParams,
} from '@/types/admin-ops-security-events';

const MS_PER_HOUR = 60 * 60 * 1000;
const DEFAULT_WINDOW_HOURS = 24;
const MAX_FETCH_PER_SOURCE = 500;
const TITLE_MAX = 80;
const MESSAGE_MAX = 300;

/** Kinds de AttendanceEvent incluídos no feed de segurança. */
export const ATTENDANCE_SECURITY_KINDS: AttendanceEventKind[] = [
  'ticket.public_lookup_failed',
  'form.blocked',
  'billing.limit.blocked',
  'billing.invoice.failed',
  'billing.checkout.completed',
  'billing.ai_credit_pack.purchased',
  'ai.credits.low_balance',
  'ai.credits.exhausted',
  'ai.premium.provider_error',
  'ai.premium.escalated',
  'bridge.loop_prevented',
  'bridge.started',
  'bridge.closed',
];

const ATTENDANCE_KIND_LEVEL: Partial<Record<AttendanceEventKind, AdminOpsSecurityEventLevel>> = {
  'ticket.public_lookup_failed': 'warning',
  'form.blocked': 'warning',
  'billing.limit.blocked': 'warning',
  'billing.invoice.failed': 'critical',
  'ai.credits.exhausted': 'critical',
  'ai.credits.low_balance': 'warning',
  'ai.premium.provider_error': 'warning',
  'bridge.loop_prevented': 'warning',
  'billing.checkout.completed': 'info',
  'billing.ai_credit_pack.purchased': 'info',
  'ai.premium.escalated': 'info',
  'bridge.started': 'info',
  'bridge.closed': 'info',
};

const KIND_TITLES: Partial<Record<AttendanceEventKind, string>> = {
  'ticket.public_lookup_failed': 'Lookup ticket inválido',
  'form.blocked': 'Formulário bloqueado',
  'billing.limit.blocked': 'Limite de billing bloqueado',
  'billing.invoice.failed': 'Fatura falhou',
  'billing.checkout.completed': 'Checkout concluído',
  'billing.ai_credit_pack.purchased': 'Pacote IA comprado',
  'ai.credits.low_balance': 'Créditos IA baixos',
  'ai.credits.exhausted': 'Créditos IA esgotados',
  'ai.premium.provider_error': 'Erro provedor IA premium',
  'ai.premium.escalated': 'Handoff IA premium',
  'bridge.loop_prevented': 'Loop bridge prevenido',
  'bridge.started': 'Bridge iniciado',
  'bridge.closed': 'Bridge encerrado',
};

const AUDIT_ACTION_PREFIXES = [
  'admin.trial.extended',
  'admin.trial.cancelled',
  'admin.plan.changed',
  'billing.',
  'webhook.',
  'security.',
  'auth.login_failed',
];

export function sanitizeAdminOpsSecurityEventText(value: unknown, maxLen?: number): string {
  if (value == null) return '';
  let text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';

  if (containsSensitiveOpsContent(text)) {
    return '[conteúdo omitido]';
  }

  text = maskSecretInText(text);
  if (containsSensitiveOpsContent(text)) {
    return '[conteúdo omitido]';
  }

  const limit = maxLen ?? MESSAGE_MAX;
  if (text.length > limit) {
    return `${text.slice(0, limit - 1)}…`;
  }
  return text;
}

export function resolveSecurityEventLevel(
  kind: string,
  fallback: AdminOpsSecurityEventLevel = 'info',
): AdminOpsSecurityEventLevel {
  const mapped = ATTENDANCE_KIND_LEVEL[kind as AttendanceEventKind];
  if (mapped) return mapped;

  if (kind.startsWith('billing.invoice') || kind.includes('.failed')) return 'critical';
  if (kind.startsWith('security.') || kind === 'auth.login_failed') return 'warning';
  if (kind.startsWith('webhook.') && kind.includes('fail')) return 'warning';

  return fallback;
}

export function resolveSecurityEventSource(
  kind: string,
  origin: 'attendance' | 'system' | 'audit',
): AdminOpsSecurityEventSource {
  if (origin === 'system') return 'system';
  if (origin === 'audit') {
    if (kind.startsWith('billing.')) return 'billing';
    if (kind.startsWith('webhook.')) return 'webhook';
    if (kind.startsWith('security.') || kind.startsWith('auth.')) return 'audit';
    if (kind.startsWith('admin.')) return 'audit';
    return 'audit';
  }

  if (kind.startsWith('ticket.')) return 'ticket';
  if (kind.startsWith('form.')) return 'form';
  if (kind.startsWith('billing.')) return 'billing';
  if (kind.startsWith('ai.')) return 'ai';
  if (kind.startsWith('bridge.')) return 'bridge';
  if (kind.startsWith('webchat.')) return 'bridge';

  return 'attendance';
}

function parseLimit(value: unknown, fallback = 25): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(100, Math.floor(n));
}

function parsePage(value: unknown, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function auditMongoFilter(extra?: Record<string, unknown>): Record<string, unknown> {
  const prefixClauses = AUDIT_ACTION_PREFIXES.map(prefix =>
    prefix.endsWith('.')
      ? { action: { $regex: `^${prefix.replace(/\./g, '\\.')}` } }
      : { action: prefix },
  );
  const base = { $or: prefixClauses };
  if (!extra) return base;
  return { $and: [base, extra] };
}

function attendanceKindsForSource(
  source?: AdminOpsSecurityEventSource,
): AttendanceEventKind[] | null {
  if (!source || source === 'attendance') return ATTENDANCE_SECURITY_KINDS;
  if (source === 'ticket') {
    return ATTENDANCE_SECURITY_KINDS.filter(k => k.startsWith('ticket.'));
  }
  if (source === 'form') {
    return ATTENDANCE_SECURITY_KINDS.filter(k => k.startsWith('form.'));
  }
  if (source === 'billing') {
    return ATTENDANCE_SECURITY_KINDS.filter(k => k.startsWith('billing.'));
  }
  if (source === 'ai') {
    return ATTENDANCE_SECURITY_KINDS.filter(k => k.startsWith('ai.'));
  }
  if (source === 'bridge') {
    return ATTENDANCE_SECURITY_KINDS.filter(
      k => k.startsWith('bridge.') || k.startsWith('webchat.'),
    );
  }
  return null;
}

function systemLevelsForFilter(
  level?: AdminOpsSecurityEventLevel,
  kind?: string,
): Array<'warn' | 'error'> {
  if (kind === 'system.error') return ['error'];
  if (kind === 'system.warn') return ['warn'];
  if (level === 'error') return ['error'];
  if (level === 'warning') return ['warn'];
  if (level === 'critical' || level === 'info') return [];
  return ['warn', 'error'];
}

export type SecurityEventsFetchPlan = {
  attendance: { enabled: boolean; kinds: AttendanceEventKind[] };
  system: { enabled: boolean; levels: Array<'warn' | 'error'> };
  audit: { enabled: boolean; filter: Record<string, unknown> };
};

/** Quais coleções consultar — reduz full scan (AH-E02). */
export function buildSecurityEventsFetchPlan(input: {
  kind?: string;
  level?: AdminOpsSecurityEventLevel;
  source?: AdminOpsSecurityEventSource;
}): SecurityEventsFetchPlan {
  const { kind, level, source } = input;

  if (kind?.startsWith('system.')) {
    return {
      attendance: { enabled: false, kinds: [] },
      system: {
        enabled: true,
        levels: kind === 'system.error' ? ['error'] : kind === 'system.warn' ? ['warn'] : ['warn', 'error'],
      },
      audit: { enabled: false, filter: {} },
    };
  }

  if (kind && ATTENDANCE_SECURITY_KINDS.includes(kind as AttendanceEventKind)) {
    return {
      attendance: { enabled: true, kinds: [kind as AttendanceEventKind] },
      system: { enabled: false, levels: [] },
      audit: { enabled: false, filter: {} },
    };
  }

  if (kind && isAuditActionRelevant(kind)) {
    return {
      attendance: { enabled: false, kinds: [] },
      system: { enabled: false, levels: [] },
      audit: { enabled: true, filter: auditMongoFilter({ action: kind }) },
    };
  }

  const attendanceKinds = attendanceKindsForSource(source);
  const attendanceEnabled =
    attendanceKinds !== null &&
    (!level ||
      attendanceKinds.some(k => resolveSecurityEventLevel(k) === level));

  const systemLevels = systemLevelsForFilter(level, kind);
  const systemEnabled =
    systemLevels.length > 0 && (!source || source === 'system');

  let auditEnabled = !source || source === 'audit' || source === 'billing' || source === 'webhook';
  let auditFilter = auditMongoFilter();

  if (source === 'billing') {
    auditFilter = auditMongoFilter({ action: { $regex: '^billing\\.' } });
  } else if (source === 'webhook') {
    auditFilter = auditMongoFilter({ action: { $regex: '^webhook\\.' } });
  } else if (source === 'audit') {
    auditFilter = auditMongoFilter();
  } else if (source && source !== 'attendance' && attendanceKinds === null) {
    auditEnabled = false;
  }

  if (level && auditEnabled) {
    // level não mapeia 1:1 em audit — filtro fino permanece pós-merge
    auditEnabled = true;
  }

  return {
    attendance: {
      enabled: attendanceEnabled,
      kinds: attendanceKinds ?? [],
    },
    system: { enabled: systemEnabled, levels: systemLevels },
    audit: { enabled: auditEnabled, filter: auditFilter },
  };
}

function parseIsoDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveWindow(params: ListAdminOpsSecurityEventsParams): { from: Date; to: Date } {
  const to = parseIsoDate(params.to) ?? new Date();
  const from =
    parseIsoDate(params.from) ?? new Date(to.getTime() - DEFAULT_WINDOW_HOURS * MS_PER_HOUR);
  if (from > to) {
    return { from: to, to: from };
  }
  return { from, to };
}

function isAuditActionRelevant(action: string): boolean {
  return AUDIT_ACTION_PREFIXES.some(prefix =>
    prefix.endsWith('.') ? action.startsWith(prefix) : action === prefix,
  );
}

function buildAttendanceMessage(kind: string, meta?: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof meta?.ticketRef === 'string' && meta.ticketRef) {
    parts.push(`Ticket ${meta.ticketRef}`);
  }
  if (typeof meta?.reason === 'string' && meta.reason) {
    parts.push(meta.reason);
  }
  if (typeof meta?.plan === 'string' && meta.plan) {
    parts.push(`Plano ${meta.plan}`);
  }
  if (typeof meta?.formId === 'string' && meta.formId) {
    parts.push(`Form ${meta.formId.slice(0, 12)}`);
  }
  if (!parts.length) {
    return KIND_TITLES[kind as AttendanceEventKind] ?? kind;
  }
  return parts.join(' · ');
}

function buildAuditMessage(action: string, details?: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof details?.plan === 'string') parts.push(`Plano: ${details.plan}`);
  if (typeof details?.previousPlan === 'string') parts.push(`Anterior: ${details.previousPlan}`);
  if (typeof details?.days === 'number') parts.push(`${details.days} dias`);
  if (typeof details?.reason === 'string') parts.push(details.reason);
  if (!parts.length) return action;
  return parts.join(' · ');
}

function extractOrganizationId(
  clientId?: mongoose.Types.ObjectId,
  details?: Record<string, unknown>,
): string | undefined {
  if (clientId) return String(clientId);
  for (const key of ['organizationId', 'orgId', 'clientId']) {
    const v = details?.[key];
    if (typeof v === 'string' && v) return v;
    if (v && typeof v === 'object' && 'toString' in v) {
      return String(v);
    }
  }
  return undefined;
}

export function mapAttendanceEventToAdminOpsSecurityEvent(doc: {
  _id: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  kind: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}): AdminOpsSecurityEventRow {
  const kind = String(doc.kind);
  const title = sanitizeAdminOpsSecurityEventText(
    KIND_TITLES[kind as AttendanceEventKind] ?? kind.replace(/\./g, ' '),
    TITLE_MAX,
  );
  const message = sanitizeAdminOpsSecurityEventText(buildAttendanceMessage(kind, doc.meta));

  return {
    id: `att:${String(doc._id)}`,
    source: resolveSecurityEventSource(kind, 'attendance'),
    level: resolveSecurityEventLevel(kind),
    kind,
    title,
    message,
    organizationId: String(doc.clientId),
    createdAt: doc.createdAt.toISOString(),
  };
}

export function mapSystemLogToAdminOpsSecurityEvent(doc: Pick<
  ISystemLog,
  '_id' | 'level' | 'service' | 'message' | 'clientId' | 'timestamp'
>): AdminOpsSecurityEventRow {
  const level: AdminOpsSecurityEventLevel =
    doc.level === 'error' ? 'error' : doc.level === 'warn' ? 'warning' : 'info';
  const kind = `system.${doc.level}`;
  const title = sanitizeAdminOpsSecurityEventText(doc.service, TITLE_MAX);
  const message = sanitizeAdminOpsSecurityEventText(doc.message);

  return {
    id: `sys:${String(doc._id)}`,
    source: 'system',
    level,
    kind,
    title: title || 'Sistema',
    message: message || kind,
    organizationId: doc.clientId ? String(doc.clientId) : undefined,
    createdAt: doc.timestamp.toISOString(),
  };
}

export function mapAuditLogToAdminOpsSecurityEvent(doc: Pick<
  IAuditLog,
  '_id' | 'action' | 'details' | 'createdAt'
>): AdminOpsSecurityEventRow {
  const kind = String(doc.action);
  const title = sanitizeAdminOpsSecurityEventText(kind.replace(/\./g, ' · '), TITLE_MAX);
  const message = sanitizeAdminOpsSecurityEventText(buildAuditMessage(kind, doc.details));
  const orgId = extractOrganizationId(undefined, doc.details);

  return {
    id: `aud:${String(doc._id)}`,
    source: resolveSecurityEventSource(kind, 'audit'),
    level: resolveSecurityEventLevel(kind, kind === 'auth.login_failed' ? 'warning' : 'info'),
    kind,
    title,
    message,
    organizationId: orgId,
    createdAt: doc.createdAt.toISOString(),
  };
}

async function enrichOrganizationNames(
  rows: AdminOpsSecurityEventRow[],
): Promise<AdminOpsSecurityEventRow[]> {
  const ids = [
    ...new Set(rows.map(r => r.organizationId).filter((id): id is string => Boolean(id))),
  ];
  if (!ids.length) return rows;

  const objectIds = ids
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));

  const orgs = objectIds.length
    ? await Organization.find({ _id: { $in: objectIds } })
        .select('name')
        .lean<Array<{ _id: mongoose.Types.ObjectId; name?: string }>>()
    : [];

  const nameById = new Map(
    orgs.map(o => [String(o._id), sanitizeAdminOpsSecurityEventText(o.name ?? '', TITLE_MAX)]),
  );

  return rows.map(row => {
    if (!row.organizationId) return row;
    const name = nameById.get(row.organizationId);
    return {
      ...row,
      organizationName: name
        ? name || 'Organização sem nome'
        : 'Organização não encontrada',
    };
  });
}

function matchesFilters(
  row: AdminOpsSecurityEventRow,
  filters: {
    kind?: string;
    level?: AdminOpsSecurityEventLevel;
    source?: AdminOpsSecurityEventSource;
  },
): boolean {
  if (filters.kind && row.kind !== filters.kind) return false;
  if (filters.level && row.level !== filters.level) return false;
  if (filters.source && row.source !== filters.source) return false;
  return true;
}

/** Garante que row serializado não vaza campos sensíveis — uso em testes. */
export function assertSafeSecurityEventRow(row: AdminOpsSecurityEventRow): void {
  const json = JSON.stringify(row);
  const forbidden = [
    'meta',
    'payload',
    'sessionData',
    'publicAccessToken',
    'stripeSubscriptionId',
    'sk_test_',
    'sk_live_',
    'whsec_',
    'Authorization',
    'JWT_SECRET',
    'SESSION_ENCRYPTION_KEY',
  ];
  for (const token of forbidden) {
    if (json.includes(token)) {
      throw new Error(`Row contém campo proibido: ${token}`);
    }
  }
  if (row.title.length > TITLE_MAX + 4) {
    throw new Error('title excede limite');
  }
  if (row.message.length > MESSAGE_MAX + 4) {
    throw new Error('message excede limite');
  }
}

export async function listAdminOpsSecurityEvents(
  params: ListAdminOpsSecurityEventsParams = {},
): Promise<AdminOpsSecurityEventsPage> {
  const page = parsePage(params.page);
  const limit = parseLimit(params.limit);
  const window = resolveWindow(params);

  const kindFilter = params.kind ? String(params.kind).trim() : undefined;
  const levelFilter = params.level
    ? (String(params.level).trim() as AdminOpsSecurityEventLevel)
    : undefined;
  const sourceFilter = params.source
    ? (String(params.source).trim() as AdminOpsSecurityEventSource)
    : undefined;

  const plan = buildSecurityEventsFetchPlan({
    kind: kindFilter,
    level: levelFilter,
    source: sourceFilter,
  });

  const fetchPerSource = Math.min(page * limit + limit, MAX_FETCH_PER_SOURCE);
  let truncated = false;

  const [attendanceDocs, systemDocs, auditDocs] = await Promise.all([
    plan.attendance.enabled
      ? AttendanceEvent.find({
          createdAt: { $gte: window.from, $lte: window.to },
          kind: { $in: plan.attendance.kinds },
        })
          .sort({ createdAt: -1 })
          .limit(fetchPerSource)
          .select('clientId kind meta createdAt')
          .lean()
      : Promise.resolve([]),

    plan.system.enabled
      ? SystemLog.find({
          timestamp: { $gte: window.from, $lte: window.to },
          level: { $in: plan.system.levels },
        })
          .sort({ timestamp: -1 })
          .limit(fetchPerSource)
          .select('level service message clientId timestamp')
          .lean()
      : Promise.resolve([]),

    plan.audit.enabled
      ? AuditLog.find({
          createdAt: { $gte: window.from, $lte: window.to },
          ...plan.audit.filter,
        })
          .sort({ createdAt: -1 })
          .limit(fetchPerSource)
          .select('action details createdAt')
          .lean()
      : Promise.resolve([]),
  ]);

  if (
    (plan.attendance.enabled && attendanceDocs.length >= fetchPerSource) ||
    (plan.system.enabled && systemDocs.length >= fetchPerSource) ||
    (plan.audit.enabled && auditDocs.length >= fetchPerSource)
  ) {
    truncated = true;
  }

  const attendanceRows = attendanceDocs.map(mapAttendanceEventToAdminOpsSecurityEvent);
  const systemRows = systemDocs.map(mapSystemLogToAdminOpsSecurityEvent);
  const auditRows = auditDocs
    .filter(doc => isAuditActionRelevant(String(doc.action)))
    .map(mapAuditLogToAdminOpsSecurityEvent);

  let merged = [...attendanceRows, ...systemRows, ...auditRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  merged = merged.filter(row =>
    matchesFilters(row, {
      kind: kindFilter,
      level: levelFilter,
      source: sourceFilter,
    }),
  );

  const total = merged.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const sliced = merged.slice(offset, offset + limit);
  const items = await enrichOrganizationNames(sliced);

  for (const row of items) {
    assertSafeSecurityEventRow(row);
  }

  return {
    items,
    page,
    limit,
    total,
    totalPages,
    truncated: truncated || undefined,
    generatedAt: new Date().toISOString(),
    window: {
      from: window.from.toISOString(),
      to: window.to.toISOString(),
    },
  };
}
