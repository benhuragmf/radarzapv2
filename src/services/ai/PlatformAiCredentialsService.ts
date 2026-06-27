import mongoose from 'mongoose';
import type { AiProvider } from '@/types/ai-assistant';
import {
  PlatformAiCredentials,
  IPlatformAiCredentials,
} from '@/models/PlatformAiCredentials';
import { AiCredentialVaultService } from './AiCredentialVaultService';
import {
  PLATFORM_AI_CREDENTIALS_DEFAULTS,
  PLATFORM_AI_ENV_KEYS,
  defaultModelForPlatformProvider,
} from '@/constants/platform-ai-credentials-defaults';
import {
  listModelsForProvider,
  type AiModelCatalogEntry,
} from '@/constants/ai-model-catalog';
import { AiProviderService } from './AiProviderService';

export type PlatformAiKeySource = 'database' | 'env' | 'none';

export type PlatformAiCredentialsPayload = {
  provider: AiProvider;
  llmModel: string;
  hasOpenAiKey: boolean;
  hasGeminiKey: boolean;
  openAiKeyMasked: string | null;
  geminiKeyMasked: string | null;
  activeKeySource: PlatformAiKeySource;
  envFallbackAvailable: boolean;
  modelCatalog: AiModelCatalogEntry[];
  modelCatalogs: { openai: AiModelCatalogEntry[]; gemini: AiModelCatalogEntry[] };
  version: number;
  updatedAt: string;
};

export type PlatformAiRuntimeConfig = {
  provider: AiProvider;
  llmModel: string;
  apiKey: string;
  keySource: Exclude<PlatformAiKeySource, 'none'>;
};

export class PlatformAiCredentialsService {
  private static instance: PlatformAiCredentialsService;

  private vault = AiCredentialVaultService.getInstance();

  static getInstance(): PlatformAiCredentialsService {
    if (!this.instance) this.instance = new PlatformAiCredentialsService();
    return this.instance;
  }

  async getGlobal(): Promise<IPlatformAiCredentials> {
    let doc = await PlatformAiCredentials.findOne({ key: 'global' });
    if (!doc) {
      doc = await PlatformAiCredentials.create({
        key: 'global',
        ...PLATFORM_AI_CREDENTIALS_DEFAULTS,
      });
    }
    return doc;
  }

  private async getGlobalWithSecrets(): Promise<IPlatformAiCredentials> {
    let doc = await PlatformAiCredentials.findOne({ key: 'global' }).select(
      '+encryptedOpenAiKey +encryptedGeminiKey',
    );
    if (!doc) {
      doc = await PlatformAiCredentials.create({
        key: 'global',
        ...PLATFORM_AI_CREDENTIALS_DEFAULTS,
      });
      doc = await PlatformAiCredentials.findOne({ key: 'global' }).select(
        '+encryptedOpenAiKey +encryptedGeminiKey',
      );
    }
    if (!doc) throw new Error('Falha ao carregar credenciais da plataforma');
    return doc;
  }

  private envKeyForProvider(provider: AiProvider): string | null {
    const keys = PLATFORM_AI_ENV_KEYS[provider];
    for (const name of keys) {
      const value = process.env[name]?.trim();
      if (value) return value;
    }
    return null;
  }

  private decryptStoredKey(stored?: string | null): string | null {
    return this.vault.decryptApiKey(stored);
  }

  resolveKeyFromDoc(
    doc: Pick<IPlatformAiCredentials, 'provider' | 'encryptedOpenAiKey' | 'encryptedGeminiKey'>,
    providerOverride?: AiProvider,
  ): { apiKey: string | null; keySource: PlatformAiKeySource } {
    const provider = providerOverride ?? doc.provider;
    const stored =
      provider === 'gemini' ? doc.encryptedGeminiKey : doc.encryptedOpenAiKey;
    const fromDb = this.decryptStoredKey(stored);
    if (fromDb) return { apiKey: fromDb, keySource: 'database' };
    const fromEnv = this.envKeyForProvider(provider);
    if (fromEnv) return { apiKey: fromEnv, keySource: 'env' };
    return { apiKey: null, keySource: 'none' };
  }

  async resolveForRuntime(providerOverride?: AiProvider): Promise<PlatformAiRuntimeConfig> {
    const doc = await this.getGlobalWithSecrets();
    const provider = providerOverride ?? doc.provider;
    const { apiKey, keySource } = this.resolveKeyFromDoc(doc, provider);
    if (!apiKey || keySource === 'none') {
      throw new Error('Chave interna RadarZap não configurada (painel admin ou .env)');
    }
    return {
      provider,
      llmModel: doc.llmModel,
      apiKey,
      keySource,
    };
  }

