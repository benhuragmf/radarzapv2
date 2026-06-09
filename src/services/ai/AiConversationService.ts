import mongoose from 'mongoose';
import { AiConversationState, IAiConversationState } from '@/models/AiConversationState';
import { AI_GENERIC_FALLBACK_REPLY, AiConversationStatus } from '@/types/ai-assistant';
import { InboxMessage } from '@/models/InboxMessage';
import { InboxDepartment } from '@/models/InboxDepartment';
import type { IDestination } from '@/models/Destination';
import type { IInboxConversation } from '@/models/InboxConversation';
import { InboxConversationStatus } from '@/types/inbox';
import type { ConversationAiStatus } from '@/types/inbox-conversation-ai';
import { AI_FALLBACK_TTL_MS, isAiFallbackExpired } from '@/types/inbox-conversation-ai';
import { AiSettingsService } from './AiSettingsService';
import { AiPromptBuilderService } from './AiPromptBuilderService';
import { AiProviderService } from './AiProviderService';
import { AiEscalationService } from './AiEscalationService';
import { AiUsageMeterService } from './AiUsageMeterService';
import { AiContextService } from './AiContextService';
import { AiAutoResolveService } from './AiAutoResolveService';
import { AiSkillService } from './AiSkillService';
import { AiMemoryService } from './AiMemoryService';
import type { InboxService } from '@/services/inbox/InboxService';
import { logger } from '@/utils/logger';

export interface AiInboundResult {
  /** IA processou a mensagem (não chamar bot padrão). */
  handled: boolean;
  /** IA falhou/limite/desativada — exibir menu de setores. */
  useStandardTriage?: boolean;
}

export interface AiInboundContext {
  clientId: string;
  conversation: IInboxConversation;
  dest: IDestination;
  text: string;
  isNew: boolean;
  hasMedia: boolean;
  mediaType?: string;
}

export class AiConversationService {
  private static instance: AiConversationService;

  static getInstance(): AiConversationService {
    if (!this.instance) this.instance = new AiConversationService();
    return this.instance;
  }

  async isEnabled(clientId: string): Promise<boolean> {
    return AiSettingsService.getInstance().isAiActive(clientId);
  }

  async getOrCreateState(
    clientId: string,
    conversationId: mongoose.Types.ObjectId,
  ): Promise<IAiConversationState> {
    let state = await AiConversationState.findOne({ conversationId });
    if (!state) {
      state = await AiConversationState.create({
        clientId: new mongoose.Types.ObjectId(clientId),
        conversationId,
        status: AiConversationStatus.AI_COLLECTING,
      });
    }
    return state;
  }

