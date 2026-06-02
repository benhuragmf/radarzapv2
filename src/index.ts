/**
 * Main application entry point
 * Starts services based on environment configuration
 */

import { config, validateServiceConfig } from '@/config/environment';
import { createServiceLogger } from '@/utils/logger';
import { DatabaseManager } from '@/database/DatabaseManager';
import { RedisManager } from '@/cache/RedisManager';
import { DiscordBotService } from '@/services/discord-bot/DiscordBotService';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { QueueProcessorService } from '@/services/queue/QueueProcessorService';
import { APIGateway } from '@/services/api-gateway/APIGateway';
import { DashboardService } from '@/services/web-dashboard/DashboardService';
import { GracefulShutdown } from '@/utils/GracefulShutdown';

const logger = createServiceLogger('MainApp');

/**
 * Main application class
 */
class Application {
  private services: Map<string, any> = new Map();
  private gracefulShutdown: GracefulShutdown;

  constructor() {
    this.gracefulShutdown = new GracefulShutdown();
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    try {
      logger.info('🚀 Starting Discord-WhatsApp Bot Application...');
      logger.info(`Environment: ${config.NODE_ENV}`);
      logger.info(`Service: ${config.SERVICE_NAME || 'all'}`);

      // Initialize core infrastructure
      await this.initializeInfrastructure();

      // Start services based on configuration
      await this.startServices();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('✅ Application started successfully!');

    } catch (error) {
      logger.error('❌ Failed to start application:', error);
      process.exit(1);
    }
  }

  /**
   * Initialize core infrastructure (database, redis)
   */
  private async initializeInfrastructure(): Promise<void> {
    logger.info('🔧 Initializing infrastructure...');

    // Initialize database
    const dbManager = DatabaseManager.getInstance();
    await dbManager.connect();
    logger.info('✅ Database connected');

    // Initialize Redis
    const redisManager = RedisManager.getInstance();
    await redisManager.connect();
    logger.info('✅ Redis connected');
  }

  /**
   * Start services based on environment configuration
   */
  private async startServices(): Promise<void> {
    const serviceName = config.SERVICE_NAME;

    if (!serviceName || serviceName === 'discord-bot') {
      await this.startDiscordBot();
    }

    if (!serviceName || serviceName === 'whatsapp-service') {
      await this.startWhatsAppService();
    }

    if (!serviceName || serviceName === 'queue-processor') {
      await this.startQueueProcessor();
    }

    if (!serviceName || serviceName === 'api-gateway') {
      await this.startAPIGateway();
    }

    if (!serviceName || serviceName === 'web-dashboard') {
      await this.startDashboard();
    }

    // If no specific service is set, start all services
    if (!serviceName) {
      logger.info('🎯 All services started in single-process mode');
    }
  }

  /**
   * Start Discord Bot service
   */
  private async startDiscordBot(): Promise<void> {
    try {
      validateServiceConfig('discord-bot');
      
      const discordBot = new DiscordBotService();
      await discordBot.start();
      
      this.services.set('discord-bot', discordBot);
      logger.info('✅ Discord Bot service started');
    } catch (error) {
      logger.error('❌ Failed to start Discord Bot service:', error);
      throw error;
    }
  }

  /**
   * Start WhatsApp service
   */
  private async startWhatsAppService(): Promise<void> {
    try {
      validateServiceConfig('whatsapp-service');
      
      const whatsappService = WhatsAppService.getInstance();
      await whatsappService.start();
      
      this.services.set('whatsapp-service', whatsappService);
      logger.info('✅ WhatsApp service started');
    } catch (error) {
      logger.error('❌ Failed to start WhatsApp service:', error);
      throw error;
    }
  }

  /**
   * Start Queue Processor service
   */
  private async startQueueProcessor(): Promise<void> {
    try {
      validateServiceConfig('queue-processor');
      
      const queueProcessor = new QueueProcessorService();
      await queueProcessor.start();
      
      this.services.set('queue-processor', queueProcessor);
      logger.info('✅ Queue Processor service started');
    } catch (error) {
      logger.error('❌ Failed to start Queue Processor service:', error);
      throw error;
    }
  }

  private async startAPIGateway(): Promise<void> {
    try {
      const gateway = new APIGateway();
      await gateway.start();
      
      this.services.set('api-gateway', gateway);
      logger.info('✅ API Gateway service started');
    } catch (error) {
      logger.error('❌ Failed to start API Gateway service:', error);
      throw error;
    }
  }

  private async startDashboard(): Promise<void> {
    try {
      const dashboard = DashboardService.getInstance(3001);
      await dashboard.start();
      this.services.set('web-dashboard', dashboard);
      logger.info('✅ Web Dashboard service started');
    } catch (error) {
      logger.error('❌ Failed to start Web Dashboard service:', error);
      // Non-fatal — don't throw, dashboard is optional
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    this.gracefulShutdown.register(async () => {
      logger.info('🛑 Graceful shutdown initiated...');

      // Stop all services
      for (const [name, service] of this.services) {
        try {
          if (service.stop) {
            await service.stop();
            logger.info(`✅ ${name} stopped`);
          }
        } catch (error) {
          logger.error(`❌ Error stopping ${name}:`, error);
        }
      }

      // Close infrastructure connections
      try {
        await RedisManager.getInstance().disconnect();
        logger.info('✅ Redis disconnected');
      } catch (error) {
        logger.error('❌ Error disconnecting Redis:', error);
      }

      try {
        await DatabaseManager.getInstance().disconnect();
        logger.info('✅ Database disconnected');
      } catch (error) {
        logger.error('❌ Error disconnecting database:', error);
      }

      logger.info('✅ Graceful shutdown completed');
    });
  }
}

/**
 * Start the application
 */
async function main() {
  const app = new Application();
  await app.start();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the application
main().catch((error) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});