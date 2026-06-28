import mongoose from 'mongoose';
import { stripeSecretKeyStatus } from '@/config/billing-env';
import { Organization, type IOrganization } from '@/models/Organization';
import { WhatsAppSession } from '@/models/WhatsAppSession';
import { CompanyMember } from '@/models/CompanyMember';
import { User } from '@/models/User';
import { writeAuditLog } from '@/models/AuditLog';
import {
  normalizeBillingStatus,
  type BillingProductStatus,
} from '@/services/billing/billing-state.util';
import type { OrgPlanId } from '@/services/billing/plan-config';
import { escapeMongoRegex } from '@/utils/redact-sensitive';
import type {
  AdminOpsOrganizationRow,
  AdminOpsOrganizationsPage,
  AdminOpsOrgPlan,
  AdminOpsOrgSort,
  CancelAdminOpsOrganizationTrialInput,
  ChangeAdminOpsOrganizationPlanInput,
  ExtendAdminOpsOrganizationTrialInput,
  ListAdminOpsOrganizationsParams,
} from '@/types/admin-ops-organizations';
import { invalidateAdminOpsSummaryCache } from './admin-ops-summary.service';
import { buildMongoFilterForAdminOpsBillingStatus } from './admin-ops-billing-status-filter.util';

const PAID_PLANS: AdminOpsOrgPlan[] = ['starter', 'pro', 'enterprise'];
const ALL_PLANS: AdminOpsOrgPlan[] = ['free', ...PAID_PLANS];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function validateAdminOpsReason(reason: unknown): string {
  const value = String(reason ?? '').trim();
  if (value.length < 5) {
    throw new Error('Motivo obrigatório (mínimo 5 caracteres)');
  }
  if (value.length > 300) {
    throw new Error('Motivo muito longo (máximo 300 caracteres)');
  }
  return value;
}

function parsePage(value: unknown, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function parseLimit(value: unknown, fallback = 25): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(100, Math.floor(n));
}

function parseSort(value: unknown): AdminOpsOrgSort {
  if (value === 'name' || value === 'planExpiresAt') return value;
  return 'createdAt';
}

function resolveStripeModeHint(): AdminOpsOrganizationRow['stripeModeHint'] {
  const status = stripeSecretKeyStatus();
  if (status === 'test') return 'test';
  if (status === 'live') return 'live';
  return 'none';
}

function assertPlan(value: unknown): AdminOpsOrgPlan {
  const plan = String(value ?? '').trim() as AdminOpsOrgPlan;
  if (!ALL_PLANS.includes(plan)) {
    throw new Error('Plano inválido');
  }
  return plan;
}

function assertPaidPlan(value: unknown): Exclude<AdminOpsOrgPlan, 'free'> {
  const plan = assertPlan(value);
  if (plan === 'free') {
    throw new Error('Plano pago inválido para trial');
  }
  return plan;
}

function billingSnapshot(org: Pick<IOrganization, 'plan' | 'planExpiresAt' | 'stripeSubscriptionStatus'>) {
  return normalizeBillingStatus({
    plan: org.plan as OrgPlanId,
    planExpiresAt: org.planExpiresAt,
    stripeSubscriptionStatus: org.stripeSubscriptionStatus,
  });
}

function applyOrganizationPlanLimits(org: IOrganization, plan: AdminOpsOrgPlan): void {
  const limits = User.getPlanLimits(plan);
  org.limits.messagesPerDay = limits.messagesPerDay;
  org.limits.groupsMax = limits.groupsMax;
  org.limits.templatesMax = limits.templatesMax;
}

async function auditAdminOpsMutation(
  action: string,
  actorUserId: string,
  organizationId: string,
  details: Record<string, unknown>,
  ip?: string,
): Promise<void> {
  await writeAuditLog({
    action,
    actorUserId,
    details: {
      organizationId,
      ...details,
    },
    ip,
  });
}