  async handleInbound(ctx: AiInboundContext, inbox: InboxService): Promise<AiInboundResult> {
    const inactive: AiInboundResult = { handled: false };

    const active = await this.isEnabled(ctx.clientId);
    if (!active) return inactive;

    const settings = await AiSettingsService.getInstance().getSettingsDoc(ctx.clientId);
    if (!settings.enabled || settings.mode === 'disabled') return inactive;

    if (ctx.conversation.status !== InboxConversationStatus.BOT_TRIAGE) {
      return inactive;
    }

    if (
      isAiFallbackExpired(ctx.conversation.aiStatus, ctx.conversation.aiFallbackUntil)
    ) {
      await inbox.clearConversationAi(ctx.clientId, String(ctx.conversation._id));
    } else if (ctx.conversation.aiStatus === 'ai_fallback_standard') {
      return { handled: false, useStandardTriage: true };
    }

    const state = await this.getOrCreateState(
      ctx.clientId,
      ctx.conversation._id as mongoose.Types.ObjectId,
    );
    if (state.status === AiConversationStatus.AI_FALLBACK_STANDARD) {
      return { handled: false, useStandardTriage: true };
    }
    if (
      state.status === AiConversationStatus.AI_ESCALATED ||
      state.status === AiConversationStatus.HUMAN_ASSIGNED
    ) {
      return { handled: false, useStandardTriage: true };
    }

    const prompt = await AiPromptBuilderService.getInstance().getOrCreatePrompt(ctx.clientId);
    const contactCtx = prompt.useSystemContext
      ? await AiContextService.getInstance().buildContactContext(ctx.clientId, ctx.dest)
      : undefined;
    AiContextService.getInstance().seedStateFromContact(state, contactCtx ?? { tags: [], knownFields: { name: false, email: false }, recentTickets: [] }, prompt);

    const hasUninterpretableMedia =
      ctx.hasMedia && (!ctx.text.trim() || ['audio', 'image', 'document', 'video'].includes(ctx.mediaType ?? ''));

    if (hasUninterpretableMedia && settings.transferRules.onUninterpretableMedia) {
      await this.releaseToStandardTriage(state, 'Mídia não interpretável pela IA', inbox);
      return { handled: false, useStandardTriage: true };
    }

    const usage = await AiUsageMeterService.getInstance().getUsageSnapshot(
      ctx.clientId,
      String(ctx.conversation._id),
      settings,
    );
    if (!usage.allowed) {
      await this.releaseToStandardTriage(state, usage.reason ?? 'Limite de IA atingido', inbox);
      return { handled: false, useStandardTriage: true };
    }

    if (ctx.isNew && !ctx.text.trim()) {
      const knownName = contactCtx?.knownFields.name ? contactCtx.name : undefined;
      const greeting = knownName
        ? `Olá, ${knownName}! Sou o assistente virtual da empresa. Como posso ajudar você hoje?`
        : 'Olá! Sou o assistente virtual. Para agilizar seu atendimento, preciso de algumas informações. Qual é o seu nome?';
      await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, greeting);
      state.status = AiConversationStatus.AI_WAITING_CLIENT;
      await state.save();
      await this.syncConversationAi(
        inbox,
        ctx.clientId,
        ctx.conversation._id as mongoose.Types.ObjectId,
        'ai_waiting_client',
      );
      return { handled: true };
    }

    if (!ctx.text.trim()) {
      if (ctx.hasMedia) {
        await this.releaseToStandardTriage(state, 'Mídia sem texto', inbox);
        return { handled: false, useStandardTriage: true };
      }
      return { handled: true };
    }

    const normalized = AiEscalationService.getInstance().normalizeForRepeatCheck(ctx.text);
    if (state.lastClientMessage && normalized === state.lastClientMessage) {
      state.repeatedQuestionCount += 1;
    } else {
      state.repeatedQuestionCount = 0;
      state.lastClientMessage = normalized;
    }

