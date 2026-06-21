import mongoose, { Schema, Document } from 'mongoose';
import {
  DEFAULT_SYSTEM_WHATSAPP_POLICY,
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
