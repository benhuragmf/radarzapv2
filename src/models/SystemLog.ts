import mongoose, { Schema, Document, Model } from 'mongoose';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('SystemLogModel');

/**
 * System Log interface
 */
export interface ISystemLog extends Document {
  level: 'info' | 'warn' | 'error' | 'debug';
  service: string;
  clientId?: mongoose.Types.ObjectId;
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
  traceId: string;
  
  // Instance methods
  isError(): boolean;
  isWarning(): boolean;
  getAge(): number;
}

/**
 * System Log schema
 */
const SystemLogSchema = new Schema<ISystemLog>({
  level: {
    type: String,
    enum: {
      values: ['info', 'warn', 'error', 'debug'],
      message: 'Level must be info, warn, error, or debug'
    },
    required: [true, 'Log level is required'],
    index: true
  },
  
  service: {
    type: String,
    required: [true, 'Service name is required'],
    maxlength: [100, 'Service name cannot exceed 100 characters'],
    index: true
  },
  
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    sparse: true // Allow null values and don't index them
  },
  
  message: {
    type: String,
    required: [true, 'Log message is required'],
    maxlength: [1000, 'Log message cannot exceed 1000 characters']
  },
  
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
  },
  
  traceId: {
    type: String,
    required: [true, 'Trace ID is required'],
    maxlength: [100, 'Trace ID cannot exceed 100 characters'],
    index: true
  }
}, {
  collection: 'systemLogs',
  // Disable automatic timestamps since we have our own timestamp field
  timestamps: false
});

/**
 * Instance Methods
 */
SystemLogSchema.methods.isError = function(this: ISystemLog): boolean {
  return this.level === 'error';
};

SystemLogSchema.methods.isWarning = function(this: ISystemLog): boolean {
  return this.level === 'warn';
};

SystemLogSchema.methods.getAge = function(this: ISystemLog): number {
  return Date.now() - this.timestamp.getTime();
};

/**
 * Static Methods
 */
SystemLogSchema.statics.createLog = async function(
  level: 'info' | 'warn' | 'error' | 'debug',
  service: string,
  message: string,
  metadata: Record<string, any> = {},
  clientId?: mongoose.Types.ObjectId,
  traceId?: string
) {
  const log = new this({
    level,
    service,
    message,
    metadata,
    clientId,
    traceId: traceId || require('crypto').randomUUID(),
    timestamp: new Date()
  });
  
  // Don't await save to avoid blocking the main thread
  log.save().catch(error => {
    console.error('Failed to save system log:', error);
  });
  
  return log;
};

SystemLogSchema.statics.generateTraceId = function(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

SystemLogSchema.statics.findByService = function(service: string, limit: number = 100) {
  return this.find({ service })
    .sort({ timestamp: -1 })
    .limit(limit);
};

SystemLogSchema.statics.findByLevel = function(level: 'info' | 'warn' | 'error' | 'debug', limit: number = 100) {
  return this.find({ level })
    .sort({ timestamp: -1 })
    .limit(limit);
};

SystemLogSchema.statics.findByClientId = function(clientId: mongoose.Types.ObjectId, limit: number = 100) {
  return this.find({ clientId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

SystemLogSchema.statics.findByTraceId = function(traceId: string) {
  return this.find({ traceId }).sort({ timestamp: 1 });
};

SystemLogSchema.statics.findErrors = function(since?: Date, limit: number = 100) {
  const query: any = { level: 'error' };
  if (since) {
    query.timestamp = { $gte: since };
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);
};

SystemLogSchema.statics.getLogStats = async function(since?: Date) {
  const matchStage: any = {};
  if (since) {
    matchStage.timestamp = { $gte: since };
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          level: '$level',
          service: '$service'
        },
        count: { $sum: 1 },
        latestTimestamp: { $max: '$timestamp' }
      }
    },
    {
      $group: {
        _id: '$_id.level',
        services: {
          $push: {
            service: '$_id.service',
            count: '$count',
            latestTimestamp: '$latestTimestamp'
          }
        },
        totalCount: { $sum: '$count' }
      }
    }
  ]);
  
  return stats;
};

SystemLogSchema.statics.searchLogs = function(
  query: string,
  service?: string,
  level?: string,
  since?: Date,
  limit: number = 100
) {
  const searchQuery: any = {
    $or: [
      { message: { $regex: query, $options: 'i' } },
      { 'metadata.error': { $regex: query, $options: 'i' } }
    ]
  };
  
  if (service) {
    searchQuery.service = service;
  }
  
  if (level) {
    searchQuery.level = level;
  }
  
  if (since) {
    searchQuery.timestamp = { $gte: since };
  }
  
  return this.find(searchQuery)
    .sort({ timestamp: -1 })
    .limit(limit);
};

