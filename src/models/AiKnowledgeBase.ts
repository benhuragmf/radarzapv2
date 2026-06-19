import mongoose, { Schema, Document } from 'mongoose';
import type { WebChatActionLink } from '../types/webchat';

export interface IAiKnowledgeBase extends Document {
  clientId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  category: string;
  keywords: string[];
  links: WebChatActionLink[];
  showAsQuickReply: boolean;
  quickReplyLabel?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AiKnowledgeBaseSchema = new Schema<IAiKnowledgeBase>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 12000 },
    category: { type: String, trim: true, maxlength: 80, default: 'Geral' },
    keywords: { type: [String], default: [] },
    links: {
      type: [
        {
          label: { type: String, maxlength: 80 },
          url: { type: String, maxlength: 500 },
          openInNewTab: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
    showAsQuickReply: { type: Boolean, default: false },
    quickReplyLabel: { type: String, maxlength: 60 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'aiKnowledgeBase' },
);

AiKnowledgeBaseSchema.index({ clientId: 1, active: 1, updatedAt: -1 });

export const AiKnowledgeBase = mongoose.model<IAiKnowledgeBase>('AiKnowledgeBase', AiKnowledgeBaseSchema);
