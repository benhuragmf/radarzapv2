import mongoose, { Schema, Document, Model } from 'mongoose';
import { GuildRole } from '@/auth/rbac/roles';

export interface IGuildMembership extends Document {
  userId: mongoose.Types.ObjectId;
  discordUserId: string;
  discordGuildId: string;
  guildName?: string;
  roleInGuild: GuildRole;
  permissions: string[];
  apiAccessEnabled: boolean;
  lastCheckedAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GuildMembershipSchema = new Schema<IGuildMembership>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  discordUserId: {
    type: String,
    required: true,
    index: true,
  },
  discordGuildId: {
    type: String,
    required: true,
    index: true,
  },
  guildName: { type: String },
  roleInGuild: {
    type: String,
    enum: Object.values(GuildRole),
    default: GuildRole.MEMBER,
    index: true,
  },
  permissions: { type: [String], default: [] },
  apiAccessEnabled: { type: Boolean, default: false },
  lastCheckedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true, index: true },
}, {
  timestamps: true,
  collection: 'guildMemberships',
});

GuildMembershipSchema.index({ userId: 1, discordGuildId: 1 }, { unique: true });
GuildMembershipSchema.index({ discordGuildId: 1, roleInGuild: 1 });

interface IGuildMembershipModel extends Model<IGuildMembership> {
  findActiveByUserId(userId: mongoose.Types.ObjectId | string): Promise<IGuildMembership[]>;
  findActiveByGuildId(guildId: string): Promise<IGuildMembership[]>;
}

GuildMembershipSchema.statics.findActiveByUserId = function(userId: mongoose.Types.ObjectId | string) {
  return this.find({ userId, isActive: true, roleInGuild: { $ne: GuildRole.MEMBER } });
};

GuildMembershipSchema.statics.findActiveByGuildId = function(guildId: string) {
  return this.find({ discordGuildId: guildId, isActive: true });
};

export const GuildMembership = mongoose.model<IGuildMembership, IGuildMembershipModel>(
  'GuildMembership',
  GuildMembershipSchema,
);
