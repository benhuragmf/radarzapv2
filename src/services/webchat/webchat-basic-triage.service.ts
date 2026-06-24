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
  classifyLocal,
  shouldRouteByClassification,
} from '@/utils/basic-triage-classifier';
import {
  buildWebChatThreadContext,
  formatWebChatAutoResolveReply,
  textLooksLikeWebChatInquiry,
  type WebChatMessageRow,
} from './webchat-ai-triage.util';
import { WebChatMessage } from '@/models/WebChatMessage';
import { isBasicTriageMode } from '@/types/attendance-mode';
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
    return isBasicTriageMode(settings);
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
    if (!isBasicTriageMode(settings)) {
      return { handled: false, replies };
    }

    const conv = ctx.conversation;
    if (conv.status === 'closed') return { handled: false, replies };
    if (conv.queueStatus !== 'bot') return { handled: false, replies };
    if (conv.assignedUserId) return { handled: false, replies };
    if (conv.whatsappBridgeActive) return { handled: false, replies };

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
      settings.transferRules?.lowConfidenceThreshold ?? 0.45,
      0.65,
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

    if (classification.intent === 'greeting') {
      replies.push(
        await ctx.sendBotReply(
          'Olá! Como posso ajudar? Descreva sua dúvida ou digite *atendente* para falar com alguém.',
        ),
      );
      return { handled: true, replies };
    }

    if (
      shouldRouteByClassification(classification, routeThreshold) &&
      classification.suggestedMenuKey
    ) {
      const department = departments.find(d => d.menuKey === classification.suggestedMenuKey);
      if (department) {
        const confirm = await buildQueueConfirmation(ctx.clientId, department.name);
        await ctx.escalate(String(department._id), confirm);
        return { handled: true, replies };
      }
    }

    if (classification.intent !== 'unknown') {
      replies.push(await ctx.sendBotReply(buildBasicTriageClarifyReply(classification.intent)));
      return { handled: true, replies };
    }

    if (lacksBotReply) {
      replies.push(await ctx.sendBotReply(BASIC_GREETING_FALLBACK));
      return { handled: true, replies };
    }

    replies.push(await ctx.sendBotReply(buildBasicTriageClarifyReply('unknown')));
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
