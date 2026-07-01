import mongoose from 'mongoose';
import { Organization } from '@/models/Organization';
import { AiSettings } from '@/models/AiSettings';
import { InboxSettings } from '@/models/InboxSettings';
import { WebChatWidget } from '@/models/WebChatWidget';
import { LeadForm } from '@/models/LeadForm';
import { AiCredentialVaultService } from '@/services/ai/AiCredentialVaultService';
import { AiUsageMeterService } from '@/services/ai/AiUsageMeterService';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import {
  buildBillingBlockReason,
  isBillingInGrace,
  normalizeBillingStatus,
  shouldBlockPaidFeatures,
} from '@/services/billing/billing-state.util';
import { isProduction } from '@/config/environment';
import { getAiPlanLimits } from '@/types/ai-assistant';
import {
  attendanceModeLabel,
  attendanceSelectionFromSettings,
  modeUsesPremiumAiChain,
  requiresAiCredits,
  resolveAttendanceMode,
  shouldRunGenerativeAi,
} from '@/types/attendance-mode';
import type {
  OperationalBlock,
  OperationalBlockModule,
  OperationalBlocksSnapshot,
} from '@/types/operational-blocks';
import { OPERATIONAL_BLOCK_MODULE_LABELS } from '@/types/operational-blocks';

export interface OperationalBlocksOptions {
  canViewBilling?: boolean;
  canViewAiBalance?: boolean;
  canManageAi?: boolean;
  canViewWhatsApp?: boolean;
}

const MODULE_ORDER: OperationalBlockModule[] = [
  'billing',
  'ai',
  'whatsapp',
  'config',
  'attendance',
];

function block(
  partial: Omit<OperationalBlock, 'moduleLabel'> & { module: OperationalBlockModule },
): OperationalBlock {
  return {
    ...partial,
    moduleLabel: OPERATIONAL_BLOCK_MODULE_LABELS[partial.module],
  };
}

function sortBlocks(blocks: OperationalBlock[]): OperationalBlock[] {
  return [...blocks].sort((a, b) => {
    const sev = a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1;
    if (sev !== 0) return sev;
    return MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module);
  });
}

function explainGenerativeAiInactive(input: {
  attendanceMode: ReturnType<typeof resolveAttendanceMode>;
  selection: ReturnType<typeof attendanceSelectionFromSettings>;
  hasApiKey: boolean;
  plan: string;
  radarchatAllowed: boolean;
  settings: { mode: string; enabled?: boolean };
}): string {
  const { attendanceMode, selection, hasApiKey, plan, radarchatAllowed, settings } = input;
  const modeLabel = attendanceModeLabel(attendanceMode);

  if (selection.credentialSource === 'company' && !hasApiKey) {
    return 'Modo chave própria ativo sem API key — configure em IA Atendimento.';
  }
  if (!radarchatAllowed && selection.credentialSource !== 'company') {
    return `Plano ${plan}: ${modeLabel} exige chave própria ou upgrade — credencial Radar Chat não incluída no plano Free.`;
  }
  if (settings.mode === 'disabled' || settings.enabled === false) {
    return `${modeLabel} selecionado na interface, mas o motor LLM está desligado — abra IA Atendimento e salve novamente.`;
  }
  if (selection.credentialSource === 'none') {
    return `${modeLabel} ativo sem provedor de credencial — escolha Radar Chat ou chave própria em IA Atendimento.`;
  }
  return `${modeLabel} configurado, mas o motor generativo não está ativo — verifique credencial e limites em IA Atendimento.`;
}

