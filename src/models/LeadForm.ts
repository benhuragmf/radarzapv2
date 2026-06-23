import mongoose, { Schema, Document } from 'mongoose';
import type { LeadFormAppearance } from '@/types/lead-form';
import { DEFAULT_LEAD_FORM_APPEARANCE } from '@/types/lead-form';

export interface ILeadForm extends Document {
  clientId: mongoose.Types.ObjectId;
  name: string;
  publicKey: string;
  active: boolean;
  allowedDomains: string[];
  appearance: LeadFormAppearance;
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
    askEmail: { type: Boolean, default: DEFAULT_LEAD_FORM_APPEARANCE.askEmail },
    requireEmail: { type: Boolean, default: DEFAULT_LEAD_FORM_APPEARANCE.requireEmail },
    askMessage: { type: Boolean, default: DEFAULT_LEAD_FORM_APPEARANCE.askMessage },
    requireMessage: { type: Boolean, default: DEFAULT_LEAD_FORM_APPEARANCE.requireMessage },
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
    appearance: { type: AppearanceSchema, default: () => ({ ...DEFAULT_LEAD_FORM_APPEARANCE }) },
    redirectUrl: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

LeadFormSchema.index({ clientId: 1, name: 1 });

export const LeadForm =
  (mongoose.models.LeadForm as mongoose.Model<ILeadForm>) ??
  mongoose.model<ILeadForm>('LeadForm', LeadFormSchema);
