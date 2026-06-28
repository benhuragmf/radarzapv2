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

    const contactContext: AiContactContext | undefined =
      opts.visitorName ||
      opts.visitorEmail ||
      opts.visitorPhone ||
      opts.contactReason
        ? {
            name: opts.visitorName,
            email: opts.visitorEmail,
            phone: opts.visitorPhone,
            tags: opts.contactReason ? [opts.contactReason] : [],
            recentTickets: [],
            knownFields: {
              name: Boolean(opts.visitorName?.trim()),
              email: Boolean(opts.visitorEmail?.trim()),
            },
          }
        : undefined;

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

      const factualGuard = guardPremiumAiFactualReply({
        reply,
        systemPrompt,
        companyName: (await Organization.findById(clientId).select('name').lean())?.name,
      });
      const replyForClient = factualGuard.blocked ? factualGuard.reply : reply;

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
}
