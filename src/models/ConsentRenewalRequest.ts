import mongoose, { Schema, Document } from 'mongoose';
import { ConsentStatus } from '@/types/consent';

export interface IConsentRenewalRequest extends Document {
  clientId: mongoose.Types.ObjectId;
  destinationId: mongoose.Types.ObjectId;
  phone: string;
  contactName: string;
  previousStatus: ConsentStatus;
  requestedByUserId: string;
  requestedByUsername: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedByUserId?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

const ConsentRenewalRequestSchema = new Schema<IConsentRenewalRequest>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination', required: true, index: true },
    phone: { type: String, required: true },
    contactName: { type: String, required: true },
    previousStatus: { type: String, enum: Object.values(ConsentStatus), required: true },
    requestedByUserId: { type: String, required: true },
    requestedByUsername: { type: String, required: true },
    reason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    resolvedByUserId: String,
    resolvedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'consentRenewalRequests' },
);

export const ConsentRenewalRequest = mongoose.model<IConsentRenewalRequest>(
  'ConsentRenewalRequest',
  ConsentRenewalRequestSchema,
);
