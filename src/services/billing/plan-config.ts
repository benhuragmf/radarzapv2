import fs from 'fs';
import path from 'path';

/** Planos persistidos em Organization.plan (trial: só catálogo até TOP 17). */
export type OrgPlanId = 'free' | 'starter' | 'pro' | 'enterprise';
/** Todos os planos do catálogo comercial (inclui trial). */
export type CatalogPlanId = OrgPlanId | 'trial';
export type PurchasablePlanId = 'starter' | 'pro';

export interface PlanCommercialLimits {
  includedAgents: number;
  includedUsers: number;
  includedSupervisors: number;
  webchatWidgets: number;
  leadForms: number;
  departments: number;
  conversationsPerMonth: number;
  messagesPerDay: number;
  ticketsPerMonth: number;
  leadsPerMonth: number;
  contacts: number;
  whatsappDestinations: number;
  templatesMax: number;
  aiCreditsMonthly: number;
  monthlyLearningOps: number;
  historyRetentionDays: number;
  maxConcurrentChatsPerAgent: number;
}

export interface PlanCommercialFeatures {
  webchat: boolean;
  whatsapp: boolean;
  inbox: boolean;
  tickets: boolean;
  leads: boolean;
  contacts: boolean;
  forms: boolean;
  departments: boolean;
  basicAi: boolean;
  premiumAi: boolean;
  removeBranding: boolean;
  supervision: boolean;
  reports: boolean;
  prioritySupport: boolean;
  webhooks: boolean;
  api: boolean;
  export: boolean;
  audit: boolean;
  multiUser: boolean;
}

export interface PlanCatalogEntry {
  id: CatalogPlanId;
  name: string;
  description: string;
  isDefault?: boolean;
  purchasable?: boolean;
  comingSoon?: boolean;
  priceOnRequest?: boolean;
  trialDays?: number;
  priceMonthlyCents?: number;
  currency?: string;
  billingInterval?: 'month';
  stripePriceId?: string;
  /** Legado UI — bullets de marketing */
  features?: string[];
  featureBullets?: string[];
  recommendedFor?: string[];
  limits: PlanCommercialLimits;
  featuresFlags?: PlanCommercialFeatures;
  /** @deprecated use featureBullets — alias de leitura */
}

interface PlansDocument {
  schemaVersion?: number;
  extraUserPriceCentsMonthly?: number;
  aiCreditPacks?: Array<{
    id: string;
    credits: number;
    priceCents: number;
    currency: string;
    status?: string;
  }>;
  plans: Array<
    PlanCatalogEntry & {
      features?: string[] | PlanCommercialFeatures;
      featureBullets?: string[];
    }
  >;
}

/** Limites operacionais já aplicados em Organization/User (legado 3 campos). */
export interface PlanOperationalLimits {
  messagesPerDay: number;
  groupsMax: number;
  templatesMax: number;
}

const ENV_PRICE: Record<PurchasablePlanId, string> = {
  starter: 'STRIPE_PRICE_ID_STARTER',
  pro: 'STRIPE_PRICE_ID_PRO',
};

