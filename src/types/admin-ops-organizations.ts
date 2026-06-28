export type AdminOpsOrgPlan = 'free' | 'starter' | 'pro' | 'enterprise';

export type AdminOpsOrgBillingStatus =
  | 'free'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'paused'
  | 'incomplete'
  | 'manual';

export type AdminOpsOrgSort = 'createdAt' | 'name' | 'planExpiresAt';

export interface AdminOpsOrganizationRow {
  id: string;
  name: string;
  plan: AdminOpsOrgPlan;
  billingStatus: AdminOpsOrgBillingStatus;
  planExpiresAt?: string | null;
  createdAt: string;
  stripeModeHint?: 'none' | 'test' | 'live';
  waConnected: boolean;
  membersCount?: number;
}

export interface AdminOpsOrganizationsPage {
  items: AdminOpsOrganizationRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  generatedAt: string;
}

export interface ListAdminOpsOrganizationsParams {
  page?: number | string;
  limit?: number | string;
  plan?: AdminOpsOrgPlan;
  status?: AdminOpsOrgBillingStatus;
  search?: string;
  sort?: AdminOpsOrgSort;
}

export interface ChangeAdminOpsOrganizationPlanInput {
  plan: AdminOpsOrgPlan;
  expiresAt?: string | null;
  reason: string;
  actorUserId: string;
  ip?: string;
}

export interface ExtendAdminOpsOrganizationTrialInput {
  days: number;
  reason: string;
  plan?: Exclude<AdminOpsOrgPlan, 'free'>;
  actorUserId: string;
  ip?: string;
}

export interface CancelAdminOpsOrganizationTrialInput {
  reason: string;
  actorUserId: string;
  ip?: string;
}
