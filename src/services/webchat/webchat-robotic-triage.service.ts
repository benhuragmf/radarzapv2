import mongoose from 'mongoose';
import { InboxDepartment } from '@/models/InboxDepartment';
import { WebChatMessage } from '@/models/WebChatMessage';
import type { IWebChatConversation } from '@/models/WebChatConversation';
import { AiSettingsService } from '@/services/ai/AiSettingsService';
import { resolveAttendanceMode } from '@/types/attendance-mode';
import {
  buildInboxTriageMenu,
  buildInvalidMenuHint,
  buildQueueConfirmation,
  parseInboxMenuChoice,
} from '@/constants/inbox-triage';
import { WEBCHAT_BOT_SENDER_ID } from './webchat-bot.util';

export interface WebChatRoboticTriageContext {
  clientId: string;
  conversation: IWebChatConversation;
  text: string;
  sendBotReply: (body: string) => Promise<unknown>;
  escalate: (departmentId: string, reason: string) => Promise<void>;
}

export interface WebChatRoboticTriageResult {
  /** true quando modo robotizado está ativo e a mensagem foi tratada pelo fluxo */
  handled: boolean;
  replies: unknown[];
}

export class WebChatRoboticTriageService {
  private static instance: WebChatRoboticTriageService;

  static getInstance(): WebChatRoboticTriageService {
    if (!this.instance) this.instance = new WebChatRoboticTriageService();
    return this.instance;
  }

  async isRoboticAttendanceMode(clientId: string): Promise<boolean> {
    const settings = await AiSettingsService.getInstance().getSettingsDoc(clientId);
    return resolveAttendanceMode(settings) === 'robotic';
  }

  /** Conversa ainda no bot sem menu de setores enviado pelo assistente robotizado. */
  async conversationLacksRoboticMenu(conversationId: mongoose.Types.ObjectId): Promise<boolean> {
    const sent = await WebChatMessage.exists({
      conversationId,
      direction: 'outbound',
      senderUserId: WEBCHAT_BOT_SENDER_ID,
    });
    return !sent;
  }

  /**
   * Menu numérico de setores (paridade com WhatsApp `handleStandardBotTriage`).
   * Só atua quando `AiSettings.attendanceMode === robotic` e conversa em `queueStatus: bot`.
   */
  async handleInbound(ctx: WebChatRoboticTriageContext): Promise<WebChatRoboticTriageResult> {
    const replies: unknown[] = [];
    const trimmed = ctx.text?.trim() ?? '';

    const isRobotic = await this.isRoboticAttendanceMode(ctx.clientId);
    if (!isRobotic) {
      return { handled: false, replies };
    }

    const conv = ctx.conversation;
    if (conv.status === 'closed') return { handled: false, replies };
    if (conv.queueStatus !== 'bot') return { handled: false, replies };
    if (conv.assignedUserId) return { handled: false, replies };
    if (conv.whatsappBridgeActive) return { handled: false, replies };

    const convOid = conv._id as mongoose.Types.ObjectId;
    const choice = trimmed ? await parseInboxMenuChoice(ctx.clientId, trimmed) : null;

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

    const lacksMenu = await this.conversationLacksRoboticMenu(convOid);
    const needsMenu = lacksMenu || !trimmed;

    if (needsMenu) {
      const menu = await buildInboxTriageMenu(ctx.clientId);
      replies.push(await ctx.sendBotReply(menu));
      return { handled: true, replies };
    }

    const hint = await buildInvalidMenuHint(ctx.clientId);
    replies.push(await ctx.sendBotReply(hint));
    return { handled: true, replies };
  }
}
