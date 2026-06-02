import { QueueManager } from '@/cache/QueueManager';
import { RateLimiter } from '@/cache/RateLimiter';
import { SessionCache } from '@/cache/SessionCache';
import { RedisManager } from '@/cache/RedisManager';
import { MessageQueue, User, Destination, SystemLog } from '@/models';
import { RulesEngine } from '@/services/rules/RulesEngine';
import { TemplateEngine } from '@/services/templates/TemplateEngine';
import { createServiceLogger } from '@/utils/logger';
import { CircuitBreaker } from '@/services/common/CircuitBreaker';
import { Job } from 'bullmq';
import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Queue Processor Service with autonomous scaling and processing
 */
export class QueueProcessorService {
  private queueManager: QueueManager;
  private rateLimiter: RateLimiter;
  private sessionCache: SessionCache;
  private redisManager: RedisManager;
  private rulesEngine: RulesEngine;
  private templateEngine: TemplateEngine;
  private circuitBreaker: CircuitBreaker;
  private serviceLogger = createServiceLogger('QueueProcessorService');
  private isRunning = false;
  private processingStats = {
    processed: 0,
    failed: 0,
    startTime: new Date()
  };

  // Deduplication config
  private static readonly DEDUP_WINDOW_HOURS = 6;
  private static readonly MIN_SEND_DELAY_MS = 3000;

  constructor() {
    this.queueManager = QueueManager.getInstance();
    this.rateLimiter = RateLimiter.getInstance();
    this.sessionCache = SessionCache.getInstance();
    this.redisManager = RedisManager.getInstance();
    this.rulesEngine = new RulesEngine();
    this.templateEngine = TemplateEngine.getInstance();
    this.circuitBreaker = new CircuitBreaker('queue-processor', {
      failureThreshold: 10,
      recoveryTimeout: 60000,
      monitorTimeout: 30000
    });
  }

  /**
   * Start queue processor service
   */
  async start(): Promise<void> {
    try {
      this.serviceLogger.info('🚀 Starting Queue Processor Service...');

      // Register all queue processors
      await this.registerProcessors();

      // Setup monitoring and cleanup
      this.setupMonitoring();

      this.isRunning = true;
      this.processingStats.startTime = new Date();

      this.serviceLogger.info('✅ Queue Processor Service started successfully');

    } catch (error) {
      this.serviceLogger.error('❌ Failed to start Queue Processor Service:', error);
      throw error;
    }
  }

  /**
   * Stop queue processor service
   */
  async stop(): Promise<void> {
    try {
      this.serviceLogger.info('🛑 Stopping Queue Processor Service...');

      this.isRunning = false;

      this.serviceLogger.info('✅ Queue Processor Service stopped');

    } catch (error) {
      this.serviceLogger.error('Error stopping Queue Processor Service:', error);
    }
  }

  /**
   * Register all queue processors
   */
  private async registerProcessors(): Promise<void> {
    // Message processing queue
    await this.queueManager.registerProcessor(
      'message-processing',
      async (job: Job) => await this.processDiscordMessage(job),
      5 // Concurrency
    );

    // Discord notifications queue
    await this.queueManager.registerProcessor(
      'discord-notifications',
      async (job: Job) => await this.processDiscordNotification(job),
      3 // Concurrency
    );

    // Session cleanup queue
    await this.queueManager.registerProcessor(
      'session-cleanup',
      async (job: Job) => await this.processSessionCleanup(job),
      1 // Single worker for cleanup
    );

    // Rate limiting cleanup queue
    await this.queueManager.registerProcessor(
      'rate-limiting',
      async (job: Job) => await this.processRateLimitingCleanup(job),
      1 // Single worker for cleanup
    );

    this.serviceLogger.info('✅ All queue processors registered');
  }