SystemLogSchema.statics.getRecentErrors = function(hours: number = 24, limit: number = 50) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.find({
    level: 'error',
    timestamp: { $gte: since }
  })
  .sort({ timestamp: -1 })
  .limit(limit);
};

SystemLogSchema.statics.getServiceHealth = async function(service: string, hours: number = 1) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    {
      $match: {
        service,
        timestamp: { $gte: since }
      }
    },
    {
      $group: {
        _id: '$level',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const total = stats.reduce((sum, stat) => sum + stat.count, 0);
  const errors = stats.find(stat => stat._id === 'error')?.count || 0;
  const warnings = stats.find(stat => stat._id === 'warn')?.count || 0;
  
  return {
    service,
    period: `${hours} hours`,
    totalLogs: total,
    errorCount: errors,
    warningCount: warnings,
    errorRate: total > 0 ? (errors / total) * 100 : 0,
    health: errors === 0 ? 'healthy' : errors < total * 0.1 ? 'degraded' : 'unhealthy'
  };
};

SystemLogSchema.statics.cleanupOldLogs = async function(daysOld: number = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const result = await this.deleteMany({
    timestamp: { $lt: cutoffDate }
  });
  
  logger.info('Old logs cleaned up', {
    deletedCount: result.deletedCount,
    cutoffDate
  });
  
  return result.deletedCount;
};

SystemLogSchema.statics.getTopErrors = async function(hours: number = 24, limit: number = 10) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const topErrors = await this.aggregate([
    {
      $match: {
        level: 'error',
        timestamp: { $gte: since }
      }
    },
    {
      $group: {
        _id: '$message',
        count: { $sum: 1 },
        services: { $addToSet: '$service' },
        latestTimestamp: { $max: '$timestamp' },
        firstTimestamp: { $min: '$timestamp' }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: limit
    }
  ]);
  
  return topErrors;
};

/**
 * Middleware
 */
SystemLogSchema.pre('save', function(this: ISystemLog, next) {
  // Ensure timestamp is set
  if (!this.timestamp) {
    this.timestamp = new Date();
  }
  
  // Generate trace ID if not provided
  if (!this.traceId) {
    this.traceId = (this.constructor as ISystemLogModel).generateTraceId();
  }
  
  // Sanitize metadata to prevent circular references
  if (this.metadata && typeof this.metadata === 'object') {
    try {
      JSON.stringify(this.metadata);
    } catch (error) {
      this.metadata = { error: 'Circular reference detected in metadata' };
    }
  }
  
  next();
});

/**
 * Indexes
 */
SystemLogSchema.index({ level: 1, timestamp: -1 });
SystemLogSchema.index({ service: 1, timestamp: -1 });
SystemLogSchema.index({ clientId: 1, timestamp: -1 });

// Compound indexes for common queries
SystemLogSchema.index({ service: 1, level: 1, timestamp: -1 }, { name: 'service_level_time_idx' });
SystemLogSchema.index({ level: 1, service: 1, timestamp: -1 }, { name: 'level_service_time_idx' });

// TTL index for automatic cleanup (30 days)
SystemLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

// Text index for search functionality
SystemLogSchema.index({ message: 'text', 'metadata.error': 'text' });

/**
 * Model interface for static methods
 */
interface ISystemLogModel extends Model<ISystemLog> {
  createLog(
    level: 'info' | 'warn' | 'error' | 'debug',
    service: string,
    message: string,
    metadata?: Record<string, any>,
    clientId?: mongoose.Types.ObjectId,
    traceId?: string
  ): Promise<ISystemLog>;
  generateTraceId(): string;
  findByService(service: string, limit?: number): Promise<ISystemLog[]>;
  findByLevel(level: 'info' | 'warn' | 'error' | 'debug', limit?: number): Promise<ISystemLog[]>;
  findByClientId(clientId: mongoose.Types.ObjectId, limit?: number): Promise<ISystemLog[]>;
  findByTraceId(traceId: string): Promise<ISystemLog[]>;
  findErrors(since?: Date, limit?: number): Promise<ISystemLog[]>;
  getLogStats(since?: Date): Promise<any[]>;
  searchLogs(
    query: string,
    service?: string,
    level?: string,
    since?: Date,
    limit?: number
  ): Promise<ISystemLog[]>;
  getRecentErrors(hours?: number, limit?: number): Promise<ISystemLog[]>;
  getServiceHealth(service: string, hours?: number): Promise<any>;
  cleanupOldLogs(daysOld?: number): Promise<number>;
  getTopErrors(hours?: number, limit?: number): Promise<any[]>;
}

/**
 * Export the SystemLog model
 */
export const SystemLog = mongoose.model<ISystemLog, ISystemLogModel>('SystemLog', SystemLogSchema);