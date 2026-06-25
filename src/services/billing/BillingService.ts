import mongoose from 'mongoose';
import { config } from '@/config/environment';
import {
  logBillingEnvOnBoot,
  stripeSecretKey,
  stripeSecretKeyStatus,
  stripeWebhookSecret,
} from '@/config/billing-env';
import { BillingOrder } from '@/models/BillingOrder';
import { Organization, IOrganization } from '@/models/Organization';
import {
  canSubscribeToPlan,
  PlanConfigService,
  type OrgPlanId,
  type PurchasablePlanId,
} from '@/services/billing/plan-config';
import {
  parseStripeWebhookEvent,
  verifyStripeWebhookSignature,
} from '@/services/billing/stripe-webhook.util';
import { SubscriptionExpiryService } from '@/services/billing/subscription-expiry.service';
import {
  addDays,
  computeSubscriptionStatus,
  formatDatePtBr,
  formatTimeRemaining,
  isPaidPlanActive,
} from '@/services/billing/subscription.util';
import {
  isBillingInGrace,
  normalizeBillingStatus,
  shouldBlockPaidFeatures,
} from '@/services/billing/billing-state.util';
import { findAiCreditPackById } from '@/types/ai-credit-packages.util';
import { AiWalletService } from '@/services/ai/AiWalletService';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('BillingService');

type ActivateSource = 'stripe_webhook' | 'stripe_confirm' | 'manual' | 'dev';

export class BillingHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'BillingHttpError';
  }
}

export class BillingService {
  private static instance: BillingService;
  private planConfig = PlanConfigService.getInstance();
  private expiry = SubscriptionExpiryService.getInstance();

  static getInstance(): BillingService {
    if (!BillingService.instance) BillingService.instance = new BillingService();
    return BillingService.instance;
  }

  initialize(): void {
    logBillingEnvOnBoot();
    this.expiry.startSweep();
  }

  private canUseDevBilling(): boolean {
    if (process.env.ALLOW_DEV_BILLING === 'true') return true;
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }

  private assertPurchasable(planId: string): PurchasablePlanId {
    if (planId !== 'starter' && planId !== 'pro') {
      throw new BillingHttpError('planId deve ser starter ou pro', 400);
    }
    const plan = this.planConfig.findPlan(planId);
    if (!plan?.purchasable) {
      throw new BillingHttpError(`Plano ${planId} não disponível para compra`, 400);
    }
    return planId;
  }

