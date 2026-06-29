import mongoose, { Schema, Document, Model } from 'mongoose';
import { DEFAULT_INBOX_DEPARTMENTS } from '@/constants/inbox-triage';
import { INBOX_INTERNAL_RANK_MIN } from '@/types/inbox-department';

export type InboxDepartmentBridgeHoursMode = 'always' | 'business_hours' | 'never';

export interface InboxDepartmentMemberConfigDoc {
  userId: mongoose.Types.ObjectId;
  whatsappBridgeEnabled: boolean;
  bridgeHoursMode: InboxDepartmentBridgeHoursMode;
}

export interface IInboxDepartment extends Document {
  clientId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  /** Tecla do menu fixo (1–4) ou código interno (i1, i2…) — só setores visíveis usam o menu WhatsApp */
  menuKey: string;
  /** false = setor interno: não aparece no menu do cliente; só equipe transfere/atende */
  clientVisible: boolean;
  /** 0 = público. Internos: 2 = 2ª instância, 3 = 3ª instância… */
  internalRank: number;
  memberUserIds: mongoose.Types.ObjectId[];
  /** Bridge WhatsApp por atendente (alertas !assumir) — só para IDs em memberUserIds */
  memberConfigs: InboxDepartmentMemberConfigDoc[];
  isActive: boolean;
  sortOrder: number;
  /** Índice do último atendente no round-robin deste setor */
  lastRoundRobinIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const InboxDepartmentSchema = new Schema<IInboxDepartment>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, maxlength: 80 },
    description: { type: String, maxlength: 300 },
    menuKey: { type: String, required: true, maxlength: 8 },
    clientVisible: { type: Boolean, default: true, index: true },
    internalRank: { type: Number, default: 0, min: 0, max: 9, index: true },
    memberUserIds: { type: [Schema.Types.ObjectId], default: [] },
    memberConfigs: {
      type: [
        {
          userId: { type: Schema.Types.ObjectId, required: true },
          whatsappBridgeEnabled: { type: Boolean, default: true },
          bridgeHoursMode: {
            type: String,
            enum: ['always', 'business_hours', 'never'],
            default: 'always',
          },
        },
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    lastRoundRobinIndex: { type: Number, default: -1 },
  },
  { timestamps: true, collection: 'inboxDepartments' },
);

InboxDepartmentSchema.index({ clientId: 1, menuKey: 1 }, { unique: true });
InboxDepartmentSchema.index({ clientId: 1, name: 1 });

interface IInboxDepartmentModel extends Model<IInboxDepartment> {
  ensureDefaults(clientId: mongoose.Types.ObjectId): Promise<IInboxDepartment[]>;
}

InboxDepartmentSchema.statics.ensureDefaults = async function ensureDefaults(
  clientId: mongoose.Types.ObjectId,
) {
  const existing = await this.find({ clientId, isActive: true }).sort({ sortOrder: 1 });
  if (existing.length > 0) return existing;

  const docs = await this.insertMany(
    DEFAULT_INBOX_DEPARTMENTS.map(d => ({
      clientId,
      name: d.name,
      description: d.description,
      menuKey: d.menuKey,
      sortOrder: d.sortOrder,
      isActive: true,
      clientVisible: true,
      internalRank: 0,
      memberUserIds: [],
    })),
  );
  return docs;
};

export const InboxDepartment = mongoose.model<IInboxDepartment, IInboxDepartmentModel>(
  'InboxDepartment',
  InboxDepartmentSchema,
);