  /**
   * Process Discord message for WhatsApp forwarding.
   *
   * Pipeline:
   *   1. Validate user & session
   *   2. RulesEngine.evaluate → RuleMatch[]
   *   3. For each match: render template, dedup check, enqueue send job
   *   4. Log every step to SystemLog
   */
  private async processDiscordMessage(job: Job): Promise<any> {
    const { data } = job;
    const { messageId, channelId, clientId, extractedData } = data;
    const traceId = crypto.randomUUID();
    const capturedAt = new Date();

    const logMeta = { messageId, channelId, clientId, traceId };

    try {
      this.serviceLogger.info('Processing Discord message', logMeta);

      // ── 1. User validation ────────────────────────────────────────────────
      const user = await User.findById(new mongoose.Types.ObjectId(clientId));
      if (!user) {
        await SystemLog.createLog('warn', 'QueueProcessorService', 'User not found', logMeta, undefined, traceId);
        return { success: false, reason: 'User not found' };
      }

      if (!user.canSendMessage()) {
        await SystemLog.createLog('warn', 'QueueProcessorService', 'Message limit exceeded', {
          ...logMeta, limit: user.limits.messagesPerDay, used: user.usage.messagesUsed
        }, user._id as mongoose.Types.ObjectId, traceId);
        return { success: false, reason: 'Message limit exceeded' };
      }

      // ── 2. WhatsApp session check ─────────────────────────────────────────
      const whatsappSession = await this.sessionCache.getWhatsAppSession(clientId);
      if (!whatsappSession || whatsappSession.status !== 'connected') {
        await SystemLog.createLog('warn', 'QueueProcessorService', 'WhatsApp not connected', logMeta,
          user._id as mongoose.Types.ObjectId, traceId);
        return { success: false, reason: 'WhatsApp not connected' };
      }

      // ── 3. Rules evaluation ───────────────────────────────────────────────
      const matches = await this.rulesEngine.evaluate(extractedData, clientId);

      await SystemLog.createLog('info', 'QueueProcessorService', 'Rules evaluated', {
        ...logMeta, rulesMatched: matches.length
      }, user._id as mongoose.Types.ObjectId, traceId);

      if (matches.length === 0) {
        await SystemLog.createLog('info', 'QueueProcessorService', 'No rules matched — message skipped', logMeta,
          user._id as mongoose.Types.ObjectId, traceId);
        return { success: true, reason: 'No rules matched', jobsEnqueued: 0 };
      }

      // ── 4. For each match: template + dedup + enqueue ─────────────────────
      let jobsEnqueued = 0;
      const now = Date.now();

      for (const match of matches) {
        const { destinationIds, templateName, priority, addDelay, rule } = match;

        // Build template variables from extractedData
        const variables = this.buildTemplateVariables(extractedData);

        // Render template
        let renderedMessage: string;
        try {
          renderedMessage = await this.templateEngine.renderTemplate(
            templateName,
            variables,
            user._id as mongoose.Types.ObjectId,
            { fallbackToDefault: true, removeUnusedVariables: true }
          );
        } catch (templateError) {
          await SystemLog.createLog('error', 'QueueProcessorService', 'Template render failed', {
            ...logMeta, templateName, error: (templateError as Error).message, ruleId: rule._id
          }, user._id as mongoose.Types.ObjectId, traceId);
          continue;
        }

        // If rule has no specific destinations, use all active destinations of the user
        let resolvedDestinationIds = destinationIds;
        if (!resolvedDestinationIds || resolvedDestinationIds.length === 0) {
          const allDests = await Destination.findByClientId(user._id as mongoose.Types.ObjectId, true);
          resolvedDestinationIds = allDests.map((d: any) => d._id);
          this.serviceLogger.debug('Rule has no destinations — using all active destinations', {
            clientId, ruleId: rule._id, count: resolvedDestinationIds.length
          });
        }

        // Enqueue one job per destination
        for (const destinationId of resolvedDestinationIds) {
          const destination = await Destination.findById(destinationId);
          if (!destination || !destination.isActive) continue;

          // ── Deduplication ─────────────────────────────────────────────────
          const dedupHash = crypto
            .createHash('sha256')
            .update(`${clientId}:${destinationId}:${renderedMessage}`)
            .digest('hex');

          const dedupKey = `dedup:${dedupHash}`;
          const isDuplicate = await this.redisManager.exists(dedupKey);

          if (isDuplicate) {
            await SystemLog.createLog('info', 'QueueProcessorService', 'Duplicate message skipped', {
              ...logMeta, ruleId: rule._id, destinationId, dedupHash
            }, user._id as mongoose.Types.ObjectId, traceId);
            continue;
          }

          // Mark as sent (TTL = dedup window)
          await this.redisManager.setWithTTL(
            dedupKey,
            '1',
            QueueProcessorService.DEDUP_WINDOW_HOURS * 3600
          );

          // ── Enqueue send job ──────────────────────────────────────────────
          const priorityValue = priority === 'high' ? 8 : priority === 'medium' ? 5 : 2;
          const delay = addDelay + (jobsEnqueued * QueueProcessorService.MIN_SEND_DELAY_MS);

          // Include thumbnail as image if available
          const thumbnail = variables.thumbnail || variables.imagem || '';

          await this.queueManager.addJob(
            'whatsapp-sending',
            'send-message',
            {
              clientId,
              destination: destination.identifier,
              content: {
                text: renderedMessage,
                ...(thumbnail ? { image: thumbnail } : {}),
              },
              messageId,
              ruleId: rule._id.toString(),
              templateName,
              traceId,
            },
            {
              priority: priorityValue,
              attempts: 3,
              delay,
              backoff: { type: 'exponential', delay: 2000 },
            }
          );

          jobsEnqueued++;

          await SystemLog.createLog('info', 'QueueProcessorService', 'Send job enqueued', {
            ...logMeta,
            ruleId: rule._id,
            ruleName: rule.name,
            templateName,
            destination: destination.identifier,
            priority,
            delay,
          }, user._id as mongoose.Types.ObjectId, traceId);
        }
      }

      this.processingStats.processed++;
      this.circuitBreaker.recordSuccess();

      this.serviceLogger.info('Discord message processed successfully', {
        ...logMeta, jobsEnqueued, processingTimeMs: Date.now() - capturedAt.getTime()
      });

      return { success: true, jobsEnqueued };

    } catch (error) {
      this.processingStats.failed++;
      this.circuitBreaker.recordFailure();

      this.serviceLogger.error('Failed to process Discord message', {
        ...logMeta, error: (error as Error).message
      });

      await SystemLog.createLog('error', 'QueueProcessorService', 'Failed to process Discord message', {
        ...logMeta, error: (error as Error).message, stack: (error as Error).stack
      }, undefined, traceId).catch(() => {});

      throw error;
    }
  }

