import mongoose from 'mongoose';
import { AiSettings, IAiSettings, defaultModelForProvider } from '@/models/AiSettings';
import { AiPrompt, IAiPrompt } from '@/models/AiPrompt';
import { Organization } from '@/models/Organization';
import type { AiMode, AiProvider } from '@/types/ai-assistant';
import {
  estimateTypicalTurnCostUsd,
  getModelCatalogEntry,
  listModelsForProvider,
} from '@/constants/ai-model-catalog';
import {
  DEFAULT_AI_MAX_TOKENS,
  getAiPlanLimits,
  MIN_AI_MAX_TOKENS,
} from '@/types/ai-assistant';
import { AiCredentialVaultService } from './AiCredentialVaultService';
import { AiKnowledgeBaseService } from './AiKnowledgeBaseService';
import { AiSkillService } from './AiSkillService';
import { AiMemoryService } from './AiMemoryService';
import { AiUsageMeterService } from './AiUsageMeterService';
import { PlatformAiBlueprintService } from './PlatformAiBlueprintService';

export interface AiModelCatalogPayload {
  id: string;
  label: string;
  description: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  tier: string;
  recommended?: boolean;
  deprecated?: boolean;
  typicalTurnCostUsd: number;
}

export interface AiSettingsPayload {
  settings: Record<string, unknown>;
  prompt: Record<string, unknown>;
  knowledgeBase: unknown[];
  skills: unknown[];
  memories: unknown[];
  usage: unknown;
  apiKeyMasked: string | null;
  hasApiKey: boolean;
  planLimits: ReturnType<typeof getAiPlanLimits>;
  modelCatalog: AiModelCatalogPayload[];
  modelCatalogs: { gemini: AiModelCatalogPayload[]; openai: AiModelCatalogPayload[] };
  selectedModelPricing: AiModelCatalogPayload | null;
  blueprintInfo: {
    managedBy: 'radarzap';
    version: number;
    agentName: string;
    updatedAt: Date;
  };
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
    if (doc.maxTokens < MIN_AI_MAX_TOKENS) {
      doc.maxTokens = DEFAULT_AI_MAX_TOKENS;
      await doc.save();
    }
    return doc;
  }

  async getFullPayload(clientId: string): Promise<AiSettingsPayload> {
    const [settings, prompt, knowledgeBase, skills, memories, usage, org, blueprint] =
      await Promise.all([
        this.getSettingsDoc(clientId),
        AiPrompt.findOne({ clientId: new mongoose.Types.ObjectId(clientId) }),
        AiKnowledgeBaseService.getInstance().list(clientId),
        AiSkillService.getInstance().list(clientId),
        AiMemoryService.getInstance().list(clientId),
        AiUsageMeterService.getInstance().getUsageSnapshot(clientId),
        Organization.findById(clientId).select('plan').lean(),
        PlatformAiBlueprintService.getInstance().getGlobal(),
      ]);

    const withKey = await AiSettings.findOne({ clientId: settings.clientId }).select('+encryptedApiKey');
    const plainKey = this.vault.decryptApiKey(withKey?.encryptedApiKey);

    const promptDoc =
      prompt ??
      (await AiPrompt.create({ clientId: new mongoose.Types.ObjectId(clientId) }));

    const toPayload = (m: ReturnType<typeof listModelsForProvider>[number]): AiModelCatalogPayload => ({
      id: m.id,
      label: m.label,
      description: m.description,
      inputUsdPer1M: m.inputUsdPer1M,
      outputUsdPer1M: m.outputUsdPer1M,
      tier: m.tier,
      recommended: m.recommended,
      deprecated: m.deprecated,
      typicalTurnCostUsd: estimateTypicalTurnCostUsd(m.id),
    });

    const modelCatalogs = {
      gemini: listModelsForProvider('gemini').map(toPayload),
      openai: listModelsForProvider('openai').map(toPayload),
    };

    let catalog = listModelsForProvider(settings.provider).map(toPayload);
    if (!catalog.some(m => m.id === settings.llmModel)) {
      catalog = [
        ...catalog,
        {
          id: settings.llmModel,
          label: settings.llmModel,
          description: 'Modelo salvo anteriormente — escolha um da lista para atualizar.',
          inputUsdPer1M: 0.3,
          outputUsdPer1M: 2.5,
          tier: 'balanced',
          typicalTurnCostUsd: estimateTypicalTurnCostUsd(settings.llmModel),
        },
      ];
    }

    const selected = getModelCatalogEntry(settings.llmModel);
    const selectedModelPricing = selected
      ? {
          id: selected.id,
          label: selected.label,
          description: selected.description,
          inputUsdPer1M: selected.inputUsdPer1M,
          outputUsdPer1M: selected.outputUsdPer1M,
          tier: selected.tier,
          recommended: selected.recommended,
          deprecated: selected.deprecated,
          typicalTurnCostUsd: estimateTypicalTurnCostUsd(selected.id),
        }
      : {
          id: settings.llmModel,
          label: settings.llmModel,
          description: 'Modelo personalizado (preço estimado)',
          inputUsdPer1M: 0.3,
          outputUsdPer1M: 2.5,
          tier: 'balanced',
          typicalTurnCostUsd: estimateTypicalTurnCostUsd(settings.llmModel),
        };

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
        customRules: promptDoc.customRules ?? '',
        useSystemContext: promptDoc.useSystemContext !== false,
        skipKnownFields: promptDoc.skipKnownFields !== false,
        autoResolveEnabled: promptDoc.autoResolveEnabled !== false,
        learnSkillsEnabled: promptDoc.learnSkillsEnabled !== false,
        learnMemoryEnabled: promptDoc.learnMemoryEnabled !== false,
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
      skills: skills.map(s => AiSkillService.getInstance().toPayload(s)),
      memories: memories.map(m => AiMemoryService.getInstance().toPayload(m)),
      usage,
      apiKeyMasked: this.vault.maskApiKey(plainKey),
      hasApiKey: this.vault.hasKey(withKey?.encryptedApiKey),
      planLimits: getAiPlanLimits(org?.plan ?? 'free'),
      modelCatalog: catalog,
      modelCatalogs,
      selectedModelPricing: selectedModelPricing,
      blueprintInfo: {
        managedBy: 'radarzap',
        version: blueprint.version,
        agentName: blueprint.agentName,
        updatedAt: blueprint.updatedAt,
      },
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
    const skills = body.skills as Array<{
      id?: string;
      title: string;
      triggers: string;
      solution: string;
      status?: 'pending' | 'approved' | 'rejected';
      _delete?: boolean;
    }> | undefined;
    const memories = body.memories as Array<{
      id?: string;
      title: string;
      content: string;
      tags?: string;
      status?: 'pending' | 'approved' | 'rejected';
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
      const prevProvider = settings.provider;
      settings.provider = s.provider as AiProvider;
      if (!s.model || prevProvider !== settings.provider) {
        settings.llmModel = defaultModelForProvider(settings.provider);
      }
    }
    if (typeof s.model === 'string' && s.model.trim()) settings.llmModel = s.model.trim();
    if (typeof s.temperature === 'number') settings.temperature = s.temperature;
    if (typeof s.maxTokens === 'number') {
      settings.maxTokens = Math.min(
        4096,
        Math.max(MIN_AI_MAX_TOKENS, s.maxTokens),
      );
    }
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
            ...(typeof p.customRules === 'string' ? { customRules: p.customRules } : {}),
            ...(typeof p.useSystemContext === 'boolean' ? { useSystemContext: p.useSystemContext } : {}),
            ...(typeof p.skipKnownFields === 'boolean' ? { skipKnownFields: p.skipKnownFields } : {}),
            ...(typeof p.autoResolveEnabled === 'boolean' ? { autoResolveEnabled: p.autoResolveEnabled } : {}),
            ...(typeof p.learnSkillsEnabled === 'boolean' ? { learnSkillsEnabled: p.learnSkillsEnabled } : {}),
            ...(typeof p.learnMemoryEnabled === 'boolean' ? { learnMemoryEnabled: p.learnMemoryEnabled } : {}),
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

    if (Array.isArray(skills)) {
      await AiSkillService.getInstance().syncPayload(clientId, skills);
    }

    if (Array.isArray(memories)) {
      await AiMemoryService.getInstance().syncPayload(clientId, memories);
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
