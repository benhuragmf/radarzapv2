import mongoose from 'mongoose';
import { createServiceLogger } from '@/utils/logger';
import { WebChatMessage } from '@/models/WebChatMessage';
import { Organization } from '@/models/Organization';
import { AiProviderService, type AiChatMessage } from '@/services/ai/AiProviderService';
import { AiSettingsService } from '@/services/ai/AiSettingsService';
import { AiPromptBuilderService } from '@/services/ai/AiPromptBuilderService';
import { AiAutoResolveService } from '@/services/ai/AiAutoResolveService';
import { PlatformAiBlueprintService } from '@/services/ai/PlatformAiBlueprintService';
import type { AiContactContext } from '@/services/ai/AiContextService';
import { AiContextService } from '@/services/ai/AiContextService';
import { Destination } from '@/models/Destination';
import { WebChatConversation } from '@/models/WebChatConversation';
import { AiEscalationService } from '@/services/ai/AiEscalationService';
import { AiUsageMeterService } from '@/services/ai/AiUsageMeterService';
import { estimateTypicalTurnCostUsd } from '@/constants/ai-model-catalog';
import { aiCreditsFromActualCost } from '@/types/ai-credits';
import { AI_CREDITS_CLIENT_FALLBACK_MESSAGE } from '@/types/ai-wallet';
import type { WebChatAiEscalationPolicy } from '../../types/webchat';
import {
  buildWebChatPromptSuffix,
  buildWebChatThreadContext,
  formatWebChatAutoResolveReply,
  resolveWebChatShouldEscalate,
  rewritePrematureTransferReply,
  shouldRewritePrematureTransfer,
  textLooksLikeWebChatInquiry,
  type WebChatMessageRow,
} from './webchat-ai-triage.util';
import { normalizeEscalationPolicy } from './webchat-ai-escalation-policy.util';
import {
  attendanceModeLabel,
  effectiveWebChatPremiumAi,
  resolveAttendanceMode,
  webChatGlobalModeHint,
  webChatPremiumAiAllowed,
  type AttendanceMode,
} from '@/types/attendance-mode';
import type { AiStructuredReply } from '@/types/ai-assistant';
import {
  buildPremiumAiSafetySuffix,
  buildPremiumAiUngroundedReply,
  guardPremiumAiFactualReply,
  isKbRequiredFactualInquiry,
  recordPremiumAiAttendanceEvent,
  sanitizePremiumAiResponse,
  shouldEscalatePremiumAiBeforeCall,
} from '@/types/premium-ai.util';

export interface WebChatAiAvailability {
  available: boolean;
  reason?: string;
  attendanceMode: AttendanceMode;
  attendanceModeLabel: string;
  premiumAiAllowed: boolean;
  globalModeHint: string;
}

export class WebChatAiService {
  private static instance: WebChatAiService;
  private serviceLogger = createServiceLogger('WebChatAiService');

  static getInstance(): WebChatAiService {
    if (!WebChatAiService.instance) {
      WebChatAiService.instance = new WebChatAiService();
    }
    return WebChatAiService.instance;
  }

  async getAvailability(clientId: string): Promise<WebChatAiAvailability> {
    const settings = await AiSettingsService.getInstance().getSettingsDoc(clientId);
    const attendanceMode = resolveAttendanceMode(settings);
    const base = {
      attendanceMode,
      attendanceModeLabel: attendanceModeLabel(attendanceMode),
      premiumAiAllowed: webChatPremiumAiAllowed(settings),
      globalModeHint: webChatGlobalModeHint(attendanceMode),
    };

    if (!webChatPremiumAiAllowed(settings)) {
      return {
        ...base,
        available: false,
        reason:
          attendanceMode === 'premium_assistant' || attendanceMode === 'hybrid'
            ? 'IA Premium inativa — configure credencial em Inbox → IA Atendimento'
            : `Modo global: ${attendanceModeLabel(attendanceMode)}. IA Premium conversacional só nos modos IA Premium ou Híbrido.`,
      };
    }

    try {
      await AiProviderService.getInstance().resolveApiKey(clientId, settings);
    } catch (e) {
      return { ...base, available: false, reason: (e as Error).message };
    }

    if (settings.mode === 'radarzap') {
      const pendingCredits = aiCreditsFromActualCost(
        estimateTypicalTurnCostUsd(settings.llmModel),
      );
      const usage = await AiUsageMeterService.getInstance().getUsageSnapshot(
        clientId,
        undefined,
        settings,
        { pendingCalls: 1, pendingCredits },
      );
      if (!usage.allowed) {
        return {
          ...base,
          available: false,
          reason: usage.reason ?? 'Limite de créditos IA atingido',
        };
      }
    }

    return { ...base, available: true };
  }

