/**
 * Central export file for all cache and queue infrastructure
 */

export { RedisManager } from './RedisManager';
export { QueueManager } from './QueueManager';
export { RateLimiter } from './RateLimiter';
export { SessionCache } from './SessionCache';

/**
 * Cache and Queue Health Monitor
 */
export class CacheHealthMonitor {
  private static instance: CacheHealthMonitor;

  static getInstance(): CacheHealthMonitor {
    if (!CacheHealthMonitor.instance) {
      CacheHealthMonitor.instance = new CacheHealthMonitor();
    }
    return CacheHealthMonitor.instance;
  }

  /**
   * Comprehensive health check for all cache and queue systems
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    details: {
      redis: any;
      queues: any;
      rateLimiter: any;
      sessions: any;
    };
  }> {
    const { RedisManager } = await import('./RedisManager');
    const { QueueManager } = await import('./QueueManager');
    const { RateLimiter } = await import('./RateLimiter');
    const { SessionCache } = await import('./SessionCache');
    
    const redisManager = RedisManager.getInstance();
    const queueManager = QueueManager.getInstance();
    const rateLimiter = RateLimiter.getInstance();
    const sessionCache = SessionCache.getInstance();

    const [redisHealth, queueHealth, rateLimiterStats, sessionStats] = await Promise.allSettled([
      redisManager.healthCheck(),
      queueManager.healthCheck(),
      rateLimiter.getStats(),
      sessionCache.getSessionStats()
    ]);

    const details = {
      redis: {
        healthy: redisHealth.status === 'fulfilled' && redisHealth.value,
        error: redisHealth.status === 'rejected' ? redisHealth.reason.message : null
      },
      queues: {
        healthy: queueHealth.status === 'fulfilled' && queueHealth.value.healthy,
        details: queueHealth.status === 'fulfilled' ? queueHealth.value.details : null,
        error: queueHealth.status === 'rejected' ? queueHealth.reason.message : null
      },
      rateLimiter: {
        healthy: rateLimiterStats.status === 'fulfilled' && rateLimiterStats.value !== null,
        stats: rateLimiterStats.status === 'fulfilled' ? rateLimiterStats.value : null,
        error: rateLimiterStats.status === 'rejected' ? rateLimiterStats.reason.message : null
      },
      sessions: {
        healthy: sessionStats.status === 'fulfilled' && sessionStats.value !== null,
        stats: sessionStats.status === 'fulfilled' ? sessionStats.value : null,
        error: sessionStats.status === 'rejected' ? sessionStats.reason.message : null
      }
    };

    const healthy = details.redis.healthy && 
                   details.queues.healthy && 
                   details.rateLimiter.healthy && 
                   details.sessions.healthy;

    return { healthy, details };
  }

  /**
   * Get comprehensive statistics
   */
  async getStats(): Promise<any> {
    const { RedisManager } = await import('./RedisManager');
    const { QueueManager } = await import('./QueueManager');
    const { RateLimiter } = await import('./RateLimiter');
    const { SessionCache } = await import('./SessionCache');
    
    const redisManager = RedisManager.getInstance();
    const queueManager = QueueManager.getInstance();
    const rateLimiter = RateLimiter.getInstance();
    const sessionCache = SessionCache.getInstance();

    const [redisInfo, queueStats, rateLimiterStats, sessionStats] = await Promise.allSettled([
      redisManager.getInfo(),
      queueManager.getQueueStats(),
      rateLimiter.getStats(),
      sessionCache.getSessionStats()
    ]);

    return {
      redis: redisInfo.status === 'fulfilled' ? redisInfo.value : null,
      queues: queueStats.status === 'fulfilled' ? queueStats.value : null,
      rateLimiter: rateLimiterStats.status === 'fulfilled' ? rateLimiterStats.value : null,
      sessions: sessionStats.status === 'fulfilled' ? sessionStats.value : null,
      timestamp: new Date()
    };
  }

