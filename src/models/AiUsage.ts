import mongoose, { Schema, Document } from 'mongoose';
import type { AiProvider } from '@/types/ai-assistant';
import type { AiUsageKind } from '@/types/ai-usage-kind';

export interface IAiUsage extends Document {
  clientId: mongoose.Types.ObjectId;
  conversationId?: mongoose.Types.ObjectId;
  provider: AiProvider | 'radarzap' | 'radarzap-basic-triage' | string;
  /** Modo de atendimento que originou a chamada LLM — desde 2.11.3. */
  usageKind?: AiUsageKind;
  llmModel: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  createdAt: Date;
}

const AiUsageSchema = new Schema<IAiUsage>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, index: true },
    provider: { type: String, required: true },
    usageKind: {
      type: String,
      enum: ['premium_assistant', 'basic_triage', 'unknown'],
    },
    llmModel: { type: String, required: true },
    inputTokens: { type: Number, default: 0, min: 0 },
    outputTokens: { type: Number, default: 0, min: 0 },
    totalTokens: { type: Number, default: 0, min: 0 },
    estimatedCost: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'aiUsage' },
);

AiUsageSchema.index({ clientId: 1, createdAt: -1 });

export const AiUsage = mongoose.model<IAiUsage>('AiUsage', AiUsageSchema);
