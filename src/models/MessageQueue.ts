import mongoose, { Schema, Document, Model } from 'mongoose';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('MessageQueueModel');

/**
 * Message Queue interface
 */
export interface IMessageQueue extends Document {
  clientId: mongoose.Types.ObjectId;
  content: {
    text: string;
    image?: string;
    template: string;
    variables: Record<string, any>;
  };
  destinations: Array<{
    type: 'group' | 'contact';
    identifier: string;
    name: string;
  }>;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  priority: number;
  scheduledFor: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: Date;
  processedAt?: Date;
  
  // Instance methods
  markAsProcessing(): Promise<void>;
  markAsSent(): Promise<void>;
  markAsFailed(error: string): Promise<void>;
  incrementAttempt(): Promise<void>;
  canRetry(): boolean;
  scheduleRetry(delayMs: number): Promise<void>;
  isExpired(): boolean;
}

/**
 * Message Queue schema
 */
const MessageQueueSchema = new Schema<IMessageQueue>({
  clientId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Client ID is required'],
    ref: 'User',
    index: true
  },
  
  content: {
    text: {
      type: String,
      required: [true, 'Message text is required'],
      maxlength: [4096, 'Message text cannot exceed 4096 characters']
    },
    
    image: {
      type: String,
      validate: {
        validator: function(v: string) {
          if (!v) return true;
          // Validate URL or base64 format
          return /^(https?:\/\/|data:image\/)/.test(v);
        },
        message: 'Image must be a valid URL or base64 data'
      }
    },
    
    template: {
      type: String,
      required: [true, 'Template name is required'],
      maxlength: [100, 'Template name cannot exceed 100 characters']
    },
    
    variables: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  
  destinations: [{
    type: {
      type: String,
      enum: {
        values: ['group', 'contact'],
        message: 'Destination type must be group or contact'
      },
      required: true
    },
    
    identifier: {
      type: String,
      required: [true, 'Destination identifier is required'],
      validate: {
        validator: function(v: string) {
          // Basic validation for phone numbers or group IDs
          return /^[\w\-@.+]+$/.test(v);
        },
        message: 'Invalid destination identifier format'
      }
    },
    
    name: {
      type: String,
      required: [true, 'Destination name is required'],
      maxlength: [100, 'Destination name cannot exceed 100 characters']
    }
  }],
  
  status: {
    type: String,
    enum: {
      values: ['pending', 'processing', 'sent', 'failed'],
      message: 'Status must be pending, processing, sent, or failed'
    },
    default: 'pending',
    index: true
  },
  
  priority: {
    type: Number,
    min: [0, 'Priority cannot be negative'],
    max: [10, 'Priority cannot exceed 10'],
    default: 5,
    index: true
  },
  
  scheduledFor: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  attempts: {
    type: Number,
    min: [0, 'Attempts cannot be negative'],
    default: 0
  },
  
  maxAttempts: {
    type: Number,
    min: [1, 'Max attempts must be at least 1'],
    default: 3
  },
  
  lastError: {
    type: String,
    maxlength: [1000, 'Error message cannot exceed 1000 characters']
  },
  
  processedAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  collection: 'messageQueue'
});

/**
 * Instance Methods
 */
MessageQueueSchema.methods.markAsProcessing = async function(this: IMessageQueue): Promise<void> {
  this.status = 'processing';
  await this.save();
  
  logger.info('Message marked as processing', {
    messageId: this._id,
    clientId: this.clientId,
    destinations: this.destinations.length
  });
};

MessageQueueSchema.methods.markAsSent = async function(this: IMessageQueue): Promise<void> {
  this.status = 'sent';
  this.processedAt = new Date();
  await this.save();
  
  logger.info('Message marked as sent', {
    messageId: this._id,
    clientId: this.clientId,
    destinations: this.destinations.length,
    attempts: this.attempts
  });
};

MessageQueueSchema.methods.markAsFailed = async function(this: IMessageQueue, error: string): Promise<void> {
  this.status = 'failed';
  this.lastError = error.substring(0, 1000); // Truncate if too long
  this.processedAt = new Date();
  await this.save();
  
  logger.error('Message marked as failed', {
    messageId: this._id,
    clientId: this.clientId,
    error: this.lastError,
    attempts: this.attempts
  });
};

MessageQueueSchema.methods.incrementAttempt = async function(this: IMessageQueue): Promise<void> {
  this.attempts += 1;
  await this.save();
  
  logger.debug('Message attempt incremented', {
    messageId: this._id,
    attempts: this.attempts,
    maxAttempts: this.maxAttempts
  });
};

MessageQueueSchema.methods.canRetry = function(this: IMessageQueue): boolean {
  return this.attempts < this.maxAttempts && this.status === 'failed';
};

MessageQueueSchema.methods.scheduleRetry = async function(this: IMessageQueue, delayMs: number): Promise<void> {
  if (!this.canRetry()) {
    throw new Error('Message cannot be retried');
  }
  
  this.status = 'pending';
  this.scheduledFor = new Date(Date.now() + delayMs);
  this.lastError = undefined;
  await this.save();
  
  logger.info('Message scheduled for retry', {
    messageId: this._id,
    scheduledFor: this.scheduledFor,
    attempt: this.attempts + 1,
    maxAttempts: this.maxAttempts
  });
};