export async function buildOperationalBlocks(
  clientId: string,
  opts: OperationalBlocksOptions = {},
): Promise<OperationalBlocksSnapshot> {
  const canViewBilling = opts.canViewBilling !== false;
  const canViewAiBalance = opts.canViewAiBalance !== false;
  const canManageAi = opts.canManageAi !== false;
  const canViewWhatsApp = opts.canViewWhatsApp !== false;

  const clientOid = new mongoose.Types.ObjectId(clientId);
  const now = new Date();
  const blocks: OperationalBlock[] = [];
  const vault = AiCredentialVaultService.getInstance();

  const [org, aiSettingsDoc, inboxSettings] = await Promise.all([
    Organization.findById(clientId)
      .select('plan planExpiresAt stripeSubscriptionStatus stripePastDueAt limits usage')
      .lean(),
    AiSettings.findOne({ clientId: clientOid }).select('+encryptedApiKey').lean(),
    InboxSettings.findOne({ clientId: clientOid })
      .select('whatsappFallbackEnabled whatsappFallbackAlertPhones')
      .lean(),
  ]);

  if (org && canViewBilling) {
    const billingStatus = normalizeBillingStatus({
      plan: org.plan,
      planExpiresAt: org.planExpiresAt,
      stripeSubscriptionStatus: org.stripeSubscriptionStatus,
    });
    const inGrace = isBillingInGrace(billingStatus, org.stripePastDueAt, now);

    if (shouldBlockPaidFeatures(billingStatus, { inGrace })) {
      blocks.push(
        block({
          id: 'billing:account_blocked',
          module: 'billing',
          title: 'Conta com restrição de cobrança',
          reason: buildBillingBlockReason(billingStatus),
          href: '/plans',
          severity: 'critical',
          ownerOnly: true,
        }),
      );
    } else if (billingStatus === 'past_due' && !inGrace) {
      blocks.push(
        block({
          id: 'billing:past_due',
          module: 'billing',
          title: 'Pagamento pendente',
          reason: buildBillingBlockReason(billingStatus),
          href: '/plans',
          severity: 'critical',
          ownerOnly: true,
        }),
      );
    }

    const msgLimit = org.limits?.messagesPerDay ?? -1;
    const msgUsed = org.usage?.messagesUsed ?? 0;
    if (msgLimit !== -1 && msgUsed >= msgLimit) {
      blocks.push(
        block({
          id: 'billing:messages_quota',
          module: 'billing',
          title: 'Limite diário de mensagens atingido',
          reason: `Uso ${msgUsed}/${msgLimit} hoje — envios automáticos e campanhas ficam pausados até amanhã ou upgrade.`,
          href: '/plans',
          severity: 'critical',
          ownerOnly: true,
        }),
      );
    }
  }

  if (aiSettingsDoc) {
    const attendanceMode = resolveAttendanceMode(aiSettingsDoc);
    const selection = attendanceSelectionFromSettings(aiSettingsDoc);
    const plan = org?.plan ?? 'free';
    const planLimits = getAiPlanLimits(plan);
    const hasApiKey = vault.hasKey(aiSettingsDoc.encryptedApiKey);
    const generativeActive = shouldRunGenerativeAi(aiSettingsDoc);

    if (modeUsesPremiumAiChain(attendanceMode) && !generativeActive) {
      blocks.push(
        block({
          id: 'ai:generative_inactive',
          module: 'ai',
          title: 'IA Premium indisponível',
          reason: explainGenerativeAiInactive({
            attendanceMode,
            selection,
            hasApiKey,
            plan,
            radarchatAllowed: planLimits.radarchatAllowed,
            settings: aiSettingsDoc,
          }),
          href: '/platform/inbox/ia',
          severity: 'critical',
        }),
      );
    } else if (
      generativeActive &&
      aiSettingsDoc.mode === 'company' &&
      !hasApiKey &&
      canManageAi
    ) {
      blocks.push(
        block({
          id: 'ai:missing_api_key',
          module: 'ai',
          title: 'IA sem chave configurada',
          reason: 'Modo chave própria ativo sem API key — a IA não conseguirá responder.',
          href: '/platform/inbox/ia',
          severity: 'critical',
        }),
      );
    }

    if (canViewAiBalance && requiresAiCredits(attendanceMode)) {
      try {
        const snapshot = await AiUsageMeterService.getInstance().getUsageSnapshot(clientId);
        if (!snapshot.allowed) {
          blocks.push(
            block({
              id: 'ai:quota_blocked',
              module: 'ai',
              title: 'IA bloqueada por limite',
              reason: snapshot.reason ?? 'Limite de uso de IA atingido — atendimento automático com IA fica indisponível.',
              href: '/platform/inbox/ia',
              severity: 'critical',
              ownerOnly: true,
            }),
          );
        } else if (snapshot.wallet?.depleted) {
          blocks.push(
            block({
              id: 'ai:credits_depleted',
              module: 'ai',
              title: 'Créditos IA esgotados',
              reason:
                snapshot.reason ??
                'Saldo mensal de créditos IA esgotado — respostas automáticas com IA ficam bloqueadas.',
              href: '/platform/inbox/ia',
              severity: 'critical',
              ownerOnly: true,
            }),
          );
        }
      } catch {
        /* quota scan optional */
      }
    }
  }

  if (canViewWhatsApp) {
    try {
      const details = await WhatsAppService.getInstance().getSessionDetails(clientId);
      if (details.status !== 'connected') {
        const reason =
          details.status === 'qr-required'
            ? 'QR pendente — escaneie em Conexões WhatsApp para receber e enviar mensagens.'
            : details.status === 'connecting'
              ? 'Sessão conectando — aguarde ou abra Conexões WhatsApp.'
              : 'Sessão offline — reconecte em Conexões WhatsApp para atender pelo canal WA.';
        blocks.push(
          block({
            id: 'whatsapp:disconnected',
            module: 'whatsapp',
            title: 'WhatsApp desconectado',
            reason,
            href: '/sessions',
            severity: 'critical',
          }),
        );
      }
    } catch {
      /* WA optional */
    }
  }

  if (canManageAi && inboxSettings?.whatsappFallbackEnabled) {
    if (!(inboxSettings.whatsappFallbackAlertPhones?.length ?? 0)) {
      blocks.push(
        block({
          id: 'config:wa_fallback_phones',
          module: 'config',
          title: 'Fallback WhatsApp incompleto',
          reason: 'Fallback ativo sem números de alerta — alertas críticos não serão enviados.',
          href: '/platform/inbox/bot',
          severity: 'warning',
          ownerOnly: true,
        }),
      );
    }
  }

  if (canManageAi && isProduction()) {
    const emptyDomains = {
      $or: [{ allowedDomains: { $exists: false } }, { allowedDomains: { $size: 0 } }],
    };
    const [openWebChat, openLeads] = await Promise.all([
      WebChatWidget.countDocuments({ clientId: clientOid, active: true, ...emptyDomains }),
      LeadForm.countDocuments({ clientId: clientOid, active: true, ...emptyDomains }),
    ]);

    if (openWebChat > 0) {
      blocks.push(
        block({
          id: 'config:webchat_domains',
          module: 'config',
          title: 'WebChat sem domínios permitidos',
          reason: 'Widget ativo sem allowedDomains — o embed fica bloqueado em produção.',
          href: '/platform/webchat',
          severity: 'critical',
          ownerOnly: true,
        }),
      );
    }

    if (openLeads > 0) {
      blocks.push(
        block({
          id: 'config:leads_domains',
          module: 'config',
          title: 'Formulário sem domínios permitidos',
          reason: 'Formulário ativo sem allowedDomains — capturas públicas ficam bloqueadas.',
          href: '/platform/leads',
          severity: 'critical',
          ownerOnly: true,
        }),
      );
    }
  }

  const sorted = sortBlocks(blocks);
  const criticalCount = sorted.filter(b => b.severity === 'critical').length;
  const warningCount = sorted.filter(b => b.severity === 'warning').length;

  return {
    hasBlocks: sorted.length > 0,
    criticalCount,
    warningCount,
    blocks: sorted,
    checkedAt: now.toISOString(),
  };
}
