import { AiSettings, IAiSettings } from '@/models/AiSettings';
import { Organization } from '@/models/Organization';
import type { AiProvider, AiStructuredReply } from '@/types/ai-assistant';
import {
  AI_GENERIC_FALLBACK_REPLY,
  MIN_AI_MAX_TOKENS,
} from '@/types/ai-assistant';
import { geminiFallbackModelIds } from '@/constants/ai-model-catalog';
import { getAiPlanLimits } from '@/types/ai-assistant';
import { AiCredentialVaultService } from './AiCredentialVaultService';
import { estimateTypicalTurnCostUsd } from '@/constants/ai-model-catalog';
import { aiCreditsFromActualCost } from '@/types/ai-credits';
import { AiUsageMeterService } from './AiUsageMeterService';
import { aiUsageKindFromProviderLabel } from '@/types/ai-usage-kind';
import { recordAiCreditAttendanceEvent } from '@/types/ai-wallet';

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionResult {
  structured: AiStructuredReply;
  inputTokens: number;
  outputTokens: number;
  provider: string;
  model: string;
}

export class AiProviderService {
  private static instance: AiProviderService;

  static getInstance(): AiProviderService {
    if (!this.instance) this.instance = new AiProviderService();
    return this.instance;
  }

  private vault = AiCredentialVaultService.getInstance();

  async resolveApiKey(clientId: string, settings: IAiSettings): Promise<string> {
    if (settings.mode === 'disabled' || !settings.enabled) {
      throw new Error('IA desativada');
    }
    if (settings.mode === 'radarzap') {
      const org = await Organization.findById(clientId).select('plan').lean();
      const plan = getAiPlanLimits(org?.plan ?? 'free');
      if (!plan.radarzapAllowed) {
        throw new Error('IA RadarZap não disponível no plano atual');
      }
      const key = process.env.RADARZAP_AI_OPENAI_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
      if (!key) throw new Error('Chave interna RadarZap não configurada no servidor');
      return key;
    }
    const doc = await AiSettings.findOne({ clientId }).select('+encryptedApiKey');
    const key = this.vault.decryptApiKey(doc?.encryptedApiKey);
    if (!key) throw new Error('API Key da empresa não configurada');
    return key;
  }

  async testConnection(
    clientId: string,
    settings: IAiSettings,
    overrideKey?: string,
  ): Promise<{ ok: boolean; message: string; model: string }> {
    try {
      const apiKey = overrideKey?.trim() || (await this.resolveApiKey(clientId, settings));
      const result = await this.callProvider(settings.provider, settings.llmModel, apiKey, [
        { role: 'system', content: 'Responda apenas: OK' },
        { role: 'user', content: 'ping' },
      ], 0.1, 16);
      return { ok: true, message: result.text.slice(0, 120) || 'Conexão OK', model: settings.llmModel };
    } catch (e) {
      return { ok: false, message: (e as Error).message, model: settings.llmModel };
    }
  }

  async complete(
    clientId: string,
    settings: IAiSettings,
    messages: AiChatMessage[],
    conversationId?: string,
  ): Promise<AiCompletionResult> {
    const pendingCredits =
      settings.mode === 'radarzap'
        ? aiCreditsFromActualCost(estimateTypicalTurnCostUsd(settings.llmModel))
        : 0;
    const usage = await AiUsageMeterService.getInstance().getUsageSnapshot(
      clientId,
      conversationId,
      settings,
      { pendingCalls: 1, pendingCredits },
    );
    if (!usage.allowed) {
      void recordAiCreditAttendanceEvent({
        clientId,
        kind: 'ai.credits.blocked',
        conversationId,
        meta: { reason: usage.reason, stage: 'pre_provider' },
      });
      void import('@/services/inbox/panel-critical-alerts.service').then(({ PanelCriticalAlertsService }) => {
        PanelCriticalAlertsService.getInstance().notifyAiQuotaExceeded(
          clientId,
          usage.reason ?? 'Limite de IA atingido',
        );
      });
      throw new Error(usage.reason ?? 'Limite de IA atingido');
    }

    const apiKey = await this.resolveApiKey(clientId, settings);
    const maxTokens = Math.max(settings.maxTokens, MIN_AI_MAX_TOKENS);
    return this.completeWithKey(
      clientId,
      settings,
      messages,
      apiKey,
      conversationId,
      settings.mode === 'radarzap' ? 'radarzap' : settings.provider,
      settings.temperature,
      maxTokens,
    );
  }