  /**
   * Build template variables from an ExtractedMessage.
   * Maps the ExtractedMessage fields to the variable names used in RadarZap templates.
   */
  private buildTemplateVariables(extractedData: any): Record<string, string> {
    const now = new Date();
    const link = extractedData.links?.[0] ?? '';

    // Detect if it's a live/video embed
    const isLive    = extractedData.embedType === 'twitch' || extractedData.embedType === 'live';
    const isYoutube = extractedData.embedType === 'youtube';

    // Best title: embed title > embed description first line > text first line
    const embedTitle = extractedData.embedTitles?.[0] ?? '';
    const embedDesc  = extractedData.embedDescriptions?.[0] ?? '';
    const textTitle  = extractedData.text?.split('\n').find((l: string) => l.trim()) ?? '';

    // If embed title is "StreamerName - Twitch/YouTube", it's the channel name not the stream title
    // Use description first line as the real title in that case
    const isTitleChannelName = /[-–]\s*(Twitch|YouTube|Twitch\.tv)$/i.test(embedTitle);

    // Filter out lines that are just URLs from description
    const descLines = embedDesc.split('\n').filter((l: string) => l.trim() && !/^https?:\/\//i.test(l.trim()));
    const descClean = descLines.join('\n').trim();

    const titulo = isTitleChannelName
      ? (descClean.split('\n').find((l: string) => l.trim()) || embedTitle)
      : (embedTitle || textTitle || descClean.split('\n')[0] || '');

    // Streamer: prefer embed.author.name, fallback to channel name from title
    const streamerRaw = extractedData.embedAuthorName || extractedData.authorName || '';
    const streamer = streamerRaw || (isTitleChannelName
      ? embedTitle.replace(/\s*[-–]\s*(Twitch|YouTube|Twitch\.tv)$/i, '').trim()
      : '');

    // Best description: embed description > text (skip URL-only lines)
    const descricao = descClean || extractedData.text || '';

    // Game
    const jogo = extractedData.embedGame || '';

    // Viewers
    const viewers = extractedData.embedViewers || '';

    // Thumbnail
    const thumbnail = extractedData.embedThumbnail || extractedData.imageUrls?.[0] || '';

    // Platform label
    const plataforma = isLive ? '🔴 Twitch' : isYoutube ? '▶️ YouTube' : '🎮';

    return {
      // RadarZap core
      servidor:     extractedData.guildName   ?? '',
      canal:        extractedData.channelName ?? '',
      autor:        extractedData.authorName  ?? '',
      mensagem:     extractedData.text        ?? '',
      link,
      links:        (extractedData.links ?? []).join('\n'),
      imagem:       thumbnail,
      embed_titulo: embedTitle,
      embed_desc:   embedDesc,
      data:         now.toLocaleDateString('pt-BR'),
      hora:         now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      timestamp:    now.toISOString(),

      // Enriquecidos
      titulo,
      descricao,
      streamer,
      jogo,
      viewers,
      thumbnail,
      plataforma,

      // Legacy
      title:        titulo,
      price:        extractedData.price        ?? '',
      store:        extractedData.store        ?? '',
      purchaseLink: link,
      message:      extractedData.text        ?? '',
    };
  }

  /**
   * Process Discord notification
   */
  private async processDiscordNotification(job: Job): Promise<any> {
    const { data } = job;
    const { jobName } = data;

    try {
      switch (jobName) {
        case 'send-qr-code':
          return await this.sendQRCodeNotification(data);
        case 'send-notification':
          return await this.sendDiscordNotification(data);
        default:
          throw new Error(`Unknown Discord notification job: ${jobName}`);
      }
    } catch (error) {
      this.serviceLogger.error('Failed to process Discord notification:', error);
      throw error;
    }
  }

  /**
   * Send QR code notification to Discord
   */
  private async sendQRCodeNotification(data: any): Promise<any> {
    const { discordUserId, channelId, qrCode, message } = data;

    try {
      // In a real implementation, this would send the QR code to Discord
      // For now, we'll log it and store in cache for the Discord bot to pick up
      
      await this.sessionCache.setSession(`qr-code:${discordUserId}`, {
        qrCode,
        message,
        channelId,
        timestamp: new Date(),
        expires: new Date(Date.now() + 2 * 60 * 1000) // 2 minutes
      }, 120); // 2 minutes TTL

      this.serviceLogger.info('QR code notification queued for Discord', {
        discordUserId,
        channelId
      });

      return { success: true };

    } catch (error) {
      this.serviceLogger.error('Failed to send QR code notification:', error);
      throw error;
    }
  }

  /**
   * Send general notification to Discord
   */
  private async sendDiscordNotification(data: any): Promise<any> {
    const { discordUserId, channelId, message } = data;

    try {
      // Store notification for Discord bot to pick up
      await this.sessionCache.setSession(`notification:${discordUserId}:${Date.now()}`, {
        message,
        channelId,
        timestamp: new Date()
      }, 300); // 5 minutes TTL

      this.serviceLogger.info('Discord notification queued', {
        discordUserId,
        channelId
      });

      return { success: true };

    } catch (error) {
      this.serviceLogger.error('Failed to send Discord notification:', error);
      throw error;
    }
  }

  /**
   * Process session cleanup
   */
  private async processSessionCleanup(_job: Job): Promise<any> {
    try {
      this.serviceLogger.info('Starting session cleanup...');

      // Clean up expired sessions from cache
      const cacheCleanedCount = await this.sessionCache.cleanupExpiredSessions();

      // Clean up rate limiter data
      const rateLimiterCleanedCount = await this.rateLimiter.cleanup();

      this.serviceLogger.info('Session cleanup completed', {
        cacheCleanedCount,
        rateLimiterCleanedCount
      });

      return {
        success: true,
        cacheCleanedCount,
        rateLimiterCleanedCount
      };

    } catch (error) {
      this.serviceLogger.error('Session cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Process rate limiting cleanup
   */
  private async processRateLimitingCleanup(_job: Job): Promise<any> {
    try {
      this.serviceLogger.info('Starting rate limiting cleanup...');

      const cleanedCount = await this.rateLimiter.cleanup();

      this.serviceLogger.info('Rate limiting cleanup completed', {
        cleanedCount
      });

      return {
        success: true,
        cleanedCount
      };

    } catch (error) {
      this.serviceLogger.error('Rate limiting cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Setup monitoring and periodic tasks
   */
  private setupMonitoring(): void {
    // Schedule periodic cleanup tasks
    const cleanupInterval = global.setInterval(async () => {
      if (this.isRunning) {
        await this.queueManager.addJob(
          'session-cleanup',
          'cleanup-sessions',
          {},
          { priority: 1 }
        );
      }
    }, 60 * 60 * 1000); // Every hour

    // Schedule rate limiting cleanup
    const rateLimitCleanupInterval = global.setInterval(async () => {
      if (this.isRunning) {
        await this.queueManager.addJob(
          'rate-limiting',
          'cleanup-rate-limits',
          {},
          { priority: 1 }
        );
      }
    }, 30 * 60 * 1000); // Every 30 minutes

    // Log processing statistics
    const statsInterval = global.setInterval(() => {
      if (this.isRunning) {
        const uptime = Date.now() - this.processingStats.startTime.getTime();
        const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
        const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));

        this.serviceLogger.info('Queue processing statistics', {
          processed: this.processingStats.processed,
          failed: this.processingStats.failed,
          successRate: this.processingStats.processed > 0 
            ? ((this.processingStats.processed / (this.processingStats.processed + this.processingStats.failed)) * 100).toFixed(2) + '%'
            : '0%',
          uptime: `${uptimeHours}h ${uptimeMinutes}m`,
          circuitBreakerState: this.circuitBreaker.getState()
        });
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Store intervals for cleanup on stop
    (this as any).intervals = [cleanupInterval, rateLimitCleanupInterval, statsInterval];

    this.serviceLogger.info('✅ Monitoring and periodic tasks setup completed');
  }

  /**
   * Get service status
   */
  getStatus(): any {
    const uptime = Date.now() - this.processingStats.startTime.getTime();
    
    return {
      running: this.isRunning,
      uptime,
      processed: this.processingStats.processed,
      failed: this.processingStats.failed,
      successRate: this.processingStats.processed > 0 
        ? ((this.processingStats.processed / (this.processingStats.processed + this.processingStats.failed)) * 100)
        : 0,
      circuitBreakerState: this.circuitBreaker.getState(),
      lastActivity: new Date()
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const queueStats = await this.queueManager.getQueueStats();
      const circuitBreakerHealthy = this.circuitBreaker.getState() !== 'open';
      
      // Check if any queue has too many failed jobs
      const hasFailedJobs = Object.values(queueStats).some((stats: any) => 
        stats.failed > stats.completed * 0.1 // More than 10% failure rate
      );

      return {
        healthy: this.isRunning && circuitBreakerHealthy && !hasFailedJobs,
        details: {
          running: this.isRunning,
          circuitBreakerState: this.circuitBreaker.getState(),
          circuitBreakerHealthy,
          queueStats,
          hasFailedJobs,
          processingStats: this.processingStats,
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Get detailed queue statistics
   */
  async getDetailedStats(): Promise<any> {
    try {
      const queueStats = await this.queueManager.getQueueStats();
      const status = this.getStatus();

      return {
        service: status,
        queues: queueStats,
        circuitBreaker: this.circuitBreaker.getStats(),
        timestamp: new Date()
      };
    } catch (error) {
      this.serviceLogger.error('Failed to get detailed stats:', error);
      return null;
    }
  }

  /**
   * Manually trigger cleanup
   */
  async triggerCleanup(): Promise<any> {
    try {
      this.serviceLogger.info('Manually triggering cleanup...');

      const results = await Promise.allSettled([
        this.queueManager.addJob('session-cleanup', 'cleanup-sessions', {}, { priority: 10 }),
        this.queueManager.addJob('rate-limiting', 'cleanup-rate-limits', {}, { priority: 10 })
      ]);

      return {
        success: true,
        results: results.map(result => ({
          status: result.status,
          value: result.status === 'fulfilled' ? result.value : null,
          reason: result.status === 'rejected' ? result.reason : null
        }))
      };
    } catch (error) {
      this.serviceLogger.error('Failed to trigger cleanup:', error);
      throw error;
    }
  }
}