import mongoose, { Schema, Document, Model } from 'mongoose';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('RuleModel');

export interface IRuleConditions {
  channelIds?: string[];
  guildIds?: string[];
  authorIds?: string[];
  onlyBots?: boolean;
  onlyUsers?: boolean;
  requireKeywords?: string[];
  excludeKeywords?: string[];
  requireLink?: boolean;
  requireImage?: boolean;
  requireEmbed?: boolean;
}

export interface IRuleAction {
  destinationIds: mongoose.Types.ObjectId[];
  templateName: string;
  priority: 'high' | 'medium' | 'low';
  addDelay?: number;
}

export interface IRule extends Document {
  clientId: mongoose.Types.ObjectId;
  name: string;
  isActive: boolean;
  conditions: IRuleConditions;
  action: IRuleAction;
  matchCount: number;
  createdAt: Date;
  updatedAt: Date;

  toggle(): Promise<IRule>;
  incrementMatchCount(): Promise<void>;
}

const RuleSchema = new Schema<IRule>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },

    name: {
      type: String,
      required: [true, 'Rule name is required'],
      trim: true,
      maxlength: [100, 'Rule name cannot exceed 100 characters'],
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    conditions: {
      channelIds: { type: [String], default: [] },
      guildIds: { type: [String], default: [] },
      authorIds: { type: [String], default: [] },
      onlyBots: { type: Boolean, default: false },
      onlyUsers: { type: Boolean, default: false },
      requireKeywords: { type: [String], default: [] },
      excludeKeywords: { type: [String], default: [] },
      requireLink: { type: Boolean, default: false },
      requireImage: { type: Boolean, default: false },
      requireEmbed: { type: Boolean, default: false },
    },

    action: {
      destinationIds: {
        type: [Schema.Types.ObjectId],
        required: true,
        ref: 'Destination',
      },
      templateName: {
        type: String,
        required: true,
        default: 'radarzap-padrao',
      },
      priority: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'medium',
      },
      addDelay: {
        type: Number,
        min: 0,
        default: 0,
      },
    },

    matchCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'rules',
  }
);

// Instance methods
RuleSchema.methods.toggle = async function (this: IRule): Promise<IRule> {
  this.isActive = !this.isActive;
  await this.save();
  logger.info('Rule toggled', { ruleId: this._id, name: this.name, isActive: this.isActive });
  return this;
};

RuleSchema.methods.incrementMatchCount = async function (this: IRule): Promise<void> {
  this.matchCount += 1;
  await this.save();
};

// Static methods
RuleSchema.statics.findByClientId = function (clientId: mongoose.Types.ObjectId) {
  return this.find({ clientId }).sort({ createdAt: -1 });
};

RuleSchema.statics.findActiveByClientId = function (clientId: mongoose.Types.ObjectId) {
  return this.find({ clientId, isActive: true }).sort({ createdAt: -1 });
};

// Indexes
RuleSchema.index({ clientId: 1, isActive: 1 });

interface IRuleModel extends Model<IRule> {
  findByClientId(clientId: mongoose.Types.ObjectId): Promise<IRule[]>;
  findActiveByClientId(clientId: mongoose.Types.ObjectId): Promise<IRule[]>;
}

export const Rule = mongoose.model<IRule, IRuleModel>('Rule', RuleSchema);
