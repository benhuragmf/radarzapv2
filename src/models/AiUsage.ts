import mongoose, { Schema, Document } from 'mongoose';
import type { AiProvider } from '@/types/ai-assistant';

export interface IAiUsage extends Document {
  clientId: mongoose.Types.ObjectId;
  conversationId?: mongoose.Types.ObjectId;
  provider: AiProvider | 'radarzap';
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
