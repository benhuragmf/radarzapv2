import { WhatsAppService } from './WhatsAppService';
import { QueueManager } from '@/cache/QueueManager';
import { createServiceLogger } from '@/utils/logger';

/**
 * WhatsApp Service Integration for queue-based operations
 */
export class WhatsAppServiceIntegration {
  private whatsappService: WhatsAppService;
  private queueManager: QueueManager;
  private serviceLogger = createServiceLogger('WhatsAppServiceIntegration');

  constructor() {
    this.whatsappService = WhatsAppService.getInstance();
    this.queueManager = QueueManager.getInstance();
  }

  /**
   * Initialize the integration
   */
  async initialize(): Promise<void> {
    try {
      this.serviceLogger.info('🚀 Initializing WhatsApp Service Integration...');

      // Start WhatsApp service with enhanced features
      await this.whatsappService.start();

      // Register additional queue processors for integration
      await this.registerIntegrationProcessors();

      this.serviceLogger.info('✅ WhatsApp Service Integration initialized successfully');
    } catch (error) {
      this.serviceLogger.error('❌ Failed to initialize WhatsApp Service Integration:', error);
      throw error;
    }
  }

  /**
   * Register integration-specific queue processors
   */
  private async registerIntegrationProcessors(): Promise<void> {
    // Destination management processor
    await this.queueManager.registerProcessor(
      'whatsapp-destination-management',
      async (job) => {
        const { name: jobName, data } = job;
        
        switch (jobName) {
          case 'add-destination':
            return await this.handleAddDestination(data);
          case 'remove-destination':
            return await this.handleRemoveDestination(data);
          case 'validate-destination':
            return await this.handleValidateDestination(data);
          case 'cleanup-destinations':
            return await this.handleCleanupDestinations(data);
          default:
            throw new Error(`Unknown destination management job: ${jobName}`);
        }
      },
      2 // Concurrency of 2 for destination management
    );

    // Health monitoring processor
    await this.queueManager.registerProcessor(
      'whatsapp-health-monitoring',
      async (job) => {
        const { name: jobName, data } = job;
        
        switch (jobName) {
          case 'health-check':
            return await this.handleHealthCheck(data);
          case 'session-health-check':
            return await this.handleSessionHealthCheck(data);
          case 'service-stats':
            return await this.handleServiceStats(data);
          default:
            throw new Error(`Unknown health monitoring job: ${jobName}`);
        }
      },
      1 // Concurrency of 1 for health monitoring
    );

    this.serviceLogger.info('✅ Integration queue processors registered');
  }

  /**
   * Handle add destination request
   */
  private async handleAddDestination(data: any): Promise<any> {
    const { clientId, type, identifier, name, consentSource, ipAddress, discordUserId, channelId } = data;

    try {
      const result = await this.whatsappService.addDestination(
        clientId,
        type,
        identifier,
        name,
        consentSource,
        ipAddress
      );

      // Notify Discord of success
      if (discordUserId && channelId) {
        await this.queueManager.addJob(
          'discord-notifications',
          'send-notification',
          {
            discordUserId,
            channelId,
            message: `✅ **Destination Added Successfully**\n\n` +
                    `**Type:** ${type}\n` +
                    `**Name:** ${name}\n` +
                    `**Identifier:** ${identifier}\n` +
                    `**Status:** Active with consent`
          },
          { priority: 7 }
        );
      }

      return result;
    } catch (error) {
      // Notify Discord of failure
      if (discordUserId && channelId) {
        await this.queueManager.addJob(
          'discord-notifications',
          'send-notification',
          {
            discordUserId,
            channelId,
            message: `❌ **Failed to Add Destination**\n\n` +
                    `**Error:** ${error.message}\n` +
                    `**Identifier:** ${identifier}`
          },
          { priority: 7 }
        );
      }

      throw error;
    }
  }

  /**
   * Handle remove destination request
   */
  private async handleRemoveDestination(data: any): Promise<any> {
    const { clientId, identifier, discordUserId, channelId } = data;

    try {
      await this.whatsappService.removeDestination(clientId, identifier);

      // Notify Discord of success
      if (discordUserId && channelId) {
        await this.queueManager.addJob(
          'discord-notifications',
          'send-notification',
          {
            discordUserId,
            channelId,
            message: `✅ **Destination Removed Successfully**\n\n` +
                    `**Identifier:** ${identifier}\n` +
                    `**Status:** Consent revoked and deactivated`
          },
          { priority: 7 }
        );
      }

      return { success: true, message: 'Destination removed successfully' };
    } catch (error) {
      // Notify Discord of failure
      if (discordUserId && channelId) {
        await this.queueManager.addJob(
          'discord-notifications',
          'send-notification',
          {
            discordUserId,
            channelId,
            message: `❌ **Failed to Remove Destination**\n\n` +
                    `**Error:** ${error.message}\n` +
                    `**Identifier:** ${identifier}`
          },
          { priority: 7 }
        );
      }

      throw error;
    }
  }

