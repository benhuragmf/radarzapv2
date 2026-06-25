import mongoose from 'mongoose';
import { InboxDepartment } from '@/models/InboxDepartment';
import { AiAutoResolveService } from '@/services/ai/AiAutoResolveService';
import { AiPromptBuilderService } from '@/services/ai/AiPromptBuilderService';
import { AiSettingsService } from '@/services/ai/AiSettingsService';
import type { IWebChatConversation } from '@/models/WebChatConversation';
import {
  buildInvalidMenuHint,
  buildQueueConfirmation,
  loadClientVisibleDepartments,
  parseInboxMenuChoice,
} from '@/constants/inbox-triage';
import {
  buildBasicTriageClarifyReply,
  buildBasicTriageTicketStatusReply,
  classifyLocal,
  shouldRouteByClassification,
} from '@/utils/basic-triage-classifier';
import {
  mapBasicIntentToProduct,
  recordBasicTriageClassificationEvent,
  resolveBasicTriageAction,
  shouldSkipBasicTriageForBridge,
  TRIAGE_CONFIDENCE_HIGH,
} from '@/types/basic-triage.util';
import {
  buildWebChatThreadContext,
  formatWebChatAutoResolveReply,
  textLooksLikeWebChatInquiry,
  type WebChatMessageRow,
} from './webchat-ai-triage.util';
import { WebChatMessage } from '@/models/WebChatMessage';
import { isHybridMode, modeUsesBasicTriageChain, resolveAttendanceMode } from '@/types/attendance-mode';
import { WEBCHAT_BOT_SENDER_ID } from './webchat-bot.util';

export interface WebChatBasicTriageContext {
  clientId: string;
  conversation: IWebChatConversation;
  text: string;
  messageRows: WebChatMessageRow[];
  sendBotReply: (body: string) => Promise<unknown>;
  escalate: (departmentId: string, reason: string) => Promise<void>;
}

export interface WebChatBasicTriageResult {
  handled: boolean;
  replies: unknown[];
}

const BASIC_GREETING_FALLBACK =
  'Olá! Como posso ajudar? Descreva sua dúvida com suas palavras — vou direcionar ao setor certo. Se preferir, digite *atendente* para falar com alguém.';

export class WebChatBasicTriageService {
  private static instance: WebChatBasicTriageService;

  static getInstance(): WebChatBasicTriageService {
    if (!this.instance) this.instance = new WebChatBasicTriageService();
    return this.instance;
  }

  async isBasicTriageMode(clientId: string): Promise<boolean> {
    const settings = await AiSettingsService.getInstance().getSettingsDoc(clientId);
    return modeUsesBasicTriageChain(resolveAttendanceMode(settings));
  }

  async conversationLacksBasicBotReply(conversationId: mongoose.Types.ObjectId): Promise<boolean> {
    const sent = await WebChatMessage.exists({
      conversationId,
      direction: 'outbound',
      senderUserId: WEBCHAT_BOT_SENDER_ID,
    });
    return !sent;
  }

