import mongoose, { Schema, Document } from 'mongoose';

export interface IInboxTransfer extends Document {
  clientId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  fromDepartmentId?: mongoose.Types.ObjectId;
  toDepartmentId: mongoose.Types.ObjectId;
  fromUserId?: mongoose.Types.ObjectId;
  toUserId?: mongoose.Types.ObjectId;
  reason?: string;
  createdAt: Date;
}

const InboxTransferSchema = new Schema<IInboxTransfer>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, required: true, ref: 'InboxConversation', index: true },
    fromDepartmentId: { type: Schema.Types.ObjectId, ref: 'InboxDepartment' },
    toDepartmentId: { type: Schema.Types.ObjectId, required: true, ref: 'InboxDepartment' },
    fromUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    toUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'inboxTransfers' },
);

export const InboxTransfer = mongoose.model<IInboxTransfer>('InboxTransfer', InboxTransferSchema);
