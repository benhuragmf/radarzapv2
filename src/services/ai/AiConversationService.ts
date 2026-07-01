import mongoose from 'mongoose';
import { AiConversationState, IAiConversationState } from '@/models/AiConversationState';
import { AI_GENERIC_FALLBACK_REPLY, AiConversationStatus } from '@/types/ai-assistant';
import { emptyAiStructuredReply, type AiStructuredReply } from '@/types/ai-assistant';
import { InboxMessage } from '@/models/InboxMessage';
import { InboxDepartment } from '@/models/InboxDepartment';
import type { IInboxDepartment } from '@/models/InboxDepartment';
import type { IDestination } from '@/models/Destination';
import type { IInboxConversation } from '@/models/InboxConversation';
import { InboxConversation } from '@/models/InboxConversation';
import { InboxConversationStatus } from '@/types/inbox';
import type { ConversationAiStatus } from '@/types/inbox-conversation-ai';
import { AI_FALLBACK_TTL_MS, isAiFallbackExpired } from '@/types/inbox-conversation-ai';
import { AiSettingsService } from './AiSettingsService';
import { AiPromptBuilderService } from './AiPromptBuilderService';
import { AiProviderService } from './AiProviderService';
import { AiEscalationService } from './AiEscalationService';
import { AiUsageMeterService } from './AiUsageMeterService';
import { estimateTypicalTurnCostUsd } from '@/constants/ai-model-catalog';
import { aiCreditsFromActualCost } from '@/types/ai-credits';
import { AiContextService, type AiContactContext } from './AiContextService';
import type { IAiPrompt } from '@/models/AiPrompt';
import { AiAutoResolveService } from './AiAutoResolveService';
import { AiSkillService } from './AiSkillService';
import { AiMemoryService } from './AiMemoryService';
import {
  isWaLocationInboundText,
  parseWaLocationFromInboundText,
} from '@/utils/wa-location.util';
import {
  buildAddressLabelFromLocation,
  reverseGeocodeCoords,
  aiReplyCollectsDeliveryAddress,
  sanitizeAiReplyStripTransferDuringCatalogFlow,
  sanitizeAiReplyStripPixBeforeAddress,
} from '@/utils/catalog-delivery.util';
import {
  detectDeliveryFulfillmentChoice,
  detectPickupFulfillmentChoice,
  detectDeliveryFeeOrAddressQuestion,
  detectPurchaseConfirmation,
  extractProductNameFromCatalogOffer,
  buildFulfillmentReminderReply,
  isCatalogPurchaseOfferMessage,
  looksLikeCatalogProductNameQuery,
  isAwaitingCatalogFulfillmentChoice,
} from '@/types/catalog-sales';
import {
  textIsCepOnly,
  textLooksLikeStreetNumber,
  textLooksLikeDeliveryAddressInput,
} from '@/types/catalog-delivery-address';
import { parseStreetNumberReply } from '@/utils/catalog-delivery.util';
import { AiTicketUpdateService } from './AiTicketUpdateService';
import { AiTicketAssistService } from './AiTicketAssistService';
import type { InboxService } from '@/services/inbox/InboxService';
import { Organization } from '@/models/Organization';
import {
  buildPremiumAiUngroundedReply,
  guardPremiumAiFactualReply,
  isKbRequiredFactualInquiry,
} from '@/types/premium-ai.util';
import { listClientFacingTickets } from '@/services/inbox/client-ticket-list';
import {
  classifyTicketClientIntent,
  ticketIntentBlocksAppend,
  ticketIntentNeedsAssist,
} from '@/utils/ticket-client-intent';
import {
  buildAiTicketChoiceMenu,
  clientWantsTicketInteraction,
  isTicketClientClosingMessage,
  isTicketRefOnlyMessage,
  isTicketUpdateContext,
  looksLikeTicketSupplement,
  parseAiTicketMenuChoice,
  parseTicketRefFromText,
  isTicketClientDecline,
} from '@/utils/ticket-ref';
import { parseTicketStatusRequest } from '@/types/inbox-ticket';
import { logger } from '@/utils/logger';
import {
  looksLikePurchaseInquiry,
  resolveClientFirstName,
  textLooksLikeGreetingOrNonName,
} from '@/utils/ai-kb-client.util';
import { resolveRegistryNameFromDestination } from '@/utils/ai-name-confirm.util';

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
    const ctxSvc = AiContextService.getInstance();
    const contactCtxForCollection = await ctxSvc.buildContactContext(ctx.clientId, ctx.dest);
    const contactCtx = prompt.useSystemContext ? contactCtxForCollection : undefined;
    AiContextService.getInstance().seedStateFromContact(state, contactCtxForCollection, prompt);

    const hasUninterpretableMedia =
      ctx.hasMedia && (!ctx.text.trim() || ['audio', 'image', 'document', 'video'].includes(ctx.mediaType ?? ''));

    if (hasUninterpretableMedia && settings.transferRules.onUninterpretableMedia) {
      await this.releaseToStandardTriage(state, 'Mídia não interpretável pela IA', inbox);
      return { handled: false, useStandardTriage: true };
    }

    const pendingCredits =
      settings.mode === 'radarchat'
        ? aiCreditsFromActualCost(estimateTypicalTurnCostUsd(settings.llmModel))
        : 0;
    const usage = await AiUsageMeterService.getInstance().getUsageSnapshot(
      ctx.clientId,
      String(ctx.conversation._id),
      settings,
      { pendingCalls: 1, pendingCredits },
    );
    if (!usage.allowed) {
      await this.releaseToStandardTriage(state, usage.reason ?? 'Limite de IA atingido', inbox);
      return { handled: false, useStandardTriage: true };
    }

    if (ctx.isNew && !ctx.text.trim()) {
      const greeting = await AiPromptBuilderService.getInstance().buildGreeting(
        ctx.clientId,
        contactCtxForCollection,
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

    if (isWaLocationInboundText(ctx.text)) {
      await this.ingestClientLocationText(ctx, state);
    }

    if (await this.tryHandleAiTicketMenuFlow(
        ctx,
        inbox,
        state,
      )
    ) {
      return { handled: true };
    }

    if (await this.tryHandleTicketClientIntent(ctx, inbox, state)) {
      return { handled: true };
    }

    const autoResolveSvc = AiAutoResolveService.getInstance();
    let threadContext = [state.collectedProblem, state.summary].filter(Boolean).join(' ');
    if (
      prompt.autoResolveEnabled &&
      state.nameConfirmed &&
      this.textLooksLikeProblemDescription(ctx.text) &&
      !looksLikePurchaseInquiry(ctx.text, threadContext) &&
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
    const ticketUpdateCtx = isTicketUpdateContext(
      state,
      ctx.text,
      lastAssistantBefore?.content,
    );

    const ticketIntent =
      state.targetTicketRef || isTicketUpdateContext(state, ctx.text, lastAssistantBefore?.content)
        ? classifyTicketClientIntent(ctx.text)
        : undefined;

    if (settings.transferRules.onHumanRequest && escSvc.clientRequestsHuman(ctx.text)) {
      state.targetTicketRef = undefined;
      state.pendingTicketChoices = undefined;
      await state.save();
      await this.escalate(ctx, inbox, state, 'Cliente solicitou atendente humano');
      return { handled: true };
    }

    if (
      ticketUpdateCtx &&
      !ticketIntentBlocksAppend(ticketIntent ?? 'other') &&
      !parseTicketStatusRequest(ctx.text) &&
      !isTicketClientDecline(ctx.text) &&
      looksLikeTicketSupplement(ctx.text) &&
      !isTicketRefOnlyMessage(ctx.text)
    ) {
      const saved = await this.tryTicketUpdateFromClient(
        ctx,
        state,
        emptyAiStructuredReply(),
        inbox,
        lastAssistantBefore?.content,
      );
      if (saved && state.targetTicketRef) {
        const first = state.collectedName?.trim().split(/\s+/)[0];
        await inbox.sendAiReply(
          ctx.clientId,
          ctx.conversation,
          ctx.dest.identifier,
          this.buildTicketSavedRecoveryReply(first, state.targetTicketRef),
        );
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
    }

    if (
      state.status === AiConversationStatus.AI_COMPLETED &&
      !ticketUpdateCtx &&
      escSvc.clientClosingConversation(ctx.text)
    ) {
      await this.completeAiConversation(ctx, inbox, state, 'farewell');
      return { handled: true };
    }

    if (!ticketUpdateCtx && escSvc.clientClosingConversation(ctx.text)) {
      await this.completeAiConversation(ctx, inbox, state, 'farewell');
      return { handled: true };
    }

    if (
      ticketUpdateCtx &&
      (escSvc.clientClosingConversation(ctx.text) ||
        isTicketClientDecline(ctx.text) ||
        isTicketClientClosingMessage(ctx.text))
    ) {
      if (await this.tryHandleTicketClientIntent(ctx, inbox, state)) {
        return { handled: true };
      }
      state.targetTicketRef = undefined;
      state.pendingTicketChoices = undefined;
      const first = state.collectedName?.trim().split(/\s+/)[0];
      await inbox.sendAiReply(
        ctx.clientId,
        ctx.conversation,
        ctx.dest.identifier,
        first
          ? `Entendido, ${first}! Se precisar de algo, é só chamar.`
          : 'Entendido! Se precisar de algo, é só chamar.',
      );
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

    const ticketSavedEarly =
      !ticketIntentBlocksAppend(ticketIntent ?? 'other') &&
      !parseTicketStatusRequest(ctx.text) &&
      !isTicketClientDecline(ctx.text) &&
      (await this.tryTicketUpdateFromClient(
        ctx,
        state,
        emptyAiStructuredReply(),
        inbox,
        lastAssistantBefore?.content,
      ));

    const ticketBrief = state.targetTicketRef
      ? await inbox.getTicketBriefForAssist(ctx.clientId, state.targetTicketRef)
      : undefined;

    const threadContextForKb = [state.collectedProblem, state.summary, ctx.text]
      .filter(Boolean)
      .join(' ');

    if (
      await this.tryCatalogDeliveryQuestionShortCircuit(ctx, inbox, state)
    ) {
      return { handled: true };
    }

    if (
      await this.tryCatalogAddressShortCircuit(ctx, inbox, state)
    ) {
      return { handled: true };
    }

    if (
      await this.tryCatalogFulfillmentShortCircuit(
        ctx,
        inbox,
        state,
        threadContextForKb,
        lastAssistantBefore?.content,
      )
    ) {
      return { handled: true };
    }

    const catalogProductQuery =
      looksLikeCatalogProductNameQuery(ctx.text ?? '') &&
      !detectDeliveryFulfillmentChoice(ctx.text ?? '') &&
      !detectPickupFulfillmentChoice(ctx.text ?? '') &&
      !isAwaitingCatalogFulfillmentChoice(lastAssistantBefore?.content);

    if (
      (looksLikePurchaseInquiry(ctx.text, threadContextForKb) || catalogProductQuery) &&
      !detectDeliveryFulfillmentChoice(ctx.text) &&
      !detectPickupFulfillmentChoice(ctx.text) &&
      (await this.tryCatalogPurchaseOfferShortCircuit(
        ctx,
        inbox,
        state,
        threadContextForKb,
        lastAssistantBefore?.content,
        catalogProductQuery,
      ))
    ) {
      return { handled: true };
    }

    if (isKbRequiredFactualInquiry(ctx.text, threadContextForKb)) {
      const grounded = await autoResolveSvc.tryResolve(ctx.clientId, ctx.text, {
        threadContext: threadContextForKb,
        groundedOnly: true,
      });
      if (grounded.hit && grounded.reply) {
        this.mergeCollected(state, {}, ctx.text);
        state.collectedProblem = ctx.text.trim();
        state.aiTurnCount += 1;
        state.confidence = 0.85;
        state.summary = `Resolvido via ${grounded.source}: ${grounded.sourceTitle ?? ''}`.trim();
        const autoReply = `${grounded.reply}\n\nIsso respondeu sua dúvida? Se precisar de um atendente, digite *atendente*.`;
        await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, autoReply);
        state.status = AiConversationStatus.AI_WAITING_CLIENT;
        await state.save();
        await this.syncConversationAi(
          inbox,
          ctx.clientId,
          ctx.conversation._id as mongoose.Types.ObjectId,
          'ai_waiting_client',
        );
        logger.info('IA respondeu via KB (sem LLM) — dúvida factual', {
          clientId: ctx.clientId,
          source: grounded.source,
        });
        return { handled: true };
      }

      const org = await Organization.findById(ctx.clientId).select('name').lean();
      const safeReply = buildPremiumAiUngroundedReply(org?.name);
      if (this.textLooksLikeProblemDescription(ctx.text)) {
        state.collectedProblem = ctx.text.trim();
      }
      state.aiTurnCount += 1;
      state.confidence = 0.2;
      state.summary = 'Dúvida factual sem artigo na base de conhecimento';
      await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, safeReply);
      state.status = AiConversationStatus.AI_WAITING_CLIENT;
      await state.save();
      await this.syncConversationAi(
        inbox,
        ctx.clientId,
        ctx.conversation._id as mongoose.Types.ObjectId,
        'ai_waiting_client',
      );
      logger.info('IA bloqueou LLM — dúvida factual sem KB', {
        clientId: ctx.clientId,
        conversationId: ctx.conversation._id,
        text: ctx.text.slice(0, 80),
      });
      return { handled: true };
    }

    const systemPrompt = await AiPromptBuilderService.getInstance().buildSystemPrompt(
      ctx.clientId,
      {
        contactContext: contactCtx,
        clientText: ctx.text,
        ticketContext: ticketBrief ?? undefined,
        ticketClientIntent: ticketIntent,
      },
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
      return this.recoverFromAiFailure(
        ctx,
        inbox,
        state,
        prompt,
        llmError ?? 'IA indisponível',
        ticketSavedEarly,
        lastAssistantBefore?.content,
      );
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
        ticketSavedEarly,
        lastAssistantBefore?.content,
      );
    }

    const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
    if (
      lastAssistant?.content.trim() === AI_GENERIC_FALLBACK_REPLY &&
      structured.reply.trim() === AI_GENERIC_FALLBACK_REPLY
    ) {
      return this.recoverFromAiFailure(
        ctx,
        inbox,
        state,
        prompt,
        'Resposta genérica repetida',
        ticketSavedEarly,
        lastAssistantBefore?.content,
      );
    }

    this.mergeCollected(state, structured, ctx.text);
    if (structured.shouldCreateTicket) {
      await inbox.createTicketFromAi(ctx.clientId, ctx.conversation, {
        subject:
          structured.ticketReason?.trim() ||
          structured.internalSummary?.trim() ||
          state.collectedProblem?.trim(),
        initialClientBody: ctx.text?.trim() || state.collectedProblem?.trim(),
      });
    }
    if (!parseTicketStatusRequest(ctx.text) && !isTicketClientDecline(ctx.text)) {
      const appendIntent = ticketIntent ?? classifyTicketClientIntent(ctx.text);
      if (!ticketIntentBlocksAppend(appendIntent)) {
        await this.tryTicketUpdateFromClient(
          ctx,
          state,
          structured.shouldAppendToTicket ? structured : emptyAiStructuredReply(),
          inbox,
          lastAssistantBefore?.content,
        );
      }
    }
    await ctxSvc.persistCollectedFields(ctx.dest, {
      name: state.nameConfirmed ? state.collectedName : undefined,
      email: state.collectedEmail,
      address: state.collectedAddress,
      phone: state.collectedPhone,
      organization: state.collectedCompany,
      deliveryNotes: state.collectedDeliveryNotes,
      preferredSchedule: state.collectedPreferredSchedule,
      taxDocument: state.collectedCpfCnpj,
    });
    state.confidence = structured.confidence;
    state.aiTurnCount += 1;
    if (structured.internalSummary) state.summary = structured.internalSummary;
    if (structured.departmentMenuKey) state.suggestedDepartmentMenuKey = structured.departmentMenuKey;

    const { CatalogSalesService } = await import('@/services/catalog/CatalogSalesService');
    const catalogSvc = CatalogSalesService.getInstance();
    threadContext = [state.collectedProblem, state.summary].filter(Boolean).join(' ');
    const catalogTurn = await catalogSvc.processAiCatalogTurn({
      clientId: ctx.clientId,
      conversation: {
        conversationId: String(ctx.conversation._id),
        channel: 'whatsapp',
        destinationId: String(ctx.dest._id),
        contactIdentifier: ctx.conversation.contactIdentifier,
        contactName: ctx.conversation.contactName,
      },
      clientText: ctx.text ?? '',
      structured,
      aiSummary: structured.internalSummary,
      threadContext,
    });

    const orgForGuard = await Organization.findById(ctx.clientId).select('name').lean();
    const factualGuard = guardPremiumAiFactualReply({
      reply: structured.reply,
      systemPrompt,
      companyName: orgForGuard?.name,
    });
    if (factualGuard.blocked) {
      structured.reply = factualGuard.reply;
      structured.confidence = Math.min(structured.confidence ?? 0.5, 0.35);
      structured.shouldEscalate = false;
      logger.warn('IA substituiu resposta factual inventada (sem KB)', {
        clientId: ctx.clientId,
        conversationId: ctx.conversation._id,
        reason: factualGuard.reason,
      });
    }

    structured.reply = catalogSvc.sanitizeAiReplyForCatalogQuote(structured.reply, catalogTurn);

    const activeCatalogOrder = await catalogSvc.findActiveOrderForConversation(
      ctx.clientId,
      String(ctx.conversation._id),
    );
    const catalogAddressPending = activeCatalogOrder?.status === 'aguardando_endereco';
    const catalogSalesFlowActive =
      Boolean(activeCatalogOrder) ||
      detectDeliveryFulfillmentChoice(ctx.text ?? '') ||
      (looksLikePurchaseInquiry(ctx.text ?? '', threadContext) &&
        aiReplyCollectsDeliveryAddress(structured.reply));

    if (catalogSalesFlowActive) {
      structured.shouldEscalate = false;
      structured.reply = sanitizeAiReplyStripTransferDuringCatalogFlow(structured.reply);
      if (catalogAddressPending) {
        structured.reply = sanitizeAiReplyStripPixBeforeAddress(structured.reply);
      }
    }

    let escalation = escSvc.check({
      clientText: ctx.text,
      hasUninterpretableMedia,
      structured,
      state,
      prompt,
      rules: settings.transferRules,
      catalogAddressPending,
      catalogSalesFlowActive,
    });

    if (!escalation.shouldEscalate) {
      if (escSvc.isWaitingForPromisedHandoff(ctx.text, lastAssistantBefore?.content)) {
        if (!catalogSalesFlowActive) {
          escalation = {
            shouldEscalate: true,
            reason: 'Cliente aguardando transferência prometida pela IA',
          };
        }
      } else if (escSvc.aiReplyPromisesTransfer(structured.reply)) {
        if (!catalogSalesFlowActive) {
          escalation = {
            shouldEscalate: true,
            reason: structured.escalationReason ?? 'IA confirmou encaminhamento para humano',
          };
        }
      } else if (structured.shouldEscalate) {
        if (escSvc.clientRequestsHuman(ctx.text) || state.aiTurnCount >= 2) {
          escalation = {
            shouldEscalate: true,
            reason: structured.escalationReason ?? 'IA indicou transferência',
          };
        }
      }
    }

    const skipLlmReplyBecauseCatalog =
      catalogTurn.serverQuoteSent === true ||
      catalogTurn.handled === true ||
      (catalogTurn.quoteFailed && Boolean(activeCatalogOrder));

    if (!skipLlmReplyBecauseCatalog && structured.reply.trim()) {
      await inbox.sendAiReply(
        ctx.clientId,
        ctx.conversation,
        ctx.dest.identifier,
        structured.reply,
      );
    }

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

  private async tryCatalogDeliveryQuestionShortCircuit(
    ctx: AiInboundContext,
    inbox: InboxService,
    state: IAiConversationState,
  ): Promise<boolean> {
    const text = ctx.text?.trim() ?? '';
    if (!detectDeliveryFeeOrAddressQuestion(text)) return false;

    const { CatalogSalesService } = await import('@/services/catalog/CatalogSalesService');
    const catalogSvc = CatalogSalesService.getInstance();
    const reply = await catalogSvc.buildCatalogDeliveryQuestionReply({
      clientId: ctx.clientId,
      conversationId: String(ctx.conversation._id),
      clientText: text,
      contactFirstName: resolveClientFirstName(state.collectedName),
    });
    if (!reply) return false;

    state.aiTurnCount += 1;
    state.shouldEscalate = false;
    await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, reply);
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

  private async tryCatalogAddressShortCircuit(
    ctx: AiInboundContext,
    inbox: InboxService,
    state: IAiConversationState,
  ): Promise<boolean> {
    const text = ctx.text?.trim() ?? '';
    const looksAddress =
      textIsCepOnly(text) ||
      textLooksLikeStreetNumber(text) ||
      textLooksLikeDeliveryAddressInput(text) ||
      parseStreetNumberReply(text) !== null;
    if (!looksAddress) return false;

    const { CatalogSalesService } = await import('@/services/catalog/CatalogSalesService');
    const catalogSvc = CatalogSalesService.getInstance();
    const cfg = await catalogSvc.loadCompanyConfig(ctx.clientId);
    if (!cfg.enabled) return false;

    const active = await catalogSvc.findActiveOrderForConversation(
      ctx.clientId,
      String(ctx.conversation._id),
    );
    if (!active || active.status !== 'aguardando_endereco') return false;

    const convRef = {
      conversationId: String(ctx.conversation._id),
      channel: 'whatsapp' as const,
      destinationId: String(ctx.dest._id),
      contactIdentifier: ctx.conversation.contactIdentifier,
      contactName: ctx.conversation.contactName,
    };

    const result = await catalogSvc.tryProcessCatalogAddressInput({
      clientId: ctx.clientId,
      conversation: convRef,
      clientText: text,
    });

    if (!result.handled) return false;

    state.aiTurnCount += 1;
    state.shouldEscalate = false;
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

  private async tryCatalogFulfillmentShortCircuit(
    ctx: AiInboundContext,
    inbox: InboxService,
    state: IAiConversationState,
    threadContext: string,
    lastAssistantReply?: string,
  ): Promise<boolean> {
    const text = ctx.text?.trim() ?? '';
    const isPickup = detectPickupFulfillmentChoice(text);
    const isDelivery = detectDeliveryFulfillmentChoice(text);
    if (!isPickup && !isDelivery) return false;

    const { CatalogSalesService } = await import('@/services/catalog/CatalogSalesService');
    const catalogSvc = CatalogSalesService.getInstance();
    const cfg = await catalogSvc.loadCompanyConfig(ctx.clientId);
    if (!cfg.enabled) return false;

    const result = await catalogSvc.processFulfillmentChoice({
      clientId: ctx.clientId,
      conversation: {
        conversationId: String(ctx.conversation._id),
        channel: 'whatsapp',
        destinationId: String(ctx.dest._id),
        contactIdentifier: ctx.conversation.contactIdentifier,
        contactName: ctx.conversation.contactName,
      },
      clientText: text,
      threadContext,
      lastAssistantReply,
      contactFirstName: resolveClientFirstName(state.collectedName),
    });
    if (!result.handled) return false;

    const reply =
      result.customerReply ??
      (isDelivery
        ? 'Perfeito! Para calcular o frete da *entrega*, envie o *CEP* (8 dígitos) do endereço.'
        : undefined);
    if (reply) {
      await inbox.sendAiReply(
        ctx.clientId,
        ctx.conversation,
        ctx.dest.identifier,
        reply,
      );
    }

    state.aiTurnCount += 1;
    state.shouldEscalate = false;
    state.confidence = 0.92;
    state.status = AiConversationStatus.AI_WAITING_CLIENT;
    await state.save();
    await this.syncConversationAi(
      inbox,
      ctx.clientId,
      ctx.conversation._id as mongoose.Types.ObjectId,
      'ai_waiting_client',
    );
    logger.info('Catálogo processou retirada/entrega sem LLM', {
      clientId: ctx.clientId,
      conversationId: ctx.conversation._id,
      delivery: isDelivery,
      pickup: isPickup,
    });
    return true;
  }

  private async tryCatalogPurchaseOfferShortCircuit(
    ctx: AiInboundContext,
    inbox: InboxService,
    state: IAiConversationState,
    threadContext: string,
    lastAssistantReply?: string,
    productNameQueryOnly = false,
  ): Promise<boolean> {
    const { CatalogSalesService } = await import('@/services/catalog/CatalogSalesService');
    const catalogSvc = CatalogSalesService.getInstance();
    const cfg = await catalogSvc.loadCompanyConfig(ctx.clientId);
    if (!cfg.enabled) return false;

    const active = await catalogSvc.findActiveOrderForConversation(
      ctx.clientId,
      String(ctx.conversation._id),
    );
    if (active) return false;

    if (active) return false;

    if (
      isCatalogPurchaseOfferMessage(lastAssistantReply) &&
      detectPurchaseConfirmation(ctx.text ?? '')
    ) {
      const confirm = await catalogSvc.processPurchaseOfferConfirmation({
        clientId: ctx.clientId,
        conversation: {
          conversationId: String(ctx.conversation._id),
          channel: 'whatsapp',
          destinationId: String(ctx.dest._id),
          contactIdentifier: ctx.conversation.contactIdentifier,
          contactName: ctx.conversation.contactName,
        },
        clientText: ctx.text ?? '',
        threadContext,
        lastAssistantReply,
        contactFirstName: resolveClientFirstName(state.collectedName),
      });
      if (confirm.handled && confirm.customerReply) {
        state.aiTurnCount += 1;
        state.shouldEscalate = false;
        await inbox.sendAiReply(
          ctx.clientId,
          ctx.conversation,
          ctx.dest.identifier,
          confirm.customerReply,
        );
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
    }

    if (isCatalogPurchaseOfferMessage(lastAssistantReply)) {
      const offeredProduct = extractProductNameFromCatalogOffer(lastAssistantReply);
      const clientNorm = (ctx.text ?? '').trim().toLowerCase();
      if (
        offeredProduct &&
        clientNorm === offeredProduct.toLowerCase()
      ) {
        const reminder = buildFulfillmentReminderReply(
          offeredProduct,
          resolveClientFirstName(state.collectedName),
        );
        state.aiTurnCount += 1;
        state.shouldEscalate = false;
        await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, reminder);
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
    }

    const offer = await catalogSvc.buildPurchaseOfferForInquiry({
      clientId: ctx.clientId,
      clientText: ctx.text ?? '',
      threadContext,
      contactFirstName: resolveClientFirstName(state.collectedName),
      lastAssistantReply,
    });

    if (!offer && productNameQueryOnly) {
      const notFound = await catalogSvc.buildProductNotFoundReply({
        clientId: ctx.clientId,
        clientText: ctx.text ?? '',
        contactFirstName: resolveClientFirstName(state.collectedName),
      });
      if (!notFound) return false;
      state.aiTurnCount += 1;
      state.shouldEscalate = false;
      await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, notFound);
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

    if (!offer) return false;

    const lastOfferProduct = extractProductNameFromCatalogOffer(lastAssistantReply);
    const newOfferProduct = extractProductNameFromCatalogOffer(offer);
    if (
      lastOfferProduct &&
      newOfferProduct &&
      lastOfferProduct.toLowerCase() === newOfferProduct.toLowerCase() &&
      isCatalogPurchaseOfferMessage(lastAssistantReply)
    ) {
      return false;
    }

    if (this.textLooksLikeProblemDescription(ctx.text)) {
      state.collectedProblem = ctx.text.trim();
    }
    state.aiTurnCount += 1;
    state.shouldEscalate = false;
    state.confidence = 0.9;
    await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, offer);
    state.status = AiConversationStatus.AI_WAITING_CLIENT;
    await state.save();
    await this.syncConversationAi(
      inbox,
      ctx.clientId,
      ctx.conversation._id as mongoose.Types.ObjectId,
      'ai_waiting_client',
    );
    logger.info('IA enviou oferta padronizada de catálogo (sem KB/PIX bruto)', {
      clientId: ctx.clientId,
      conversationId: ctx.conversation._id,
    });
    return true;
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
      looksLikePurchaseInquiry(ctx.text, threadContext) ||
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
    ticketSavedEarly = false,
    lastAssistantReply?: string,
  ): Promise<AiInboundResult> {
    logger.warn('IA em recuperação — sem menu de setores', {
      clientId: ctx.clientId,
      conversationId: ctx.conversation._id,
      reason,
      ticketSavedEarly,
    });

    if (prompt.autoResolveEnabled && (await this.tryAutoResolveAndReply(ctx, inbox, state))) {
      return { handled: true };
    }

    const threadContext = [state.collectedProblem, state.summary].filter(Boolean).join(' ');
    if (
      detectDeliveryFulfillmentChoice(ctx.text) ||
      detectPickupFulfillmentChoice(ctx.text)
    ) {
      const { CatalogSalesService } = await import('@/services/catalog/CatalogSalesService');
      const fulfillment = await CatalogSalesService.getInstance().processFulfillmentChoice({
        clientId: ctx.clientId,
        conversation: {
          conversationId: String(ctx.conversation._id),
          channel: 'whatsapp',
          destinationId: String(ctx.dest._id),
          contactIdentifier: ctx.conversation.contactIdentifier,
          contactName: ctx.conversation.contactName,
        },
        clientText: ctx.text,
        threadContext,
        lastAssistantReply,
        contactFirstName: resolveClientFirstName(state.collectedName),
      });
      if (fulfillment.handled) {
        const reply =
          fulfillment.customerReply ??
          (detectDeliveryFulfillmentChoice(ctx.text)
            ? 'Perfeito! Para calcular o frete da *entrega*, envie o *CEP* (8 dígitos) do endereço.'
            : undefined);
        if (reply) {
          await inbox.sendAiReply(
            ctx.clientId,
            ctx.conversation,
            ctx.dest.identifier,
            reply,
          );
        }
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
    }

    if (looksLikePurchaseInquiry(ctx.text, threadContext)) {
      const { CatalogSalesService } = await import('@/services/catalog/CatalogSalesService');
      const purchaseReply = await CatalogSalesService.getInstance().buildPurchaseRecoveryReply({
        clientId: ctx.clientId,
        conversationId: String(ctx.conversation._id),
        clientText: ctx.text,
        threadContext,
        contactFirstName: resolveClientFirstName(state.collectedName),
        lastAssistantReply,
      });
      if (purchaseReply) {
        await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, purchaseReply);
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
    }

    const { CatalogSalesService } = await import('@/services/catalog/CatalogSalesService');
    const catalogSvc = CatalogSalesService.getInstance();
    const addressAttempt = await catalogSvc.tryProcessCatalogAddressInput({
      clientId: ctx.clientId,
      conversation: {
        conversationId: String(ctx.conversation._id),
        channel: 'whatsapp',
        destinationId: String(ctx.dest._id),
        contactIdentifier: ctx.conversation.contactIdentifier,
        contactName: ctx.conversation.contactName,
      },
      clientText: ctx.text,
    });
    if (addressAttempt.handled) {
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

    const contextual = await catalogSvc.buildContextualRecoveryReply({
      clientId: ctx.clientId,
      conversationId: String(ctx.conversation._id),
      contactFirstName: resolveClientFirstName(state.collectedName),
    });
    if (contextual) {
      await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, contextual);
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

    const ticketSaved =
      ticketSavedEarly || (await this.tryTicketUpdateFromClient(ctx, state, emptyAiStructuredReply(), inbox));

    const first = resolveClientFirstName(state.collectedName);
    const reply = ticketSaved && state.targetTicketRef
      ? this.buildTicketSavedRecoveryReply(first, state.targetTicketRef)
      : first
        ? `${first}, tive dificuldade em confirmar essa etapa do pedido. Vou chamar um atendente para continuar sem perder seu histórico.`
        : 'Tive dificuldade em confirmar essa etapa do pedido. Vou chamar um atendente para continuar sem perder seu histórico.';

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
      collectedPhone?: string;
      collectedCompany?: string;
      collectedDeliveryNotes?: string;
      collectedPreferredSchedule?: string;
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
    if (structured.collectedPhone?.trim() && /\d{8,}/.test(text.replace(/\D/g, ''))) {
      state.collectedPhone = structured.collectedPhone.trim();
    }
    if (structured.collectedCompany?.trim() && text.length >= 2) {
      state.collectedCompany = structured.collectedCompany.trim();
    }
    if (structured.collectedDeliveryNotes?.trim() && text.length >= 3) {
      state.collectedDeliveryNotes = structured.collectedDeliveryNotes.trim();
    }
    if (structured.collectedPreferredSchedule?.trim() && text.length >= 3) {
      state.collectedPreferredSchedule = structured.collectedPreferredSchedule.trim();
    }
    if (structured.collectedOrderNumber?.trim() && /\d{4,}/.test(text)) {
      state.collectedOrderNumber = structured.collectedOrderNumber.trim();
    }
    if (structured.urgency) state.urgency = structured.urgency;
    if (structured.internalSummary) state.summary = structured.internalSummary;
  }

  private buildTicketSavedRecoveryReply(firstName: string | undefined, ticketRef: string): string {
    const prefix = firstName ? `${firstName}, ` : '';
    return (
      `${prefix}sua informação foi registrada no ticket *${ticketRef}*. ` +
      'Nossa equipe será avisada. Se quiser incluir mais algo, pode enviar aqui ou digite *atendente*.'
    );
  }

  private buildTicketSelectedPrompt(ticketRef: string): string {
    return `Chamado *${ticketRef}* selecionado. O que você gostaria de adicionar?`;
  }

  private async tryHandleTicketClientIntent(
    ctx: AiInboundContext,
    inbox: InboxService,
    state: IAiConversationState,
  ): Promise<boolean> {
    const ref = await this.resolveActiveTicketRef(ctx, state);
    if (!ref) return false;

    const intent = classifyTicketClientIntent(ctx.text);
    if (intent === 'select_ref' || !ticketIntentNeedsAssist(intent)) return false;

    state.targetTicketRef = ref;
    const result = await AiTicketAssistService.getInstance().handle({
      clientId: ctx.clientId,
      text: ctx.text,
      ticketRef: ref,
      inbox,
      contactName: state.collectedName,
    });

    if (!result.handled || !result.reply) return false;

    if (intent === 'decline' || intent === 'exit_close') {
      state.targetTicketRef = undefined;
      state.pendingTicketChoices = undefined;
    }

    await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, result.reply);
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

  private async resolveActiveTicketRef(
    ctx: AiInboundContext,
    state: IAiConversationState,
  ): Promise<string | undefined> {
    if (state.targetTicketRef) return state.targetTicketRef;
    const fromText = parseTicketRefFromText(ctx.text);
    if (fromText && isTicketRefOnlyMessage(ctx.text)) return fromText;
    const history = await this.loadRecentHistory(ctx.conversation._id as mongoose.Types.ObjectId);
    const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
    return lastAssistant ? (parseTicketRefFromText(lastAssistant.content) ?? undefined) : undefined;
  }

  private async tryHandleAiTicketMenuFlow(
    ctx: AiInboundContext,
    inbox: InboxService,
    state: IAiConversationState,
  ): Promise<boolean> {
    const tickets = await listClientFacingTickets(
      ctx.clientId,
      ctx.dest._id as mongoose.Types.ObjectId,
    );

    if (state.pendingTicketChoices?.length) {
      if (/^novo\b/i.test(ctx.text.trim())) {
        state.pendingTicketChoices = undefined;
        state.targetTicketRef = undefined;
        await state.save();
        return false;
      }
      const picked = parseAiTicketMenuChoice(ctx.text, state.pendingTicketChoices);
      if (picked) {
        state.targetTicketRef = picked;
        state.pendingTicketChoices = undefined;
        await state.save();
        if (
          looksLikeTicketSupplement(ctx.text) &&
          !isTicketRefOnlyMessage(ctx.text) &&
          (await this.tryTicketUpdateFromClient(ctx, state, emptyAiStructuredReply(), inbox))
        ) {
          const first = state.collectedName?.trim().split(/\s+/)[0];
          await inbox.sendAiReply(
            ctx.clientId,
            ctx.conversation,
            ctx.dest.identifier,
            this.buildTicketSavedRecoveryReply(first, picked),
          );
        } else {
          await inbox.sendAiReply(
            ctx.clientId,
            ctx.conversation,
            ctx.dest.identifier,
            this.buildTicketSelectedPrompt(picked),
          );
        }
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
      await inbox.sendAiReply(
        ctx.clientId,
        ctx.conversation,
        ctx.dest.identifier,
        `Por favor, responda com o número (1–${state.pendingTicketChoices.length}) ou o código *TK-…*.\nDigite *novo* para outro assunto.`,
      );
      state.status = AiConversationStatus.AI_WAITING_CLIENT;
      await state.save();
      return true;
    }

    const refFromText = parseTicketRefFromText(ctx.text);
    if (refFromText && isTicketRefOnlyMessage(ctx.text)) {
      state.targetTicketRef = refFromText;
      await state.save();
      await inbox.sendAiReply(
        ctx.clientId,
        ctx.conversation,
        ctx.dest.identifier,
        this.buildTicketSelectedPrompt(refFromText),
      );
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

    if (
      !state.targetTicketRef &&
      clientWantsTicketInteraction(ctx.text) &&
      !looksLikeTicketSupplement(ctx.text)
    ) {
      if (tickets.length === 0) {
        await inbox.sendAiReply(
          ctx.clientId,
          ctx.conversation,
          ctx.dest.identifier,
          'Não encontrei chamados anteriores na sua conta. Descreva sua solicitação ou digite *atendente*.',
        );
        state.status = AiConversationStatus.AI_WAITING_CLIENT;
        await state.save();
        return true;
      }
      if (tickets.length === 1) {
        state.targetTicketRef = tickets[0].ref;
        await state.save();
        await inbox.sendAiReply(
          ctx.clientId,
          ctx.conversation,
          ctx.dest.identifier,
          `Encontrei o chamado *${tickets[0].ref}*. O que você gostaria de adicionar?`,
        );
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
      state.pendingTicketChoices = tickets.map(t => t.ref);
      await state.save();
      await inbox.sendAiReply(
        ctx.clientId,
        ctx.conversation,
        ctx.dest.identifier,
        buildAiTicketChoiceMenu(tickets),
      );
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

    return false;
  }

  private async tryTicketUpdateFromClient(
    ctx: AiInboundContext,
    state: IAiConversationState,
    structured: AiStructuredReply,
    inbox: InboxService,
    lastAssistantText?: string,
  ): Promise<boolean> {
    const saved = await AiTicketUpdateService.getInstance().tryPersist(
      ctx.clientId,
      ctx.dest.identifier,
      state,
      structured,
      ctx.text,
      inbox,
      lastAssistantText,
    );
    await state.save();
    return saved;
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

    const registry =
      state.registryNameSnapshot ??
      contactCtx.name ??
      resolveRegistryNameFromDestination(ctx.dest);

    if (
      await ctxSvc.tryAutoConfirmKnownContact(state, {
        clientId: ctx.clientId,
        destinationId: ctx.dest._id as mongoose.Types.ObjectId,
        conversationId: ctx.conversation._id as mongoose.Types.ObjectId,
        registryName: registry,
      })
    ) {
      return false;
    }

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
      const first = resolveClientFirstName(parsed.name);
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

      const first = state.collectedName?.trim().split(/\s+/)[0];
      await inbox.sendAiReply(
        ctx.clientId,
        ctx.conversation,
        ctx.dest.identifier,
        first
          ? `Obrigado, ${first}! E-mail registrado. Como posso ajudar você hoje?`
          : 'E-mail registrado. Como posso ajudar você hoje?',
      );
      state.status = AiConversationStatus.AI_WAITING_CLIENT;
      await state.save();
      return true;
    }

    if (this.isImpatiencePing(ctx.text)) {
      const first = state.collectedName?.trim().split(/\s+/)[0];
      let body = first ? `${first}, estou aqui! ` : 'Estou aqui! ';
      if (state.collectedProblem?.trim()) {
        body += `Recebi: *${state.collectedProblem.trim().slice(0, 80)}*. `;
      }
      body += 'Para registrar e continuar, qual é o seu *e-mail*?';
      await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, body);
      state.status = AiConversationStatus.AI_WAITING_CLIENT;
      await state.save();
      return true;
    }

    if (this.textLooksLikeProblemDescription(ctx.text)) {
      state.collectedProblem = ctx.text.trim();
    }

    const problem = state.collectedProblem?.trim();
    const first = state.collectedName?.trim().split(/\s+/)[0];
    const emailAsk = ctxSvc.buildEmailCollectionPrompt(state.collectedName);
    const body =
      problem && this.textLooksLikeProblemDescription(ctx.text)
        ? first
          ? `Entendi, ${first}! Anotei: *${problem.slice(0, 100)}*. Para registrar seu atendimento, qual é o seu *e-mail*?`
          : `Anotei: *${problem.slice(0, 100)}*. Para registrar seu atendimento, qual é o seu *e-mail*?`
        : emailAsk;

    await inbox.sendAiReply(
      ctx.clientId,
      ctx.conversation,
      ctx.dest.identifier,
      body,
    );
    state.status = AiConversationStatus.AI_WAITING_CLIENT;
    await state.save();
    return true;
  }

  private textLooksLikeName(text: string): boolean {
    const t = text.trim();
    if (!t || t.includes('@') || /\d/.test(t)) return false;
    if (textLooksLikeGreetingOrNonName(t)) return false;
    const words = t.split(/\s+/).filter(Boolean);
    return words.length <= 3 && t.length <= 40;
  }

  private isImpatiencePing(text: string): boolean {
    const raw = text.trim();
    if (/^\?+$/.test(raw)) return true;
    const norm = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[!?.]+/g, '')
      .trim();
    if (!norm) return true;
    if (/^(oi|ola|alo|e ai|eae|hello|cadê|cade|demora|demorando)$/.test(norm)) return true;
    if (/^(esta ai|está ai|ta ai|tá ai|ola esta ai|ola ta ai)$/.test(norm)) return true;
    return norm.length <= 12 && /^(oi|alo|eai|opa)$/.test(norm);
  }

  private textLooksLikeProblemDescription(text: string): boolean {
    const t = text.trim();
    if (!t || t.includes('@')) return false;
    if (isWaLocationInboundText(t)) return false;
    if (this.textLooksLikeName(t)) return false;
    if (/^(oi|ola|olá|bom dia|boa tarde|boa noite|preciso de ajuda|sim|nao|não|s|ss|ok)$/i.test(t)) {
      return false;
    }
    if (/\b(plano|vip|sala de jogos|contrat|comprar|acesso|comercial|benef[ií]cio|zaad)\b/i.test(t)) {
      return true;
    }
    if (/\b(problema|erro|ajuda|n[aã]o conecta|n[aã]o funciona|instala)/i.test(t)) return true;
    const words = t.split(/\s+/).filter(Boolean);
    return words.length >= 3 && t.length >= 12;
  }

  private async ingestClientLocationText(
    ctx: AiInboundContext,
    state: IAiConversationState,
  ): Promise<void> {
    const coords = parseWaLocationFromInboundText(ctx.text);
    if (!coords) return;

    const reverse = await reverseGeocodeCoords(coords.lat, coords.lng);
    const addressLabel = buildAddressLabelFromLocation({
      reverseDisplayName: reverse?.displayName,
      lat: coords.lat,
      lng: coords.lng,
    });
    state.collectedAddress = addressLabel;
    if (state.collectedProblem?.trim() && isWaLocationInboundText(state.collectedProblem)) {
      state.collectedProblem = undefined;
    }
    await state.save();

    const { CatalogSalesService } = await import('@/services/catalog/CatalogSalesService');
    await CatalogSalesService.getInstance().maybeUpdateOrderFromAiTurn({
      clientId: ctx.clientId,
      conversationId: String(ctx.conversation._id),
      structured: { collectedAddress: addressLabel },
    });
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
    let department: IInboxDepartment | null = menuKey
      ? await InboxDepartment.findOne({ clientId: clientOid, menuKey, isActive: true })
      : null;
    if (!department && opts?.lastAiReply) {
      department = await this.findDepartmentFromAiText(
        clientOid,
        opts.lastAiReply,
        ctx.text,
      );
    }
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
    const promisedInReply =
      Boolean(opts?.lastAiReply) &&
      AiEscalationService.getInstance().aiReplyPromisesTransfer(opts!.lastAiReply!);
    await inbox.escalateFromAi(ctx.clientId, ctx.conversation, ctx.dest, department, {
      reason,
      internalNote: [collected, state.summary].filter(Boolean).join('\n'),
      clientMessage: promisedInReply ? '' : (opts?.clientMessage ?? defaultClientMsg),
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

  /**
   * Conversas em triagem IA cuja última resposta prometeu encaminhamento mas não saíram da fila.
   * Recupera após restart ou falha silenciosa no escalonamento.
   */
  async recoverStuckPromisedHandoffs(clientId: string, inbox: InboxService): Promise<void> {
    if (!(await this.isEnabled(clientId))) return;

    const escSvc = AiEscalationService.getInstance();
    const stuckBefore = new Date(Date.now() - 45_000);
    const convs = await InboxConversation.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      status: InboxConversationStatus.BOT_TRIAGE,
      lastOutboundAt: { $lte: stuckBefore },
    })
      .sort({ lastOutboundAt: 1 })
      .limit(15)
      .exec();

    for (const conv of convs) {
      const lastOut = await InboxMessage.findOne({
        conversationId: conv._id,
        direction: 'outbound',
      })
        .sort({ createdAt: -1 })
        .lean();
      if (!lastOut?.body || !escSvc.aiReplyPromisesTransfer(lastOut.body)) continue;

      const lastIn = await InboxMessage.findOne({
        conversationId: conv._id,
        direction: 'inbound',
      })
        .sort({ createdAt: -1 })
        .lean();
      if (lastIn && lastOut.createdAt && lastIn.createdAt > lastOut.createdAt) continue;

      logger.info('Recuperando triagem IA travada após promessa de encaminhamento', {
        clientId,
        conversationId: conv._id,
      });
      try {
        const state = await this.getOrCreateState(
          clientId,
          conv._id as mongoose.Types.ObjectId,
        );
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
          'Recuperação: IA prometeu encaminhamento sem completar fila',
          { lastAiReply: lastOut.body },
        );
      } catch (e) {
        logger.warn('Falha ao recuperar triagem IA travada', {
          clientId,
          conversationId: conv._id,
          error: (e as Error).message,
        });
      }
    }
  }

  private async findDepartmentFromAiText(
    clientOid: mongoose.Types.ObjectId,
    aiReply: string,
    clientText?: string,
  ): Promise<IInboxDepartment | null> {
    const corpus = `${aiReply}\n${clientText ?? ''}`;
    const setorMatch = aiReply.match(/setor\s+([A-Za-zÀ-ú0-9\s]{2,40})/i);
    if (setorMatch) {
      const namePart = setorMatch[1].replace(/[.!?,].*$/, '').trim();
      const escaped = namePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const byName = await InboxDepartment.findOne({
        clientId: clientOid,
        isActive: true,
        name: new RegExp(`^${escaped}$`, 'i'),
      });
      if (byName) return byName;
    }
    for (const kw of ['comercial', 'vendas', 'suporte', 'financeiro']) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(corpus)) {
        const byKw = await InboxDepartment.findOne({
          clientId: clientOid,
          isActive: true,
          name: new RegExp(kw, 'i'),
        }).sort({ sortOrder: 1 });
        if (byKw) return byKw;
      }
    }
    return null;
  }
}
