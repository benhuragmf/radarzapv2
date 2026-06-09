import mongoose, { Schema, Document } from 'mongoose';

export type AiSkillStatus = 'pending' | 'approved' | 'rejected';
export type AiSkillSource = 'learned' | 'manual';

export interface IAiSkill extends Document {
  clientId: mongoose.Types.ObjectId;
  title: string;
  /** Palavras-chave / assunto que disparam a skill (texto livre). */
  triggers: string;
  solution: string;
  status: AiSkillStatus;
  source: AiSkillSource;
  sourceConversationId?: mongoose.Types.ObjectId;
  sourceProblem?: string;
  approvedByUserId?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedAt?: Date;
  usageCount: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AiSkillSchema = new Schema<IAiSkill>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    triggers: { type: String, required: true, maxlength: 500 },
    solution: { type: String, required: true, maxlength: 8000 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    source: { type: String, enum: ['learned', 'manual'], default: 'manual' },
    sourceConversationId: { type: Schema.Types.ObjectId },
    sourceProblem: { type: String, maxlength: 2000 },
    approvedByUserId: { type: Schema.Types.ObjectId },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    usageCount: { type: Number, default: 0, min: 0 },
    lastUsedAt: { type: Date },
  },
  { timestamps: true, collection: 'aiSkills' },
);

AiSkillSchema.index({ clientId: 1, status: 1, updatedAt: -1 });

export const AiSkill = mongoose.model<IAiSkill>('AiSkill', AiSkillSchema);