async function enrichOrganizationRows(
  docs: Array<{
    _id: mongoose.Types.ObjectId;
    name: string;
    plan: AdminOpsOrgPlan;
    planExpiresAt?: Date | null;
    stripeSubscriptionStatus?: string | null;
    createdAt: Date;
  }>,
): Promise<AdminOpsOrganizationRow[]> {
  if (!docs.length) return [];

  const ids = docs.map(d => d._id);
  const stripeModeHint = resolveStripeModeHint();

  const [waRows, memberRows] = await Promise.all([
    WhatsAppSession.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
      { $match: { clientId: { $in: ids }, status: 'active' } },
      { $group: { _id: '$clientId', n: { $sum: 1 } } },
    ]),
    CompanyMember.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
      { $match: { organizationId: { $in: ids }, isActive: true } },
      { $group: { _id: '$organizationId', n: { $sum: 1 } } },
    ]),
  ]);

  const waMap = new Map(waRows.map(r => [String(r._id), r.n > 0]));
  const memberMap = new Map(memberRows.map(r => [String(r._id), r.n]));

  return docs.map(doc => ({
    id: String(doc._id),
    name: doc.name,
    plan: doc.plan,
    billingStatus: billingSnapshot(doc),
    planExpiresAt: doc.planExpiresAt ? doc.planExpiresAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    stripeModeHint,
    waConnected: waMap.get(String(doc._id)) ?? false,
    membersCount: memberMap.get(String(doc._id)) ?? 0,
  }));
}

