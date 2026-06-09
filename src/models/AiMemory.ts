import mongoose, { Schema, Document } from 'mongoose';

export type AiMemoryStatus = 'pending' | 'approved' | 'rejected';
export type AiMemorySource = 'learned' | 'manual';

/** Fatos curados da empresa (equivalente a MEMORY.md do OpenClaw). */
export interface IAiMemory extends Document {
  clientId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  /** Palavras-chave para busca por relevância no prompt. */
  tags: string;
  status: AiMemoryStatus;
  source: AiMemorySource;
  sourceConversationId?: mongoose.Types.ObjectId;
  approvedByUserId?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedAt?: Date;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const AiMemorySchema = new Schema<IAiMemory>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 4000 },
    tags: { type: String, default: '', maxlength: 500 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    source: { type: String, enum: ['learned', 'manual'], default: 'manual' },
    sourceConversationId: { type: Schema.Types.ObjectId },
    approvedByUserId: { type: Schema.Types.ObjectId },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    usageCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: 'aiMemories' },
);

AiMemorySchema.index({ clientId: 1, status: 1, updatedAt: -1 });

export const AiMemory = mongoose.model<IAiMemory>('AiMemory', AiMemorySchema);
