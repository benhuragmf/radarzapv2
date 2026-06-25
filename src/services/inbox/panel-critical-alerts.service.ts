import crypto from 'crypto';
import mongoose from 'mongoose';
import { Organization } from '@/models/Organization';
import { InboxSettings } from '@/models/InboxSettings';
import { AiSettings } from '@/models/AiSettings';
import { AiUsageMeterService } from '@/services/ai/AiUsageMeterService';
import { AiSettingsService } from '@/services/ai/AiSettingsService';
import { computeSubscriptionStatus, formatTimeRemaining } from '@/services/billing/subscription.util';
import { emitPanelEvent } from '@/services/inbox/PanelNotifications';
import type { PanelEventPayload, PanelEventType } from '@/types/panel-events';
import { createServiceLogger } from '@/utils/logger';
import {
  buildAiCreditAlertMessage,
  resolveAiCreditUsageLevel,
  shouldEmitAiCreditAlert,
  type AiCreditUsageLevel,
} from '@/types/ai-credit-alerts.util';

const logger = createServiceLogger('PanelCriticalAlerts');

type EmitInput = Omit<PanelEventPayload, 'id' | 'createdAt'> & {
  dedupKey?: string;
  dedupMs?: number;
};

export class PanelCriticalAlertsService {
  private static instance: PanelCriticalAlertsService;
  private readonly dedup = new Map<string, number>();
  private readonly lastAiCreditLevel = new Map<string, AiCreditUsageLevel>();

  static getInstance(): PanelCriticalAlertsService {
    if (!this.instance) this.instance = new PanelCriticalAlertsService();
    return this.instance;
  }

  private dayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private shouldEmit(key: string, cooldownMs: number): boolean {
    const now = Date.now();
    const last = this.dedup.get(key) ?? 0;
    if (now - last < cooldownMs) return false;
    this.dedup.set(key, now);
    if (this.dedup.size > 2000) {
      for (const [k, ts] of this.dedup) {
        if (now - ts > cooldownMs) this.dedup.delete(k);
      }
    }
    return true;
  }

  emit(clientId: string, event: EmitInput): void {
    const key = event.dedupKey ?? `${clientId}:${event.type}:${this.dayKey()}`;
    const cooldown = event.dedupMs ?? 86_400_000;
    if (!this.shouldEmit(key, cooldown)) return;

    emitPanelEvent(clientId, {
      id: crypto.randomUUID(),
      type: event.type,
      title: event.title,
      body: event.body,
      href: event.href,
      conversationId: event.conversationId,
      targetUserId: event.targetUserId,
      ownerOnly: event.ownerOnly,
      urgent: event.urgent,
      createdAt: new Date().toISOString(),
    });
  }

  notifyPlanExpired(clientId: string, previousPlan: string): void {
    this.emit(clientId, {
      type: 'billing:plan_expired',
      title: 'Plano expirado',
      body: `Seu plano ${previousPlan} expirou. A conta voltou ao plano Free com limites reduzidos.`,
      href: '/plans',
      dedupKey: `${clientId}:billing:plan_expired`,
      dedupMs: 7 * 86_400_000,
    });
  }

  notifyAiQuotaExceeded(clientId: string, reason: string): void {
    this.emit(clientId, {
      type: 'ai:quota_exceeded',
      title: 'Saldo de IA esgotado',
      body: reason,
      href: '/platform/inbox/ia',
      dedupKey: `${clientId}:ai:quota_exceeded:${this.dayKey()}`,
    });
  }

  notifyAiQuotaLow(
    clientId: string,
    used: number,
    limit: number,
    period: 'diário' | 'mensal',
  ): void {
    this.emit(clientId, {
      type: 'ai:quota_low',
      title: 'Saldo de IA baixo',
      body: `${used}/${limit} no limite ${period} — ajuste limites ou faça upgrade.`,
      href: '/platform/inbox/ia',
      dedupKey: `${clientId}:ai:quota_low:${period}:${this.dayKey()}`,
    });
  }

