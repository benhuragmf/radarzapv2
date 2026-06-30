import { AiPromptBuilderService } from './AiPromptBuilderService';
import { AiAutoResolveService } from './AiAutoResolveService';
import { AiSettingsService } from './AiSettingsService';
import { AiContextService } from './AiContextService';
import { AiProviderService, type AiChatMessage } from './AiProviderService';
import { AiUsageMeterService } from './AiUsageMeterService';
import { estimateTypicalTurnCostUsd } from '@/constants/ai-model-catalog';
import { aiCreditsFromActualCost } from '@/types/ai-credits';
import type { AiInboundContext, AiInboundResult } from './AiConversationService';
import type { InboxService } from '@/services/inbox/InboxService';
import { InboxConversationStatus } from '@/types/inbox';
import { resolveAttendanceMode } from '@/types/attendance-mode';
import {
  buildBasicTriageClarifyReply,
  buildBasicTriageTicketStatusReply,
  classifyLocal,
  shouldRouteByClassification,
  type BasicTriageClassification,
  type BasicTriageDepartmentHint,
} from '@/utils/basic-triage-classifier';
import {
  mapBasicIntentToProduct,
  recordBasicTriageClassificationEvent,
  resolveBasicTriageAction,
  TRIAGE_CONFIDENCE_HIGH,
} from '@/types/basic-triage.util';
import {
  loadClientVisibleDepartments,
  parseInboxMenuChoice,
} from '@/constants/inbox-triage';
import { createServiceLogger } from '@/utils/logger';
import type { IAiSettings } from '@/models/AiSettings';

const BASIC_MEDIA_PROMPT =
  'Recebi seu anexo. Descreva em texto como posso ajudar — assim direciono ao setor certo. Se preferir, digite *atendente*.';

const serviceLogger = createServiceLogger('AiBasicTriageService');

const BASIC_LLM_SYSTEM = `Você é um classificador de triagem de atendimento. Responda APENAS em JSON válido:
{"intent":"commercial|finance|support|general|human_request","confidence":0.0-1.0,"reply":"mensagem curta ao cliente em português"}
- intent: setor mais provável
- confidence: certeza da classificação (0 a 1)
- reply: 1-2 frases úteis; se ambíguo, peça esclarecimento`;

/**
 * IA Básica — triagem local-first (KB/skills → classificador → setor).
 * LLM só quando `basicTriageLlmFallbackEnabled` e confiança abaixo do threshold.
 */
export class AiBasicTriageService {
  private static instance: AiBasicTriageService;

  static getInstance(): AiBasicTriageService {
    if (!this.instance) this.instance = new AiBasicTriageService();
    return this.instance;
  }

  async isActive(clientId: string): Promise<boolean> {
    const settings = await AiSettingsService.getInstance().getSettingsDoc(clientId);
    const mode = resolveAttendanceMode(settings);
    return mode === 'basic_triage' || mode === 'hybrid';
  }

  async handleInbound(ctx: AiInboundContext, inbox: InboxService): Promise<AiInboundResult> {
    const inactive: AiInboundResult = { handled: false };

    if (!(await this.isActive(ctx.clientId))) return inactive;

    if (ctx.conversation.status !== InboxConversationStatus.BOT_TRIAGE) {
      return inactive;
    }

    const settings = await AiSettingsService.getInstance().getSettingsDoc(ctx.clientId);
    const prompt = await AiPromptBuilderService.getInstance().getOrCreatePrompt(ctx.clientId);
    const routeThreshold = Math.max(
      settings.transferRules?.lowConfidenceThreshold ?? TRIAGE_CONFIDENCE_HIGH,
      TRIAGE_CONFIDENCE_HIGH,
    );

    const departments = await this.loadDepartmentHints(ctx.clientId);

    if (ctx.isNew && !ctx.text.trim()) {
      const contactCtx = prompt.useSystemContext
        ? await AiContextService.getInstance().buildContactContext(ctx.clientId, ctx.dest)
        : undefined;
      const greeting = await AiPromptBuilderService.getInstance().buildGreeting(
        ctx.clientId,
        contactCtx,
      );
      await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, greeting);
      return { handled: true };
    }

