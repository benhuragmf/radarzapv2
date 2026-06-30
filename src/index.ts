/*
 * Radar Chat / RadarGamer
 * Copyright (c) 2026 Benhur Augusto Gomes Monteiro Faria
 * Todos os direitos reservados.
 * Uso, cópia, distribuição ou modificação sem autorização é proibido.
 */

/**
 * Main application entry point
 * Starts services based on environment configuration
 */

import { config, validateConfig, validateServiceConfig } from '@/config/environment';
import { createServiceLogger } from '@/utils/logger';
import { DatabaseManager } from '@/database/DatabaseManager';
import { RedisManager } from '@/cache/RedisManager';
import { QueueManager } from '@/cache/QueueManager';
import { DiscordBotService } from '@/services/discord-bot/DiscordBotService';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';
import { QueueProcessorService } from '@/services/queue/QueueProcessorService';
import { WebhookDispatcherService } from '@/services/integrations/WebhookDispatcherService';
import { BillingService } from '@/services/billing/BillingService';
import { APIGateway } from '@/services/api-gateway/APIGateway';
import { DashboardService } from '@/services/web-dashboard/DashboardService';
import { GracefulShutdown } from '@/utils/GracefulShutdown';
import { acquireDevInstanceLock, releaseDevInstanceLock } from '@/utils/dev-instance-lock';
import { isDegradedBootAllowed, probeRedisReachable } from '@/services/infra/infra-boot.util';
import {
  finalizeInfraBoot,
  isDegradedBoot,
  markInfraRuntime,
  resetInfraRuntimeState,
} from '@/services/infra/infra-runtime-state';

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
      logger.info('Iniciando Radar Chat...');
      const envLabel =
        process.env.npm_lifecycle_event === 'dev'
          ? 'development (npm run dev)'
          : config.NODE_ENV;
      logger.info(`Environment: ${envLabel}`);
      logger.info(`Service: ${config.SERVICE_NAME || 'all'}`);
      validateConfig();

      // Initialize core infrastructure
      await this.initializeInfrastructure();

      // Start services based on configuration
      await this.startServices();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Aplicacao iniciada com sucesso');
      if (isDegradedBoot()) {
        logger.warn(
          'Modo degradado ativo — Redis/filas indisponíveis; ver GET /api/services/health e runbook SPOF',
        );
      }

    } catch (error) {
      const dup =
        error instanceof Error &&
        error.message.includes('Não é permitido duas instâncias em dev');
      if (dup) {
        logger.error(error.message);
      } else {
        logger.error('Falha ao iniciar aplicacao:', error);
      }
      process.exit(1);
    }
  }

  /**
   * Initialize core infrastructure (database, redis)
   */
  private async waitForMongoReady(dbManager: DatabaseManager, timeoutMs = 45_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!dbManager.isConnected() && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!dbManager.isConnected()) {
      throw new Error(
        'MongoDB indisponível após aguardar reconexão — execute: docker compose up -d mongodb redis',
      );
    }
  }

  private async initializeInfrastructure(): Promise<void> {
    logger.info('Inicializando infraestrutura...');
    resetInfraRuntimeState();
    const allowDegraded = isDegradedBootAllowed();

    const dbManager = DatabaseManager.getInstance();
    await dbManager.connect();
    await this.waitForMongoReady(dbManager);
    if (!dbManager.isConnected()) {
      throw new Error(
        'MongoDB indisponível após aguardar reconexão — execute: docker compose up -d mongodb redis',
      );
    }
    markInfraRuntime({ mongodbReady: true });
    logger.info('Banco de dados OK');

    const redisManager = RedisManager.getInstance();
    let redisReady = false;

    if (await probeRedisReachable()) {
      try {
        await redisManager.connect();
        redisReady = redisManager.isConnected();
      } catch (error) {
        logger.warn('Redis probe OK mas connect falhou:', error);
      }
    } else {
      logger.warn('Redis indisponível no boot (probe falhou)');
    }

    if (!redisReady) {
      if (!allowDegraded) {
        throw new Error(
          'Redis obrigatório no boot — execute: docker compose up -d redis ou habilite INFRA_DEGRADED_BOOT só em dev',
        );
      }
      markInfraRuntime({
        redisReady: false,
        queuesReady: false,
        degraded: true,
        degradedReasons: ['redis_unavailable_at_boot'],
      });
      logger.warn('Modo degradado: Redis indisponível — filas BullMQ e webhooks outbound não iniciados');
    } else {
      markInfraRuntime({ redisReady: true });
      logger.info('Redis OK');

      await QueueManager.getInstance().initialize();
      logger.info('Filas Bull OK');
      markInfraRuntime({ queuesReady: true });

      await WebhookDispatcherService.getInstance().initialize();
      logger.info('Webhooks outbound OK');
    }

    await acquireDevInstanceLock(config.DASHBOARD.PORT);

    BillingService.getInstance().initialize();
    logger.info('Billing Stripe OK');

    finalizeInfraBoot();
  }

  /**
   * Start services based on environment configuration
   */
  private async startServices(): Promise<void> {
    const serviceName = config.SERVICE_NAME;

    if (!serviceName || serviceName === 'whatsapp-service') {
      await this.startWhatsAppService();
    }

    if (!serviceName || serviceName === 'queue-processor') {
      await this.startQueueProcessor();
    }

    if (!serviceName || serviceName === 'discord-bot') {
      await this.startDiscordBot();
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
      logger.error('❌ Failed to start Discord Bot service (painel segue sem gateway Discord):', error);
      // Não derrubar o monolito — Inbox/WA/painel devem subir mesmo com Discord offline
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
      // Não fatal em dev — costuma ser porta 8080 (PORT) já em uso
    }
  }

  private async startDashboard(): Promise<void> {
    try {
      const dashboard = DashboardService.getInstance(3001);
      await dashboard.start();
      this.services.set('web-dashboard', dashboard);
      logger.info('✅ Web Dashboard service started');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      logger.error('❌ Failed to start Web Dashboard service:', {
        message: err.message,
        code: err.code,
        port: 3001,
        hint:
          err.code === 'EADDRINUSE'
            ? 'Porta 3001 ocupada — execute: npm run dev:stop'
            : undefined,
      });
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
        await releaseDevInstanceLock();
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
  const msg = reason instanceof Error ? reason.message : String(reason);
  const infraOffline =
    /ECONNREFUSED|ECONNRESET|Redis|Mongo|max retries/i.test(msg);

  if (config.NODE_ENV === 'development' && infraOffline) {
    logger.warn(`Infra offline (promise): ${msg}`);
    return;
  }

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
