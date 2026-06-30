import mongoose, { Schema, Document } from 'mongoose';
import {
  AiMode,
  AiProvider,
  AiTransferRules,
  DEFAULT_AI_TRANSFER_RULES,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
} from '@/types/ai-assistant';
import type { AttendanceMode } from '@/types/attendance-mode';
import { ATTENDANCE_MODE_VALUES } from '@/types/attendance-mode';
import { defaultModelForProviderCatalog } from '@/constants/ai-model-catalog';

export interface IAiSettings extends Document {
  clientId: mongoose.Types.ObjectId;
  enabled: boolean;
  mode: AiMode;
  /** Modo de atendimento (produto) — Fase 3+. Runtime LLM ainda usa `mode`. */
  attendanceMode?: AttendanceMode;
  provider: AiProvider;
  llmModel: string;
  encryptedApiKey?: string;
  temperature: number;
  maxTokens: number;
  dailyLimit: number;
  monthlyLimit: number;
  perConversationLimit: number;
  transferRules: AiTransferRules;
  createdAt: Date;
  updatedAt: Date;
}

const TransferRulesSchema = new Schema<AiTransferRules>(
  {
    onHumanRequest: { type: Boolean, default: true },
    onAngryClient: { type: Boolean, default: true },
    onCancellation: { type: Boolean, default: true },
    onLegal: { type: Boolean, default: true },
    onLowConfidence: { type: Boolean, default: true },
    onRepeatedQuestion: { type: Boolean, default: true },
    onMinDataCollected: { type: Boolean, default: true },
    onSensitiveMessage: { type: Boolean, default: true },
    onUninterpretableMedia: { type: Boolean, default: true },
    lowConfidenceThreshold: { type: Number, default: 0.45, min: 0, max: 1 },
    repeatedQuestionCount: { type: Number, default: 3, min: 2, max: 10 },
  },
  { _id: false },
);

const AiSettingsSchema = new Schema<IAiSettings>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    mode: { type: String, enum: ['radarchat', 'company', 'disabled'], default: 'disabled' },
    attendanceMode: {
      type: String,
      enum: [...ATTENDANCE_MODE_VALUES],
      default: 'disabled',
    },
    provider: { type: String, enum: ['openai', 'gemini'], default: 'openai' },
    llmModel: { type: String, default: DEFAULT_OPENAI_MODEL, maxlength: 80 },
    encryptedApiKey: { type: String, select: false },
    temperature: { type: Number, default: 0.4, min: 0, max: 1 },
    maxTokens: { type: Number, default: 600, min: 100, max: 4096 },
    dailyLimit: { type: Number, default: 50, min: 0 },
    monthlyLimit: { type: Number, default: 1000, min: 0 },
    perConversationLimit: { type: Number, default: 25, min: 1 },
    transferRules: { type: TransferRulesSchema, default: () => ({ ...DEFAULT_AI_TRANSFER_RULES }) },
  },
  { timestamps: true, collection: 'aiSettings' },
);

export const AiSettings = mongoose.model<IAiSettings>('AiSettings', AiSettingsSchema);

export function defaultModelForProvider(provider: AiProvider): string {
  return defaultModelForProviderCatalog(provider);
}