function buildListFilter(params: ListAdminOpsOrganizationsParams): Record<string, unknown> {
  const search = String(params.search ?? '').trim().slice(0, 80);
  const clauses: Record<string, unknown>[] = [];

  if (params.plan) {
    clauses.push({ plan: params.plan });
  }
  if (search) {
    clauses.push({ name: { $regex: escapeMongoRegex(search), $options: 'i' } });
  }
  if (params.status) {
    clauses.push(buildMongoFilterForAdminOpsBillingStatus(params.status));
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { $and: clauses };
}

export async function listAdminOpsOrganizations(
  params: ListAdminOpsOrganizationsParams,
): Promise<AdminOpsOrganizationsPage> {
  const page = parsePage(params.page);
  const limit = parseLimit(params.limit);
  const sort = parseSort(params.sort);
  const filter = buildListFilter(params);

  const select =
    'name plan planExpiresAt stripeSubscriptionStatus createdAt' as const;

  const sortSpec: Record<string, 1 | -1> =
    sort === 'name'
      ? { name: 1 }
      : sort === 'planExpiresAt'
        ? { planExpiresAt: -1, createdAt: -1 }
        : { createdAt: -1 };

  const [total, docs] = await Promise.all([
    Organization.countDocuments(filter),
    Organization.find(filter)
      .select(select)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const items = await enrichOrganizationRows(
    docs.map(doc => ({
      _id: doc._id as mongoose.Types.ObjectId,
      name: doc.name,
      plan: doc.plan as AdminOpsOrgPlan,
      planExpiresAt: doc.planExpiresAt,
      stripeSubscriptionStatus: doc.stripeSubscriptionStatus,
      createdAt: doc.createdAt ?? new Date(),
    })),
  );

  return {
    items,
    page,
    limit,
    total,
    totalPages,
    generatedAt: new Date().toISOString(),
  };
}

async function loadOrganizationOrThrow(id: string): Promise<IOrganization> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Organização inválida');
  }
  const org = await Organization.findById(id);
  if (!org) {
    throw new Error('Organização não encontrada');
  }
  return org;
}

export async function changeAdminOpsOrganizationPlan(
  organizationId: string,
  input: ChangeAdminOpsOrganizationPlanInput,
): Promise<{ ok: true; plan: AdminOpsOrgPlan; planExpiresAt: string | null }> {
  const reason = validateAdminOpsReason(input.reason);
  const plan = assertPlan(input.plan);
  const org = await loadOrganizationOrThrow(organizationId);

  const previousPlan = org.plan as AdminOpsOrgPlan;
  const previousPlanExpiresAt = org.planExpiresAt?.toISOString() ?? null;
  const previousBillingStatus = billingSnapshot(org);

  org.plan = plan;

  if (plan === 'free') {
    org.planExpiresAt = undefined;
    org.stripeSubscriptionId = undefined;
    org.stripeSubscriptionStatus = undefined;
    org.stripePastDueAt = undefined;
  } else if (input.expiresAt) {
    const parsed = new Date(input.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Data de expiração inválida');
    }
    org.planExpiresAt = parsed;
  } else if (!org.planExpiresAt || org.planExpiresAt.getTime() <= Date.now()) {
    org.planExpiresAt = new Date(Date.now() + 30 * MS_PER_DAY);
  }

  if (plan !== 'free' && !org.stripeSubscriptionStatus) {
    org.stripeSubscriptionStatus = 'manual';
  }

  applyOrganizationPlanLimits(org, plan);
  await org.save();

  const newBillingStatus = billingSnapshot(org);

  await auditAdminOpsMutation(
    'admin.plan.changed',
    input.actorUserId,
    organizationId,
    {
      previousPlan,
      newPlan: plan,
      previousPlanExpiresAt,
      newPlanExpiresAt: org.planExpiresAt?.toISOString() ?? null,
      previousBillingStatus,
      newBillingStatus,
      reason,
    },
    input.ip,
  );

  await invalidateAdminOpsSummaryCache();

  return {
    ok: true,
    plan,
    planExpiresAt: org.planExpiresAt?.toISOString() ?? null,
  };
}

export async function extendAdminOpsOrganizationTrial(
  organizationId: string,
  input: ExtendAdminOpsOrganizationTrialInput,
): Promise<{ ok: true; plan: AdminOpsOrgPlan; planExpiresAt: string }> {
  const reason = validateAdminOpsReason(input.reason);
  const days = Math.floor(Number(input.days));
  if (!Number.isFinite(days) || days < 1 || days > 90) {
    throw new Error('Dias inválidos (use 1 a 90)');
  }

  const org = await loadOrganizationOrThrow(organizationId);
  const previousPlan = org.plan as AdminOpsOrgPlan;
  const previousPlanExpiresAt = org.planExpiresAt?.toISOString() ?? null;
  const previousBillingStatus = billingSnapshot(org);

  const targetPlan =
    input.plan ??
    (previousPlan === 'free' ? 'starter' : (previousPlan as Exclude<AdminOpsOrgPlan, 'free'>));

  if (input.plan) {
    assertPaidPlan(input.plan);
  }

  org.plan = targetPlan;

  const base = Math.max(Date.now(), org.planExpiresAt?.getTime() ?? Date.now());
  org.planExpiresAt = new Date(base + days * MS_PER_DAY);
  org.stripeSubscriptionStatus = 'trialing';
  applyOrganizationPlanLimits(org, targetPlan);
  await org.save();

  const newBillingStatus = billingSnapshot(org);

  await auditAdminOpsMutation(
    'admin.trial.extended',
    input.actorUserId,
    organizationId,
    {
      previousPlan,
      newPlan: targetPlan,
      previousPlanExpiresAt,
      newPlanExpiresAt: org.planExpiresAt.toISOString(),
      previousBillingStatus,
      newBillingStatus,
      days,
      reason,
    },
    input.ip,
  );

  await invalidateAdminOpsSummaryCache();

  return {
    ok: true,
    plan: targetPlan,
    planExpiresAt: org.planExpiresAt.toISOString(),
  };
}

export async function cancelAdminOpsOrganizationTrial(
  organizationId: string,
  input: CancelAdminOpsOrganizationTrialInput,
): Promise<{ ok: true; plan: 'free' }> {
  const reason = validateAdminOpsReason(input.reason);
  const org = await loadOrganizationOrThrow(organizationId);

  const previousPlan = org.plan as AdminOpsOrgPlan;
  const previousPlanExpiresAt = org.planExpiresAt?.toISOString() ?? null;
  const previousBillingStatus = billingSnapshot(org);

  org.plan = 'free';
  org.planExpiresAt = undefined;
  org.stripeSubscriptionId = undefined;
  org.stripeSubscriptionStatus = undefined;
  org.stripePastDueAt = undefined;
  applyOrganizationPlanLimits(org, 'free');
  await org.save();

  await auditAdminOpsMutation(
    'admin.trial.cancelled',
    input.actorUserId,
    organizationId,
    {
      previousPlan,
      newPlan: 'free',
      previousPlanExpiresAt,
      newPlanExpiresAt: null,
      previousBillingStatus,
      newBillingStatus: 'free' as BillingProductStatus,
      reason,
    },
    input.ip,
  );

  await invalidateAdminOpsSummaryCache();

  return { ok: true, plan: 'free' };
}

/** Garante que rows públicas não vazam campos sensíveis — usado em testes. */
export function assertSafeOrganizationRow(row: AdminOpsOrganizationRow): void {
  const json = JSON.stringify(row);
  const forbidden = [
    'stripeSubscriptionId',
    'sessionData',
    'sk_test_',
    'sk_live_',
    'whsec_',
    'ownerUserId',
    'publicAccessToken',
  ];
  for (const token of forbidden) {
    if (json.includes(token)) {
      throw new Error(`Campo sensível detectado na row: ${token}`);
    }
  }
}