    if (prompt.autoResolveEnabled && this.textLooksLikeProblemDescription(ctx.text)) {
      const auto = await AiAutoResolveService.getInstance().tryResolve(ctx.clientId, ctx.text);
      if (auto.hit && auto.reply) {
        this.mergeCollected(state, {}, ctx.text);
        state.collectedProblem = ctx.text.trim();
        state.aiTurnCount += 1;
        state.confidence = 0.85;
        state.summary = `Resolvido via ${auto.source}: ${auto.sourceTitle ?? ''}`.trim();

        const autoReply = `${auto.reply}\n\nIsso resolveu sua dúvida? Se precisar de mais ajuda, descreva ou digite *atendente*.`;
        await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, autoReply);

        state.status = AiConversationStatus.AI_WAITING_CLIENT;
        await state.save();
        await this.syncConversationAi(
          inbox,
          ctx.clientId,
          ctx.conversation._id as mongoose.Types.ObjectId,
          'ai_waiting_client',
        );
        logger.info('IA resolveu sem LLM (economia de créditos)', {
          clientId: ctx.clientId,
          source: auto.source,
          score: auto.score,
        });
        return { handled: true };
      }
    }

    const history = await this.loadRecentHistory(ctx.conversation._id as mongoose.Types.ObjectId);
    const systemPrompt = await AiPromptBuilderService.getInstance().buildSystemPrompt(
      ctx.clientId,
      { contactContext: contactCtx, clientText: ctx.text },
    );

    let completion;
    try {
      completion = await AiProviderService.getInstance().complete(
        ctx.clientId,
        settings,
        [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: ctx.text },
        ],
        String(ctx.conversation._id),
      );
    } catch (e) {
      const reason = (e as Error).message;
      logger.warn('IA falhou — liberando bot padrão (menu de setores)', {
        clientId: ctx.clientId,
        conversationId: ctx.conversation._id,
        reason,
      });

      await AiConversationState.findOneAndUpdate(
        {
          conversationId: ctx.conversation._id,
          status: {
            $nin: [
              AiConversationStatus.AI_FALLBACK_STANDARD,
              AiConversationStatus.AI_ESCALATED,
              AiConversationStatus.HUMAN_ASSIGNED,
            ],
          },
        },
        {
          $set: {
            status: AiConversationStatus.AI_FALLBACK_STANDARD,
            shouldEscalate: false,
            escalationReason: reason,
          },
        },
      );
      await inbox.setConversationAiStatus(
        ctx.clientId,
        String(ctx.conversation._id),
        'ai_fallback_standard',
        new Date(Date.now() + AI_FALLBACK_TTL_MS),
      );
      return { handled: false, useStandardTriage: true };
    }

    const { structured } = completion;
    const providerSvc = AiProviderService.getInstance();

    if (providerSvc.isUnusableClientReply(structured)) {
      logger.warn('IA retornou resposta inválida — bot padrão', {
        clientId: ctx.clientId,
        conversationId: ctx.conversation._id,
        parseFailed: structured.parseFailed,
      });
      await this.releaseToStandardTriage(state, 'Resposta da IA inválida ou vazia', inbox);
      return { handled: false, useStandardTriage: true };
    }

    const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
    if (
      lastAssistant?.content.trim() === AI_GENERIC_FALLBACK_REPLY &&
      structured.reply.trim() === AI_GENERIC_FALLBACK_REPLY
    ) {
      await this.releaseToStandardTriage(state, 'IA repetindo resposta genérica', inbox);
      return { handled: false, useStandardTriage: true };
    }

    this.mergeCollected(state, structured, ctx.text);
    state.confidence = structured.confidence;
    state.aiTurnCount += 1;
    if (structured.internalSummary) state.summary = structured.internalSummary;
    if (structured.departmentMenuKey) state.suggestedDepartmentMenuKey = structured.departmentMenuKey;

    const escalation = AiEscalationService.getInstance().check({
      clientText: ctx.text,
      hasUninterpretableMedia,
      structured,
      state,
      prompt,
      rules: settings.transferRules,
    });

    await inbox.sendAiReply(
      ctx.clientId,
      ctx.conversation,
      ctx.dest.identifier,
      structured.reply,
    );

    if (escalation.shouldEscalate) {
      logger.info('IA escalonando conversa', {
        clientId: ctx.clientId,
        conversationId: ctx.conversation._id,
        reason: escalation.reason,
        aiTurnCount: state.aiTurnCount,
        collectedName: state.collectedName,
        collectedEmail: state.collectedEmail,
        collectedProblem: state.collectedProblem,
      });
      await this.escalate(
        ctx,
        inbox,
        state,
        escalation.reason ?? 'Transferência para humano',
        { lastAiReply: structured.reply },
      );
      return { handled: true };
    }

    state.status = AiConversationStatus.AI_WAITING_CLIENT;
    await state.save();
    await this.syncConversationAi(
      inbox,
      ctx.clientId,
      ctx.conversation._id as mongoose.Types.ObjectId,
      'ai_waiting_client',
    );
    return { handled: true };
  }

  private async releaseToStandardTriage(
    state: IAiConversationState,
    reason: string,
    inbox?: InboxService,
  ): Promise<void> {
    state.status = AiConversationStatus.AI_FALLBACK_STANDARD;
    state.shouldEscalate = false;
    state.escalationReason = reason;
    await state.save();
    if (inbox) {
      await inbox.setConversationAiStatus(
        String(state.clientId),
        String(state.conversationId),
        'ai_fallback_standard',
        new Date(Date.now() + AI_FALLBACK_TTL_MS),
      );
    }
  }

  private async syncConversationAi(
    inbox: InboxService,
    clientId: string,
    conversationId: mongoose.Types.ObjectId,
    aiStatus: ConversationAiStatus | null,
    aiFallbackUntil?: Date,
  ): Promise<void> {
    await inbox.setConversationAiStatus(
      clientId,
      String(conversationId),
      aiStatus,
      aiFallbackUntil,
    );
  }

  async manualRespond(
    clientId: string,
    conversationId: string,
    text: string,
    inbox: InboxService,
  ): Promise<{ reply: string; escalated: boolean }> {
    const conv = await inbox.getConversationRaw(clientId, conversationId);
    if (!conv) throw new Error('Conversa não encontrada');
    const settings = await AiSettingsService.getInstance().getSettingsDoc(clientId);
    const state = await this.getOrCreateState(clientId, conv._id as mongoose.Types.ObjectId);
    const systemPrompt = await AiPromptBuilderService.getInstance().buildSystemPrompt(clientId);
    const history = await this.loadRecentHistory(conv._id as mongoose.Types.ObjectId);
    const completion = await AiProviderService.getInstance().complete(
      clientId,
      settings,
      [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: text },
      ],
      conversationId,
    );
    this.mergeCollected(state, completion.structured, text);
    await inbox.sendAiReply(clientId, conv, conv.contactIdentifier, completion.structured.reply);
    state.status = AiConversationStatus.AI_WAITING_CLIENT;
    await state.save();
    return { reply: completion.structured.reply, escalated: false };
  }

  async manualEscalate(
    clientId: string,
    conversationId: string,
    inbox: InboxService,
    reason?: string,
  ): Promise<void> {
    const conv = await inbox.getConversationRaw(clientId, conversationId);
    if (!conv) throw new Error('Conversa não encontrada');
    const state = await this.getOrCreateState(clientId, conv._id as mongoose.Types.ObjectId);
    await this.escalate(
      {
        clientId,
        conversation: conv,
        dest: { identifier: conv.contactIdentifier } as IDestination,
        text: '',
        isNew: false,
        hasMedia: false,
      },
      inbox,
      state,
      reason ?? 'Escalonamento manual',
    );
  }

  private mergeCollected(
    state: IAiConversationState,
    structured: {
      collectedName?: string;
      collectedEmail?: string;
      collectedProblem?: string;
      collectedCpfCnpj?: string;
      collectedAddress?: string;
      collectedOrderNumber?: string;
      urgency?: 'low' | 'medium' | 'high';
      internalSummary?: string;
    },
    clientText: string,
  ): void {
    const text = clientText.trim();
    const emailInText = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];

    if (structured.collectedName?.trim() && this.textLooksLikeName(text)) {
      state.collectedName = structured.collectedName.trim();
    } else if (this.textLooksLikeName(text)) {
      state.collectedName = text;
    }

    if (emailInText) {
      state.collectedEmail = emailInText.toLowerCase();
    } else if (structured.collectedEmail?.trim() && text.includes('@')) {
      state.collectedEmail = structured.collectedEmail.trim();
    }

    if (this.textLooksLikeProblemDescription(text)) {
      state.collectedProblem = text;
    } else if (
      structured.collectedProblem?.trim() &&
      this.textLooksLikeProblemDescription(structured.collectedProblem)
    ) {
      state.collectedProblem = structured.collectedProblem.trim();
    }

    if (structured.collectedCpfCnpj?.trim() && /\d{3,}/.test(text)) {
      state.collectedCpfCnpj = structured.collectedCpfCnpj.trim();
    }
    if (structured.collectedAddress?.trim() && text.length >= 12) {
      state.collectedAddress = structured.collectedAddress.trim();
    }
    if (structured.collectedOrderNumber?.trim() && /\d{4,}/.test(text)) {
      state.collectedOrderNumber = structured.collectedOrderNumber.trim();
    }
    if (structured.urgency) state.urgency = structured.urgency;
    if (structured.internalSummary) state.summary = structured.internalSummary;
  }

  private textLooksLikeName(text: string): boolean {
    const t = text.trim();
    if (!t || t.includes('@') || /\d/.test(t)) return false;
    if (/^(oi|ola|olá|bom dia|boa tarde|boa noite)$/i.test(t)) return false;
    const words = t.split(/\s+/).filter(Boolean);
    return words.length <= 3 && t.length <= 40;
  }

  private textLooksLikeProblemDescription(text: string): boolean {
    const t = text.trim();
    if (!t || t.includes('@')) return false;
    if (this.textLooksLikeName(t)) return false;
    if (/^(oi|ola|olá|bom dia|boa tarde|boa noite|preciso de ajuda)$/i.test(t)) return false;
    return t.length >= 10 || t.split(/\s+/).length >= 3;
  }

  private async escalate(
    ctx: AiInboundContext,
    inbox: InboxService,
    state: IAiConversationState,
    reason: string,
    opts?: { clientMessage?: string; lastAiReply?: string },
  ): Promise<void> {
    const freshConv = await inbox.getConversationRaw(
      ctx.clientId,
      String(ctx.conversation._id),
    );
    if (freshConv?.status === InboxConversationStatus.WAITING_QUEUE) {
      return;
    }

    state.shouldEscalate = true;
    state.escalationReason = reason;
    state.status = AiConversationStatus.AI_ESCALATED;
    await state.save();
    await this.syncConversationAi(
      inbox,
      ctx.clientId,
      ctx.conversation._id as mongoose.Types.ObjectId,
      'ai_escalated',
    );

    const menuKey = state.suggestedDepartmentMenuKey;
    const clientOid = new mongoose.Types.ObjectId(ctx.clientId);
    let department = menuKey
      ? await InboxDepartment.findOne({ clientId: clientOid, menuKey, isActive: true })
      : null;
    if (!department) {
      department = await InboxDepartment.findOne({
        clientId: clientOid,
        isActive: true,
        clientVisible: { $ne: false },
      }).sort({ sortOrder: 1 });
    }

    const summaryBlock = state.summary
      ? `\n\n*Resumo IA:* ${state.summary}`
      : '';
    const collected = [
      state.collectedName && `Nome: ${state.collectedName}`,
      state.collectedEmail && `E-mail: ${state.collectedEmail}`,
      state.collectedProblem && `Problema: ${state.collectedProblem}`,
      state.collectedOrderNumber && `Pedido: ${state.collectedOrderNumber}`,
      state.urgency && `Urgência: ${state.urgency}`,
    ]
      .filter(Boolean)
      .join('\n');

    const defaultClientMsg = `Estou transferindo você para um atendente humano.${summaryBlock ? '' : ''} Aguarde um momento, por favor.`;
    await inbox.escalateFromAi(ctx.clientId, ctx.conversation, ctx.dest, department, {
      reason,
      internalNote: [collected, state.summary].filter(Boolean).join('\n'),
      clientMessage: opts?.clientMessage ?? defaultClientMsg,
    });

    const promptCfg = await AiPromptBuilderService.getInstance().getOrCreatePrompt(ctx.clientId);
    const convId = ctx.conversation._id as mongoose.Types.ObjectId;
    if (promptCfg.learnSkillsEnabled) {
      try {
        await AiSkillService.getInstance().proposeFromConversation(
          ctx.clientId,
          convId,
          state,
          opts?.lastAiReply,
        );
      } catch (e) {
        logger.warn('Falha ao propor skill aprendida', { error: (e as Error).message });
      }
    }
    if (promptCfg.learnMemoryEnabled) {
      try {
        await AiMemoryService.getInstance().proposeFromConversation(
          ctx.clientId,
          convId,
          state,
          opts?.lastAiReply,
        );
      } catch (e) {
        logger.warn('Falha ao propor memória aprendida', { error: (e as Error).message });
      }
    }
  }

  private async loadRecentHistory(
    conversationId: mongoose.Types.ObjectId,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const rows = await InboxMessage.find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();
    return rows
      .reverse()
      .filter(m => m.direction === 'inbound' || m.direction === 'outbound')
      .map(m => ({
        role: m.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
        content: m.body?.slice(0, 1500) ?? '',
      }))
      .filter(m => m.content.trim());
  }

  async markHumanAssigned(conversationId: string, clientId?: string): Promise<void> {
    await AiConversationState.updateOne(
      { conversationId: new mongoose.Types.ObjectId(conversationId) },
      { status: AiConversationStatus.HUMAN_ASSIGNED },
    );
    if (clientId) {
      const { InboxService } = await import('@/services/inbox/InboxService');
      await InboxService.getInstance().setConversationAiStatus(
        clientId,
        conversationId,
        'human_assigned',
      );
    }
  }
}
