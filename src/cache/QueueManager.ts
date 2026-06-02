import { Queue, Worker, Job, JobsOptions, QueueOptions } from 'bullmq';
import { RedisManager } from './RedisManager';
import { config } from '@/config/environment';
import { logger, createServiceLogger } from '@/utils/logger';

/**
 * Queue Manager with Bull Queue and automatic job processing
 */
export class QueueManager {
  private static instance: QueueManager;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private processors: Map<string, (job: Job) => Promise<any>> = new Map();
  private serviceLogger = createServiceLogger('QueueManager');
  private isInitialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  /**
   * Initialize queue manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.serviceLogger.info('Queue manager already initialized');
      return;
    }

    try {
      this.serviceLogger.info('Initializing queue manager...');

      // Ensure Redis is connected
      const redisManager = RedisManager.getInstance();
      if (!redisManager.isConnected()) {
        await redisManager.connect();
      }

      // Create default queues
      await this.createDefaultQueues();

      // Setup global error handlers
      this.setupGlobalErrorHandlers();

      this.isInitialized = true;
      this.serviceLogger.info('✅ Queue manager initialized');

    } catch (error) {
      this.serviceLogger.error('❌ Failed to initialize queue manager:', error);
      throw error;
    }
  }

  /**
   * Create default queues for the system
   */
  private async createDefaultQueues(): Promise<void> {
    const defaultQueues = [
      'message-processing',
      'whatsapp-sending',
      'discord-monitoring',
      'session-cleanup',
      'rate-limiting',
      'notifications'
    ];

    for (const queueName of defaultQueues) {
      await this.createQueue(queueName);
    }

    this.serviceLogger.info(`Created ${defaultQueues.length} default queues`);
  }

  /**
   * Create a new queue
   */
  async createQueue(name: string, options?: QueueOptions): Promise<Queue> {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queueOptions: QueueOptions = {
      connection: this.buildBullMQConnection(),
      prefix: config.QUEUE.REDIS_KEY_PREFIX,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: config.QUEUE.MAX_RETRY,
        backoff: {
          type: 'exponential',
          delay: config.QUEUE.DELAY_MULTIPLIER,
        },
      },
      ...options,
    };

    const queue = new Queue(name, queueOptions);

    // Setup queue event handlers
    this.setupQueueEventHandlers(queue, name);

    this.queues.set(name, queue);
    this.serviceLogger.info(`Queue created: ${name}`);

