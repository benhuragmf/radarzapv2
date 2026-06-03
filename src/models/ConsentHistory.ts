import mongoose, { Schema, Document, Model } from 'mongoose';
import type { ConsentActionOrigin } from '@/types/consent';
import { ConsentStatus } from '@/types/consent';

export interface IConsentHistory extends Document {
  clientId: mongoose.Types.ObjectId;
  destinationId: mongoose.Types.ObjectId;
  phone: string;
  companyName?: string;
  previousStatus: ConsentStatus;
  newStatus: ConsentStatus;
  replyText?: string;
  attemptNumber?: number;
  requestedByUserId?: string;
  requestedByUsername?: string;
  origin: ConsentActionOrigin;
  createdAt: Date;
}

const ConsentHistorySchema = new Schema<IConsentHistory>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', required: true, index: true },
    phone: { type: String, required: true, index: true },
    companyName: String,
    previousStatus: { type: String, enum: Object.values(ConsentStatus), required: true },
    newStatus: { type: String, enum: Object.values(ConsentStatus), required: true },
    replyText: String,
    attemptNumber: Number,
    requestedByUserId: String,
    requestedByUsername: String,
    origin: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'consentHistory' },
);

ConsentHistorySchema.index({ clientId: 1, createdAt: -1 });

export const ConsentHistory = mongoose.model<IConsentHistory>('ConsentHistory', ConsentHistorySchema);
