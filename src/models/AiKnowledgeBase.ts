import mongoose, { Schema, Document } from 'mongoose';

export interface IAiKnowledgeBase extends Document {
  clientId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AiKnowledgeBaseSchema = new Schema<IAiKnowledgeBase>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 12000 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'aiKnowledgeBase' },
);

AiKnowledgeBaseSchema.index({ clientId: 1, active: 1, updatedAt: -1 });

export const AiKnowledgeBase = mongoose.model<IAiKnowledgeBase>('AiKnowledgeBase', AiKnowledgeBaseSchema);
