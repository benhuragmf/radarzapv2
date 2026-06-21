import mongoose from 'mongoose';
import { AiSettings } from '@/models/AiSettings';
import { InboxDepartment } from '@/models/InboxDepartment';
import { AiAutoResolveService } from '@/services/ai/AiAutoResolveService';
import { AiPromptBuilderService } from '@/services/ai/AiPromptBuilderService';
import type { IWebChatConversation } from '@/models/WebChatConversation';
import {
  buildInboxTriageMenu,
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

export class WebChatBasicTriageService {
  private static instance: WebChatBasicTriageService;

  static getInstance(): WebChatBasicTriageService {
    if (!this.instance) this.instance = new WebChatBasicTriageService();
    return this.instance;
  }

  async isBasicTriageMode(clientId: string): Promise<boolean> {
    const doc = await AiSettings.findOne({ clientId: new mongoose.Types.ObjectId(clientId) })
      .select('attendanceMode')
      .lean();
    return doc?.attendanceMode === 'basic_triage';
  }

  async handleInbound(ctx: WebChatBasicTriageContext): Promise<WebChatBasicTriageResult> {
    const replies: unknown[] = [];
    const trimmed = ctx.text?.trim() ?? '';

    if (!(await this.isBasicTriageMode(ctx.clientId))) {
      return { handled: false, replies };
    }

    const conv = ctx.conversation;
    if (conv.status === 'closed') return { handled: false, replies };
    if (conv.queueStatus !== 'bot') return { handled: false, replies };
    if (conv.assignedUserId) return { handled: false, replies };
    if (conv.whatsappBridgeActive) return { handled: false, replies };

    const prompt = await AiPromptBuilderService.getInstance().getOrCreatePrompt(ctx.clientId);
    const departments = await loadClientVisibleDepartments(ctx.clientId);
    const deptHints = departments.map(d => ({
      name: d.name,
      menuKey: d.menuKey,
      description: d.description,
    }));

    const routeThreshold = 0.65;
    const threadContext = buildWebChatThreadContext(ctx.messageRows);

    if (trimmed) {
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

      if (
        prompt.autoResolveEnabled &&
        textLooksLikeWebChatInquiry(trimmed)
      ) {
        const auto = await AiAutoResolveService.getInstance().tryResolve(ctx.clientId, trimmed, {
          threadContext,
          webchatInquiry: true,
        });
        if (auto.hit && auto.reply) {
          replies.push(await ctx.sendBotReply(formatWebChatAutoResolveReply(auto.reply)));
          return { handled: true, replies };
        }
      }

      const classification = classifyLocal(trimmed, deptHints);

      if (classification.intent === 'greeting') {
        replies.push(
          await ctx.sendBotReply(
            'Olá! Como posso ajudar? Descreva sua dúvida ou escolha um setor no menu.',
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
    }

    const menu = await buildInboxTriageMenu(ctx.clientId);
    replies.push(await ctx.sendBotReply(menu));
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