  getPricing() {
    const secret = stripeSecretKey();
    const devBilling = this.canUseDevBilling();
    const plans = this.planConfig
      .getCatalog()
      .filter(p => p.purchasable)
      .map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceMonthlyCents: p.priceMonthlyCents ?? 0,
        currency: p.currency ?? 'BRL',
        stripeEnabled: Boolean(
          secret && this.planConfig.getStripePriceId(p.id as PurchasablePlanId),
        ),
        features: p.features ?? [],
        recommendedFor: p.recommendedFor ?? [],
      }));

    const starterPriceId = this.planConfig.getStripePriceId('starter');
    const proPriceId = this.planConfig.getStripePriceId('pro');

    return {
      plans: this.planConfig.getCatalog(),
      purchasablePlans: plans,
      stripeEnabled: plans.some(p => p.stripeEnabled),
      stripeConfigured: Boolean(secret),
      stripeTestMode: Boolean(secret?.startsWith('sk_test_')),
      webhookConfigured: Boolean(stripeWebhookSecret()),
      devBillingEnabled: devBilling,
      setup: {
        hasSecretKey: Boolean(secret),
        secretKeyStatus: stripeSecretKeyStatus(),
        hasStarterPrice: Boolean(starterPriceId),
        hasProPrice: Boolean(proPriceId),
        ready: Boolean(secret && starterPriceId && proPriceId),
      },
    };
  }

  async createCheckout(userId: string, organizationId: string, planIdRaw?: string) {
    const planId = this.assertPurchasable(planIdRaw ?? 'pro');
    const org = await Organization.findById(organizationId);
    if (!org) throw new BillingHttpError('Organização não encontrada', 404);

    await this.expiry.expireOrgIfNeeded(organizationId);
    const refreshed = await Organization.findById(organizationId);
    const currentPlan = (refreshed?.plan ?? 'free') as OrgPlanId;
    const gate = canSubscribeToPlan(currentPlan, planId);
    if (gate.ok === false) {
      return {
        ok: true,
        alreadySubscribed: true,
        organizationId,
        planId: currentPlan,
        message: gate.reason,
      };
    }

    const catalog = this.planConfig.findPlan(planId)!;
    const stripePriceId = this.planConfig.getStripePriceId(planId);
    const secret = stripeSecretKey();
    const amountCents = catalog.priceMonthlyCents ?? 0;
    const currency = catalog.currency ?? 'BRL';

    if (!secret || !stripePriceId) {
      const order = await BillingOrder.create({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        userId: new mongoose.Types.ObjectId(userId),
        status: 'pending',
        amountCents,
        currency,
        planId,
      });
      return {
        ok: true,
        mode: 'manual' as const,
        planId,
        orderId: String(order._id),
        amountCents,
        currency,
        message:
          'Configure STRIPE_SECRET_KEY e STRIPE_PRICE_ID_* no .env para checkout Stripe.',
      };
    }

    const webOrigin = config.DASHBOARD.FRONTEND_URL;
    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    params.set(
      'success_url',
      `${webOrigin}/plans?checkout=success&session_id={CHECKOUT_SESSION_ID}&organizationId=${encodeURIComponent(organizationId)}&planId=${encodeURIComponent(planId)}`,
    );
    params.set('cancel_url', `${webOrigin}/plans?checkout=cancel`);
    params.set('client_reference_id', organizationId);
    params.set('metadata[organizationId]', organizationId);
    params.set('metadata[userId]', userId);
    params.set('metadata[planId]', planId);
    params.set('line_items[0][price]', stripePriceId);
    params.set('line_items[0][quantity]', '1');

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let detail = text.slice(0, 300);
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } };
        if (parsed.error?.message) detail = parsed.error.message;
      } catch {
        /* raw */
      }
      throw new BillingHttpError(`Stripe: ${detail}`, 400);
    }

    const session = (await res.json()) as { id: string; url: string };
    await BillingOrder.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      userId: new mongoose.Types.ObjectId(userId),
      status: 'pending',
      amountCents,
      currency,
      planId,
      stripeSessionId: session.id,
    });

    return { ok: true, mode: 'stripe' as const, planId, url: session.url };
  }

  async createAiCreditPackCheckout(
    userId: string,
    organizationId: string,
    packIdRaw?: string,
  ) {
    const packId = String(packIdRaw ?? '').trim();
    const pack = findAiCreditPackById(packId);
    if (!pack) throw new BillingHttpError('Pacote de créditos inválido', 400);

    const org = await Organization.findById(organizationId);
    if (!org) throw new BillingHttpError('Organização não encontrada', 404);

    const secret = stripeSecretKey();
    const amountCents = pack.priceCents;
    const currency = pack.currency ?? 'BRL';

    if (!secret) {
      const order = await BillingOrder.create({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        userId: new mongoose.Types.ObjectId(userId),
        status: 'pending',
        orderKind: 'ai_credit_pack',
        planId: packId,
        creditPackId: packId,
        creditsGranted: pack.credits,
        amountCents,
        currency,
      });
      return {
        ok: true,
        mode: 'manual' as const,
        packId,
        orderId: String(order._id),
        amountCents,
        currency,
        credits: pack.credits,
        message:
          'Configure STRIPE_SECRET_KEY no .env para checkout Stripe de pacotes IA.',
      };
    }

    const webOrigin = config.DASHBOARD.FRONTEND_URL;
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set(
      'success_url',
      `${webOrigin}/platform/ai?checkout=success&session_id={CHECKOUT_SESSION_ID}&packId=${encodeURIComponent(packId)}`,
    );
    params.set('cancel_url', `${webOrigin}/platform/ai?checkout=cancel`);
    params.set('client_reference_id', organizationId);
    params.set('metadata[organizationId]', organizationId);
    params.set('metadata[userId]', userId);
    params.set('metadata[orderKind]', 'ai_credit_pack');
    params.set('metadata[creditPackId]', packId);
    params.set('metadata[credits]', String(pack.credits));
    params.set('line_items[0][price_data][currency]', currency.toLowerCase());
    params.set('line_items[0][price_data][unit_amount]', String(amountCents));
    params.set(
      'line_items[0][price_data][product_data][name]',
      `IA Créditos — ${pack.credits.toLocaleString('pt-BR')} créditos`,
    );
    params.set('line_items[0][quantity]', '1');

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let detail = text.slice(0, 300);
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } };
        if (parsed.error?.message) detail = parsed.error.message;
      } catch {
        /* raw */
      }
      throw new BillingHttpError(`Stripe: ${detail}`, 400);
    }

    const session = (await res.json()) as { id: string; url: string };
    await BillingOrder.create({
      organizationId: new mongoose.Types.ObjectId(organizationId),
      userId: new mongoose.Types.ObjectId(userId),
      status: 'pending',
      orderKind: 'ai_credit_pack',
      planId: packId,
      creditPackId: packId,
      creditsGranted: pack.credits,
      amountCents,
      currency,
      stripeSessionId: session.id,
    });

    return {
      ok: true,
      mode: 'stripe' as const,
      packId,
      credits: pack.credits,
      url: session.url,
    };
  }

  isAiCreditPackCheckoutEnabled(): boolean {
    return Boolean(stripeSecretKey());
  }

  async confirmCheckout(userId: string, organizationId: string, sessionId: string) {
    const secret = stripeSecretKey();
    if (!secret) throw new BillingHttpError('Stripe não configurado', 400);

    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    if (!res.ok) throw new BillingHttpError('Sessão Stripe inválida', 400);

    const session = (await res.json()) as {
      payment_status: string;
      status: string;
      subscription?: string;
      metadata?: { organizationId?: string; planId?: string; userId?: string };
      client_reference_id?: string;
    };

    const metaOrgId =
      session.metadata?.organizationId ?? session.client_reference_id ?? '';
    if (metaOrgId !== organizationId) {
      throw new BillingHttpError('Sessão não corresponde à organização', 400);
    }

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      throw new BillingHttpError('Pagamento ainda não confirmado', 400);
    }

    const metadata =
      session.metadata && typeof session.metadata === 'object' && !Array.isArray(session.metadata)
        ? (session.metadata as Record<string, unknown>)
        : {};
    const orderKind = String(metadata.orderKind ?? 'subscription').trim();

    if (orderKind === 'ai_credit_pack') {
      return this.confirmAiCreditPackCheckout(organizationId, userId, sessionId, metadata);
    }

    const planId = this.assertPurchasable(String(metadata.planId ?? 'pro'));
    const existing = await BillingOrder.findOne({
      stripeSessionId: sessionId,
      organizationId,
      status: 'paid',
    });
    const org = await Organization.findById(organizationId);
    if (existing && org?.plan === planId && isPaidPlanActive(org.plan, org.planExpiresAt)) {
      return {
        ok: true,
        organizationId,
        plan: org.plan,
        planId,
        alreadyActive: true,
      };
    }

    return this.activatePlan(
      organizationId,
      userId,
      planId,
      sessionId,
      'stripe_confirm',
      String(session.subscription ?? '').trim() || undefined,
    );
  }

  async handleStripeWebhook(rawBody: Buffer, signatureHeader: string) {
    const secret = stripeWebhookSecret();
    if (!secret) throw new BillingHttpError('STRIPE_WEBHOOK_SECRET não configurado', 400);
    if (!verifyStripeWebhookSignature(rawBody, signatureHeader, secret)) {
      throw new BillingHttpError('Assinatura Stripe inválida', 401);
    }

    const event = parseStripeWebhookEvent(rawBody);
    switch (event.type) {
      case 'checkout.session.completed':
        return this.onCheckoutSessionCompleted(event.data.object);
      case 'checkout.session.expired':
        return this.onCheckoutSessionExpired(event.data.object);
      case 'invoice.paid':
        return this.onInvoicePaid(event.data.object);
      case 'invoice.payment_failed':
        return this.onInvoicePaymentFailed(event.data.object);
      case 'customer.subscription.deleted':
        return this.onCustomerSubscriptionDeleted(event.data.object);
      default:
        return { ok: true, ignored: event.type };
    }
  }

  async getSubscription(organizationId: string) {
    await this.expiry.expireOrgIfNeeded(organizationId);
    const org = await Organization.findById(organizationId).lean();
    if (!org) throw new BillingHttpError('Organização não encontrada', 404);

    const planId = org.plan as OrgPlanId;
    const status = computeSubscriptionStatus(planId, org.planExpiresAt);
    const billingStatus = normalizeBillingStatus({
      plan: planId,
      planExpiresAt: org.planExpiresAt,
      stripeSubscriptionStatus: org.stripeSubscriptionStatus,
    });
    const inGrace = isBillingInGrace(
      billingStatus,
      org.stripePastDueAt,
    );
    const paidFeaturesBlocked = shouldBlockPaidFeatures(billingStatus, { inGrace });
    const remaining = formatTimeRemaining(org.planExpiresAt);
    const catalog = this.planConfig.findPlan(planId);
    const orders = await BillingOrder.find({ organizationId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const lastPaid = orders.find(o => o.status === 'paid') ?? null;
    let activatedAt = org.planActivatedAt;
    let expiresAt = org.planExpiresAt;
    if (planId !== 'free' && !expiresAt) {
      activatedAt = activatedAt ?? lastPaid?.paidAt ?? lastPaid?.createdAt ?? org.updatedAt;
      expiresAt = addDays(activatedAt ?? new Date(), 30);
    }

    return {
      organizationId: String(org._id),
      organizationName: org.name,
      planId,
      planName: this.planConfig.planDisplayName(planId),
      status,
      billingStatus,
      inGracePeriod: inGrace,
      paidFeaturesBlocked,
      plan: planId,
      isActive: planId === 'free' || status === 'active' || status === 'expiring_soon',
      activatedAt: activatedAt?.toISOString() ?? null,
      expiresAt: expiresAt?.toISOString() ?? null,
      activatedAtLabel: formatDatePtBr(activatedAt),
      expiresAtLabel: formatDatePtBr(expiresAt),
      timeRemaining: remaining.label,
      daysRemaining: remaining.daysRemaining,
      hoursRemaining: remaining.hoursRemaining,
      stripeSubscriptionId: org.stripeSubscriptionId ?? null,
      limits: org.limits,
      usage: org.usage,
      priceMonthlyCents: catalog?.priceMonthlyCents ?? null,
      currency: catalog?.currency ?? 'BRL',
      features: catalog?.features ?? [],
      recommendedFor: catalog?.recommendedFor ?? [],
      lastPayment: lastPaid
        ? {
            orderId: String(lastPaid._id),
            planId: lastPaid.planId,
            amountCents: lastPaid.amountCents,
            currency: lastPaid.currency,
            paidAt: lastPaid.paidAt?.toISOString() ?? null,
            paidAtLabel: formatDatePtBr(lastPaid.paidAt),
          }
        : null,
      orders: orders.map(o => ({
        id: String(o._id),
        status: o.status,
        orderKind: o.orderKind ?? 'subscription',
        planId: o.planId,
        creditPackId: o.creditPackId ?? null,
        planName: this.planConfig.planDisplayName(o.planId),
        amountCents: o.amountCents,
        currency: o.currency,
        createdAt: o.createdAt.toISOString(),
        paidAt: o.paidAt?.toISOString() ?? null,
      })),
    };
  }

  async listOrdersAdmin(limit = 50) {
    return BillingOrder.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('organizationId', 'name plan')
      .populate('userId', 'email displayName')
      .lean();
  }

  async runSubscriptionSweep() {
    return this.expiry.sweepExpired();
  }

  async devActivateOrganization(
    organizationId: string,
    userId: string,
    planIdRaw: string,
  ) {
    if (!this.canUseDevBilling()) {
      throw new BillingHttpError('Billing dev desabilitado', 403);
    }
    const planId = this.assertPurchasable(planIdRaw);
    return this.activatePlan(organizationId, userId, planId, undefined, 'dev');
  }

  private async activatePlan(
    organizationId: string,
    userId: string,
    planId: PurchasablePlanId,
    stripeSessionId?: string,
    source: ActivateSource = 'manual',
    stripeSubscriptionId?: string,
  ) {
    const now = new Date();
    const expiresAt = addDays(now, 30);

    const org = await Organization.findById(organizationId);
    if (!org) throw new BillingHttpError('Organização não encontrada', 404);

    await org.upgradePlan(planId);
    org.planActivatedAt = now;
    org.planExpiresAt = expiresAt;
    if (stripeSubscriptionId) org.stripeSubscriptionId = stripeSubscriptionId;
    await org.save();

    if (stripeSessionId) {
      await BillingOrder.updateMany(
        { stripeSessionId, organizationId },
        { status: 'paid', paidAt: now, planId },
      );
    }

    logger.info('Plano ativado', { organizationId, planId, source, userId });

    return {
      ok: true,
      organizationId,
      plan: planId,
      planId,
      expiresAt: expiresAt.toISOString(),
      source,
    };
  }

  private async onCheckoutSessionCompleted(session: Record<string, unknown>) {
    const paymentStatus = String(session.payment_status ?? '');
    const status = String(session.status ?? '');
    if (paymentStatus !== 'paid' && status !== 'complete') {
      return { ok: true, skipped: 'payment_not_complete', paymentStatus, status };
    }

    const metadata =
      session.metadata && typeof session.metadata === 'object' && !Array.isArray(session.metadata)
        ? (session.metadata as Record<string, unknown>)
        : {};
    const organizationId = String(
      metadata.organizationId ?? session.client_reference_id ?? '',
    ).trim();
    const userId = String(metadata.userId ?? '').trim();
    const sessionId = String(session.id ?? '').trim();
    const orderKind = String(metadata.orderKind ?? 'subscription').trim();

    if (!organizationId || !userId || !sessionId) {
      throw new BillingHttpError('Sessão Stripe sem organizationId/userId', 400);
    }

    if (orderKind === 'ai_credit_pack') {
      return this.fulfillAiCreditPackPurchase({
        organizationId,
        userId,
        sessionId,
        creditPackId: String(metadata.creditPackId ?? '').trim(),
        credits: Number(metadata.credits ?? 0),
        source: 'stripe_webhook',
      });
    }

    const planId = this.assertPurchasable(String(metadata.planId ?? 'pro'));
    const stripeSubscriptionId = String(session.subscription ?? '').trim() || undefined;

    const org = await Organization.findById(organizationId);
    if (!org) throw new BillingHttpError('Organização não encontrada', 404);

    const paidOrder = await BillingOrder.findOne({
      stripeSessionId: sessionId,
      status: 'paid',
    });
    if (
      paidOrder &&
      org.plan === planId &&
      isPaidPlanActive(org.plan, org.planExpiresAt)
    ) {
      return { ok: true, organizationId, planId, alreadyActive: true };
    }

    return this.activatePlan(
      organizationId,
      userId,
      planId,
      sessionId,
      'stripe_webhook',
      stripeSubscriptionId,
    );
  }

  private async onCheckoutSessionExpired(session: Record<string, unknown>) {
    const sessionId = String(session.id ?? '').trim();
    if (!sessionId) return { ok: true, skipped: 'missing_session_id' };
    const result = await BillingOrder.updateMany(
      { stripeSessionId: sessionId, status: 'pending' },
      { status: 'cancelled' },
    );
    return { ok: true, cancelledOrders: result.modifiedCount };
  }

  private async onInvoicePaid(invoice: Record<string, unknown>) {
    const subscriptionId = String(invoice.subscription ?? '').trim();
    if (!subscriptionId) return { ok: true, skipped: 'no_subscription' };

    const billingReason = String(invoice.billing_reason ?? '');
    if (
      billingReason &&
      billingReason !== 'subscription_cycle' &&
      billingReason !== 'subscription_create'
    ) {
      return { ok: true, skipped: 'billing_reason', billingReason };
    }

    const org = await Organization.findOne({ stripeSubscriptionId: subscriptionId });
    if (!org || org.plan === 'free') {
      return { ok: true, skipped: 'unknown_subscription', subscriptionId };
    }

    return this.renewOrganizationSubscription(org, 'stripe_invoice');
  }

  private async onCustomerSubscriptionDeleted(subscription: Record<string, unknown>) {
    const subscriptionId = String(subscription.id ?? '').trim();
    if (!subscriptionId) return { ok: true, skipped: 'missing_subscription_id' };
    return this.expiry.expireByStripeSubscriptionId(subscriptionId);
  }

  private async onInvoicePaymentFailed(invoice: Record<string, unknown>) {
    const subscriptionId = String(invoice.subscription ?? '').trim();
    if (!subscriptionId) return { ok: true, skipped: 'no_subscription' };

    const org = await Organization.findOne({ stripeSubscriptionId: subscriptionId });
    if (!org || org.plan === 'free') {
      return { ok: true, skipped: 'unknown_subscription', subscriptionId };
    }

    org.stripeSubscriptionStatus = 'past_due';
    org.stripePastDueAt = org.stripePastDueAt ?? new Date();
    await org.save();

    logger.info('Pagamento de assinatura falhou — grace period', {
      organizationId: String(org._id),
      subscriptionId,
    });

    return {
      ok: true,
      organizationId: String(org._id),
      billingStatus: 'past_due',
    };
  }

  private async confirmAiCreditPackCheckout(
    organizationId: string,
    userId: string,
    sessionId: string,
    metadata: Record<string, unknown>,
  ) {
    const packId = String(metadata.creditPackId ?? '').trim();
    const credits = Number(metadata.credits ?? 0);
    return this.fulfillAiCreditPackPurchase({
      organizationId,
      userId,
      sessionId,
      creditPackId: packId,
      credits,
      source: 'stripe_confirm',
    });
  }

  private async fulfillAiCreditPackPurchase(input: {
    organizationId: string;
    userId: string;
    sessionId: string;
    creditPackId: string;
    credits: number;
    source: ActivateSource;
  }) {
    const pack = findAiCreditPackById(input.creditPackId);
    const credits = pack?.credits ?? input.credits;
    if (!input.creditPackId || !Number.isFinite(credits) || credits <= 0) {
      throw new BillingHttpError('Pacote de créditos inválido na sessão', 400);
    }

    const existingPaid = await BillingOrder.findOne({
      stripeSessionId: input.sessionId,
      organizationId: input.organizationId,
      orderKind: 'ai_credit_pack',
      status: 'paid',
    });
    if (existingPaid) {
      const org = await Organization.findById(input.organizationId).select('aiWallet').lean();
      return {
        ok: true,
        organizationId: input.organizationId,
        packId: input.creditPackId,
        creditsGranted: existingPaid.creditsGranted ?? credits,
        purchasedCredits: org?.aiWallet?.purchasedCredits ?? 0,
        alreadyFulfilled: true,
      };
    }

    const now = new Date();
    await BillingOrder.updateMany(
      { stripeSessionId: input.sessionId, organizationId: input.organizationId },
      {
        status: 'paid',
        paidAt: now,
        orderKind: 'ai_credit_pack',
        creditPackId: input.creditPackId,
        creditsGranted: credits,
        planId: input.creditPackId,
      },
    );

    const purchasedTotal = await AiWalletService.getInstance().addPurchasedCredits(
      input.organizationId,
      credits,
    );

    logger.info('Pacote IA Créditos creditado', {
      organizationId: input.organizationId,
      packId: input.creditPackId,
      credits,
      source: input.source,
      userId: input.userId,
    });

    return {
      ok: true,
      organizationId: input.organizationId,
      packId: input.creditPackId,
      creditsGranted: credits,
      purchasedCredits: purchasedTotal,
      source: input.source,
    };
  }

  private async renewOrganizationSubscription(org: IOrganization, source: string) {
    if (org.plan === 'free') {
      return { ok: true, skipped: 'free_plan', organizationId: String(org._id) };
    }

    const now = new Date();
    const base =
      org.planExpiresAt && org.planExpiresAt.getTime() > now.getTime()
        ? org.planExpiresAt
        : now;
    const expiresAt = addDays(base, 30);
    org.planExpiresAt = expiresAt;
    org.planActivatedAt = org.planActivatedAt ?? now;
    org.stripeSubscriptionStatus = 'active';
    org.stripePastDueAt = undefined;
    await org.save();

    logger.info('Assinatura renovada', {
      organizationId: String(org._id),
      plan: org.plan,
      source,
      expiresAt: expiresAt.toISOString(),
    });

    return {
      ok: true,
      renewed: true,
      organizationId: String(org._id),
      planId: org.plan,
      expiresAt: expiresAt.toISOString(),
      source,
    };
  }
}
