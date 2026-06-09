import { AiSettings, IAiSettings } from '@/models/AiSettings';
import { Organization } from '@/models/Organization';
import type { AiProvider, AiStructuredReply } from '@/types/ai-assistant';
import { getAiPlanLimits } from '@/types/ai-assistant';
import { AiCredentialVaultService } from './AiCredentialVaultService';
import { AiUsageMeterService } from './AiUsageMeterService';

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
    const usage = await AiUsageMeterService.getInstance().getUsageSnapshot(
      clientId,
      conversationId,
      settings,
    );
    if (!usage.allowed) throw new Error(usage.reason ?? 'Limite de IA atingido');

    const apiKey = await this.resolveApiKey(clientId, settings);
    const raw = await this.callProvider(
      settings.provider,
      settings.llmModel,
      apiKey,
      messages,
      settings.temperature,
      settings.maxTokens,
    );

    const structured = this.parseStructuredReply(raw.text);
    const providerLabel = settings.mode === 'radarzap' ? 'radarzap' : settings.provider;

    await AiUsageMeterService.getInstance().recordUsage({
      clientId,
      conversationId,
      provider: providerLabel,
      llmModel: settings.llmModel,
      inputTokens: raw.inputTokens,
      outputTokens: raw.outputTokens,
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

  private async callGemini(
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

  parseStructuredReply(raw: string): AiStructuredReply {
    try {
      const parsed = JSON.parse(raw) as Partial<AiStructuredReply>;
      return {
        reply: String(parsed.reply ?? 'Desculpe, não consegui processar. Um atendente irá ajudá-lo em breve.'),
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
      };
    } catch {
      return {
        reply: raw.trim() || 'Como posso ajudá-lo hoje?',
        confidence: 0.4,
        shouldEscalate: false,
      };
    }
  }
}