MessageQueueSchema.methods.isExpired = function(this: IMessageQueue): boolean {
  // Messages expire after 24 hours
  const expiryTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  return Date.now() - this.createdAt.getTime() > expiryTime;
};

/**
 * Static Methods
 */
MessageQueueSchema.statics.findPendingMessages = function(limit: number = 10) {
  return this.find({
    status: 'pending',
    scheduledFor: { $lte: new Date() }
  })
  .sort({ priority: -1, scheduledFor: 1 })
  .limit(limit);
};

MessageQueueSchema.statics.findByClientId = function(clientId: mongoose.Types.ObjectId, status?: string) {
  const query: any = { clientId };
  if (status) {
    query.status = status;
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

MessageQueueSchema.statics.createMessage = async function(
  clientId: mongoose.Types.ObjectId,
  content: any,
  destinations: any[],
  priority: number = 5,
  scheduledFor?: Date
) {
  const message = new this({
    clientId,
    content,
    destinations,
    priority,
    scheduledFor: scheduledFor || new Date(),
    status: 'pending',
    attempts: 0,
    maxAttempts: 3
  });
  
  await message.save();
  
  logger.info('New message created', {
    messageId: message._id,
    clientId,
    destinations: destinations.length,
    priority,
    scheduledFor: message.scheduledFor
  });
  
  return message;
};

MessageQueueSchema.statics.getQueueStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgPriority: { $avg: '$priority' },
        avgAttempts: { $avg: '$attempts' }
      }
    }
  ]);
  
  // Get additional stats
  const totalMessages = await this.countDocuments();
  const oldestPending = await this.findOne(
    { status: 'pending' },
    {},
    { sort: { createdAt: 1 } }
  );
  
  return {
    byStatus: stats,
    totalMessages,
    oldestPendingAge: oldestPending ? Date.now() - oldestPending.createdAt.getTime() : 0
  };
};

MessageQueueSchema.statics.cleanupOldMessages = async function(daysOld: number = 7) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const result = await this.deleteMany({
    status: { $in: ['sent', 'failed'] },
    processedAt: { $lt: cutoffDate }
  });
  
  logger.info('Old messages cleaned up', {
    deletedCount: result.deletedCount,
    cutoffDate
  });
  
  return result.deletedCount;
};

MessageQueueSchema.statics.findFailedMessages = function() {
  return this.find({
    status: 'failed',
    attempts: { $gte: '$maxAttempts' }
  }).sort({ createdAt: -1 });
};

MessageQueueSchema.statics.requeueFailedMessages = async function() {
  const failedMessages = await this.find({
    status: 'failed',
    attempts: { $lt: '$maxAttempts' }
  });
  
  let requeuedCount = 0;
  
  for (const message of failedMessages) {
    if (message.canRetry() && !message.isExpired()) {
      // Calculate exponential backoff delay
      const baseDelay = 60000; // 1 minute
      const delay = baseDelay * Math.pow(2, message.attempts);
      
      await message.scheduleRetry(delay);
      requeuedCount++;
    }
  }
  
  logger.info('Failed messages requeued', {
    requeuedCount,
    totalFailed: failedMessages.length
  });
  
  return requeuedCount;
};

/**
 * Middleware
 */
MessageQueueSchema.pre('save', function(this: IMessageQueue, next) {
  // Validate destinations array is not empty
  if (!this.destinations || this.destinations.length === 0) {
    return next(new Error('At least one destination is required'));
  }
  
  // Ensure scheduledFor is not in the past (unless it's a retry)
  if (this.isNew && this.scheduledFor < new Date()) {
    this.scheduledFor = new Date();
  }
  
  next();
});

MessageQueueSchema.post('save', function(this: IMessageQueue) {
  logger.debug('Message queue item saved', {
    messageId: this._id,
    status: this.status,
    priority: this.priority,
    attempts: this.attempts,
    destinationsCount: this.destinations.length
  });
});

/**
 * Indexes
 */
MessageQueueSchema.index({ clientId: 1, status: 1 });
MessageQueueSchema.index({ status: 1, priority: -1, scheduledFor: 1 });
MessageQueueSchema.index({ createdAt: 1 });

// Compound index for queue processing
MessageQueueSchema.index({ 
  status: 1, 
  scheduledFor: 1, 
  priority: -1 
}, { name: 'queue_processing_idx' });

/**
 * Model interface for static methods
 */
interface IMessageQueueModel extends Model<IMessageQueue> {
  findPendingMessages(limit?: number): Promise<IMessageQueue[]>;
  findByClientId(clientId: mongoose.Types.ObjectId, status?: string): Promise<IMessageQueue[]>;
  createMessage(
    clientId: mongoose.Types.ObjectId,
    content: any,
    destinations: any[],
    priority?: number,
    scheduledFor?: Date
  ): Promise<IMessageQueue>;
  getQueueStats(): Promise<any>;
  cleanupOldMessages(daysOld?: number): Promise<number>;
  findFailedMessages(): Promise<IMessageQueue[]>;
  requeueFailedMessages(): Promise<number>;
}

/**
 * Export the MessageQueue model
 */
export const MessageQueue = mongoose.model<IMessageQueue, IMessageQueueModel>('MessageQueue', MessageQueueSchema);