  async generateVisitorReply(
    clientId: string,
    conversationId: string,
    opts: {
      visitorName?: string;
      visitorEmail?: string;
      visitorPhone?: string;
      contactReason?: string;
      pageUrl?: string;
      pageTitle?: string;
      intakeSummary?: string;
      escalationPolicy?: Partial<WebChatAiEscalationPolicy> | null;
    },
  ): Promise<{ body: string; senderName: string; shouldEscalate?: boolean } | null> {
    const availability = await this.getAvailability(clientId);
    if (!availability.available) {
      if (availability.reason?.includes('crédito') || availability.reason?.includes('Saldo')) {
        return {
          body: sanitizePremiumAiResponse(AI_CREDITS_CLIENT_FALLBACK_MESSAGE, 'webchat'),
          senderName: 'Assistente virtual',
          shouldEscalate: true,
        };
      }
      return null;
    }

    const escalationPolicy = normalizeEscalationPolicy(opts.escalationPolicy);

    const settings = await AiSettingsService.getInstance().getSettingsDoc(clientId);
    const prompt = await AiPromptBuilderService.getInstance().getOrCreatePrompt(clientId);
    const convOid = new mongoose.Types.ObjectId(conversationId);

    const rows = await WebChatMessage.find({ conversationId: convOid })
      .sort({ createdAt: 1 })
      .limit(24)
      .lean();

    const messageRows: WebChatMessageRow[] = rows.map(m => ({
      direction: m.direction as WebChatMessageRow['direction'],
      body: m.body,
    }));

    const contactContext: AiContactContext | undefined = await this.resolveWebChatContactContext(
      clientId,
      conversationId,
      opts,
    );

    const lastInbound = [...rows].reverse().find(m => m.direction === 'inbound')?.body ?? '';
    const threadContext = buildWebChatThreadContext(messageRows);
    const blueprint = await PlatformAiBlueprintService.getInstance().getGlobal();
    const senderName =
      prompt.agentName?.trim() || blueprint.agentName?.trim() || 'Assistente IA';

    void recordPremiumAiAttendanceEvent({
      clientId,
      kind: 'ai.premium.requested',
      channel: 'webchat',
      conversationId,
    });

    const preEscalate = shouldEscalatePremiumAiBeforeCall({ clientText: lastInbound });
    if (preEscalate.escalate) {
      void recordPremiumAiAttendanceEvent({
        clientId,
        kind: 'ai.premium.escalated',
        channel: 'webchat',
        conversationId,
        reason: preEscalate.reason,
      });
      return {
        body: sanitizePremiumAiResponse(
          'Vou encaminhar você para um atendente humano continuar o atendimento.',
          'webchat',
        ),
        senderName,
        shouldEscalate: true,
      };
    }

    if (
      prompt.autoResolveEnabled &&
      textLooksLikeWebChatInquiry(lastInbound)
    ) {
      const auto = await AiAutoResolveService.getInstance().tryResolve(clientId, lastInbound, {
        threadContext,
        webchatInquiry: true,
      });
      if (auto.hit && auto.reply) {
        this.serviceLogger.info('WebChat auto-resolve', {
          conversationId,
          source: auto.source,
          score: auto.score,
        });
        void recordPremiumAiAttendanceEvent({
          clientId,
          kind: 'ai.premium.answered',
          channel: 'webchat',
          conversationId,
          meta: { source: auto.source, grounded: true },
        });
        return {
          body: sanitizePremiumAiResponse(formatWebChatAutoResolveReply(auto.reply), 'webchat'),
          senderName,
          shouldEscalate: false,
        };
      }
    }

    if (isKbRequiredFactualInquiry(lastInbound, threadContext)) {
      const grounded = await AiAutoResolveService.getInstance().tryResolve(clientId, lastInbound, {
        threadContext,
        groundedOnly: true,
      });
      if (grounded.hit && grounded.reply) {
        void recordPremiumAiAttendanceEvent({
          clientId,
          kind: 'ai.premium.answered',
          channel: 'webchat',
          conversationId,
          meta: { source: grounded.source, grounded: true },
        });
        return {
          body: sanitizePremiumAiResponse(formatWebChatAutoResolveReply(grounded.reply), 'webchat'),
          senderName,
          shouldEscalate: false,
        };
      }
      const org = await Organization.findById(clientId).select('name').lean();
      return {
        body: sanitizePremiumAiResponse(
          buildPremiumAiUngroundedReply(org?.name),
          'webchat',
        ),
        senderName,
        shouldEscalate: false,
      };
    }

    const systemPrompt =
      (await AiPromptBuilderService.getInstance().buildSystemPrompt(clientId, {
        contactContext,
        clientText: lastInbound,
      })) +
      buildWebChatPromptSuffix(
        {
          visitorName: opts.visitorName,
          visitorEmail: opts.visitorEmail,
          visitorPhone: opts.visitorPhone,
          contactReason: opts.contactReason,
          pageUrl: opts.pageUrl,
          pageTitle: opts.pageTitle,
          intakeSummary: opts.intakeSummary,
        },
        escalationPolicy,
      ) +
      buildPremiumAiSafetySuffix('webchat');

    const history: AiChatMessage[] = [{ role: 'system', content: systemPrompt }];

    for (const m of rows) {
      if (m.direction === 'system') continue;
      if (m.direction === 'inbound') {
        history.push({ role: 'user', content: m.body });
      } else if (m.direction === 'outbound') {
        history.push({ role: 'assistant', content: m.body });
      }
    }

    try {
      const provider = AiProviderService.getInstance();
      const result = await provider.complete(clientId, settings, history, conversationId);
      const reply = result.structured.reply?.trim();
      if (!reply || provider.isUnusableClientReply(result.structured)) return null;

      await this.persistWebChatCollectedData(clientId, conversationId, opts, result.structured);

      const { CatalogSalesService } = await import('@/services/catalog/CatalogSalesService');
      const catalogSvc = CatalogSalesService.getInstance();
      const conversation = await WebChatConversation.findById(conversationId)
        .select('destinationId visitorName visitorEmail visitorPhone')
        .lean();
      const catalogTurn = await catalogSvc.processAiCatalogTurn({
        clientId,
        conversation: {
          conversationId,
          channel: 'webchat',
          destinationId: conversation?.destinationId ? String(conversation.destinationId) : undefined,
          contactIdentifier:
            conversation?.visitorPhone ?? conversation?.visitorEmail ?? opts.visitorPhone,
          contactName: conversation?.visitorName ?? opts.visitorName ?? 'Visitante',
        },
        clientText: lastInbound,
        structured: result.structured,
        aiSummary: result.structured.internalSummary,
      });

      const factualGuard = guardPremiumAiFactualReply({
        reply,
        systemPrompt,
        companyName: (await Organization.findById(clientId).select('name').lean())?.name,
      });
      let replyForClient = factualGuard.blocked ? factualGuard.reply : reply;
      replyForClient = catalogSvc.sanitizeAiReplyForCatalogQuote(replyForClient, catalogTurn);

      const shouldEscalate = resolveWebChatShouldEscalate({
        clientText: lastInbound,
        modelWantsEscalate: Boolean(result.structured.shouldEscalate),
        modelReply: replyForClient,
        messages: messageRows,
        policy: escalationPolicy,
      });

      const esc = AiEscalationService.getInstance();
      let body = sanitizePremiumAiResponse(replyForClient, 'webchat');
      if (
        !shouldEscalate &&
        esc.aiReplyPromisesTransfer(reply) &&
        shouldRewritePrematureTransfer(lastInbound, escalationPolicy)
      ) {
        body = sanitizePremiumAiResponse(
          rewritePrematureTransferReply(lastInbound, opts.visitorName),
          'webchat',
        );
      }

      void recordPremiumAiAttendanceEvent({
        clientId,
        kind: shouldEscalate ? 'ai.premium.escalated' : 'ai.premium.answered',
        channel: 'webchat',
        conversationId,
        reason: shouldEscalate ? 'model_or_policy' : undefined,
        meta: { provider: true },
      });

      return {
        body,
        senderName,
        shouldEscalate,
      };
    } catch (e) {
      if (prompt.autoResolveEnabled && textLooksLikeWebChatInquiry(lastInbound)) {
        const auto = await AiAutoResolveService.getInstance().tryResolve(clientId, lastInbound, {
          threadContext,
          webchatInquiry: true,
        });
        if (auto.hit && auto.reply) {
          void recordPremiumAiAttendanceEvent({
            clientId,
            kind: 'ai.premium.answered',
            channel: 'webchat',
            conversationId,
            meta: { source: auto.source, fallbackAfterError: true },
          });
          return {
            body: sanitizePremiumAiResponse(formatWebChatAutoResolveReply(auto.reply), 'webchat'),
            senderName,
            shouldEscalate: false,
          };
        }
      }
      void recordPremiumAiAttendanceEvent({
        clientId,
        kind: 'ai.premium.provider_error',
        channel: 'webchat',
        conversationId,
        reason: (e as Error).message?.slice(0, 120),
      });
      this.serviceLogger.warn('Falha ao gerar resposta IA no WebChat', {
        conversationId,
        clientId,
        error: (e as Error).message,
      });
      return null;
    }
  }

