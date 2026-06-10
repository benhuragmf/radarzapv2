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
import { AiContextService, type AiContactContext } from './AiContextService';
import type { IAiPrompt } from '@/models/AiPrompt';
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
      const greeting = await AiPromptBuilderService.getInstance().buildGreeting(
        ctx.clientId,
        contactCtx,
      );
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

    const expandedText = this.expandShortClientReply(ctx.text);
    if (expandedText !== ctx.text.trim()) {
      ctx = { ...ctx, text: expandedText };
    }

    const normalized = AiEscalationService.getInstance().normalizeForRepeatCheck(ctx.text);
    if (state.lastClientMessage && normalized === state.lastClientMessage) {
      state.repeatedQuestionCount += 1;
    } else {
      state.repeatedQuestionCount = 0;
      state.lastClientMessage = normalized;
    }

    const ctxSvc = AiContextService.getInstance();
    const contactCtxForCollection =
      contactCtx ?? { tags: [], knownFields: { name: false, email: false }, recentTickets: [] };

    if (await this.ensureNameConfirmed(ctx, inbox, state, prompt, contactCtxForCollection, ctxSvc)) {
      return { handled: true };
    }

    const emailGate = await this.ensureEmailCollected(
      ctx,
      inbox,
      state,
      prompt,
      contactCtxForCollection,
      ctxSvc,
    );
    if (emailGate === true) {
      return { handled: true };
    }
    if (emailGate === 'resume_problem' && state.collectedProblem?.trim()) {
      ctx = { ...ctx, text: state.collectedProblem.trim() };
    }

    const autoResolveSvc = AiAutoResolveService.getInstance();
    const threadContext = [state.collectedProblem, state.summary].filter(Boolean).join(' ');
    if (
      prompt.autoResolveEnabled &&
      state.nameConfirmed &&
      this.textLooksLikeProblemDescription(ctx.text) &&
      autoResolveSvc.shouldAttemptAutoResolve(ctx.text, threadContext)
    ) {
      const auto = await autoResolveSvc.tryResolve(ctx.clientId, ctx.text, { threadContext });
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
    const escSvc = AiEscalationService.getInstance();
    const lastAssistantBefore = [...history].reverse().find(m => m.role === 'assistant');

    if (
      state.status === AiConversationStatus.AI_COMPLETED &&
      escSvc.clientClosingConversation(ctx.text)
    ) {
      await this.completeAiConversation(ctx, inbox, state, 'farewell');
      return { handled: true };
    }

    if (escSvc.clientClosingConversation(ctx.text)) {
      await this.completeAiConversation(ctx, inbox, state, 'farewell');
      return { handled: true };
    }

    if (escSvc.clientDeclinesMoreHelp(ctx.text, lastAssistantBefore?.content)) {
      await this.completeAiConversation(ctx, inbox, state, 'declined_more');
      return { handled: true };
    }

    if (
      settings.transferRules.onHumanRequest &&
      escSvc.isWaitingForPromisedHandoff(ctx.text, lastAssistantBefore?.content)
    ) {
      logger.info('IA completando transferência pendente (cliente aguardando)', {
        clientId: ctx.clientId,
        conversationId: ctx.conversation._id,
      });
      await this.escalate(ctx, inbox, state, 'Cliente aguardando transferência prometida pela IA');
      return { handled: true };
    }

    if (settings.transferRules.onHumanRequest && escSvc.clientRequestsHuman(ctx.text)) {
      logger.info('IA escalonando por pedido explícito de suporte/humano', {
        clientId: ctx.clientId,
        conversationId: ctx.conversation._id,
        text: ctx.text.slice(0, 80),
      });
      await this.escalate(ctx, inbox, state, 'Cliente solicitou atendente humano');
      return { handled: true };
    }

    if (this.textLooksLikeProblemDescription(ctx.text)) {
      state.collectedProblem = ctx.text.trim();
      await state.save();
    }

    const systemPrompt = await AiPromptBuilderService.getInstance().buildSystemPrompt(
      ctx.clientId,
      { contactContext: contactCtx, clientText: ctx.text },
    );

    const llmMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: ctx.text },
    ];

    let completion: Awaited<ReturnType<AiProviderService['complete']>> | undefined;
    let llmError: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        completion = await AiProviderService.getInstance().complete(
          ctx.clientId,
          settings,
          llmMessages,
          String(ctx.conversation._id),
        );
        llmError = undefined;
        break;
      } catch (e) {
        llmError = (e as Error).message;
        logger.warn('IA falhou na chamada ao provedor', {
          clientId: ctx.clientId,
          conversationId: ctx.conversation._id,
          reason: llmError,
          attempt: attempt + 1,
        });
        if (attempt === 0 && this.isTransientAiError(llmError)) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue;
        }
        break;
      }
    }

    if (!completion) {
      return this.recoverFromAiFailure(ctx, inbox, state, prompt, llmError ?? 'IA indisponível');
    }

    const { structured } = completion;
    const providerSvc = AiProviderService.getInstance();

    if (providerSvc.isUnusableClientReply(structured)) {
      logger.warn('IA retornou resposta inválida — tentando recuperação', {
        clientId: ctx.clientId,
        conversationId: ctx.conversation._id,
        parseFailed: structured.parseFailed,
      });
      return this.recoverFromAiFailure(
        ctx,
        inbox,
        state,
        prompt,
        structured.parseFailed ? 'JSON inválido' : 'Resposta vazia',
      );
    }

    const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
    if (
      lastAssistant?.content.trim() === AI_GENERIC_FALLBACK_REPLY &&
      structured.reply.trim() === AI_GENERIC_FALLBACK_REPLY
    ) {
      return this.recoverFromAiFailure(ctx, inbox, state, prompt, 'Resposta genérica repetida');
    }

    this.mergeCollected(state, structured, ctx.text);
    await ctxSvc.persistCollectedFields(ctx.dest, {
      name: state.nameConfirmed ? state.collectedName : undefined,
      email: state.collectedEmail,
    });
    state.confidence = structured.confidence;
    state.aiTurnCount += 1;
    if (structured.internalSummary) state.summary = structured.internalSummary;
    if (structured.departmentMenuKey) state.suggestedDepartmentMenuKey = structured.departmentMenuKey;

    let escalation = escSvc.check({
      clientText: ctx.text,
      hasUninterpretableMedia,
      structured,
      state,
      prompt,
      rules: settings.transferRules,
    });

    if (!escalation.shouldEscalate) {
      if (escSvc.isWaitingForPromisedHandoff(ctx.text, lastAssistantBefore?.content)) {
        escalation = {
          shouldEscalate: true,
          reason: 'Cliente aguardando transferência prometida pela IA',
        };
      } else if (
        structured.shouldEscalate ||
        escSvc.aiReplyPromisesTransfer(structured.reply)
      ) {
        if (escSvc.clientRequestsHuman(ctx.text) || state.aiTurnCount >= 2) {
          escalation = {
            shouldEscalate: true,
            reason: structured.escalationReason ?? 'IA confirmou transferência para humano',
          };
        }
      }
    }

    await inbox.sendAiReply(
      ctx.clientId,
      ctx.conversation,
      ctx.dest.identifier,
      structured.reply,
    );

    if (
      escalation.shouldEscalate &&
      (escSvc.clientClosingConversation(ctx.text) ||
        escSvc.clientDeclinesMoreHelp(ctx.text, lastAssistantBefore?.content))
    ) {
      escalation = { shouldEscalate: false };
    }

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

  private isTransientAiError(message: string): boolean {
    return /high demand|quota exceeded|rate.?limit|429|resource.?exhausted|overloaded|try again|unavailable|please retry|timeout|timed out|fetch failed|econnreset|503|502/i.test(
      message,
    );
  }

  private expandShortClientReply(text: string): string {
    const norm = text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    if (/^(s|ss)$/.test(norm)) return 'sim';
    return text.trim();
  }

  private async tryAutoResolveAndReply(
    ctx: AiInboundContext,
    inbox: InboxService,
    state: IAiConversationState,
  ): Promise<boolean> {
    const autoResolveSvc = AiAutoResolveService.getInstance();
    const threadContext = [state.collectedProblem, state.summary].filter(Boolean).join(' ');
    if (
      !this.textLooksLikeProblemDescription(ctx.text) ||
      !autoResolveSvc.shouldAttemptAutoResolve(ctx.text, threadContext)
    ) {
      return false;
    }
    const auto = await autoResolveSvc.tryResolve(ctx.clientId, ctx.text, { threadContext });
    if (!auto.hit || !auto.reply) return false;

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
    return true;
  }

  /** Falha do Gemini/OpenAI — mantém IA ativa (não joga no menu de setores). */
  private async recoverFromAiFailure(
    ctx: AiInboundContext,
    inbox: InboxService,
    state: IAiConversationState,
    prompt: IAiPrompt,
    reason: string,
  ): Promise<AiInboundResult> {
    logger.warn('IA em recuperação — sem menu de setores', {
      clientId: ctx.clientId,
      conversationId: ctx.conversation._id,
      reason,
    });

    if (prompt.autoResolveEnabled && (await this.tryAutoResolveAndReply(ctx, inbox, state))) {
      return { handled: true };
    }

    const first = state.collectedName?.trim().split(/\s+/)[0];
    const reply = first
      ? `${first}, tive uma instabilidade momentânea ao processar sua mensagem. Pode repetir em alguns segundos ou digite *atendente* para falar com nossa equipe.`
      : 'Tive uma instabilidade momentânea ao processar sua mensagem. Pode repetir em alguns segundos ou digite *atendente* para nossa equipe.';

    await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, reply);
    state.status = AiConversationStatus.AI_WAITING_CLIENT;
    state.shouldEscalate = false;
    await state.save();
    await this.syncConversationAi(
      inbox,
      ctx.clientId,
      ctx.conversation._id as mongoose.Types.ObjectId,
      'ai_waiting_client',
    );
    return { handled: true };
  }

  private async completeAiConversation(
    ctx: AiInboundContext,
    inbox: InboxService,
    state: IAiConversationState,
    kind: 'farewell' | 'declined_more',
  ): Promise<void> {
    const firstName = state.collectedName?.trim().split(/\s+/)[0];
    const reply =
      kind === 'farewell'
        ? firstName
          ? `De nada, ${firstName}! Qualquer dúvida, é só chamar. Tenha um ótimo dia!`
          : 'De nada! Qualquer dúvida, é só chamar. Tenha um ótimo dia!'
        : 'Entendido! Se precisar de mais alguma coisa, é só me chamar.';

    await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, reply);
    state.status = AiConversationStatus.AI_COMPLETED;
    state.shouldEscalate = false;
    await state.save();
    await this.syncConversationAi(
      inbox,
      ctx.clientId,
      ctx.conversation._id as mongoose.Types.ObjectId,
      'ai_completed',
    );

    if (kind === 'farewell') {
      await inbox.closeAiResolvedConversation(ctx.clientId, ctx.conversation);
    }
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
      state.nameConfirmed = true;
    } else if (this.textLooksLikeName(text)) {
      state.collectedName = text;
      state.nameConfirmed = true;
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

  private async ensureNameConfirmed(
    ctx: AiInboundContext,
    inbox: InboxService,
    state: IAiConversationState,
    prompt: IAiPrompt,
    contactCtx: AiContactContext,
    ctxSvc: AiContextService,
  ): Promise<boolean> {
    if (!prompt.collectName || state.nameConfirmed) return false;

    const registry = state.registryNameSnapshot ?? contactCtx.name;
    const parsed = ctxSvc.parseNameConfirmation(ctx.text, registry);

    if (parsed.denied) {
      state.registryNameSnapshot = undefined;
      await inbox.sendAiReply(
        ctx.clientId,
        ctx.conversation,
        ctx.dest.identifier,
        'Sem problemas! Qual é o seu *nome completo*?',
      );
      await state.save();
      return true;
    }

    if (parsed.confirmed && parsed.name) {
      state.collectedName = parsed.name;
      state.nameConfirmed = true;
      await ctxSvc.persistCollectedFields(ctx.dest, { name: parsed.name });
      const first = parsed.name.split(/\s+/)[0];
      await inbox.sendAiReply(
        ctx.clientId,
        ctx.conversation,
        ctx.dest.identifier,
        `Obrigado, ${first}! Como posso ajudar você hoje?`,
      );
      state.status = AiConversationStatus.AI_WAITING_CLIENT;
      await state.save();
      return true;
    }

    await inbox.sendAiReply(
      ctx.clientId,
      ctx.conversation,
      ctx.dest.identifier,
      ctxSvc.buildNameConfirmationPrompt(registry),
    );
    state.status = AiConversationStatus.AI_WAITING_CLIENT;
    await state.save();
    return true;
  }

  private async ensureEmailCollected(
    ctx: AiInboundContext,
    inbox: InboxService,
    state: IAiConversationState,
    prompt: IAiPrompt,
    contactCtx: AiContactContext,
    ctxSvc: AiContextService,
  ): Promise<boolean | 'resume_problem'> {
    if (!state.nameConfirmed) return false;
    if (!ctxSvc.needsEmailCollection(state, contactCtx, prompt)) return false;

    const email = ctxSvc.emailInText(ctx.text);
    if (email) {
      state.collectedEmail = email;
      await ctxSvc.persistCollectedFields(ctx.dest, { email });
      await state.save();
      if (state.collectedProblem?.trim()) return 'resume_problem';
      return false;
    }

    if (this.textLooksLikeProblemDescription(ctx.text)) {
      state.collectedProblem = ctx.text.trim();
    }

    await inbox.sendAiReply(
      ctx.clientId,
      ctx.conversation,
      ctx.dest.identifier,
      ctxSvc.buildEmailCollectionPrompt(state.collectedName),
    );
    state.status = AiConversationStatus.AI_WAITING_CLIENT;
    await state.save();
    return true;
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
    if (/^(oi|ola|olá|bom dia|boa tarde|boa noite|preciso de ajuda|sim|nao|não|s|ss|ok)$/i.test(t)) {
      return false;
    }
    if (/\b(plano|vip|sala de jogos|contrat|acesso|comercial|benef[ií]cio)\b/i.test(t)) return true;
    if (/\b(problema|erro|ajuda|n[aã]o conecta|n[aã]o funciona|instala)/i.test(t)) return true;
    const words = t.split(/\s+/).filter(Boolean);
    return words.length >= 3 && t.length >= 12;
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