const PLAN_LABEL: Record<CatalogPlanId, string> = {
  trial: 'Trial',
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const COMMERCIAL_RANK: Record<CatalogPlanId, number> = {
  free: 0,
  trial: 1,
  starter: 2,
  pro: 3,
  enterprise: 4,
};

const REQUIRED_LIMIT_KEYS: (keyof PlanCommercialLimits)[] = [
  'includedAgents',
  'includedUsers',
  'includedSupervisors',
  'webchatWidgets',
  'leadForms',
  'departments',
  'conversationsPerMonth',
  'messagesPerDay',
  'ticketsPerMonth',
  'leadsPerMonth',
  'contacts',
  'whatsappDestinations',
  'templatesMax',
  'aiCreditsMonthly',
  'monthlyLearningOps',
  'historyRetentionDays',
  'maxConcurrentChatsPerAgent',
];

function normalizeEntry(raw: PlansDocument['plans'][number]): PlanCatalogEntry {
  const flags =
    raw.features && typeof raw.features === 'object' && !Array.isArray(raw.features)
      ? (raw.features as PlanCommercialFeatures)
      : undefined;
  const bullets = raw.featureBullets ?? (Array.isArray(raw.features) ? raw.features : undefined);
  return {
    ...raw,
    features: bullets,
    featuresFlags: flags,
    limits: raw.limits,
  };
}

export function resolveOperationalLimits(planId: string): PlanOperationalLimits {
  const entry = PlanConfigService.getInstance().findPlan(planId);
  if (entry?.limits) {
    return {
      messagesPerDay: entry.limits.messagesPerDay,
      groupsMax: entry.limits.whatsappDestinations,
      templatesMax: entry.limits.templatesMax,
    };
  }
  return { messagesPerDay: 10, groupsMax: 2, templatesMax: 2 };
}

export function validatePlanCatalog(doc: PlansDocument): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const requiredPlans: CatalogPlanId[] = ['trial', 'free', 'starter', 'pro', 'enterprise'];

  if (!doc.plans?.length) {
    errors.push('Catálogo vazio');
    return errors;
  }

  for (const id of requiredPlans) {
    if (!doc.plans.some(p => p.id === id)) {
      errors.push(`Plano obrigatório ausente: ${id}`);
    }
  }

  for (const raw of doc.plans) {
    const plan = normalizeEntry(raw);
    if (!plan.id) errors.push('Plano sem id');
    if (ids.has(plan.id)) errors.push(`ID duplicado: ${plan.id}`);
    ids.add(plan.id);

    if (!plan.name?.trim()) errors.push(`${plan.id}: sem name`);
    if (!plan.currency?.trim()) errors.push(`${plan.id}: sem currency`);
    if (!plan.limits) {
      errors.push(`${plan.id}: sem limits`);
      continue;
    }

    for (const key of REQUIRED_LIMIT_KEYS) {
      const v = plan.limits[key];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        errors.push(`${plan.id}: limits.${key} inválido`);
      } else if (key !== 'templatesMax' && key !== 'whatsappDestinations' && v < 0) {
        errors.push(`${plan.id}: limits.${key} negativo`);
      }
    }

    if (plan.purchasable && plan.id !== 'enterprise') {
      const cents = plan.priceMonthlyCents ?? 0;
      if (cents <= 0) {
        errors.push(`${plan.id}: plano pago sem priceMonthlyCents`);
      }
    }

    if (plan.id === 'enterprise' && plan.purchasable && !plan.priceOnRequest) {
      errors.push('enterprise: deve ser sob consulta (purchasable false ou priceOnRequest)');
    }

    if (plan.id === 'free' || plan.id === 'trial') {
      if (plan.purchasable) errors.push(`${plan.id}: não deve ser purchasable`);
    }
  }

  const rank = (id: CatalogPlanId) => COMMERCIAL_RANK[id] ?? -1;
  if (rank('free') >= rank('trial')) errors.push('Ordem: free deve ser menor que trial');
  if (rank('trial') >= rank('starter')) errors.push('Ordem: trial deve ser menor que starter');
  if (rank('starter') >= rank('pro')) errors.push('Ordem: starter deve ser menor que pro');
  if (rank('pro') >= rank('enterprise')) errors.push('Ordem: pro deve ser menor que enterprise');

  const aiByPlan: Record<string, number> = {};
  for (const p of doc.plans) {
    aiByPlan[p.id] = p.limits?.aiCreditsMonthly ?? -1;
  }
  if (aiByPlan.free !== 0) errors.push('free: aiCreditsMonthly deve ser 0');
  if (aiByPlan.trial !== 100) errors.push('trial: aiCreditsMonthly deve ser 100');
  if (aiByPlan.starter !== 400) errors.push('starter: aiCreditsMonthly deve ser 400');
  if (aiByPlan.pro !== 2500) errors.push('pro: aiCreditsMonthly deve ser 2500');
  if (aiByPlan.enterprise !== 12000) errors.push('enterprise: aiCreditsMonthly deve ser 12000');

  return errors;
}

export class PlanConfigService {
  private static instance: PlanConfigService;
  private catalog: PlanCatalogEntry[] = [];
  private meta: Pick<PlansDocument, 'schemaVersion' | 'extraUserPriceCentsMonthly' | 'aiCreditPacks'> =
    {};

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
    const doc = JSON.parse(raw) as PlansDocument;
    const validationErrors = validatePlanCatalog(doc);
    if (validationErrors.length) {
      throw new Error(`config/plans.json inválido:\n${validationErrors.join('\n')}`);
    }
    this.meta = {
      schemaVersion: doc.schemaVersion,
      extraUserPriceCentsMonthly: doc.extraUserPriceCentsMonthly,
      aiCreditPacks: doc.aiCreditPacks,
    };
    this.catalog = (doc.plans ?? []).map(normalizeEntry);
  }

  getMeta() {
    return { ...this.meta };
  }

  getCatalog(): PlanCatalogEntry[] {
    return this.catalog.map(p => ({ ...p, limits: { ...p.limits } }));
  }

  findPlan(planId: string): PlanCatalogEntry | undefined {
    return this.catalog.find(p => p.id === planId);
  }

  getCommercialLimits(planId: string): PlanCommercialLimits | undefined {
    return this.findPlan(planId)?.limits;
  }

  getStripePriceId(planId: PurchasablePlanId): string | null {
    const envKey = ENV_PRICE[planId];
    const fromEnv = process.env[envKey]?.trim();
    if (fromEnv) return fromEnv;
    const plan = this.findPlan(planId);
    const fromJson = plan?.stripePriceId?.trim();
    return fromJson || null;
  }

  planDisplayName(planId: OrgPlanId | CatalogPlanId | string): string {
    return PLAN_LABEL[planId as CatalogPlanId] ?? String(planId);
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

export function commercialPlanRank(planId: CatalogPlanId): number {
  return COMMERCIAL_RANK[planId] ?? 0;
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