  private async resolveWebChatContactContext(
    clientId: string,
    conversationId: string,
    opts: {
      visitorName?: string;
      visitorEmail?: string;
      visitorPhone?: string;
      contactReason?: string;
    },
  ): Promise<AiContactContext | undefined> {
    const conversation = await WebChatConversation.findById(conversationId)
      .select('destinationId visitorName visitorEmail visitorPhone contactReason')
      .lean();
    const ctxSvc = AiContextService.getInstance();

    if (conversation?.destinationId) {
      const dest = await Destination.findOne({
        _id: conversation.destinationId,
        clientId: new mongoose.Types.ObjectId(clientId),
        type: 'contact',
      });
      if (dest) return ctxSvc.buildContactContext(clientId, dest);
    }

    const phone = opts.visitorPhone?.trim() || conversation?.visitorPhone?.trim();
    if (phone) {
      const { resolveDestinationForCollectedData } = await import(
        '@/services/contacts/contact-collected-data.service'
      );
      const dest = await resolveDestinationForCollectedData({
        clientId,
        visitorPhone: phone,
        visitorName: opts.visitorName ?? conversation?.visitorName ?? undefined,
        visitorEmail: opts.visitorEmail ?? conversation?.visitorEmail ?? undefined,
      });
      if (dest) return ctxSvc.buildContactContext(clientId, dest);
    }

    if (
      opts.visitorName ||
      opts.visitorEmail ||
      opts.visitorPhone ||
      opts.contactReason ||
      conversation?.visitorName ||
      conversation?.visitorEmail
    ) {
      return {
        name: opts.visitorName ?? conversation?.visitorName,
        email: opts.visitorEmail ?? conversation?.visitorEmail,
        phone: opts.visitorPhone ?? conversation?.visitorPhone,
        tags: (opts.contactReason ?? conversation?.contactReason)
          ? [opts.contactReason ?? conversation?.contactReason ?? '']
          : [],
        recentTickets: [],
        knownFields: {
          name: Boolean((opts.visitorName ?? conversation?.visitorName)?.trim()),
          email: Boolean((opts.visitorEmail ?? conversation?.visitorEmail)?.trim()),
          address: false,
        },
      };
    }
    return undefined;
  }

