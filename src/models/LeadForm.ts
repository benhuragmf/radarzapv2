import mongoose, { Schema, Document } from 'mongoose';
import type { LeadFormAppearance, LeadFormRouting, LeadCaptureStatus } from '@/types/lead-form';
import { DEFAULT_LEAD_FORM_APPEARANCE, DEFAULT_LEAD_FORM_ROUTING } from '@/types/lead-form';

export interface ILeadForm extends Document {
  clientId: mongoose.Types.ObjectId;
  name: string;
  publicKey: string;
  active: boolean;
  allowedDomains: string[];
  /** Inclui hosts do site em Configurações → Empresa (padrão true). */
  includeCompanyWebsite?: boolean;
  appearance: LeadFormAppearance;
  routing: LeadFormRouting;
  redirectUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppearanceSchema = new Schema<LeadFormAppearance>(
  {
    title: { type: String, default: DEFAULT_LEAD_FORM_APPEARANCE.title, maxlength: 120 },
    description: { type: String, default: DEFAULT_LEAD_FORM_APPEARANCE.description, maxlength: 400 },
    buttonText: { type: String, default: DEFAULT_LEAD_FORM_APPEARANCE.buttonText, maxlength: 40 },
    successMessage: {
      type: String,
      default: DEFAULT_LEAD_FORM_APPEARANCE.successMessage,
      maxlength: 500,
    },
    primaryColor: { type: String, default: DEFAULT_LEAD_FORM_APPEARANCE.primaryColor, maxlength: 20 },
    theme: { type: String, enum: ['auto', 'light', 'dark'], default: 'auto' },
    size: { type: String, enum: ['compact', 'default', 'wide'], default: 'default' },
    borderRadius: { type: Number, default: 8, min: 0, max: 24 },
    showLogo: { type: Boolean, default: false },
    askEmail: { type: Boolean, default: DEFAULT_LEAD_FORM_APPEARANCE.askEmail },
    requireEmail: { type: Boolean, default: DEFAULT_LEAD_FORM_APPEARANCE.requireEmail },
    askMessage: { type: Boolean, default: DEFAULT_LEAD_FORM_APPEARANCE.askMessage },
    requireMessage: { type: Boolean, default: DEFAULT_LEAD_FORM_APPEARANCE.requireMessage },
    customFields: {
      type: [
        {
          id: { type: String, required: true, maxlength: 40 },
          label: { type: String, required: true, maxlength: 80 },
          type: {
            type: String,
            enum: ['text', 'textarea', 'email', 'tel', 'select', 'checkbox', 'hidden'],
            default: 'text',
          },
          required: { type: Boolean, default: false },
          placeholder: { type: String, maxlength: 120 },
          options: [{ type: String, maxlength: 80 }],
        },
      ],
      default: [],
    },
    requireConsent: { type: Boolean, default: false },
    consentText: { type: String, default: DEFAULT_LEAD_FORM_APPEARANCE.consentText, maxlength: 500 },
    consentPolicyUrl: { type: String, maxlength: 500 },
    honeypot: { type: Boolean, default: true },
  },
  { _id: false },
);

const RoutingSchema = new Schema<LeadFormRouting>(
  {
    initialStatus: {
      type: String,
      enum: ['new', 'in_review', 'in_progress', 'qualified', 'converted', 'lost', 'spam'],
      default: 'new',
    },
    defaultContactGroupIds: [{ type: String }],
    defaultTags: [{ type: String, maxlength: 60 }],
    defaultAssigneeId: { type: String },
    contactMode: { type: String, enum: ['always', 'qualify', 'never'], default: 'always' },
    autoOpenInbox: { type: Boolean, default: false },
    autoOpenInboxWhenOnline: { type: Boolean, default: false },
  },
  { _id: false },
);

const LeadFormSchema = new Schema<ILeadForm>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, ref: 'Organization', index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    publicKey: { type: String, required: true, unique: true, index: true },
    active: { type: Boolean, default: true, index: true },
    allowedDomains: { type: [String], default: [] },
    includeCompanyWebsite: { type: Boolean, default: true },
    appearance: { type: AppearanceSchema, default: () => ({ ...DEFAULT_LEAD_FORM_APPEARANCE }) },
    routing: { type: RoutingSchema, default: () => ({ ...DEFAULT_LEAD_FORM_ROUTING }) },
    redirectUrl: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

LeadFormSchema.index({ clientId: 1, name: 1 });

export const LeadForm =
  (mongoose.models.LeadForm as mongoose.Model<ILeadForm>) ??
  mongoose.model<ILeadForm>('LeadForm', LeadFormSchema);