  notifyMessagesQuotaExceeded(clientId: string, used: number, limit: number): void {
    this.emit(clientId, {
      type: 'billing:messages_quota_exceeded',
      title: 'Limite diário de mensagens',
      body: `${used}/${limit} mensagens hoje. Envios pausados até amanhã ou faça upgrade em Planos.`,
      href: '/plans',
      dedupKey: `${clientId}:billing:messages_quota:${this.dayKey()}`,
    });
  }

  notifyCriticalConfig(
    clientId: string,
    title: string,
    body: string,
    href: string,
    dedupKey: string,
  ): void {
    this.emit(clientId, {
      type: 'system:critical_config',
      title,
      body,
      href,
      dedupKey: `${clientId}:system:critical_config:${dedupKey}`,
      dedupMs: 3 * 86_400_000,
    });
  }

  async scanSubscriptionExpiring(): Promise<void> {
    const now = new Date();
    const rows = await Organization.find({
      plan: { $ne: 'free' },
      planExpiresAt: { $exists: true, $gt: now },
    })
      .select('_id plan planExpiresAt')
      .limit(200)
      .lean();

    for (const org of rows) {
      const clientId = String(org._id);
      const status = computeSubscriptionStatus(org.plan, org.planExpiresAt, now);
      if (status !== 'expiring_soon') continue;

      const remaining = formatTimeRemaining(org.planExpiresAt, now);
      const days = remaining.daysRemaining ?? 0;
      const tier =
        days <= 1 ? '1d' : days <= 3 ? '3d' : '7d';
      const urgent = days <= 3;

      this.emit(clientId, {
        type: 'billing:plan_expiring',
        title: days <= 1 ? 'Plano expira hoje' : 'Plano expira em breve',
        body: `Plano ${org.plan}: ${remaining.label}. Renove em Planos e cobrança.`,
        href: '/plans',
        urgent,
        dedupKey: `${clientId}:billing:plan_expiring:${tier}`,
        dedupMs: tier === '1d' ? 12 * 3_600_000 : 86_400_000,
      });
    }
  }

  async scanAiQuota(clientId: string): Promise<void> {
    try {
      const snapshot = await AiUsageMeterService.getInstance().getUsageSnapshot(clientId);
      if (!snapshot.allowed) {
        this.notifyAiQuotaExceeded(clientId, snapshot.reason ?? 'Limite de IA atingido');
        void import('@/types/ai-wallet').then(({ recordAiCreditAttendanceEvent }) =>
          recordAiCreditAttendanceEvent({
            clientId,
            kind: 'ai.credits.blocked',
            meta: { reason: snapshot.reason },
          }),
        );
        return;
      }
      if (snapshot.wallet?.depleted) {
        this.notifyAiQuotaExceeded(
          clientId,
          snapshot.reason ?? 'Saldo mensal de créditos IA esgotado',
        );
        this.lastAiCreditLevel.set(clientId, 'exhausted');
        void import('@/types/ai-wallet').then(({ recordAiCreditAttendanceEvent }) =>
          recordAiCreditAttendanceEvent({ clientId, kind: 'ai.credits.exhausted' }),
        );
        return;
      }
      if (snapshot.wallet && snapshot.wallet.totalAllowance > 0) {
        const usage = resolveAiCreditUsageLevel(snapshot.wallet);
        const prev = this.lastAiCreditLevel.get(clientId) ?? 'ok';
        if (shouldEmitAiCreditAlert(prev, usage.level)) {
          this.lastAiCreditLevel.set(clientId, usage.level);
          const alert = buildAiCreditAlertMessage(usage.level, usage);
          if (usage.level === 'exhausted') {
            this.notifyAiQuotaExceeded(clientId, alert.body);
          } else {
            this.emit(clientId, {
              type: usage.level === 'warning_90' ? 'ai:quota_low' : 'ai:quota_low',
              title: alert.title,
              body: alert.body,
              href: '/platform/inbox/ia',
              dedupKey: `${clientId}:ai:credit_level:${usage.level}:${this.dayKey()}`,
            });
            void import('@/types/ai-wallet').then(({ recordAiCreditAttendanceEvent }) =>
              recordAiCreditAttendanceEvent({
                clientId,
                kind: 'ai.credits.low_balance',
                meta: { level: usage.level, used: usage.used, allowance: usage.allowance },
              }),
            );
          }
          return;
        }
        if (usage.level === 'ok') {
          this.lastAiCreditLevel.set(clientId, 'ok');
        }
      }
      if (snapshot.dailyLimit > 0 && snapshot.dailyUsed >= snapshot.dailyLimit * 0.9) {
        this.notifyAiQuotaLow(clientId, snapshot.dailyUsed, snapshot.dailyLimit, 'diário');
      } else if (
        snapshot.monthlyLimit > 0 &&
        snapshot.monthlyUsed >= snapshot.monthlyLimit * 0.9
      ) {
        this.notifyAiQuotaLow(clientId, snapshot.monthlyUsed, snapshot.monthlyLimit, 'mensal');
      }
    } catch (err) {
      logger.warn('scanAiQuota failed', { clientId, err: (err as Error).message });
    }
  }

