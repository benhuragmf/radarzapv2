import fs from 'fs';
import path from 'path';

export type OrgPlanId = 'free' | 'starter' | 'pro' | 'enterprise';
export type PurchasablePlanId = 'starter' | 'pro';

export interface PlanCatalogEntry {
  id: OrgPlanId;
  name: string;
  description: string;
  isDefault?: boolean;
  purchasable?: boolean;
  comingSoon?: boolean;
  priceMonthlyCents?: number;
  currency?: string;
  stripePriceId?: string;
  features?: string[];
  recommendedFor?: string[];
}

const ENV_PRICE: Record<PurchasablePlanId, string> = {
  starter: 'STRIPE_PRICE_ID_STARTER',
  pro: 'STRIPE_PRICE_ID_PRO',
};

const PLAN_LABEL: Record<OrgPlanId, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export class PlanConfigService {
  private static instance: PlanConfigService;
  private catalog: PlanCatalogEntry[] = [];

  static getInstance(): PlanConfigService {
    if (!PlanConfigService.instance) PlanConfigService.instance = new PlanConfigService();
    return PlanConfigService.instance;
  }

  constructor() {
    this.reload();
  }

  reload(): void {
    const filePath = path.resolve(process.cwd(), 'config/plans.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const doc = JSON.parse(raw) as { plans: PlanCatalogEntry[] };
    this.catalog = doc.plans ?? [];
  }

  getCatalog(): PlanCatalogEntry[] {
    return this.catalog.map(p => ({ ...p }));
  }

  findPlan(planId: string): PlanCatalogEntry | undefined {
    return this.catalog.find(p => p.id === planId);
  }

  getStripePriceId(planId: PurchasablePlanId): string | null {
    const envKey = ENV_PRICE[planId];
    const fromEnv = process.env[envKey]?.trim();
    if (fromEnv) return fromEnv;
    const plan = this.findPlan(planId);
    const fromJson = plan?.stripePriceId?.trim();
    return fromJson || null;
  }

  planDisplayName(planId: OrgPlanId | string): string {
    return PLAN_LABEL[planId as OrgPlanId] ?? String(planId);
  }
}

export function planRank(planId: OrgPlanId): number {
  switch (planId) {
    case 'free':
      return 0;
    case 'starter':
      return 1;
    case 'pro':
      return 2;
    case 'enterprise':
      return 3;
    default:
      return 0;
  }
}

export function canSubscribeToPlan(
  currentPlan: OrgPlanId,
  targetPlan: PurchasablePlanId,
): { ok: true } | { ok: false; reason: string } {
  if (planRank(currentPlan) >= planRank(targetPlan)) {
    return {
      ok: false,
      reason: `Sua empresa já está no plano ${PlanConfigService.getInstance().planDisplayName(currentPlan)} ou superior`,
    };
  }
  return { ok: true };
}