    return queue;
  }

  /**
   * Build Redis connection options for BullMQ from the configured URL.
   * Supports redis://, rediss://, and URLs with credentials.
   */
  private buildBullMQConnection(): any {
    const url = config.REDIS.URL;

    // If it's a full URL (contains ://), parse it properly
    if (url.includes('://')) {
      try {
        // Node's URL parser handles redis:// and rediss://
        const parsed = new URL(url.replace(/^rediss?:\/\//, (match) => {
          return match === 'rediss://' ? 'https://' : 'http://';
        }));

        return {
          host: parsed.hostname,
          port: parseInt(parsed.port) || 6379,
          password: parsed.password ? decodeURIComponent(parsed.password) : config.REDIS.PASSWORD,
          username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
          tls: url.startsWith('rediss://') ? {} : undefined,
          maxRetriesPerRequest: null, // required by BullMQ
          enableReadyCheck: false,
          connectTimeout: 10000,
        };
      } catch {
        // fallback below
      }
    }

    // Plain host:port fallback
    const [host, portStr] = url.split(':');
    return {
      host: host || 'localhost',
      port: parseInt(portStr) || 6379,
      password: config.REDIS.PASSWORD,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 10000,
    };
  }

  /**
   * Parse Redis host from URL
   */
  private parseRedisHost(): string {
    return this.buildBullMQConnection().host;
  }

  /**
   * Parse Redis port from URL
   */
  private parseRedisPort(): number {
    return this.buildBullMQConnection().port;
  }

  /**
   * Setup event handlers for a queue
   */
  private setupQueueEventHandlers(queue: Queue, name: string): void {
    queue.on('error', (error) => {
      this.serviceLogger.error(`Queue error in ${name}:`, error);
    });

    queue.on('waiting', (job) => {
      this.serviceLogger.debug(`Job waiting in ${name}: ${job.id}`);
    });

    queue.on('progress', (job, progress) => {
      this.serviceLogger.debug(`Job progress in ${name}: ${job.id} - ${progress}%`);
    });
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    process.on('SIGTERM', async () => {
      this.serviceLogger.info('Received SIGTERM, closing queues...');
      await this.closeAllQueues();
    });

    process.on('SIGINT', async () => {
      this.serviceLogger.info('Received SIGINT, closing queues...');
      await this.closeAllQueues();
    });
  }

  /**
   * Register a processor for a queue
   */
  async registerProcessor(
    queueName: string,
    processor: (job: Job) => Promise<any>,
    concurrency: number = config.QUEUE.CONCURRENCY
  ): Promise<void> {
    const queue = await this.getOrCreateQueue(queueName);
    
    this.processors.set(queueName, processor);
    
    // Create worker for processing jobs
    const worker = new Worker(queueName, async (job: Job) => {
      try {
        this.serviceLogger.debug(`Processing job ${job.id} in queue ${queueName}`);
        const result = await processor(job);
        this.serviceLogger.debug(`Job ${job.id} completed successfully`);
        return result;
      } catch (error) {
        this.serviceLogger.error(`Job ${job.id} failed:`, error);
        throw error;
      }
    }, {
      connection: this.buildBullMQConnection(),
      prefix: config.QUEUE.REDIS_KEY_PREFIX,
      lockDuration: 120000,
      lockRenewTime: 30000,
      concurrency
    });

    this.workers.set(queueName, worker);
    this.serviceLogger.info(`Processor registered for queue: ${queueName} (concurrency: ${concurrency})`);
  }

  /**
   * Add job to queue
   */
  async addJob(
    queueName: string,
    jobName: string,
    data: any,
    options?: JobsOptions
  ): Promise<Job> {
    const queue = await this.getOrCreateQueue(queueName);
    
    const jobOptions: JobsOptions = {
      priority: this.calculatePriority(data),
      delay: options?.delay || 0,
      attempts: options?.attempts || config.QUEUE.MAX_RETRY,
      ...options,
    };

    const job = await queue.add(jobName, data, jobOptions);
    
    this.serviceLogger.debug(`Job added to ${queueName}: ${job.id}`);
    this.updateQueueStats(queueName, 'pending', 1);
    
    return job;
  }

  /**
   * Calculate job priority based on data
   */
  private calculatePriority(data: any): number {
    // Default priority is 0 (normal)
    let priority = 0;

    // Higher priority for premium users
    if (data.userPlan === 'premium') {
      priority += 10;
    } else if (data.userPlan === 'enterprise') {
      priority += 20;
    }

    // Higher priority for urgent messages
    if (data.urgent) {
      priority += 5;
    }

    // Higher priority for retry attempts
    if (data.retryAttempt) {
      priority += data.retryAttempt;
    }

    return priority;
  }

  /**
   * Get or create queue
   */
  private async getOrCreateQueue(name: string): Promise<Queue> {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }
    
    return await this.createQueue(name);
  }

  /**
   * Get queue by name
   */
  getQueue(name: string): Queue | null {
    return this.queues.get(name) || null;
  }

  /**
   * Get all queue names
   */
  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName?: string): Promise<any> {
    if (queueName) {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue not found: ${queueName}`);
      }

      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      return {
        name: queueName,
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length,
      };
    } else {
      // Get stats for all queues
      const stats: any = {};
      
      for (const [name, queue] of this.queues) {
        stats[name] = await this.getQueueStats(name);
      }
      
      return stats;
    }
  }

  /**
   * Update queue statistics in Redis
   */
  private async updateQueueStats(queueName: string, stat: string, increment: number): Promise<void> {
    try {
      const redisManager = RedisManager.getInstance();
      await redisManager.hincrby(`queue:stats:${queueName}`, stat, increment);
      await redisManager.hincrby('queue:stats:global', stat, increment);
    } catch (error) {
      this.serviceLogger.error('Failed to update queue stats:', error);
    }
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    await queue.pause();
    this.serviceLogger.info(`Queue paused: ${queueName}`);
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    await queue.resume();
    this.serviceLogger.info(`Queue resumed: ${queueName}`);
  }

  /**
   * Clean queue (remove completed/failed jobs)
   */
  async cleanQueue(
    queueName: string,
    grace: number = 24 * 60 * 60 * 1000, // 24 hours
    status: 'completed' | 'failed' | 'active' | 'wait' = 'completed'
  ): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const cleaned = await queue.clean(grace, 100, status);
    this.serviceLogger.info(`Cleaned ${cleaned.length} ${status} jobs from ${queueName}`);
    
    return cleaned.length;
  }

  /**
   * Get job by ID
   */
  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    return await queue.getJob(jobId);
  }

  /**
   * Remove job by ID
   */
  async removeJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
      this.serviceLogger.info(`Job removed: ${jobId} from ${queueName}`);
    }
  }

  /**
   * Retry failed job
   */
  async retryJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.retry();
      this.serviceLogger.info(`Job retried: ${jobId} from ${queueName}`);
    }
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(queueName: string, start: number = 0, end: number = -1): Promise<Job[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    return await queue.getFailed(start, end);
  }

  /**
   * Get waiting jobs
   */
  async getWaitingJobs(queueName: string, start: number = 0, end: number = -1): Promise<Job[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    return await queue.getWaiting(start, end);
  }

  /**
   * Get active jobs
   */
  async getActiveJobs(queueName: string, start: number = 0, end: number = -1): Promise<Job[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    return await queue.getActive(start, end);
  }

  /**
   * Close specific queue
   */
  async closeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.close();
      this.queues.delete(queueName);
      this.processors.delete(queueName);
      this.serviceLogger.info(`Queue closed: ${queueName}`);
    }
  }

  /**
   * Close all queues
   */
  async closeAllQueues(): Promise<void> {
    const closePromises = Array.from(this.queues.entries()).map(async ([name, queue]) => {
      try {
        await queue.close();
        this.serviceLogger.info(`Queue closed: ${name}`);
      } catch (error) {
        this.serviceLogger.error(`Error closing queue ${name}:`, error);
      }
    });

    await Promise.allSettled(closePromises);
    
    this.queues.clear();
    this.processors.clear();
    this.isInitialized = false;
    
    this.serviceLogger.info('All queues closed');
  }

  /**
   * Health check for queue system
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const details: any = {
        queuesCount: this.queues.size,
        processorsCount: this.processors.size,
        queueStats: {}
      };

      // Check each queue
      for (const [name, queue] of this.queues) {
        try {
          const stats = await this.getQueueStats(name);
          details.queueStats[name] = {
            ...stats,
            healthy: stats.failed < stats.total * 0.1 // Less than 10% failure rate
          };
        } catch (error) {
          details.queueStats[name] = {
            healthy: false,
            error: error.message
          };
        }
      }

      const allQueuesHealthy = Object.values(details.queueStats).every((stat: any) => stat.healthy);
      
      return {
        healthy: allQueuesHealthy && this.isInitialized,
        details
      };
      
    } catch (error) {
      return {
        healthy: false,
        details: { error: error.message }
      };
    }
  }
}