  scanMessagesQuota(org: {
    _id: unknown;
    limits?: { messagesPerDay?: number };
    usage?: { messagesUsed?: number };
  }): void {
    const limit = org.limits?.messagesPerDay ?? -1;
    const used = org.usage?.messagesUsed ?? 0;
    if (limit === -1 || used < limit) return;
    this.notifyMessagesQuotaExceeded(String(org._id), used, limit);
  }

  async scanCriticalConfig(clientId: string): Promise<void> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const [inboxSettings, aiSettings] = await Promise.all([
      InboxSettings.findOne({ clientId: clientOid })
        .select('whatsappFallbackEnabled whatsappFallbackAlertPhones')
        .lean(),
      AiSettings.findOne({ clientId: clientOid }).lean(),
    ]);

    if (
      inboxSettings?.whatsappFallbackEnabled &&
      !(inboxSettings.whatsappFallbackAlertPhones?.length ?? 0)
    ) {
      this.notifyCriticalConfig(
        clientId,
        'Fallback WhatsApp incompleto',
        'Fallback ativo sem números de alerta — configure em Bot do Inbox.',
        '/platform/inbox/bot',
        'wa-fallback-phones',
      );
    }

    if (
      aiSettings &&
      aiSettings.mode === 'company' &&
      !aiSettings.encryptedApiKey?.trim() &&
      (await AiSettingsService.getInstance().isAiActive(clientId))
    ) {
      this.notifyCriticalConfig(
        clientId,
        'IA sem chave configurada',
        'Modo empresa ativo sem API key — a IA não conseguirá responder.',
        '/platform/inbox/ia',
        'ai-company-key',
      );
    }
  }

  async scanAll(): Promise<void> {
    await this.scanSubscriptionExpiring();

    const orgs = await Organization.find({})
      .select('_id plan planExpiresAt usage limits')
      .limit(500)
      .lean();

    for (const org of orgs) {
      const clientId = String(org._id);
      this.scanMessagesQuota(org);
      await this.scanAiQuota(clientId);
      await this.scanCriticalConfig(clientId);
    }
  }
}

/** Atalho para emitir alerta crítico genérico (configuração, integração, etc.). */
export function emitCriticalPanelEvent(
  clientId: string,
  input: {
    type?: Extract<PanelEventType, 'system:critical_config'>;
    title: string;
    body: string;
    href?: string;
    dedupKey?: string;
    ownerOnly?: boolean;
  },
): void {
  PanelCriticalAlertsService.getInstance().emit(clientId, {
    type: input.type ?? 'system:critical_config',
    title: input.title,
    body: input.body,
    href: input.href ?? '/settings',
    dedupKey: input.dedupKey,
    ownerOnly: input.ownerOnly,
  });
}