    if (!ctx.text.trim()) {
      if (ctx.hasMedia) {
        await inbox.sendAiReply(
          ctx.clientId,
          ctx.conversation,
          ctx.dest.identifier,
          BASIC_MEDIA_PROMPT,
        );
        return { handled: true };
      }
      return { handled: true };
    }

    const text = ctx.text.trim();

    const menuChoice = await parseInboxMenuChoice(ctx.clientId, text);
    if (menuChoice) {
      await inbox.routeFromTriageChoice(ctx.clientId, ctx.conversation, ctx.dest, menuChoice);
      return { handled: true };
    }

    if (
      prompt.autoResolveEnabled &&
      AiAutoResolveService.getInstance().shouldAttemptAutoResolve(text)
    ) {
      const auto = await AiAutoResolveService.getInstance().tryResolve(ctx.clientId, text);
      if (auto.hit && auto.reply) {
        const body =
          `${auto.reply}\n\nIsso resolveu sua dúvida? Se precisar de um atendente, digite *atendente* ou escolha um setor.`;
        await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, body);
        serviceLogger.info('IA Básica resolveu via KB/skill', {
          clientId: ctx.clientId,
          source: auto.source,
        });
        return { handled: true };
      }
    }

    let classification = classifyLocal(text, departments);

    if (
      prompt.basicTriageLlmFallbackEnabled &&
      !shouldRouteByClassification(classification, routeThreshold) &&
      classification.intent !== 'greeting'
    ) {
      const llmClass = await this.tryLlmClassification(ctx.clientId, settings, text, departments);
      if (llmClass) classification = llmClass;
    }

    if (classification.intent === 'greeting') {
      const reply =
        'Olá! Como posso ajudar? Descreva sua dúvida ou digite o número do setor desejado.';
      await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, reply);
      return { handled: true };
    }

    const action = resolveBasicTriageAction(classification, { routeThreshold });
    const productIntent = mapBasicIntentToProduct(classification.intent);

    if (action === 'route' && classification.suggestedMenuKey) {
      await inbox.routeFromTriageChoice(
        ctx.clientId,
        ctx.conversation,
        ctx.dest,
        classification.suggestedMenuKey,
      );
      await recordBasicTriageClassificationEvent({
        clientId: ctx.clientId,
        conversationId: String(ctx.conversation._id),
        productIntent,
        confidence: classification.confidence,
        action: 'route',
        menuKey: classification.suggestedMenuKey,
        channel: 'whatsapp',
      });
      serviceLogger.info('IA Básica encaminhou por classificação', {
        clientId: ctx.clientId,
        intent: classification.intent,
        menuKey: classification.suggestedMenuKey,
        confidence: classification.confidence,
      });
      return { handled: true };
    }

    if (action === 'queue' && classification.suggestedMenuKey) {
      const queueKey = classification.intent === 'human_request' ? '4' : classification.suggestedMenuKey;
      await inbox.routeFromTriageChoice(ctx.clientId, ctx.conversation, ctx.dest, queueKey);
      await recordBasicTriageClassificationEvent({
        clientId: ctx.clientId,
        conversationId: String(ctx.conversation._id),
        productIntent,
        confidence: classification.confidence,
        action: 'queue',
        menuKey: queueKey,
        channel: 'whatsapp',
      });
      return { handled: true };
    }

    if (classification.intent === 'ticket_status') {
      const reply = buildBasicTriageTicketStatusReply();
      await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, reply);
      await recordBasicTriageClassificationEvent({
        clientId: ctx.clientId,
        conversationId: String(ctx.conversation._id),
        productIntent,
        confidence: classification.confidence,
        action: 'clarify',
        channel: 'whatsapp',
      });
      return { handled: true };
    }

    if (classification.intent !== 'unknown') {
      if (resolveAttendanceMode(settings) === 'hybrid') {
        return inactive;
      }
      const clarify = buildBasicTriageClarifyReply(classification.intent);
      await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, clarify);
      await recordBasicTriageClassificationEvent({
        clientId: ctx.clientId,
        conversationId: String(ctx.conversation._id),
        productIntent,
        confidence: classification.confidence,
        action: 'clarify',
        channel: 'whatsapp',
      });
      return { handled: true };
    }

    if (resolveAttendanceMode(settings) === 'hybrid') {
      return inactive;
    }

    if (action === 'queue') {
      await inbox.routeFromTriageChoice(ctx.clientId, ctx.conversation, ctx.dest, '4');
      await recordBasicTriageClassificationEvent({
        clientId: ctx.clientId,
        conversationId: String(ctx.conversation._id),
        productIntent: 'unknown',
        confidence: classification.confidence,
        action: 'queue',
        menuKey: '4',
        channel: 'whatsapp',
      });
      return { handled: true };
    }

    const clarify = buildBasicTriageClarifyReply('unknown');
    await inbox.sendAiReply(ctx.clientId, ctx.conversation, ctx.dest.identifier, clarify);
    await recordBasicTriageClassificationEvent({
      clientId: ctx.clientId,
      conversationId: String(ctx.conversation._id),
      productIntent: 'unknown',
      confidence: classification.confidence,
      action: 'clarify',
      channel: 'whatsapp',
    });
    return { handled: true };
  }

  private async loadDepartmentHints(clientId: string): Promise<BasicTriageDepartmentHint[]> {
    const depts = await loadClientVisibleDepartments(clientId);
    return depts.map(d => ({
      name: d.name,
      menuKey: d.menuKey,
      description: d.description,
    }));
  }

  private async tryLlmClassification(
    clientId: string,
    settings: IAiSettings,
    text: string,
    departments: BasicTriageDepartmentHint[],
  ): Promise<BasicTriageClassification | null> {
    try {
      const pendingCredits = aiCreditsFromActualCost(
        estimateTypicalTurnCostUsd(settings.llmModel) * 0.35,
      );
      const usage = await AiUsageMeterService.getInstance().getUsageSnapshot(
        clientId,
        undefined,
        settings,
        { pendingCalls: 1, pendingCredits, meteringOverride: 'radarchat_calls' },
      );
      if (!usage.allowed) return null;

      const deptList = departments.map(d => `${d.menuKey}=${d.name}`).join(', ');
      const messages: AiChatMessage[] = [
        { role: 'system', content: `${BASIC_LLM_SYSTEM}\nSetores: ${deptList}` },
        { role: 'user', content: text },
      ];

      const provider = AiProviderService.getInstance();
      const result = await provider.completeForBasicTriage(clientId, settings, messages);
      const raw = result.structured.reply?.trim() ?? '';
      const parsed = this.parseLlmJson(raw);
      if (!parsed) return null;

      const menuKey = this.menuKeyForIntent(parsed.intent, departments);
      if (!menuKey) return null;

      return {
        intent: this.normalizeIntent(parsed.intent),
        confidence: Math.min(1, Math.max(0, parsed.confidence)),
        suggestedMenuKey: menuKey,
      };
    } catch (e) {
      serviceLogger.warn('Fallback LLM IA Básica falhou', {
        clientId,
        error: (e as Error).message,
      });
      return null;
    }
  }

  private parseLlmJson(raw: string): { intent: string; confidence: number; reply?: string } | null {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const obj = JSON.parse(match[0]) as { intent?: string; confidence?: number; reply?: string };
      if (!obj.intent || typeof obj.confidence !== 'number') return null;
      return { intent: obj.intent, confidence: obj.confidence, reply: obj.reply };
    } catch {
      return null;
    }
  }

  private normalizeIntent(intent: string): BasicTriageClassification['intent'] {
    const valid = [
      'commercial',
      'finance',
      'support',
      'general',
      'human_request',
      'ticket_status',
      'complaint',
      'partnership',
    ] as const;
    if ((valid as readonly string[]).includes(intent)) {
      return intent as BasicTriageClassification['intent'];
    }
    return 'general';
  }

  private menuKeyForIntent(intent: string, departments: BasicTriageDepartmentHint[]): string | undefined {
    const map: Record<string, string> = {
      commercial: '1',
      finance: '2',
      support: '3',
      general: '4',
      human_request: '4',
    };
    const key = map[intent];
    if (key && departments.some(d => d.menuKey === key)) return key;
    return departments[0]?.menuKey;
  }
}