  private async persistWebChatCollectedData(
    clientId: string,
    conversationId: string,
    opts: {
      visitorName?: string;
      visitorEmail?: string;
      visitorPhone?: string;
    },
    structured: Pick<
      AiStructuredReply,
      | 'collectedName'
      | 'collectedEmail'
      | 'collectedAddress'
      | 'collectedPhone'
      | 'collectedCompany'
      | 'collectedDeliveryNotes'
      | 'collectedPreferredSchedule'
      | 'collectedCpfCnpj'
      | 'catalogProductId'
      | 'catalogProductName'
      | 'shouldCreateCatalogOrder'
      | 'internalSummary'
    >,
  ): Promise<void> {
    const conversation = await WebChatConversation.findById(conversationId)
      .select('destinationId visitorName visitorEmail visitorPhone')
      .lean();
    if (!conversation) return;

    const { persistContactCollectedData } = await import(
      '@/services/contacts/contact-collected-data.service'
    );
    const destId = await persistContactCollectedData({
      clientId,
      destinationId: conversation.destinationId ? String(conversation.destinationId) : undefined,
      visitorPhone: opts.visitorPhone ?? conversation.visitorPhone ?? undefined,
      visitorName: structured.collectedName ?? opts.visitorName ?? conversation.visitorName,
      visitorEmail: structured.collectedEmail ?? opts.visitorEmail ?? conversation.visitorEmail,
      fields: {
        name: structured.collectedName,
        email: structured.collectedEmail,
        address: structured.collectedAddress,
        phone: structured.collectedPhone,
        organization: structured.collectedCompany,
        deliveryNotes: structured.collectedDeliveryNotes,
        preferredSchedule: structured.collectedPreferredSchedule,
        taxDocument: structured.collectedCpfCnpj,
      },
    });

    if (destId && !conversation.destinationId) {
      await WebChatConversation.updateOne(
        { _id: new mongoose.Types.ObjectId(conversationId) },
        { $set: { destinationId: new mongoose.Types.ObjectId(destId) } },
      );
    }
  }
}
