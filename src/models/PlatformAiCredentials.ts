import mongoose, { Schema, Document } from 'mongoose';
import type { AiProvider } from '@/types/ai-assistant';
import { PLATFORM_AI_CREDENTIALS_DEFAULTS } from '@/constants/platform-ai-credentials-defaults';

/** Credenciais e modelo padrão da IA Radar Chat — único documento, gerido pelo admin. */
export interface IPlatformAiCredentials extends Document {
  key: 'global';
  provider: AiProvider;
  llmModel: string;
  encryptedOpenAiKey?: string;
  encryptedGeminiKey?: string;
  version: number;
  updatedByUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformAiCredentialsSchema = new Schema<IPlatformAiCredentials>(
  {
    key: { type: String, required: true, unique: true, default: 'global', enum: ['global'] },
    provider: {
      type: String,
      enum: ['openai', 'gemini'],
      default: PLATFORM_AI_CREDENTIALS_DEFAULTS.provider,
    },
    llmModel: {
      type: String,
      default: PLATFORM_AI_CREDENTIALS_DEFAULTS.llmModel,
      maxlength: 80,
    },
    encryptedOpenAiKey: { type: String, select: false },
    encryptedGeminiKey: { type: String, select: false },
    version: { type: Number, default: 1, min: 1 },
    updatedByUserId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true, collection: 'platformAiCredentials' },
);

export const PlatformAiCredentials = mongoose.model<IPlatformAiCredentials>(
  'PlatformAiCredentials',
  PlatformAiCredentialsSchema,
);
