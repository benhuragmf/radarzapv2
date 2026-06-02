import Redis, { Cluster } from 'ioredis';
import { config } from '@/config/environment';
import { logger, createServiceLogger } from '@/utils/logger';

/**
 * Singleton Redis Manager with automatic reconnection and clustering support
 */
export class RedisManager {
  private static instance: RedisManager;
  private client: Redis | Cluster | null = null;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // 5 seconds
  private serviceLogger = createServiceLogger('RedisManager');

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  /**
   * Connect to Redis with automatic retry and clustering support
   */
  async connect(): Promise<void> {
    if (this.client && this.client.status === 'ready') {
      this.serviceLogger.info('Redis already connected');
      return;
    }

    if (this.isConnecting) {
      this.serviceLogger.info('Redis connection already in progress');
      return;
    }

    this.isConnecting = true;

    try {
      this.serviceLogger.info('Connecting to Redis...');

      // Create main client
      this.client = this.createRedisClient();
      
      // Create pub/sub clients
      this.subscriber = this.createRedisClient();
      this.publisher = this.createRedisClient();

      // Setup event handlers
      this.setupEventHandlers();

      // Wait for connection
      await this.waitForConnection();

      this.reconnectAttempts = 0;
      this.isConnecting = false;

      this.serviceLogger.info('✅ Redis connected successfully');
      
      // Initialize Redis structures
      await this.initializeRedisStructures();
      
    } catch (error) {
      this.isConnecting = false;
      this.serviceLogger.error('❌ Redis connection failed:', error);
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.scheduleReconnect();
      } else {
        throw new Error(`Failed to connect to Redis after ${this.maxReconnectAttempts} attempts`);
      }
    }
  }

  /**
   * Create Redis client with configuration
   */
  private createRedisClient(): Redis {
    const redisConfig = {
      ...config.REDIS.OPTIONS,
      password: config.REDIS.PASSWORD,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    };

    // Check if URL contains cluster configuration
    if (config.REDIS.URL.includes(',')) {
      // Cluster mode
      const hosts = config.REDIS.URL.replace('redis://', '').split(',').map(host => {
        const [hostname, port] = host.split(':');
        return { host: hostname, port: parseInt(port) || 6379 };
      });
      
      return new Redis.Cluster(hosts, {
        redisOptions: redisConfig,
        enableOfflineQueue: false,
      }) as any;
    } else {
      // Single instance mode
      return new Redis(config.REDIS.URL, redisConfig);
    }
  }

  /**
   * Setup event handlers for connection monitoring
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.serviceLogger.info('🔗 Redis connecting...');
    });

    this.client.on('ready', () => {
      this.serviceLogger.info('✅ Redis ready');
    });

    this.client.on('error', (error) => {
      this.serviceLogger.error('🚨 Redis error:', error);
    });

    this.client.on('close', () => {
      this.serviceLogger.warn('🔌 Redis connection closed');
      
      if (!this.isConnecting) {
        this.scheduleReconnect();
      }
    });

    this.client.on('reconnecting', () => {
      this.serviceLogger.info('🔄 Redis reconnecting...');
    });

    this.client.on('end', () => {
      this.serviceLogger.info('🔒 Redis connection ended');
    });
  }

  /**
   * Wait for Redis connection to be ready
   */
  private async waitForConnection(timeoutMs: number = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Redis client not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error(`Redis connection timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.client.on('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.client.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      // Try to connect
      this.client.connect().catch(reject);
    });
  }

  /**
   * Initialize Redis data structures
   */
  private async initializeRedisStructures(): Promise<void> {
    if (!this.client) return;

    try {
      // Initialize system configuration
      await this.client.hset('system:config', {
        initialized: 'true',
        version: '1.0.0',
        startTime: new Date().toISOString()
      });

      // Initialize queue statistics
      await this.client.hset('queue:stats', {
        pending: '0',
        processing: '0',
        completed: '0',
        failed: '0',
        total_processed: '0'
      });

      // Initialize rate limiting structure
      await this.client.set('rate_limit:global:initialized', '1', 'EX', 3600);

      this.serviceLogger.info('✅ Redis structures initialized');
    } catch (error) {
      this.serviceLogger.error('Failed to initialize Redis structures:', error);
    }
  }

  /**
   * Schedule automatic reconnection
   */
  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.serviceLogger.error('❌ Max Redis reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    this.serviceLogger.info(`⏳ Scheduling Redis reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        this.serviceLogger.error('Redis reconnection attempt failed:', error);
      }
    }, delay);
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.client = null;
      }
      
      if (this.subscriber) {
        await this.subscriber.quit();
        this.subscriber = null;
      }
      
      if (this.publisher) {
        await this.publisher.quit();
        this.publisher = null;
      }
      
      this.serviceLogger.info('✅ Redis disconnected');
    } catch (error) {
      this.serviceLogger.error('Error disconnecting from Redis:', error);
    }
  }

  /**
   * Get the main Redis client
   */
  getClient(): Redis | Cluster {
    if (!this.client || this.client.status !== 'ready') {
      throw new Error('Redis client not connected');
    }
    return this.client;
  }

  /**
   * Get the subscriber client for pub/sub
   */
  getSubscriber(): Redis {
    if (!this.subscriber || this.subscriber.status !== 'ready') {
      throw new Error('Redis subscriber not connected');
    }
    return this.subscriber;
  }

  /**
   * Get the publisher client for pub/sub
   */
  getPublisher(): Redis {
    if (!this.publisher || this.publisher.status !== 'ready') {
      throw new Error('Redis publisher not connected');
    }
    return this.publisher;
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) return false;
      
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.serviceLogger.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Get Redis info and statistics
   */
  async getInfo(): Promise<any> {
    try {
      if (!this.client) return null;
      
      const info = await this.client.info();
      const memory = await this.client.info('memory');
      const stats = await this.client.info('stats');
      
      return {
        info,
        memory,
        stats,
        connected: this.isConnected(),
        timestamp: new Date()
      };
    } catch (error) {
      this.serviceLogger.error('Failed to get Redis info:', error);
      return null;
    }
  }

  /**
   * Execute Redis command with error handling
   */
  async execute<T>(command: () => Promise<T>): Promise<T | null> {
    try {
      if (!this.isConnected()) {
        throw new Error('Redis not connected');
      }
      
      return await command();
    } catch (error) {
      this.serviceLogger.error('Redis command failed:', error);
      return null;
    }
  }

  /**
   * Set value with TTL
   */
  async setWithTTL(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.execute(async () => {
      return await this.getClient().setex(key, ttlSeconds, value);
    });
    
    return result === 'OK';
  }

  /**
   * Get value
   */
  async get(key: string): Promise<string | null> {
    return await this.execute(async () => {
      return await this.getClient().get(key);
    });
  }

  /**
   * Set hash field
   */
  async hset(key: string, field: string, value: string): Promise<boolean> {
    const result = await this.execute(async () => {
      return await this.getClient().hset(key, field, value);
    });
    
    return result === 1;
  }

  /**
   * Get hash field
   */
  async hget(key: string, field: string): Promise<string | null> {
    return await this.execute(async () => {
      return await this.getClient().hget(key, field);
    });
  }

  /**
   * Get all hash fields
   */
  async hgetall(key: string): Promise<Record<string, string> | null> {
    return await this.execute(async () => {
      return await this.getClient().hgetall(key);
    });
  }

  /**
   * Increment hash field
   */
  async hincrby(key: string, field: string, increment: number = 1): Promise<number | null> {
    return await this.execute(async () => {
      return await this.getClient().hincrby(key, field, increment);
    });
  }

  /**
   * Add to sorted set
   */
  async zadd(key: string, score: number, member: string): Promise<boolean> {
    const result = await this.execute(async () => {
      return await this.getClient().zadd(key, score, member);
    });
    
    return result === 1;
  }

  /**
   * Get sorted set range
   */
  async zrange(key: string, start: number, stop: number, withScores: boolean = false): Promise<string[] | null> {
    return await this.execute(async () => {
      if (withScores) {
        return await this.getClient().zrange(key, start, stop, 'WITHSCORES');
      } else {
        return await this.getClient().zrange(key, start, stop);
      }
    });
  }

  /**
   * Remove from sorted set
   */
  async zrem(key: string, member: string): Promise<boolean> {
    const result = await this.execute(async () => {
      return await this.getClient().zrem(key, member);
    });
    
    return result === 1;
  }

  /**
   * Publish message
   */
  async publish(channel: string, message: string): Promise<boolean> {
    const result = await this.execute(async () => {
      return await this.getPublisher().publish(channel, message);
    });
    
    return (result || 0) > 0;
  }

  /**
   * Subscribe to channel
   */
  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    try {
      const subscriber = this.getSubscriber();
      
      subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          callback(message);
        }
      });
      
      await subscriber.subscribe(channel);
      
      this.serviceLogger.info(`Subscribed to Redis channel: ${channel}`);
    } catch (error) {
      this.serviceLogger.error(`Failed to subscribe to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe from channel
   */
  async unsubscribe(channel: string): Promise<void> {
    try {
      await this.getSubscriber().unsubscribe(channel);
      this.serviceLogger.info(`Unsubscribed from Redis channel: ${channel}`);
    } catch (error) {
      this.serviceLogger.error(`Failed to unsubscribe from channel ${channel}:`, error);
    }
  }

  /**
   * Execute Lua script
   */
  async evalScript(script: string, keys: string[], args: string[]): Promise<any> {
    return await this.execute(async () => {
      return await this.getClient().eval(script, keys.length, ...keys, ...args);
    });
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const result = await this.execute(async () => {
      return await this.getClient().keys(pattern);
    });
    
    return result || [];
  }

  /**
   * Delete keys
   */
  async del(...keys: string[]): Promise<number> {
    const result = await this.execute(async () => {
      return await this.getClient().del(...keys);
    });
    
    return result || 0;
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.execute(async () => {
      return await this.getClient().exists(key);
    });
    
    return result === 1;
  }

  /**
   * Set expiration on key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.execute(async () => {
      return await this.getClient().expire(key, seconds);
    });
    
    return result === 1;
  }

  /**
   * Get TTL of key
   */
  async ttl(key: string): Promise<number> {
    const result = await this.execute(async () => {
      return await this.getClient().ttl(key);
    });
    
    return result || -1;
  }

  /**
   * Flush database (use with caution)
   */
  async flushdb(): Promise<boolean> {
    const result = await this.execute(async () => {
      return await this.getClient().flushdb();
    });
    
    return result === 'OK';
  }
}