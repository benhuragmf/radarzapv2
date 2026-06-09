import mongoose, { Schema, Document } from 'mongoose';
import { DEFAULT_AI_SYSTEM_PROMPT } from '@/types/ai-assistant';

export interface IAiPrompt extends Document {
  clientId: mongoose.Types.ObjectId;
  systemPrompt: string;
  collectName: boolean;
  collectEmail: boolean;
  collectProblem: boolean;
  collectCpfCnpj: boolean;
  collectAddress: boolean;
  collectOrderNumber: boolean;
  collectUrgency: boolean;
  collectAttachments: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AiPromptSchema = new Schema<IAiPrompt>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    systemPrompt: { type: String, default: DEFAULT_AI_SYSTEM_PROMPT, maxlength: 8000 },
    collectName: { type: Boolean, default: true },
    collectEmail: { type: Boolean, default: true },
    collectProblem: { type: Boolean, default: true },
    collectCpfCnpj: { type: Boolean, default: false },
    collectAddress: { type: Boolean, default: false },
    collectOrderNumber: { type: Boolean, default: false },
    collectUrgency: { type: Boolean, default: true },
    collectAttachments: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'aiPrompts' },
);

export const AiPrompt = mongoose.model<IAiPrompt>('AiPrompt', AiPromptSchema);
