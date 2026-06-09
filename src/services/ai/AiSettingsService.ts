import mongoose from 'mongoose';
import { AiSettings, IAiSettings, defaultModelForProvider } from '@/models/AiSettings';
import { AiPrompt, IAiPrompt } from '@/models/AiPrompt';
import { Organization } from '@/models/Organization';
import type { AiMode, AiProvider } from '@/types/ai-assistant';
import { getAiPlanLimits } from '@/types/ai-assistant';
import { AiCredentialVaultService } from './AiCredentialVaultService';
import { AiKnowledgeBaseService } from './AiKnowledgeBaseService';
import { AiUsageMeterService } from './AiUsageMeterService';

export interface AiSettingsPayload {
  settings: Record<string, unknown>;
  prompt: Record<string, unknown>;
  knowledgeBase: unknown[];
  usage: unknown;
  apiKeyMasked: string | null;
  hasApiKey: boolean;
  planLimits: ReturnType<typeof getAiPlanLimits>;
}

export class AiSettingsService {
  private static instance: AiSettingsService;

  static getInstance(): AiSettingsService {
    if (!this.instance) this.instance = new AiSettingsService();
    return this.instance;
  }

  private vault = AiCredentialVaultService.getInstance();

  async getSettingsDoc(clientId: string): Promise<IAiSettings> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    let doc = await AiSettings.findOne({ clientId: clientOid });
    if (!doc) doc = await AiSettings.create({ clientId: clientOid });
    return doc;
  }

  async getFullPayload(clientId: string): Promise<AiSettingsPayload> {
    const [settings, prompt, knowledgeBase, usage, org] = await Promise.all([
      this.getSettingsDoc(clientId),
      AiPrompt.findOne({ clientId: new mongoose.Types.ObjectId(clientId) }),
      AiKnowledgeBaseService.getInstance().list(clientId),
      AiUsageMeterService.getInstance().getUsageSnapshot(clientId),
      Organization.findById(clientId).select('plan').lean(),
    ]);

    const withKey = await AiSettings.findOne({ clientId: settings.clientId }).select('+encryptedApiKey');
    const plainKey = this.vault.decryptApiKey(withKey?.encryptedApiKey);

    const promptDoc =
      prompt ??
      (await AiPrompt.create({ clientId: new mongoose.Types.ObjectId(clientId) }));

    return {
      settings: {
        enabled: settings.enabled,
        mode: settings.mode,
        provider: settings.provider,
        model: settings.llmModel,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        dailyLimit: settings.dailyLimit,
        monthlyLimit: settings.monthlyLimit,
        perConversationLimit: settings.perConversationLimit,
        transferRules: settings.transferRules,
      },
      prompt: {
        systemPrompt: promptDoc.systemPrompt,
        collectName: promptDoc.collectName,
        collectEmail: promptDoc.collectEmail,
        collectProblem: promptDoc.collectProblem,
        collectCpfCnpj: promptDoc.collectCpfCnpj,
        collectAddress: promptDoc.collectAddress,
        collectOrderNumber: promptDoc.collectOrderNumber,
        collectUrgency: promptDoc.collectUrgency,
        collectAttachments: promptDoc.collectAttachments,
      },
      knowledgeBase: knowledgeBase.map(k => ({
        id: String(k._id),
        title: k.title,
        content: k.content,
        active: k.active,
        updatedAt: k.updatedAt,
      })),
      usage,
      apiKeyMasked: this.vault.maskApiKey(plainKey),
      hasApiKey: this.vault.hasKey(withKey?.encryptedApiKey),
      planLimits: getAiPlanLimits(org?.plan ?? 'free'),
    };
  }

  async upsertSettings(
    clientId: string,
    body: Record<string, unknown>,
  ): Promise<AiSettingsPayload> {
    const settings = await this.getSettingsDoc(clientId);
    const s = (body.settings ?? body) as Record<string, unknown>;
    const p = body.prompt as Record<string, unknown> | undefined;
    const kb = body.knowledgeBase as Array<{
      id?: string;
      title: string;
      content: string;
      active?: boolean;
      _delete?: boolean;
    }> | undefined;

    if (s.mode === 'disabled') {
      settings.mode = 'disabled';
      settings.enabled = false;
    } else if (s.mode === 'radarzap' || s.mode === 'company') {
      settings.mode = s.mode as AiMode;
      settings.enabled = typeof s.enabled === 'boolean' ? s.enabled : true;
    } else if (typeof s.enabled === 'boolean') {
      settings.enabled = s.enabled;
    }
    if (s.provider === 'openai' || s.provider === 'gemini') {
      settings.provider = s.provider as AiProvider;
      if (!s.model) settings.llmModel = defaultModelForProvider(settings.provider);
    }
    if (typeof s.model === 'string' && s.model.trim()) settings.llmModel = s.model.trim();
    if (typeof s.temperature === 'number') settings.temperature = s.temperature;
    if (typeof s.maxTokens === 'number') settings.maxTokens = s.maxTokens;
    if (typeof s.dailyLimit === 'number') settings.dailyLimit = s.dailyLimit;
    if (typeof s.monthlyLimit === 'number') settings.monthlyLimit = s.monthlyLimit;
    if (typeof s.perConversationLimit === 'number') settings.perConversationLimit = s.perConversationLimit;
    if (s.transferRules && typeof s.transferRules === 'object') {
      settings.transferRules = { ...settings.transferRules, ...(s.transferRules as object) };
    }
    if (typeof s.apiKey === 'string' && s.apiKey.trim()) {
      settings.encryptedApiKey = this.vault.encryptApiKey(s.apiKey);
    }
    await settings.save();

    if (p) {
      const prompt = await AiPrompt.findOneAndUpdate(
        { clientId: new mongoose.Types.ObjectId(clientId) },
        {
          $set: {
            ...(typeof p.systemPrompt === 'string' ? { systemPrompt: p.systemPrompt } : {}),
            ...(typeof p.collectName === 'boolean' ? { collectName: p.collectName } : {}),
            ...(typeof p.collectEmail === 'boolean' ? { collectEmail: p.collectEmail } : {}),
            ...(typeof p.collectProblem === 'boolean' ? { collectProblem: p.collectProblem } : {}),
            ...(typeof p.collectCpfCnpj === 'boolean' ? { collectCpfCnpj: p.collectCpfCnpj } : {}),
            ...(typeof p.collectAddress === 'boolean' ? { collectAddress: p.collectAddress } : {}),
            ...(typeof p.collectOrderNumber === 'boolean' ? { collectOrderNumber: p.collectOrderNumber } : {}),
            ...(typeof p.collectUrgency === 'boolean' ? { collectUrgency: p.collectUrgency } : {}),
            ...(typeof p.collectAttachments === 'boolean' ? { collectAttachments: p.collectAttachments } : {}),
          },
        },
        { upsert: true, new: true },
      );
      if (!prompt) await AiPrompt.create({ clientId: new mongoose.Types.ObjectId(clientId), ...p });
    }

    if (Array.isArray(kb)) {
      const kbSvc = AiKnowledgeBaseService.getInstance();
      for (const item of kb) {
        if (item._delete && item.id) {
          await kbSvc.remove(clientId, item.id);
        } else if (item.title && item.content) {
          await kbSvc.upsert(clientId, item);
        }
      }
    }

    return this.getFullPayload(clientId);
  }

  async removeApiKey(clientId: string): Promise<AiSettingsPayload> {
    await AiSettings.updateOne(
      { clientId: new mongoose.Types.ObjectId(clientId) },
      { $unset: { encryptedApiKey: 1 } },
    );
    return this.getFullPayload(clientId);
  }

  async isAiActive(clientId: string): Promise<boolean> {
    const settings = await this.getSettingsDoc(clientId);
    return settings.enabled && settings.mode !== 'disabled';
  }
}