  /**
   * Handle validate destination request
   */
  private async handleValidateDestination(data: any): Promise<any> {
    const { clientId, identifier } = data;

    try {
      const isValid = await this.whatsappService.validateDestination(clientId, identifier);
      
      return {
        success: true,
        identifier,
        isValid,
        timestamp: new Date()
      };
    } catch (error) {
      this.serviceLogger.error(`Failed to validate destination ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Handle cleanup destinations request
   */
  private async handleCleanupDestinations(data: any): Promise<any> {
    const { clientId, discordUserId, channelId } = data;

    try {
      const result = await this.whatsappService.performDestinationCleanup(clientId);

      // Notify Discord of cleanup results
      if (discordUserId && channelId) {
        const message = result.cleaned > 0 
          ? `🧹 **Destination Cleanup Completed**\n\n` +
            `**Cleaned:** ${result.cleaned} invalid destinations\n` +
            `**Errors:** ${result.errors.length}\n` +
            (result.errors.length > 0 ? `**Error Details:**\n${result.errors.slice(0, 3).join('\n')}` : '')
          : `✅ **Destination Cleanup Completed**\n\nAll destinations are valid - no cleanup needed.`;

        await this.queueManager.addJob(
          'discord-notifications',
          'send-notification',
          {
            discordUserId,
            channelId,
            message
          },
          { priority: 6 }
        );
      }

      return result;
    } catch (error) {
      // Notify Discord of failure
      if (discordUserId && channelId) {
        await this.queueManager.addJob(
          'discord-notifications',
          'send-notification',
          {
            discordUserId,
            channelId,
            message: `❌ **Destination Cleanup Failed**\n\n**Error:** ${error.message}`
          },
          { priority: 7 }
        );
      }

      throw error;
    }
  }

  /**
   * Handle health check request
   */
  private async handleHealthCheck(data: any): Promise<any> {
    try {
      const health = await this.whatsappService.healthCheck();
      return health;
    } catch (error) {
      this.serviceLogger.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Handle session health check request
   */
  private async handleSessionHealthCheck(data: any): Promise<any> {
    const { clientId } = data;

    try {
      const health = await this.whatsappService.healthCheck();
      return health;
    } catch (error) {
      this.serviceLogger.error(`Session health check failed for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Handle service stats request
   */
  private async handleServiceStats(data: any): Promise<any> {
    try {
      const stats = this.whatsappService.getStatus();
      return stats;
    } catch (error) {
      this.serviceLogger.error('Failed to get service stats:', error);
      throw error;
    }
  }

  /**
   * Schedule periodic health checks
   */
  async scheduleHealthChecks(): Promise<void> {
    // Schedule health check every 5 minutes
    setInterval(async () => {
      try {
        await this.queueManager.addJob(
          'whatsapp-health-monitoring',
          'health-check',
          {},
          { 
            priority: 3,
            attempts: 1,
            removeOnComplete: 5,
            removeOnFail: 3
          }
        );
      } catch (error) {
        this.serviceLogger.error('Failed to schedule health check:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    this.serviceLogger.info('✅ Health checks scheduled');
  }

  /**
   * Schedule periodic destination cleanup
   */
  async scheduleDestinationCleanup(): Promise<void> {
    // Schedule cleanup every 6 hours
    setInterval(async () => {
      try {
        // Get all active clients and schedule cleanup for each
        const stats = this.whatsappService.getStatus();
        const activeClients = Object.keys(stats.sessions || {});

        for (const clientId of activeClients) {
          await this.queueManager.addJob(
            'whatsapp-destination-management',
            'cleanup-destinations',
            { clientId },
            { 
              priority: 2,
              attempts: 2,
              removeOnComplete: 3,
              removeOnFail: 5,
              delay: Math.random() * 60000 // Random delay up to 1 minute
            }
          );
        }
      } catch (error) {
        this.serviceLogger.error('Failed to schedule destination cleanup:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours

    this.serviceLogger.info('✅ Destination cleanup scheduled');
  }

  /**
   * Get integration status
   */
  getStatus(): any {
    return {
      whatsappService: this.whatsappService.getStatus(),
      integration: {
        initialized: true,
        timestamp: new Date()
      }
    };
  }

  /**
   * Stop the integration
   */
  async stop(): Promise<void> {
    try {
      this.serviceLogger.info('🛑 Stopping WhatsApp Service Integration...');
      
      await this.whatsappService.stop();
      
      this.serviceLogger.info('✅ WhatsApp Service Integration stopped');
    } catch (error) {
      this.serviceLogger.error('Error stopping WhatsApp Service Integration:', error);
    }
  }
}