  async toPayload(doc: IPlatformAiCredentials): Promise<PlatformAiCredentialsPayload> {
    const withSecrets = await PlatformAiCredentials.findById(doc._id).select(
      '+encryptedOpenAiKey +encryptedGeminiKey',
    );
    if (!withSecrets) throw new Error('Credenciais da plataforma não encontradas');

    const openAiPlain = this.decryptStoredKey(withSecrets.encryptedOpenAiKey);
    const geminiPlain = this.decryptStoredKey(withSecrets.encryptedGeminiKey);
    const { keySource } = this.resolveKeyFromDoc(withSecrets);

    return {
      provider: withSecrets.provider,
      llmModel: withSecrets.llmModel,
      hasOpenAiKey: this.vault.hasKey(withSecrets.encryptedOpenAiKey),
      hasGeminiKey: this.vault.hasKey(withSecrets.encryptedGeminiKey),
      openAiKeyMasked: this.vault.maskApiKey(openAiPlain),
      geminiKeyMasked: this.vault.maskApiKey(geminiPlain),
      activeKeySource: keySource,
      envFallbackAvailable: Boolean(this.envKeyForProvider(withSecrets.provider)),
      modelCatalog: listModelsForProvider(withSecrets.provider),
      modelCatalogs: {
        openai: listModelsForProvider('openai'),
        gemini: listModelsForProvider('gemini'),
      },
      version: withSecrets.version,
      updatedAt: withSecrets.updatedAt.toISOString(),
    };
  }

  async updateGlobal(
    patch: Record<string, unknown>,
    userId: string,
  ): Promise<PlatformAiCredentialsPayload> {
    const current = await this.getGlobalWithSecrets();
    const set: Record<string, unknown> = {
      updatedByUserId: new mongoose.Types.ObjectId(userId),
      version: (current.version ?? 1) + 1,
    };

    if (patch.provider === 'openai' || patch.provider === 'gemini') {
      const nextProvider = patch.provider as AiProvider;
      set.provider = nextProvider;
      if (typeof patch.llmModel !== 'string') {
        set.llmModel = defaultModelForPlatformProvider(nextProvider);
      }
    }

    if (typeof patch.llmModel === 'string' && patch.llmModel.trim()) {
      set.llmModel = patch.llmModel.trim().slice(0, 80);
    }

    if (typeof patch.openAiApiKey === 'string' && patch.openAiApiKey.trim()) {
      set.encryptedOpenAiKey = this.vault.encryptApiKey(patch.openAiApiKey);
    }
    if (typeof patch.geminiApiKey === 'string' && patch.geminiApiKey.trim()) {
      set.encryptedGeminiKey = this.vault.encryptApiKey(patch.geminiApiKey);
    }

    const doc = await PlatformAiCredentials.findOneAndUpdate(
      { key: 'global' },
      { $set: set },
      { new: true, upsert: true },
    );
    if (!doc) throw new Error('Falha ao salvar credenciais da plataforma');
    return this.toPayload(doc);
  }

  async removeKey(target: 'openai' | 'gemini'): Promise<PlatformAiCredentialsPayload> {
    const field = target === 'gemini' ? 'encryptedGeminiKey' : 'encryptedOpenAiKey';
    const doc = await PlatformAiCredentials.findOneAndUpdate(
      { key: 'global' },
      { $unset: { [field]: 1 } },
      { new: true },
    );
    if (!doc) throw new Error('Credenciais da plataforma não encontradas');
    return this.toPayload(doc);
  }

  async testConnection(override?: {
    provider?: AiProvider;
    llmModel?: string;
    apiKey?: string;
  }): Promise<{ ok: boolean; message: string; model: string; keySource: PlatformAiKeySource }> {
    const doc = await this.getGlobalWithSecrets();
    const provider = override?.provider ?? doc.provider;
    const llmModel = override?.llmModel?.trim() || doc.llmModel;
    const resolved = override?.apiKey?.trim()
      ? { apiKey: override.apiKey.trim(), keySource: 'database' as const }
      : this.resolveKeyFromDoc(doc, provider);
    if (!resolved.apiKey) {
      return {
        ok: false,
        message: 'Nenhuma chave configurada (painel ou .env)',
        model: llmModel,
        keySource: 'none',
      };
    }

    try {
      const result = await AiProviderService.getInstance().pingProvider(
        provider,
        llmModel,
        resolved.apiKey,
      );
      return {
        ok: true,
        message: result.text.slice(0, 120) || 'Conexão OK',
        model: llmModel,
        keySource: resolved.keySource,
      };
    } catch (e) {
      return {
        ok: false,
        message: (e as Error).message,
        model: llmModel,
        keySource: resolved.keySource,
      };
    }
  }
}
