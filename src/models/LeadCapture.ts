import mongoose, { Schema, Document } from 'mongoose';
import type { LeadFormAppearance, LeadFormRouting, LeadCaptureOrigin, LeadCaptureStatus, LeadTemperature } from '@/types/lead-form';
import { DEFAULT_LEAD_FORM_APPEARANCE, DEFAULT_LEAD_FORM_ROUTING } from '@/types/lead-form';
import type { LeadHistoryEntry, LeadUtm } from '@/types/lead-form';

export interface ILeadCapture extends Document {
  clientId: mongoose.Types.ObjectId;
  formId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  sourceUrl?: string;
  pageTitle?: string;
  origin: LeadCaptureOrigin;
  status: LeadCaptureStatus;
  temperature?: LeadTemperature;
  internalNotes?: string;
  destinationId?: mongoose.Types.ObjectId;
  inboxConversationId?: mongoose.Types.ObjectId;
  contactGroupIds?: mongoose.Types.ObjectId[];
  assignedUserId?: mongoose.Types.ObjectId;
  metadata?: Record<string, string>;
  utm?: LeadUtm;
  consentAccepted?: boolean;
  consentAcceptedAt?: Date;
  possibleDuplicate?: boolean;
  duplicateHintIds?: string[];
  history?: LeadHistoryEntry[];
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HistorySchema = new Schema(
  {
    at: { type: Date, required: true },
    kind: { type: String, required: true },
    message: { type: String, required: true, maxlength: 500 },
    userId: { type: String, maxlength: 64 },
    meta: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const UtmSchema = new Schema(
  {
    source: { type: String, maxlength: 120 },
    medium: { type: String, maxlength: 120 },
    campaign: { type: String, maxlength: 120 },
    term: { type: String, maxlength: 120 },
    content: { type: String, maxlength: 120 },
  },
  { _id: false },
);

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
    origin: {
      type: String,
      enum: ['site', 'widget', 'wordpress', 'api', 'whatsapp', 'webchat', 'manual', 'import', 'campaign'],
      default: 'site',
      index: true,
    },
    status: {
      type: String,
      enum: ['new', 'in_review', 'in_progress', 'qualified', 'converted', 'lost', 'spam'],
      default: 'new',
      index: true,
    },
    temperature: {
      type: String,
      enum: ['cold', 'warm', 'hot'],
      index: true,
    },
    internalNotes: { type: String, maxlength: 4000 },
    destinationId: { type: Schema.Types.ObjectId, ref: 'Destination' },
    inboxConversationId: { type: Schema.Types.ObjectId, ref: 'InboxConversation' },
    contactGroupIds: [{ type: Schema.Types.ObjectId, ref: 'ContactGroup' }],
    assignedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed },
    utm: { type: UtmSchema },
    consentAccepted: { type: Boolean },
    consentAcceptedAt: { type: Date },
    possibleDuplicate: { type: Boolean, default: false },
    duplicateHintIds: [{ type: String }],
    history: { type: [HistorySchema], default: [] },
    ipAddress: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);

LeadCaptureSchema.index({ clientId: 1, createdAt: -1 });
LeadCaptureSchema.index({ clientId: 1, status: 1, createdAt: -1 });
LeadCaptureSchema.index({ clientId: 1, phone: 1 });
LeadCaptureSchema.index({ clientId: 1, email: 1 });
LeadCaptureSchema.index({ clientId: 1, formId: 1, createdAt: -1 });

export const LeadCapture =
  (mongoose.models.LeadCapture as mongoose.Model<ILeadCapture>) ??
  mongoose.model<ILeadCapture>('LeadCapture', LeadCaptureSchema);
