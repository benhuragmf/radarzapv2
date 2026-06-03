import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('WhatsAppSessionModel');

/**
 * WhatsApp Session interface
 */
export interface IWhatsAppSession extends Document {
  clientId: mongoose.Types.ObjectId;
  type: 'web' | 'business';
  sessionData: string; // encrypted
  status: 'active' | 'inactive' | 'expired';
  deviceInfo: {
    platform: string;
    browser: string;
    version: string;
  };
  whatsappProfile?: {
    wuid?: string;
    profileName?: string;
    phoneNumber?: string;
    profilePictureUrl?: string;
  };
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
  
  // Instance methods
  encrypt(data: string): string;
  decrypt(): string;
  isExpired(): boolean;
  updateActivity(): Promise<void>;
  markAsExpired(): Promise<void>;
  renewSession(newExpiryHours?: number): Promise<void>;
}

/**
 * WhatsApp Session schema
 */
const WhatsAppSessionSchema = new Schema<IWhatsAppSession>({
  clientId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Client ID is required'],
    ref: 'User',
    index: true
  },
  
  type: {
    type: String,
    enum: {
      values: ['web', 'business'],
      message: 'Type must be either web or business'
    },
    required: [true, 'Session type is required'],
    index: true
  },
  
  sessionData: {
    type: String,
    required: [true, 'Session data is required'],
    validate: {
      validator: function(v: string) {
        // Ensure session data is encrypted (contains encrypted markers)
        return v.includes(':') && v.length > 32;
      },
      message: 'Session data must be encrypted'
    }
  },
  
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive', 'expired'],
      message: 'Status must be active, inactive, or expired'
    },
    default: 'inactive',
    index: true
  },
  
  deviceInfo: {
    platform: {
      type: String,
      required: true,
      default: 'unknown'
    },
    browser: {
      type: String,
      required: true,
      default: 'unknown'
    },
    version: {
      type: String,
      required: true,
      default: '1.0.0'
    }
  },

  whatsappProfile: {
    wuid: { type: String },
    profileName: { type: String },
    phoneNumber: { type: String },
    profilePictureUrl: { type: String },
  },
  
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  expiresAt: {
    type: Date,
    required: true,
    index: true,
    default: function() {
      // Default expiry: 24 hours from creation
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  }
}, {
  timestamps: true,
  collection: 'whatsappSessions'
});

/**
 * Encryption key for session data
 */
const ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || 'default-key-change-in-production-32-chars';
const ALGORITHM = 'aes-256-cbc';

function sessionCryptoKey(): Buffer {
  return crypto.scryptSync(ENCRYPTION_KEY, 'radarzap-wa-session-v1', 32);
}

/**
 * Instance Methods
 */
WhatsAppSessionSchema.methods.encrypt = function(this: IWhatsAppSession, data: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, sessionCryptoKey(), iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt session data');
  }
};

WhatsAppSessionSchema.methods.decrypt = function(this: IWhatsAppSession): string {
  try {
    const parts = this.sessionData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, sessionCryptoKey(), iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt session data');
  }
};

WhatsAppSessionSchema.methods.isExpired = function(this: IWhatsAppSession): boolean {
  return new Date() > this.expiresAt || this.status === 'expired';
};

WhatsAppSessionSchema.methods.updateActivity = async function(this: IWhatsAppSession): Promise<void> {
  this.lastActivity = new Date();
  
  // If session was inactive, mark as active
  if (this.status === 'inactive') {
    this.status = 'active';
  }
  
  await this.save();
  
  logger.debug('Session activity updated', {
    sessionId: this._id,
    clientId: this.clientId,
    status: this.status
  });
};

WhatsAppSessionSchema.methods.markAsExpired = async function(this: IWhatsAppSession): Promise<void> {
  this.status = 'expired';
  this.expiresAt = new Date(); // Set to current time
  await this.save();
  
  logger.info('Session marked as expired', {
    sessionId: this._id,
    clientId: this.clientId
  });
};

WhatsAppSessionSchema.methods.renewSession = async function(this: IWhatsAppSession, newExpiryHours: number = 24): Promise<void> {
  this.expiresAt = new Date(Date.now() + newExpiryHours * 60 * 60 * 1000);
  this.status = 'active';
  this.lastActivity = new Date();
  
  await this.save();
  
  logger.info('Session renewed', {
    sessionId: this._id,
    clientId: this.clientId,
    newExpiryAt: this.expiresAt
  });
};

/**
 * Static Methods
 */
WhatsAppSessionSchema.statics.findActiveByClientId = function(clientId: mongoose.Types.ObjectId) {
  return this.findOne({
    clientId,
    status: 'active',
    expiresAt: { $gt: new Date() }
  });
};

WhatsAppSessionSchema.statics.createSession = async function(
  clientId: mongoose.Types.ObjectId,
  type: 'web' | 'business',
  sessionData: string,
  deviceInfo: any
) {
  // Encrypt session data
  const tempSession = new this();
  const encryptedData = tempSession.encrypt(sessionData);
  
  // Create new session
  const session = new this({
    clientId,
    type,
    sessionData: encryptedData,
    deviceInfo,
    status: 'active',
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  });
  
  await session.save();
  
  logger.info('New session created', {
    sessionId: session._id,
    clientId,
    type,
    deviceInfo
  });
  
  return session;
};

WhatsAppSessionSchema.statics.cleanupExpiredSessions = async function() {
  const result = await this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { status: 'expired' }
    ]
  });
  
  logger.info('Expired sessions cleaned up', {
    deletedCount: result.deletedCount
  });
  
  return result.deletedCount;
};

WhatsAppSessionSchema.statics.getSessionStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: {
          status: '$status',
          type: '$type'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.type',
        statuses: {
          $push: {
            status: '$_id.status',
            count: '$count'
          }
        },
        total: { $sum: '$count' }
      }
    }
  ]);
  
  return stats;
};

/**
 * Middleware
 */
WhatsAppSessionSchema.pre('save', function(this: IWhatsAppSession, next) {
  // Auto-expire if past expiry date
  if (new Date() > this.expiresAt && this.status !== 'expired') {
    this.status = 'expired';
    logger.info('Session auto-expired on save', {
      sessionId: this._id,
      clientId: this.clientId
    });
  }
  
  next();
});

WhatsAppSessionSchema.post('save', function(this: IWhatsAppSession) {
  logger.debug('Session saved', {
    sessionId: this._id,
    clientId: this.clientId,
    status: this.status,
    type: this.type
  });
});

/**
 * Indexes
 */
WhatsAppSessionSchema.index({ clientId: 1, status: 1 });
WhatsAppSessionSchema.index({ type: 1, status: 1 });

// TTL index for automatic cleanup of expired sessions
WhatsAppSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Model interface for static methods
 */
interface IWhatsAppSessionModel extends Model<IWhatsAppSession> {
  findActiveByClientId(clientId: mongoose.Types.ObjectId): Promise<IWhatsAppSession | null>;
  createSession(
    clientId: mongoose.Types.ObjectId,
    type: 'web' | 'business',
    sessionData: string,
    deviceInfo: any
  ): Promise<IWhatsAppSession>;
  cleanupExpiredSessions(): Promise<number>;
  getSessionStats(): Promise<any[]>;
}

/**
 * Export the WhatsAppSession model
 */
export const WhatsAppSession = mongoose.model<IWhatsAppSession, IWhatsAppSessionModel>('WhatsAppSession', WhatsAppSessionSchema);