  async handleInbound(ctx: WebChatBasicTriageContext): Promise<WebChatBasicTriageResult> {
    const replies: unknown[] = [];
    const trimmed = ctx.text?.trim() ?? '';

    const settings = await AiSettingsService.getInstance().getSettingsDoc(ctx.clientId);
    const attendanceMode = resolveAttendanceMode(settings);
    if (!modeUsesBasicTriageChain(attendanceMode)) {
      return { handled: false, replies };
    }

    const conv = ctx.conversation;
    if (conv.status === 'closed') return { handled: false, replies };
    if (conv.queueStatus !== 'bot') return { handled: false, replies };
    if (conv.assignedUserId) return { handled: false, replies };
    if (shouldSkipBasicTriageForBridge(conv)) return { handled: false, replies };

    const convOid = conv._id as mongoose.Types.ObjectId;
    const lacksBotReply = await this.conversationLacksBasicBotReply(convOid);
    const prompt = await AiPromptBuilderService.getInstance().getOrCreatePrompt(ctx.clientId);
    const departments = await loadClientVisibleDepartments(ctx.clientId);
    const deptHints = departments.map(d => ({
      name: d.name,
      menuKey: d.menuKey,
      description: d.description,
    }));

    const routeThreshold = Math.max(
      settings.transferRules?.lowConfidenceThreshold ?? TRIAGE_CONFIDENCE_HIGH,
      TRIAGE_CONFIDENCE_HIGH,
    );
    const threadContext = buildWebChatThreadContext(ctx.messageRows);

    if (!trimmed) {
      if (lacksBotReply) {
        replies.push(await ctx.sendBotReply(BASIC_GREETING_FALLBACK));
        return { handled: true, replies };
      }
      return { handled: true, replies };
    }

    const choice = await parseInboxMenuChoice(ctx.clientId, trimmed);
    if (choice) {
      const department = await InboxDepartment.findOne({
        clientId: new mongoose.Types.ObjectId(ctx.clientId),
        menuKey: choice,
        isActive: true,
        clientVisible: { $ne: false },
      });
      if (!department) {
        const hint = await buildInvalidMenuHint(ctx.clientId);
        replies.push(await ctx.sendBotReply(hint));
        return { handled: true, replies };
      }
      const confirm = await buildQueueConfirmation(ctx.clientId, department.name);
      await ctx.escalate(String(department._id), confirm);
      return { handled: true, replies };
    }

    if (prompt.autoResolveEnabled && textLooksLikeWebChatInquiry(trimmed)) {
      const auto = await AiAutoResolveService.getInstance().tryResolve(ctx.clientId, trimmed, {
        threadContext,
        webchatInquiry: true,
      });
      if (auto.hit && auto.reply) {
        replies.push(await ctx.sendBotReply(formatWebChatAutoResolveReply(auto.reply)));
        return { handled: true, replies };
      }
    }

    let classification = classifyLocal(trimmed, deptHints);
    const action = resolveBasicTriageAction(classification, { routeThreshold });
    const productIntent = mapBasicIntentToProduct(classification.intent);
    const convId = String(conv._id);

    const audit = async (act: typeof action, menuKey?: string) => {
      await recordBasicTriageClassificationEvent({
        clientId: ctx.clientId,
        conversationId: convId,
        productIntent,
        confidence: classification.confidence,
        action: act,
        menuKey,
        channel: 'webchat',
      });
    };

    if (classification.intent === 'human_request' || action === 'queue') {
      const menuKey =
        classification.intent === 'human_request' ? '4' : classification.suggestedMenuKey ?? '4';
      const department = departments.find(d => d.menuKey === menuKey);
      if (department) {
        const confirm = await buildQueueConfirmation(ctx.clientId, department.name);
        await ctx.escalate(String(department._id), confirm);
        await audit('queue', menuKey);
        return { handled: true, replies };
      }
      if (isHybridMode(settings)) {
        return { handled: false, replies };
      }
    }

    if (classification.intent === 'ticket_status') {
      replies.push(await ctx.sendBotReply(buildBasicTriageTicketStatusReply()));
      await audit('clarify');
      return { handled: true, replies };
    }

    if (classification.intent === 'greeting') {
      replies.push(
        await ctx.sendBotReply(
          'Olá! Como posso ajudar? Descreva sua dúvida ou digite *atendente* para falar com alguém.',
        ),
      );
      return { handled: true, replies };
    }

    if (
      action === 'route' &&
      shouldRouteByClassification(classification, routeThreshold) &&
      classification.suggestedMenuKey
    ) {
      const department = departments.find(d => d.menuKey === classification.suggestedMenuKey);
      if (department) {
        const confirm = await buildQueueConfirmation(ctx.clientId, department.name);
        await ctx.escalate(String(department._id), confirm);
        await audit('route', classification.suggestedMenuKey);
        return { handled: true, replies };
      }
    }

    if (classification.intent !== 'unknown') {
      if (isHybridMode(settings)) {
        return { handled: false, replies };
      }
      replies.push(await ctx.sendBotReply(buildBasicTriageClarifyReply(classification.intent)));
      await audit('clarify');
      return { handled: true, replies };
    }

    if (lacksBotReply) {
      if (isHybridMode(settings)) {
        return { handled: false, replies };
      }
      replies.push(await ctx.sendBotReply(BASIC_GREETING_FALLBACK));
      return { handled: true, replies };
    }

    if (isHybridMode(settings)) {
      return { handled: false, replies };
    }

    replies.push(await ctx.sendBotReply(buildBasicTriageClarifyReply('unknown')));
    await audit(action === 'queue' ? 'queue' : 'clarify', action === 'queue' ? '4' : undefined);
    return { handled: true, replies };
  }

  /** Carrega últimas mensagens para contexto de auto-resolve. */
  async loadMessageRows(conversationId: mongoose.Types.ObjectId): Promise<WebChatMessageRow[]> {
    const rows = await WebChatMessage.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(24)
      .lean();
    return rows.map(m => ({
      direction: m.direction as WebChatMessageRow['direction'],
      body: m.body,
    }));
  }
}
