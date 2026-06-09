import mongoose, { Schema, Document } from 'mongoose';
import { AiConversationStatus } from '@/types/ai-assistant';

export interface IAiConversationState extends Document {
  clientId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  status: AiConversationStatus;
  collectedName?: string;
  collectedEmail?: string;
  collectedProblem?: string;
  collectedCpfCnpj?: string;
  collectedAddress?: string;
  collectedOrderNumber?: string;
  urgency?: 'low' | 'medium' | 'high';
  summary?: string;
  confidence: number;
  shouldEscalate: boolean;
  escalationReason?: string;
  suggestedDepartmentMenuKey?: string;
  aiTurnCount: number;
  lastClientMessage?: string;
  repeatedQuestionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const AiConversationStateSchema = new Schema<IAiConversationState>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: Object.values(AiConversationStatus),
      default: AiConversationStatus.AI_COLLECTING,
    },
    collectedName: { type: String, maxlength: 200 },
    collectedEmail: { type: String, maxlength: 320 },
    collectedProblem: { type: String, maxlength: 4000 },
    collectedCpfCnpj: { type: String, maxlength: 20 },
    collectedAddress: { type: String, maxlength: 500 },
    collectedOrderNumber: { type: String, maxlength: 80 },
    urgency: { type: String, enum: ['low', 'medium', 'high'] },
    summary: { type: String, maxlength: 4000 },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    shouldEscalate: { type: Boolean, default: false },
    escalationReason: { type: String, maxlength: 500 },
    suggestedDepartmentMenuKey: { type: String, maxlength: 20 },
    aiTurnCount: { type: Number, default: 0, min: 0 },
    lastClientMessage: { type: String, maxlength: 2000 },
    repeatedQuestionCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: 'aiConversationStates' },
);

export const AiConversationState = mongoose.model<IAiConversationState>(
  'AiConversationState',
  AiConversationStateSchema,
);
