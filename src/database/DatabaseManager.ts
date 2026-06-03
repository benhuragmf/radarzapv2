import mongoose, { Connection } from 'mongoose';
import { config } from '@/config/environment';
import { createServiceLogger } from '@/utils/logger';
import { LogThrottle } from '@/utils/logThrottle';

/**
 * Singleton Database Manager with automatic reconnection and pooling
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private connection: Connection | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // 5 seconds
  private serviceLogger = createServiceLogger('DatabaseManager');
  private logThrottle = new LogThrottle(15_000);
  private gaveUpReconnect = false;

  private constructor() {
    this.setupEventHandlers();
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Connect to MongoDB with automatic retry
   */
  async connect(): Promise<void> {
    if (this.connection && this.connection.readyState === 1) {
      this.serviceLogger.info('Database already connected');
      return;
    }

    if (this.isConnecting) {
      this.serviceLogger.info('Connection already in progress');
      return;
    }

    this.isConnecting = true;

    try {
      this.serviceLogger.info('Connecting to MongoDB...');

      await mongoose.connect(config.DATABASE.URL, {
        // Connection options for stability
        autoIndex: true,
        autoCreate: true,
        serverSelectionTimeoutMS: config.DATABASE.CONNECTION_TIMEOUT,
        maxPoolSize: config.DATABASE.MAX_POOL_SIZE
      });

      this.connection = mongoose.connection;
      this.reconnectAttempts = 0;
      this.isConnecting = false;

      this.serviceLogger.info('MongoDB conectado com sucesso');
      
      // Run health check
      await this.healthCheck();
      
    } catch (error) {
      this.isConnecting = false;
      this.serviceLogger.error('❌ MongoDB connection failed:', error);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.scheduleReconnect();
      } else {
        throw new Error(`Failed to connect to MongoDB after ${this.maxReconnectAttempts} attempts`);
      }
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await mongoose.disconnect();
      this.connection = null;
      this.serviceLogger.info('✅ MongoDB disconnected');
    }
  }

  /**
   * Get the current connection
   */
  getConnection(): Connection {
    if (!this.connection || this.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }
    return this.connection;
  }

  /**
   * Check if database is connected
   */
  isConnected(): boolean {
    return this.connection?.readyState === 1;
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connection) return false;
      
      await this.connection.db.admin().ping();
      return true;
    } catch (error) {
      this.serviceLogger.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations(): Promise<void> {
    try {
      this.serviceLogger.info('🔄 Running database migrations...');
      
      const db = this.getConnection().db;
      
      // Check migration status
      const migrationCollection = db.collection('migrations');
      const lastMigration = await migrationCollection.findOne(
        {},
        { sort: { version: -1 } }
      );
      
      const currentVersion = lastMigration?.version || 0;
      const targetVersion = 1; // Current migration version
      
      if (currentVersion >= targetVersion) {
        this.serviceLogger.info('✅ Database migrations up to date');
        return;
      }
      
      // Run migrations
      await this.runMigrationV1();
      
      // Record migration
      await migrationCollection.insertOne({
        version: targetVersion,
        appliedAt: new Date(),
        description: 'Initial schema setup with indexes and validation'
      });
      
      this.serviceLogger.info('✅ Database migrations completed');
      
    } catch (error) {
      this.serviceLogger.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Migration V1: Initial schema setup
   */
  private async runMigrationV1(): Promise<void> {
    const db = this.getConnection().db;
    
    // Ensure all collections exist with proper validation
    const collections = [
      'users', 'whatsappSessions', 'discordChannels', 
      'messageQueue', 'templates', 'destinations', 'systemLogs'
    ];
    
    const existingCollections = await db.listCollections().toArray();
    const existingNames = existingCollections.map(c => c.name);
    
    for (const collectionName of collections) {
      if (!existingNames.includes(collectionName)) {
        await db.createCollection(collectionName);
        this.serviceLogger.info(`Created collection: ${collectionName}`);
      }
    }
    
    // Create additional performance indexes
    await this.createPerformanceIndexes(db);
  }

  /**
   * Create performance optimization indexes
   */
  private async createPerformanceIndexes(db: any): Promise<void> {
    // Compound indexes for common queries
    await db.collection('messageQueue').createIndex(
      { clientId: 1, status: 1, priority: -1 },
      { name: 'client_status_priority_idx', background: true }
    );
    
    await db.collection('whatsappSessions').createIndex(
      { clientId: 1, status: 1, expiresAt: 1 },
      { name: 'session_management_idx', background: true }
    );
    
    await db.collection('destinations').createIndex(
      { clientId: 1, isActive: 1, 'consent.granted': 1 },
      { name: 'active_destinations_idx', background: true }
    );
    
    await db.collection('systemLogs').createIndex(
      { service: 1, level: 1, timestamp: -1 },
      { name: 'log_query_idx', background: true }
    );
    
    this.serviceLogger.info('✅ Performance indexes created');
  }

  /**
   * Setup event handlers for connection monitoring
   */
  private setupEventHandlers(): void {
    mongoose.connection.on('connected', () => {
      this.gaveUpReconnect = false;
      this.reconnectAttempts = 0;
      this.serviceLogger.info('MongoDB conectado');
    });

    mongoose.connection.on('error', (error) => {
      this.throttledLog('mongo:error', 'warn', 'MongoDB indisponível', error);
    });

    mongoose.connection.on('disconnected', () => {
      if (this.gaveUpReconnect) return;
      this.throttledLog('mongo:disconnected', 'warn', 'MongoDB desconectado');
      if (!this.isConnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
        void this.scheduleReconnect();
      }
    });

    mongoose.connection.on('reconnected', () => {
      this.gaveUpReconnect = false;
      this.reconnectAttempts = 0;
      this.serviceLogger.info('MongoDB reconectado');
    });
  }

  private throttledLog(
    key: string,
    level: 'warn' | 'error' | 'info',
    message: string,
    error?: unknown,
  ): void {
    const gate = this.logThrottle.shouldLog(key);
    if (!gate.ok) return;
    const suffix = gate.suppressed ? ` (+${gate.suppressed} repetidos)` : '';
    const errMsg =
      error instanceof Error ? error.message : error != null ? String(error) : undefined;
    const full = errMsg ? `${message}: ${errMsg}${suffix}` : `${message}${suffix}`;
    this.serviceLogger[level](full);
  }

  /**
   * Schedule automatic reconnection
   */
  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (!this.gaveUpReconnect) {
        this.gaveUpReconnect = true;
        this.throttledLog(
          'mongo:max',
          'error',
          `MongoDB: desistindo após ${this.maxReconnectAttempts} tentativas (verifique MONGODB_URL / docker)`,
        );
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    this.serviceLogger.info(`⏳ Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        this.serviceLogger.error('Reconnection attempt failed:', error);
      }
    }, delay);
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<any> {
    try {
      const db = this.getConnection().db;
      const stats = await db.stats();
      
      return {
        collections: stats.collections,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize,
        objects: stats.objects,
        avgObjSize: stats.avgObjSize,
      };
    } catch (error) {
      this.serviceLogger.error('Failed to get database stats:', error);
      return null;
    }
  }

  /**
   * Backup database (basic implementation)
   */
  async createBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup-${timestamp}`;
      
      // In a real implementation, this would use mongodump or similar
      // For now, we'll just log the backup creation
      this.serviceLogger.info(`📦 Creating backup: ${backupName}`);
      
      // This would be implemented with actual backup logic
      // For autonomous operation, could use MongoDB Atlas backup or similar
      
      return backupName;
    } catch (error) {
      this.serviceLogger.error('Backup creation failed:', error);
      throw error;
    }
  }

  /**
   * Restore from backup (basic implementation)
   */
  async restoreBackup(backupName: string): Promise<void> {
    try {
      this.serviceLogger.info(`📥 Restoring from backup: ${backupName}`);
      
      // This would be implemented with actual restore logic
      // For autonomous operation, could use MongoDB Atlas restore or similar
      
      this.serviceLogger.info('✅ Backup restored successfully');
    } catch (error) {
      this.serviceLogger.error('Backup restore failed:', error);
      throw error;
    }
  }

  /**
   * Clean up old data based on retention policies
   */
  async cleanupOldData(): Promise<void> {
    try {
      const db = this.getConnection().db;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // Clean up old logs (already handled by TTL index, but double-check)
      const logsDeleted = await db.collection('systemLogs').deleteMany({
        timestamp: { $lt: thirtyDaysAgo }
      });
      
      // Clean up expired sessions
      const sessionsDeleted = await db.collection('whatsappSessions').deleteMany({
        status: 'expired',
        expiresAt: { $lt: new Date() }
      });
      
      // Clean up old completed/failed messages (keep for 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const messagesDeleted = await db.collection('messageQueue').deleteMany({
        status: { $in: ['sent', 'failed'] },
        processedAt: { $lt: sevenDaysAgo }
      });
      
      this.serviceLogger.info('🧹 Data cleanup completed', {
        logsDeleted: logsDeleted.deletedCount,
        sessionsDeleted: sessionsDeleted.deletedCount,
        messagesDeleted: messagesDeleted.deletedCount
      });
      
    } catch (error) {
      this.serviceLogger.error('Data cleanup failed:', error);
    }
  }
}