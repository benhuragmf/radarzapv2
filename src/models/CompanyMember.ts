import mongoose, { Schema, Document, Model } from 'mongoose';
import { CompanyRole } from '@/auth/rbac/roles';
import type { Capability } from '@/auth/rbac/capabilities';

export interface ICompanyMember extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  email?: string;
  companyRole: CompanyRole;
  /** Papel personalizado da org (quando companyRole = CUSTOM) */
  customRoleId?: string;
  /** WhatsApp pessoal para encaminhamentos internos de tickets */
  whatsappPhone?: string;
  /** Permissões extras além do papel base */
  extraCapabilities?: Capability[];
  /** Permissões revogadas em relação ao papel base */
  deniedCapabilities?: Capability[];
  invitedByUserId?: mongoose.Types.ObjectId;
  inviteEmailSentAt?: Date;
  inviteEmailLastError?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyMemberSchema = new Schema<ICompanyMember>({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    sparse: true,
    index: true,
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true,
    index: true,
  },
  companyRole: {
    type: String,
    enum: Object.values(CompanyRole),
    required: true,
    index: true,
  },
  customRoleId: { type: String, trim: true, index: true, sparse: true },
  whatsappPhone: { type: String, maxlength: 32, trim: true },
  extraCapabilities: { type: [String], default: [] },
  deniedCapabilities: { type: [String], default: [] },
  invitedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  inviteEmailSentAt: { type: Date },
  inviteEmailLastError: { type: String, maxlength: 240 },
  isActive: { type: Boolean, default: true, index: true },
}, {
  timestamps: true,
  collection: 'companyMembers',
});

// Só exige unicidade quando userId já foi vinculado — vários convites pendentes (sem userId) por org.
CompanyMemberSchema.index(
  { organizationId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $type: 'objectId' } },
  },
);
CompanyMemberSchema.index({ organizationId: 1, email: 1 }, { unique: true, sparse: true });

/** Troca índice legado (sparse + userId null) pelo partialFilterExpression acima. */
export async function syncCompanyMemberIndexes(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;
  const col = CompanyMember.collection;
  try {
    await col.dropIndex('organizationId_1_userId_1');
  } catch {
    // índice antigo pode não existir
  }
  await CompanyMember.syncIndexes();
}

interface ICompanyMemberModel extends Model<ICompanyMember> {
  findActiveByUserId(userId: mongoose.Types.ObjectId | string): Promise<ICompanyMember | null>;
  findByOrg(orgId: mongoose.Types.ObjectId | string): Promise<ICompanyMember[]>;
}

CompanyMemberSchema.statics.findActiveByUserId = function(userId: mongoose.Types.ObjectId | string) {
  return this.findOne({ userId, isActive: true });
};

CompanyMemberSchema.statics.findByOrg = function(orgId: mongoose.Types.ObjectId | string) {
  return this.find({ organizationId: orgId, isActive: true }).sort({ companyRole: 1, createdAt: 1 });
};

export const CompanyMember = mongoose.model<ICompanyMember, ICompanyMemberModel>(
  'CompanyMember',
  CompanyMemberSchema,
);
