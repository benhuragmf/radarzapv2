import mongoose, { Schema, Document } from 'mongoose';
import {
  DEFAULT_SYSTEM_WHATSAPP_POLICY,
  DEFAULT_CAMPAIGN_DELAYS,
  type SystemWhatsAppPolicyDoc,
} from '@/types/whatsapp-send-policy';

export interface ISystemWhatsAppPolicy extends Document, SystemWhatsAppPolicyDoc {
  policyKey: string;
  updatedAt: Date;
}

const KindLimitSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    maxPerMinute: { type: Number, required: true, min: 1, max: 200 },
  },
  { _id: false },
);

const ProtectedTierSchema = new Schema(
  {
    id: { type: String, enum: ['minimum', 'normal', 'optimal'], required: true },
    label: { type: String, required: true, trim: true, maxlength: 40 },
    baseSec: { type: Number, required: true, min: 5, max: 600 },
    jitterMinSec: { type: Number, required: true, min: 5, max: 900 },
    jitterMaxSec: { type: Number, required: true, min: 5, max: 900 },
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const CampaignDelaysSchema = new Schema(
  {
    protectedTiers: {
      type: [ProtectedTierSchema],
      default: () => DEFAULT_CAMPAIGN_DELAYS.protectedTiers.map(t => ({ ...t })),
    },
    protectedDefaultTierId: {
      type: String,
      enum: ['minimum', 'normal', 'optimal'],
      default: DEFAULT_CAMPAIGN_DELAYS.protectedDefaultTierId,
    },
    riskDelaysSec: {
      type: [Number],
      default: () => [...DEFAULT_CAMPAIGN_DELAYS.riskDelaysSec],
      validate: {
        validator: (v: number[]) => Array.isArray(v) && v.length === 3,
        message: 'riskDelaysSec deve ter 3 valores',
      },
    },
    riskMinSec: { type: Number, default: DEFAULT_CAMPAIGN_DELAYS.riskMinSec, min: 1, max: 29 },
  },
  { _id: false },
);

const SystemWhatsAppPolicySchema = new Schema<ISystemWhatsAppPolicy>(
  {
    policyKey: { type: String, required: true, unique: true, default: 'global', index: true },
    humanizeEnabled: { type: Boolean, default: DEFAULT_SYSTEM_WHATSAPP_POLICY.humanizeEnabled },
    composingEnabled: { type: Boolean, default: DEFAULT_SYSTEM_WHATSAPP_POLICY.composingEnabled },
    defaults: {
      conversation: {
        type: KindLimitSchema,
        default: () => ({ ...DEFAULT_SYSTEM_WHATSAPP_POLICY.defaults.conversation }),
      },
      marketing: {
        type: KindLimitSchema,
        default: () => ({ ...DEFAULT_SYSTEM_WHATSAPP_POLICY.defaults.marketing }),
      },
      alert: {
        type: KindLimitSchema,
        default: () => ({ ...DEFAULT_SYSTEM_WHATSAPP_POLICY.defaults.alert }),
      },
    },
    caps: {
      conversation: {
        type: Number,
        default: DEFAULT_SYSTEM_WHATSAPP_POLICY.caps.conversation,
        min: 1,
        max: 200,
      },
      marketing: {
        type: Number,
        default: DEFAULT_SYSTEM_WHATSAPP_POLICY.caps.marketing,
        min: 1,
        max: 200,
      },
      alert: {
        type: Number,
        default: DEFAULT_SYSTEM_WHATSAPP_POLICY.caps.alert,
        min: 1,
        max: 200,
      },
    },
    campaignDelays: {
      type: CampaignDelaysSchema,
      default: () => ({
        protectedTiers: DEFAULT_CAMPAIGN_DELAYS.protectedTiers.map(t => ({ ...t })),
        protectedDefaultTierId: DEFAULT_CAMPAIGN_DELAYS.protectedDefaultTierId,
        riskDelaysSec: [...DEFAULT_CAMPAIGN_DELAYS.riskDelaysSec],
        riskMinSec: DEFAULT_CAMPAIGN_DELAYS.riskMinSec,
      }),
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: 'systemWhatsAppPolicy',
  },
);

export const SystemWhatsAppPolicy = mongoose.model<ISystemWhatsAppPolicy>(
  'SystemWhatsAppPolicy',
  SystemWhatsAppPolicySchema,
);

export async function getOrCreateSystemWhatsAppPolicy(): Promise<ISystemWhatsAppPolicy> {
  let doc = await SystemWhatsAppPolicy.findOne({ policyKey: 'global' });
  if (!doc) {
    doc = await SystemWhatsAppPolicy.create({
      policyKey: 'global',
      ...DEFAULT_SYSTEM_WHATSAPP_POLICY,
    });
  }
  return doc;
}
