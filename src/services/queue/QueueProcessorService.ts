import { QueueManager } from '@/cache/QueueManager';
import { RateLimiter } from '@/cache/RateLimiter';
import { SessionCache } from '@/cache/SessionCache';
import { RedisManager } from '@/cache/RedisManager';
import { MessageQueue, User, Destination, SystemLog, Organization } from '@/models';
import { CampaignDispatchService } from '@/services/send/CampaignDispatchService';
import { BirthdayAutomationService } from '@/services/platform/BirthdayAutomationService';
import { RulesEngine } from '@/services/rules/RulesEngine';
import { TemplateEngine } from '@/services/templates/TemplateEngine';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { OrganizationService } from '@/services/organization/OrganizationService';
import { createServiceLogger } from '@/utils/logger';
import { isDevelopment } from '@/config/environment';
import { renderCatalogTemplate } from '@/constants/discord-whatsapp-templates';
import {
  previewOutbound,
  resolveStreamTemplate,
  streamLinkFromExtracted,
} from '@/utils/stream-template';
import { inferTwitchSlug, isLiveOnChannel } from '@/utils/discord-wa-format';
import { buildDiscordWhatsAppVariables } from '@/utils/discord-wa-variables';
import {
  applyStandardWhatsAppLayout,
  buildContentFingerprint,
  collectPrimaryLink,
} from '@/utils/discord-wa-format';
import { logPipeline } from '@/utils/pipeline-log';
import { buildPipelineTrackingMeta } from '@/utils/pipeline-tracking';
import { resolveTenantSenderLabelAsync } from '@/utils/radarzap-sender';
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
  private static readonly MIN_SEND_DELAY_MS = isDevelopment() ? 1000 : 3000;

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

      const clientOid = new mongoose.Types.ObjectId(clientId);

      // ── 1. Tenant (organização ou usuário legado) ───────────────────────────
      const org = await Organization.findById(clientOid);
      let user = await User.findById(clientOid);
      if (!org && !user) {
        this.serviceLogger.warn('Tenant não encontrado — mensagem Discord ignorada', logMeta);
        await SystemLog.createLog('warn', 'QueueProcessorService', 'Tenant not found', logMeta, undefined, traceId);
        return { success: false, reason: 'Tenant not found' };
      }
      if (!user && org) {
        user = await User.findById(org.ownerUserId);
      }

      extractedData.radarzapSenderLabel = await resolveTenantSenderLabelAsync(org, user);
      const pipelineTracking = () =>
        buildPipelineTrackingMeta(extractedData, {
          organizationName: org?.name,
        });

      const logUserId = (user?._id ?? clientOid) as mongoose.Types.ObjectId;

      if (org && !org.canSendMessage()) {
        this.serviceLogger.warn('Limite diário da organização atingido', logMeta);
        await SystemLog.createLog('warn', 'QueueProcessorService', 'Message limit exceeded', {
          ...logMeta, limit: org.limits.messagesPerDay, used: org.usage.messagesUsed, tenant: 'organization',
        }, logUserId, traceId);
        return { success: false, reason: 'Message limit exceeded' };
      }
      if (user && !org && !user.canSendMessage()) {
        await SystemLog.createLog('warn', 'QueueProcessorService', 'Message limit exceeded', {
          ...logMeta, limit: user.limits.messagesPerDay, used: user.usage.messagesUsed, tenant: 'user',
        }, logUserId, traceId);
        return { success: false, reason: 'Message limit exceeded' };
      }

      // ── 2. WhatsApp (socket ativo no processo, não só cache Redis) ─────────
      const wa = WhatsAppService.getInstance();
      if (!wa.isClientConnected(clientId)) {
        this.serviceLogger.warn('WhatsApp não conectado — mensagem Discord não encaminhada', logMeta);
        await SystemLog.createLog('warn', 'QueueProcessorService', 'WhatsApp not connected', logMeta,
          logUserId, traceId);
        return { success: false, reason: 'WhatsApp not connected' };
      }

      // ── 3. Rules evaluation ───────────────────────────────────────────────
      const matches = await this.rulesEngine.evaluate(extractedData, clientId);

      await SystemLog.createLog('info', 'QueueProcessorService', 'Rules evaluated', {
        ...logMeta, rulesMatched: matches.length
      }, logUserId, traceId);

      if (matches.length === 0) {
        this.serviceLogger.warn('Nenhuma regra ativa bateu com a mensagem Discord', {
          ...logMeta,
          channelId: extractedData?.channelId,
        });
        await SystemLog.createLog('info', 'QueueProcessorService', 'No rules matched — message skipped', logMeta,
          logUserId, traceId);
        return { success: true, reason: 'No rules matched', jobsEnqueued: 0 };
      }

      // Uma mensagem Discord → uma regra (maior prioridade), evita 5 posts no WhatsApp
      const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const activeMatches =
        matches.length > 1
          ? [
              [...matches].sort(
                (a, b) => priorityRank[a.priority] - priorityRank[b.priority]
              )[0],
            ]
          : matches;

      if (matches.length > 1) {
        this.serviceLogger.info('Múltiplas regras — usando só a de maior prioridade', {
          ...logMeta,
          total: matches.length,
          picked: activeMatches[0].rule.name,
          template: activeMatches[0].templateName,
        });
      }

      const liveOnChannel = /live-on|live_on/i.test(extractedData.channelName ?? '');
      const skipStreamContentDedup = liveOnChannel && !extractedData.isBot;

      if (!skipStreamContentDedup) {
        const contentFp = buildContentFingerprint(channelId, extractedData);
        const contentDedupKey = `wa-content:${clientId}:${channelId}:${contentFp}`;
        const dedupTtlSec = liveOnChannel ? 300 : 120;

        const isNewContent = await this.redisManager.setIfNotExists(
          contentDedupKey,
          messageId,
          dedupTtlSec
        );
        if (!isNewContent) {
          await logPipeline('QueueProcessorService', 'skip', 'Conteúdo duplicado no canal', {
            ...logMeta,
            ...pipelineTracking(),
            contentFp,
            dedupTtlSec,
            reason: 'mesmo streamer/thumb em janela curta',
          }, logUserId, traceId);
          return { success: true, reason: 'Duplicate content', jobsEnqueued: 0 };
        }
      }

      // ── 4. For each match: template + dedup + enqueue ─────────────────────
      let jobsEnqueued = 0;

      for (const match of activeMatches) {
        const { destinationIds, templateName, priority, addDelay, rule } = match;

        const linkForRoute = streamLinkFromExtracted(extractedData);
        if (
          linkForRoute &&
          /twitch\.tv|youtube\.com|youtu\.be/i.test(linkForRoute) &&
          extractedData.captureKind !== 'embed_list'
        ) {
          extractedData.captureKind = 'live';
        }

        const { template: resolvedTemplate, linkKind, link: routedLink } =
          resolveStreamTemplate(
            templateName,
            extractedData.captureKind ?? 'text',
            extractedData
          );

        if (routedLink && !extractedData.primaryLink) {
          extractedData.primaryLink = routedLink;
        }
        const slug = inferTwitchSlug(extractedData);
        if (slug && !extractedData.embedAuthorName) {
          extractedData.embedAuthorName = slug;
        }

        const { variables, primaryImage, extraImages } =
          buildDiscordWhatsAppVariables(extractedData);

        // Templates dw-* sempre do catálogo global (evita cópia antiga do cliente no Mongo)
        const useGlobalTemplate =
          resolvedTemplate.startsWith('dw-') ||
          resolvedTemplate.startsWith('radarzap-');

        const linkFinal =
          collectPrimaryLink(extractedData) ||
          variables.link_principal ||
          variables.link ||
          '';

        if (
          !linkFinal &&
          (extractedData.captureKind === 'live' ||
            extractedData.captureKind === 'video' ||
            extractedData.captureKind === 'short')
        ) {
          this.serviceLogger.warn('Link vazio na fila — recompõe no envio', {
            ...logMeta,
            template: resolvedTemplate,
            streamer: variables.streamer,
          });
        }

        let renderedMessage =
          renderCatalogTemplate(resolvedTemplate, variables as Record<string, string>) ?? '';

        if (!renderedMessage && useGlobalTemplate) {
          const fallbackTpl =
            extractedData.captureKind === 'short'
              ? 'dw-short'
              : extractedData.captureKind === 'video'
                ? 'dw-video'
                : extractedData.captureKind === 'live'
                  ? 'dw-live'
                  : 'dw-padrao';
          renderedMessage =
            renderCatalogTemplate(fallbackTpl, variables as Record<string, string>) ?? '';
        }

        if (!renderedMessage && !useGlobalTemplate) {
          try {
            renderedMessage = await this.templateEngine.renderTemplate(
              resolvedTemplate,
              variables,
              logUserId,
              { fallbackToDefault: true, removeUnusedVariables: true }
            );
          } catch (templateError) {
            await SystemLog.createLog('error', 'QueueProcessorService', 'Template render failed', {
              ...logMeta, templateName, error: (templateError as Error).message, ruleId: rule._id
            }, logUserId, traceId);
            continue;
          }
        }

        renderedMessage = applyStandardWhatsAppLayout(
          renderedMessage,
          variables.rodape || '',
          linkFinal
        );

        await logPipeline('QueueProcessorService', 'render', 'Mensagem montada', {
          ...logMeta,
          ...pipelineTracking(),
          template: resolvedTemplate,
          ruleTemplate: templateName,
          linkKind,
          streamer: variables.streamer,
          rodape: variables.rodape,
          captureKind: extractedData.captureKind,
          chars: renderedMessage.length,
          hasLink: renderedMessage.includes('https://'),
          hasRodape: renderedMessage.includes('via radarzap'),
          hasImage: Boolean(primaryImage || variables.imagem),
          linkFinal: linkFinal || undefined,
          preview: previewOutbound(renderedMessage),
        }, logUserId, traceId);

        this.serviceLogger.info('Mensagem WA montada', {
          ...logMeta,
          template: resolvedTemplate,
          chars: renderedMessage.length,
          hasLink: renderedMessage.includes('https://'),
          hasRodape: renderedMessage.includes('via radarzap'),
        });

        // If rule has no specific destinations, use all active destinations of the user
        let resolvedDestinationIds = destinationIds;
        if (!resolvedDestinationIds || resolvedDestinationIds.length === 0) {
          const relatedIds = await OrganizationService.getInstance().getRelatedClientIds(clientId);
          const allDests = (
            await Promise.all(relatedIds.map(id => Destination.findByClientId(id, true)))
          ).flat();
          const seenDest = new Set<string>();
          resolvedDestinationIds = allDests
            .filter(d => {
              const key = String(d._id);
              if (seenDest.has(key)) return false;
              seenDest.add(key);
              return true;
            })
            .map(d => d._id as mongoose.Types.ObjectId);
          this.serviceLogger.debug('Rule has no destinations — using all active destinations', {
            clientId, ruleId: rule._id, count: resolvedDestinationIds.length
          });
        }

        const seenWaDest = new Set<string>();

        // Enqueue one job per destination
        for (const destinationId of resolvedDestinationIds) {
          const destination = await Destination.findById(destinationId);
          if (!destination || !destination.isActive) continue;

          if (seenWaDest.has(destination.identifier)) continue;
          seenWaDest.add(destination.identifier);

          // ── Deduplication ─────────────────────────────────────────────────
          const dedupHash = crypto
            .createHash('sha256')
            .update(`${clientId}:${destinationId}:${messageId}`)
            .digest('hex');

          const dedupKey = `dedup:${dedupHash}`;
          const isDuplicate = await this.redisManager.exists(dedupKey);

          if (isDuplicate) {
            await logPipeline('QueueProcessorService', 'skip', 'Mensagem já enviada (dedup messageId)', {
              ...logMeta,
              ...pipelineTracking(),
              ruleId: String(rule._id),
              destination: destination.identifier,
              dedupHash,
            }, logUserId, traceId);
            continue;
          }

          // ── Enqueue send job ──────────────────────────────────────────────
          const priorityValue = priority === 'high' ? 8 : priority === 'medium' ? 5 : 2;
          const streamInPost = /twitch\.tv|youtube\.com|youtu\.be/i.test(linkForRoute);
          const webhookSettleMs =
            extractedData.isBot &&
            streamInPost &&
            (extractedData.captureKind === 'live' ||
              extractedData.captureKind === 'video' ||
              extractedData.captureKind === 'short')
              ? 1500
              : 0;
          const humanEmbedSettleMs =
            !extractedData.isBot &&
            streamInPost &&
            !extractedData.embedThumbnail &&
            !extractedData.hasEmbed
              ? 800
              : 0;
          const channelSeq = await this.redisManager.increment(
            `wa-channel-seq:${clientId}:${channelId}`,
            120
          );
          const channelStaggerMs = (channelSeq - 1) * QueueProcessorService.MIN_SEND_DELAY_MS;
          const delay =
            addDelay +
            webhookSettleMs +
            humanEmbedSettleMs +
            channelStaggerMs +
            jobsEnqueued * QueueProcessorService.MIN_SEND_DELAY_MS;

          const image =
            primaryImage || variables.imagem || variables.thumbnail || '';

          await this.queueManager.addJob(
            'whatsapp-sending',
            'send-message',
            {
              clientId,
              destination: destination.identifier,
              content: {
                text: renderedMessage,
                ...(image ? { image } : {}),
                ...(extraImages.length > 0 ? { extraImages } : {}),
              },
              messageId,
              ruleId: rule._id.toString(),
              templateName: resolvedTemplate,
              resolvedTemplate,
              extractedData,
              traceId,
              dedupKey,
              dedupTtlSeconds: QueueProcessorService.DEDUP_WINDOW_HOURS * 3600,
              jobDelay: delay,
            },
            {
              priority: priorityValue,
              attempts: 3,
              delay,
              backoff: { type: 'exponential', delay: 2000 },
            }
          );

          jobsEnqueued++;

          await logPipeline('QueueProcessorService', 'queue', 'Job WA enfileirado', {
            ...logMeta,
            ...pipelineTracking(),
            ruleId: String(rule._id),
            ruleName: rule.name,
            template: resolvedTemplate,
            ruleTemplate: templateName,
            streamer: variables.streamer,
            rodape: variables.rodape,
            linkKind,
            destination: destination.identifier,
            priority,
            delay,
            channelStaggerMs,
            webhookSettleMs,
            humanEmbedSettleMs,
            preview: previewOutbound(renderedMessage),
          }, logUserId, traceId);
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

    // Processar campanhas agendadas (painel Enviar agora)
    const campaignInterval = global.setInterval(async () => {
      if (this.isRunning) {
        try {
          await CampaignDispatchService.getInstance().processPending();
        } catch (err) {
          this.serviceLogger.error('Campaign queue tick failed:', err);
        }
      }
    }, 15_000);

    // Aniversários automáticos (pw-*) — verifica regras após sendTime, 1x/dia por regra
    const runBirthdayTick = async () => {
      if (!this.isRunning) return;
      try {
        await BirthdayAutomationService.getInstance().processAllOrganizations();
      } catch (err) {
        this.serviceLogger.error('Birthday automation tick failed:', err);
      }
    };
    void runBirthdayTick();
    const birthdayInterval = global.setInterval(runBirthdayTick, 15 * 60 * 1000);

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
    (this as any).intervals = [cleanupInterval, rateLimitCleanupInterval, campaignInterval, statsInterval];

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