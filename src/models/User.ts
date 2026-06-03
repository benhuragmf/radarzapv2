import mongoose, { Schema, Document, Model } from 'mongoose';
import { createServiceLogger } from '@/utils/logger';
import { SystemRole } from '@/auth/rbac/roles';

const logger = createServiceLogger('UserModel');

/**
 * User interface
 */
export interface IUser extends Document {
  discordUserId?: string;
  googleId?: string;
  email?: string;
  displayName?: string;
  authProviders: ('google' | 'discord')[];
  primaryOrganizationId?: mongoose.Types.ObjectId;
  systemRole: SystemRole;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  limits: {
    messagesPerDay: number;
    groupsMax: number;
    templatesMax: number;
  };
  usage: {
    messagesUsed: number;
    lastReset: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  canSendMessage(): boolean;
  incrementUsage(): Promise<void>;
  resetDailyUsage(): Promise<void>;
  upgradePlan(newPlan: 'free' | 'starter' | 'pro' | 'enterprise'): Promise<void>;
  getUsagePercentage(): number;
}

/**
 * User schema with validation and middleware
 */
const UserSchema = new Schema<IUser>({
  discordUserId: {
    type: String,
    sparse: true,
    unique: true,
    index: true,
    validate: {
      validator: (v: string) => !v || /^\d{17,19}$/.test(v),
      message: 'Invalid Discord User ID format',
    },
  },

  googleId: {
    type: String,
    sparse: true,
    unique: true,
    index: true,
  },

  displayName: { type: String, trim: true, maxlength: 120 },

  authProviders: {
    type: [String],
    enum: ['google', 'discord'],
    default: [],
  },

  primaryOrganizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    index: true,
  },
  
  email: {
    type: String,
    sparse: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: 'Invalid email format'
    }
  },

  systemRole: {
    type: String,
    enum: Object.values(SystemRole),
    default: SystemRole.USER,
    index: true,
  },
  
  plan: {
    type: String,
    enum: {
      values: ['free', 'starter', 'pro', 'enterprise'],
      message: 'Plan must be free, starter, pro, or enterprise'
    },
    default: 'free',
    index: true
  },
  
  limits: {
    messagesPerDay: {
      type: Number,
      required: true,
      default: function(this: IUser) {
        return User.getPlanLimits(this.plan).messagesPerDay;
      }
    },
    groupsMax: {
      type: Number,
      required: true,
      default: function(this: IUser) {
        return User.getPlanLimits(this.plan).groupsMax;
      }
    },
    templatesMax: {
      type: Number,
      required: true,
      default: function(this: IUser) {
        return User.getPlanLimits(this.plan).templatesMax;
      }
    }
  },
  
  usage: {
    messagesUsed: {
      type: Number,
      default: 0,
      min: [0, 'Messages used cannot be negative']
    },
    lastReset: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  collection: 'users'
});

/**
 * Instance Methods
 */
UserSchema.methods.canSendMessage = function(this: IUser): boolean {
  // Check if daily reset is needed
  const now = new Date();
  const lastReset = new Date(this.usage.lastReset);
  const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceReset >= 1) {
    // Reset usage automatically
    this.usage.messagesUsed = 0;
    this.usage.lastReset = now;
    this.save().catch(error => logger.error('Failed to reset usage:', error));
  }
  
  // Unlimited for enterprise or within limits
  return this.limits.messagesPerDay === -1 || this.usage.messagesUsed < this.limits.messagesPerDay;
};

UserSchema.methods.incrementUsage = async function(this: IUser): Promise<void> {
  // Don't increment for unlimited plans
  if (this.limits.messagesPerDay === -1) return;

  this.usage.messagesUsed += 1;
  await this.save();
  
  logger.info('Usage incremented', {
    userId: this._id?.toString(),
    messagesUsed: this.usage.messagesUsed,
    limit: this.limits.messagesPerDay,
  });
};

