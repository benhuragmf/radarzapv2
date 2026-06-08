import mongoose, { Schema, Document } from 'mongoose';
import { InboxChannel, InboxConversationStatus } from '@/types/inbox';

export interface IInboxConversation extends Document {
  clientId: mongoose.Types.ObjectId;
  destinationId: mongoose.Types.ObjectId;
  contactIdentifier: string;
  contactName: string;
  departmentId?: mongoose.Types.ObjectId;
  assignedUserId?: mongoose.Types.ObjectId;
  /** Indicado pelo round-robin — aguardando aceite voluntário */
  suggestedUserId?: mongoose.Types.ObjectId;
  suggestedAt?: Date;
  status: InboxConversationStatus;
  channel: InboxChannel;
  lastMessageAt: Date;
  lastInboundAt?: Date;
  queueEnteredAt?: Date;
  acceptedAt?: Date;
  resolvedAt?: Date;
  /** Referência exibida ao converter em ticket */
  ticketRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InboxConversationSchema = new Schema<IInboxConversation>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    destinationId: { type: Schema.Types.ObjectId, required: true, ref: 'Destination', index: true },
    contactIdentifier: { type: String, required: true, index: true },
    contactName: { type: String, required: true, maxlength: 120 },
    departmentId: { type: Schema.Types.ObjectId, ref: 'InboxDepartment', index: true },
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    suggestedUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    suggestedAt: { type: Date, index: true },
    status: {
      type: String,
      enum: Object.values(InboxConversationStatus),
      default: InboxConversationStatus.BOT_TRIAGE,
      index: true,
    },
    channel: {
      type: String,
      enum: ['whatsapp_qr', 'whatsapp_cloud'],
      default: 'whatsapp_qr',
    },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastInboundAt: Date,
    queueEnteredAt: Date,
    acceptedAt: Date,
    resolvedAt: Date,
    ticketRef: { type: String, maxlength: 32, index: true },
  },
  { timestamps: true, collection: 'inboxConversations' },
);

InboxConversationSchema.index({ clientId: 1, status: 1, lastMessageAt: -1 });
InboxConversationSchema.index({ clientId: 1, departmentId: 1, status: 1 });

export const InboxConversation = mongoose.model<IInboxConversation>(
  'InboxConversation',
  InboxConversationSchema,
);
