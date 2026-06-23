import mongoose, { Schema, Document } from 'mongoose';
import type { LeadCaptureStatus } from '@/types/lead-form';

export interface ILeadCapture extends Document {
  clientId: mongoose.Types.ObjectId;
  formId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  sourceUrl?: string;
  pageTitle?: string;
  status: LeadCaptureStatus;
  internalNotes?: string;
  destinationId?: mongoose.Types.ObjectId;
  metadata?: Record<string, string>;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeadCaptureSchema = new Schema<ILeadCapture>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, ref: 'Organization', index: true },
    formId: { type: Schema.Types.ObjectId, required: true, ref: 'LeadForm', index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 32 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    message: { type: String, trim: true, maxlength: 2000 },
    sourceUrl: { type: String, trim: true, maxlength: 500 },
    pageTitle: { type: String, trim: true, maxlength: 200 },
    status: {
      type: String,
      enum: ['new', 'in_review', 'in_progress', 'converted', 'lost'],
      default: 'new',
      index: true,
    },
    internalNotes: { type: String, maxlength: 4000 },
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination' },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String, maxlength: 64 },
  },
  { timestamps: true },
);

LeadCaptureSchema.index({ clientId: 1, createdAt: -1 });
LeadCaptureSchema.index({ clientId: 1, status: 1, createdAt: -1 });
LeadCaptureSchema.index({ clientId: 1, phone: 1 });

export const LeadCapture =
  (mongoose.models.LeadCapture as mongoose.Model<ILeadCapture>) ??
  mongoose.model<ILeadCapture>('LeadCapture', LeadCaptureSchema);
