import { Organization, IOrganization } from '@/models/Organization';
import { User } from '@/models/User';
import { createServiceLogger } from '@/utils/logger';
import type { OrgPlanId } from '@/services/billing/plan-config';

const logger = createServiceLogger('SubscriptionExpiry');

export type ExpireSource = 'scheduled' | 'lazy_read' | 'stripe_subscription_deleted';

export class SubscriptionExpiryService {
  private static instance: SubscriptionExpiryService;
  private sweepTimer: NodeJS.Timeout | null = null;

  static getInstance(): SubscriptionExpiryService {
    if (!SubscriptionExpiryService.instance) {
      SubscriptionExpiryService.instance = new SubscriptionExpiryService();
    }
    return SubscriptionExpiryService.instance;
  }

  startSweep(intervalMs = Number(process.env.SUBSCRIPTION_SWEEP_MS) || 3_600_000): void {
    if (this.sweepTimer) return;
    const ms = Math.max(60_000, intervalMs);
    this.sweepTimer = setInterval(() => void this.sweepExpired(), ms);
    void this.sweepExpired();
  }

  async expireOrgIfNeeded(
    organizationId: string,
    source: ExpireSource = 'lazy_read',
  ): Promise<{ expired: boolean; planId?: OrgPlanId }> {
    const org = await Organization.findById(organizationId);
    if (!org || org.plan === 'free') return { expired: false };
    if (!org.planExpiresAt || org.planExpiresAt.getTime() > Date.now()) {
      return { expired: false };
    }
    return this.expireOrg(org, source);
  }

  async expireOrg(
    org: IOrganization,
    source: ExpireSource = 'scheduled',
  ): Promise<{ expired: boolean; planId: OrgPlanId }> {
    if (org.plan === 'free') {
      return { expired: false, planId: 'free' };
    }
    const previousPlan = org.plan;
    org.plan = 'free';
    org.stripeSubscriptionId = undefined;
    org.planExpiresAt = undefined;
    org.planActivatedAt = undefined;
    const limits = User.getPlanLimits('free');
    org.limits.messagesPerDay = limits.messagesPerDay;
    org.limits.groupsMax = limits.groupsMax;
    org.limits.templatesMax = limits.templatesMax;
    await org.save();
    logger.info('Plano expirado', {
      organizationId: String(org._id),
      previousPlan,
      source,
    });
    void import('@/services/inbox/panel-critical-alerts.service').then(({ PanelCriticalAlertsService }) => {
      PanelCriticalAlertsService.getInstance().notifyPlanExpired(String(org._id), previousPlan);
    });
    return { expired: true, planId: previousPlan };
  }

  async sweepExpired(): Promise<{ organizationsExpired: number }> {
    const now = new Date();
    const rows = await Organization.find({
      plan: { $ne: 'free' },
      planExpiresAt: { $lte: now },
    })
      .limit(100)
      .exec();

    let organizationsExpired = 0;
    for (const org of rows) {
      const result = await this.expireOrg(org, 'scheduled');
      if (result.expired) organizationsExpired += 1;
    }
    return { organizationsExpired };
  }

  async expireByStripeSubscriptionId(
    subscriptionId: string,
  ): Promise<{ expired: boolean }> {
    const sid = subscriptionId.trim();
    if (!sid) return { expired: false };

    const org = await Organization.findOne({ stripeSubscriptionId: sid });
    if (!org || org.plan === 'free') return { expired: false };

    const result = await this.expireOrg(org, 'stripe_subscription_deleted');
    return { expired: result.expired };
  }
}