  /**
   * Perform cleanup operations
   */
  async performCleanup(): Promise<{
    rateLimiterCleaned: number;
    sessionsCleaned: number;
    queuesCleaned: Record<string, number>;
  }> {
    const { QueueManager } = await import('./QueueManager');
    const { RateLimiter } = await import('./RateLimiter');
    const { SessionCache } = await import('./SessionCache');
    
    const queueManager = QueueManager.getInstance();
    const rateLimiter = RateLimiter.getInstance();
    const sessionCache = SessionCache.getInstance();

    const [rateLimiterCleaned, sessionsCleaned] = await Promise.allSettled([
      rateLimiter.cleanup(),
      sessionCache.cleanupExpiredSessions()
    ]);

    // Clean up old jobs from all queues
    const queueNames = queueManager.getQueueNames();
    const queueCleanupPromises = queueNames.map(async (queueName) => {
      const completed = await queueManager.cleanQueue(queueName, 24 * 60 * 60 * 1000, 'completed');
      const failed = await queueManager.cleanQueue(queueName, 7 * 24 * 60 * 60 * 1000, 'failed');
      return { [queueName]: completed + failed };
    });

    const queueCleanupResults = await Promise.allSettled(queueCleanupPromises);
    const queuesCleaned: Record<string, number> = {};
    
    queueCleanupResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        Object.assign(queuesCleaned, result.value);
      } else {
        queuesCleaned[queueNames[index]] = 0;
      }
    });

    return {
      rateLimiterCleaned: rateLimiterCleaned.status === 'fulfilled' ? rateLimiterCleaned.value : 0,
      sessionsCleaned: sessionsCleaned.status === 'fulfilled' ? sessionsCleaned.value : 0,
      queuesCleaned
    };
  }
}

/**
 * Cache initialization utility
 */
export class CacheInitializer {
  /**
   * Initialize all cache and queue systems
   */
  static async initialize(): Promise<void> {
    const { RedisManager } = await import('./RedisManager');
    const { QueueManager } = await import('./QueueManager');
    
    const redisManager = RedisManager.getInstance();
    const queueManager = QueueManager.getInstance();

    // Connect to Redis first
    await redisManager.connect();

    // Initialize queue manager
    await queueManager.initialize();

    // Rate limiter and session cache are initialized automatically when used
  }

  /**
   * Shutdown all cache and queue systems
   */
  static async shutdown(): Promise<void> {
    const { RedisManager } = await import('./RedisManager');
    const { QueueManager } = await import('./QueueManager');
    
    const redisManager = RedisManager.getInstance();
    const queueManager = QueueManager.getInstance();

    // Close all queues first
    await queueManager.closeAllQueues();

    // Disconnect from Redis
    await redisManager.disconnect();
  }
}

/**
 * Common cache operations utility
 */
export class CacheOperations {
  /**
   * Store data with automatic serialization
   */
  static async store(
    key: string,
    data: any,
    ttlSeconds: number = 3600
  ): Promise<boolean> {
    const { RedisManager } = await import('./RedisManager');
    const redisManager = RedisManager.getInstance();
    const serializedData = JSON.stringify(data);
    return await redisManager.setWithTTL(key, serializedData, ttlSeconds);
  }

  /**
   * Retrieve data with automatic deserialization
   */
  static async retrieve(key: string): Promise<any | null> {
    const { RedisManager } = await import('./RedisManager');
    const redisManager = RedisManager.getInstance();
    const data = await redisManager.get(key);
    
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      return data; // Return as string if not JSON
    }
  }

  /**
   * Cache with automatic refresh
   */
  static async cacheWithRefresh<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<T> {
    // Try to get from cache first
    const cached = await CacheOperations.retrieve(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const freshData = await fetchFunction();
    
    // Store in cache
    await CacheOperations.store(key, freshData, ttlSeconds);
    
    return freshData;
  }

  /**
   * Invalidate cache pattern
   */
  static async invalidatePattern(pattern: string): Promise<number> {
    const { RedisManager } = await import('./RedisManager');
    const redisManager = RedisManager.getInstance();
    const keys = await redisManager.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }
    
    return await redisManager.del(...keys);
  }
}