UserSchema.methods.resetDailyUsage = async function(this: IUser): Promise<void> {
  this.usage.messagesUsed = 0;
  this.usage.lastReset = new Date();
  await this.save();
  
  logger.info('Daily usage reset', { userId: this._id?.toString() });
};

UserSchema.methods.upgradePlan = async function(this: IUser, newPlan: 'free' | 'starter' | 'pro' | 'enterprise'): Promise<void> {
  const oldPlan = this.plan;
  this.plan = newPlan;
  const limits = User.getPlanLimits(newPlan);
  this.limits.messagesPerDay = limits.messagesPerDay;
  this.limits.groupsMax      = limits.groupsMax;
  this.limits.templatesMax   = limits.templatesMax;
  await this.save();
  logger.info('Plan upgraded', { userId: this._id?.toString(), oldPlan, newPlan, newLimits: this.limits });
};

UserSchema.methods.getUsagePercentage = function(this: IUser): number {
  if (this.limits.messagesPerDay === -1) return 0; // Unlimited
  return Math.round((this.usage.messagesUsed / this.limits.messagesPerDay) * 100);
};

/**
 * Static Methods
 */
UserSchema.statics.getPlanLimits = function(plan: string) {
  switch (plan) {
    case 'free':       return { messagesPerDay: 10,  groupsMax: 2,  templatesMax: 2  };
    case 'starter':    return { messagesPerDay: 100, groupsMax: 5,  templatesMax: 5  };
    case 'pro':        return { messagesPerDay: 500, groupsMax: 15, templatesMax: 10 };
    case 'enterprise': return { messagesPerDay: -1,  groupsMax: -1, templatesMax: -1 };
    default:           return { messagesPerDay: 10,  groupsMax: 2,  templatesMax: 2  };
  }
};

UserSchema.statics.findByDiscordId = function(discordUserId: string) {
  return this.findOne({ discordUserId });
};

UserSchema.statics.createUser = async function(discordUserId: string, email?: string) {
  const user = new this({
    discordUserId,
    email,
    authProviders: ['discord'],
    plan: 'free',
  });
  
  await user.save();
  
  logger.info('New user created', {
    userId: discordUserId,
    email,
    plan: 'free'
  });
  
  return user;
};

UserSchema.statics.getUserStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$plan',
        count: { $sum: 1 },
        totalMessages: { $sum: '$usage.messagesUsed' }
      }
    }
  ]);
  
  return stats;
};

/**
 * Middleware
 */
UserSchema.pre('validate', function(this: IUser, next) {
  if (!this.discordUserId && !this.googleId) {
    next(new Error('User must have googleId or discordUserId'));
    return;
  }
  next();
});

UserSchema.pre('save', function(this: IUser, next) {
  if (this.isModified('plan')) {
    const limits = User.getPlanLimits(this.plan);
    this.limits.messagesPerDay = limits.messagesPerDay;
    this.limits.groupsMax      = limits.groupsMax;
    this.limits.templatesMax   = limits.templatesMax;
  }
  next();
});

UserSchema.post('save', function(this: IUser) {
  logger.debug('User saved', {
    userId: this._id?.toString(),
    plan: this.plan,
    usage: this.usage,
  });
});

/**
 * Indexes
 */
UserSchema.index({ createdAt: 1 });
UserSchema.index({ 'usage.lastReset': 1 });

/**
 * Model interface for static methods
 */
interface IUserModel extends Model<IUser> {
  findByDiscordId(discordUserId: string): Promise<IUser | null>;
  createUser(discordUserId: string, email?: string): Promise<IUser>;
  getUserStats(): Promise<Array<{ _id: string; count: number; totalMessages: number }>>;
  getPlanLimits(plan: string): { messagesPerDay: number; groupsMax: number; templatesMax: number };
}

/**
 * Export the User model
 */
export const User = mongoose.model<IUser, IUserModel>('User', UserSchema);