  /**
   * Chamada LLM para IA Básica (fallback classificação) — usa chave RadarZap e limites do plano.
   */
  async completeForBasicTriage(
    clientId: string,
    settings: IAiSettings,
    messages: AiChatMessage[],
    conversationId?: string,
  ): Promise<AiCompletionResult> {
    const pendingCredits = aiCreditsFromActualCost(
      estimateTypicalTurnCostUsd(settings.llmModel) * 0.35,
    );
    const usage = await AiUsageMeterService.getInstance().getUsageSnapshot(
      clientId,
      conversationId,
      settings,
      { pendingCalls: 1, pendingCredits, meteringOverride: 'radarzap_calls' },
    );
    if (!usage.allowed) {
      void recordAiCreditAttendanceEvent({
        clientId,
        kind: 'ai.credits.blocked',
        conversationId,
        meta: { reason: usage.reason, stage: 'pre_provider' },
      });
      void import('@/services/inbox/panel-critical-alerts.service').then(({ PanelCriticalAlertsService }) => {
        PanelCriticalAlertsService.getInstance().notifyAiQuotaExceeded(
          clientId,
          usage.reason ?? 'Limite de IA atingido',
        );
      });
      throw new Error(usage.reason ?? 'Limite de IA atingido');
    }

    const apiKey = await this.resolveRadarzapPlatformKey(clientId);
    return this.completeWithKey(
      clientId,
      settings,
      messages,
      apiKey,
      conversationId,
      'radarzap-basic-triage',
      0.2,
      Math.min(Math.max(settings.maxTokens, MIN_AI_MAX_TOKENS), 256),
    );
  }

  private async resolveRadarzapPlatformKey(clientId: string): Promise<string> {
    const org = await Organization.findById(clientId).select('plan').lean();
    const plan = getAiPlanLimits(org?.plan ?? 'free');
    if (!plan.radarzapAllowed) {
      throw new Error('IA RadarZap não disponível no plano atual');
    }
    const key = process.env.RADARZAP_AI_OPENAI_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new Error('Chave interna RadarZap não configurada no servidor');
    return key;
  }

  private async completeWithKey(
    clientId: string,
    settings: IAiSettings,
    messages: AiChatMessage[],
    apiKey: string,
    conversationId: string | undefined,
    providerLabel: string,
    temperature: number,
    maxTokens: number,
  ): Promise<AiCompletionResult> {
    const raw = await this.callProvider(
      settings.provider,
      settings.llmModel,
      apiKey,
      messages,
      temperature,
      maxTokens,
    );

    const structured = this.parseStructuredReply(raw.text);

    await AiUsageMeterService.getInstance().recordUsage({
      clientId,
      conversationId,
      provider: providerLabel,
      llmModel: settings.llmModel,
      inputTokens: raw.inputTokens,
      outputTokens: raw.outputTokens,
      usageKind: aiUsageKindFromProviderLabel(providerLabel),
    });

    return {
      structured,
      inputTokens: raw.inputTokens,
      outputTokens: raw.outputTokens,
      provider: providerLabel,
      model: settings.llmModel,
    };
  }

  private async callProvider(
    provider: AiProvider,
    model: string,
    apiKey: string,
    messages: AiChatMessage[],
    temperature: number,
    maxTokens: number,
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    if (provider === 'gemini') return this.callGemini(model, apiKey, messages, temperature, maxTokens);
    return this.callOpenAi(model, apiKey, messages, temperature, maxTokens);
  }

