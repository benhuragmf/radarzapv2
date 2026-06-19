import mongoose from 'mongoose';
import { createServiceLogger } from '@/utils/logger';
import { WebChatMessage } from '@/models/WebChatMessage';
import { AiProviderService, type AiChatMessage } from '@/services/ai/AiProviderService';
import { AiSettingsService } from '@/services/ai/AiSettingsService';
import { AiPromptBuilderService } from '@/services/ai/AiPromptBuilderService';
import { AiAutoResolveService } from '@/services/ai/AiAutoResolveService';
import { PlatformAiBlueprintService } from '@/services/ai/PlatformAiBlueprintService';
import type { AiContactContext } from '@/services/ai/AiContextService';
import { AiEscalationService } from '@/services/ai/AiEscalationService';
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

export class WebChatAiService {
  private static instance: WebChatAiService;
  private serviceLogger = createServiceLogger('WebChatAiService');

  static getInstance(): WebChatAiService {
    if (!WebChatAiService.instance) {
      WebChatAiService.instance = new WebChatAiService();
    }
    return WebChatAiService.instance;
  }

  async getAvailability(clientId: string): Promise<{ available: boolean; reason?: string }> {
    const settings = await AiSettingsService.getInstance().getSettingsDoc(clientId);
    if (settings.mode === 'disabled' || !settings.enabled) {
      return { available: false, reason: 'IA desativada — configure em Inbox → IA Atendimento' };
    }
    try {
      await AiProviderService.getInstance().resolveApiKey(clientId, settings);
      return { available: true };
    } catch (e) {
      return { available: false, reason: (e as Error).message };
    }
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
    if (!availability.available) return null;

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
        return {
          body: formatWebChatAutoResolveReply(auto.reply),
          senderName,
          shouldEscalate: false,
        };
      }
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
      );

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

      const shouldEscalate = resolveWebChatShouldEscalate({
        clientText: lastInbound,
        modelWantsEscalate: Boolean(result.structured.shouldEscalate),
        modelReply: reply,
        messages: messageRows,
        policy: escalationPolicy,
      });

      const esc = AiEscalationService.getInstance();
      let body = reply;
      if (
        !shouldEscalate &&
        esc.aiReplyPromisesTransfer(reply) &&
        shouldRewritePrematureTransfer(lastInbound, escalationPolicy)
      ) {
        body = rewritePrematureTransferReply(lastInbound, opts.visitorName);
      }

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
          return {
            body: formatWebChatAutoResolveReply(auto.reply),
            senderName,
            shouldEscalate: false,
          };
        }
      }
      this.serviceLogger.warn('Falha ao gerar resposta IA no WebChat', {
        conversationId,
        clientId,
        error: (e as Error).message,
      });
      return null;
    }
  }
}