  private async callOpenAi(
    model: string,
    apiKey: string,
    messages: AiChatMessage[],
    temperature: number,
    maxTokens: number,
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
    });
    const data = (await res.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    if (!res.ok) throw new Error(data.error?.message ?? `OpenAI HTTP ${res.status}`);
    const text = data.choices?.[0]?.message?.content ?? '';
    return {
      text,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  }

  private geminiModelCandidates(primary: string): string[] {
    return geminiFallbackModelIds(primary);
  }

  private isRetryableGeminiError(message: string): boolean {
    return /high demand|quota exceeded|rate.?limit|429|resource.?exhausted|overloaded|try again|unavailable|please retry/i.test(
      message,
    );
  }

  private async callGemini(
    model: string,
    apiKey: string,
    messages: AiChatMessage[],
    temperature: number,
    maxTokens: number,
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const models = this.geminiModelCandidates(model);
    let lastError: Error | null = null;

    for (let i = 0; i < models.length; i += 1) {
      const candidate = models[i];
      try {
        return await this.callGeminiOnce(candidate, apiKey, messages, temperature, maxTokens);
      } catch (e) {
        const err = e as Error;
        lastError = err;
        const retryable = this.isRetryableGeminiError(err.message);
        if (!retryable || i === models.length - 1) throw err;
      }
    }

    throw lastError ?? new Error('Gemini indisponível');
  }

  private async callGeminiOnce(
    model: string,
    apiKey: string,
    messages: AiChatMessage[],
    temperature: number,
    maxTokens: number,
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
    const system = messages.find(m => m.role === 'system')?.content ?? '';
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
        },
      }),
    });
    const data = (await res.json()) as {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    if (!res.ok) throw new Error(data.error?.message ?? `Gemini HTTP ${res.status}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return {
      text,
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  isUnusableClientReply(structured: AiStructuredReply): boolean {
    const reply = structured.reply?.trim() ?? '';
    if (!reply) return true;
    if (reply === AI_GENERIC_FALLBACK_REPLY) return true;
    if (reply.startsWith('{') && reply.includes('"reply"')) return true;
    if (reply.length < 15) return true;
    if (/^here(\s+is)?(\s+the)?/i.test(reply)) return true;
    if (/json\s+requested/i.test(reply)) return true;
    return false;
  }

  parseStructuredReply(raw: string): AiStructuredReply {
    const trimmed = raw.trim();
    const payload = this.extractJsonPayload(trimmed);
    const looksLikeJson = trimmed.startsWith('{') || payload.startsWith('{');

    if (!looksLikeJson && trimmed.length > 0) {
      return {
        reply: trimmed,
        confidence: 0.6,
        shouldEscalate: false,
        parseFailed: false,
      };
    }

    try {
      const parsed = JSON.parse(payload) as Partial<AiStructuredReply>;
      const reply = this.normalizeClientReply(String(parsed.reply ?? ''));
      if (!reply.trim()) {
        return {
          reply: AI_GENERIC_FALLBACK_REPLY,
          confidence: 0.5,
          shouldEscalate: false,
          parseFailed: true,
        };
      }
      return {
        reply,
        collectedName: parsed.collectedName || undefined,
        collectedEmail: parsed.collectedEmail || undefined,
        collectedProblem: parsed.collectedProblem || undefined,
        collectedCpfCnpj: parsed.collectedCpfCnpj || undefined,
        collectedAddress: parsed.collectedAddress || undefined,
        collectedOrderNumber: parsed.collectedOrderNumber || undefined,
        urgency: parsed.urgency,
        intent: parsed.intent,
        departmentMenuKey: parsed.departmentMenuKey,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        shouldEscalate: Boolean(parsed.shouldEscalate),
        escalationReason: parsed.escalationReason,
        internalSummary: parsed.internalSummary,
        shouldCreateTicket: parsed.shouldCreateTicket === true,
        ticketReason: parsed.ticketReason || undefined,
        targetTicketRef: parsed.targetTicketRef || undefined,
        shouldAppendToTicket: parsed.shouldAppendToTicket === true,
        ticketAppendBody: parsed.ticketAppendBody || undefined,
        parseFailed: false,
      };
    } catch {
      const reply = this.extractReplyField(raw) ?? this.extractReplyField(payload);
      if (reply?.trim()) {
        return {
          reply: reply.trim(),
          confidence: 0.5,
          shouldEscalate: false,
          parseFailed: false,
        };
      }
      return {
        reply: AI_GENERIC_FALLBACK_REPLY,
        confidence: 0.5,
        shouldEscalate: false,
        parseFailed: true,
      };
    }
  }

  /** Remove cercas markdown e isola o objeto JSON da resposta do modelo. */
  private extractJsonPayload(raw: string): string {
    let text = raw.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) text = fenced[1].trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return text.slice(start, end + 1);
    return text;
  }

  private extractReplyField(raw: string): string | undefined {
    const match = raw.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/s);
    if (!match) return undefined;
    try {
      return JSON.parse(`"${match[1]}"`) as string;
    } catch {
      return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
  }

  /** Nunca enviar JSON bruto ao cliente no WhatsApp. */
  private normalizeClientReply(reply: string): string {
    const trimmed = reply.trim();
    if (!trimmed.startsWith('{') || !trimmed.includes('"reply"')) return trimmed;
    return this.extractReplyField(trimmed) ?? AI_GENERIC_FALLBACK_REPLY;
  }
}
