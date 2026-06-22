import { logger } from '@/utils/logger';

/**
 * Graceful shutdown handler for autonomous operation
 */
export class GracefulShutdown {
  private shutdownHandlers: Array<() => Promise<void>> = [];
  private isShuttingDown = false;
  private shutdownTimeout = 30000; // 30 seconds

  constructor() {
    if (process.env.npm_lifecycle_event === 'dev' || process.env.RADARZAP_DEV === '1') {
      this.shutdownTimeout = 12_000;
    }
    this.setupSignalHandlers();
  }

  /**
   * Register a shutdown handler
   */
  register(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Set shutdown timeout
   */
  setTimeout(timeout: number): void {
    this.shutdownTimeout = timeout;
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    // Handle SIGTERM (Docker stop)
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM signal');
      this.initiateShutdown();
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      logger.info('Received SIGINT signal');
      this.initiateShutdown();
    });

    // Handle SIGUSR2 (nodemon restart)
    process.on('SIGUSR2', () => {
      logger.info('Received SIGUSR2 signal');
      this.initiateShutdown();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      this.initiateShutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      this.initiateShutdown(1);
    });
  }

  /**
   * Initiate graceful shutdown process
   */
  private async initiateShutdown(exitCode: number = 0): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info('🛑 Initiating graceful shutdown...');

    // Set a timeout to force exit if shutdown takes too long
    const forceExitTimer = setTimeout(() => {
      logger.error('⏰ Shutdown timeout reached, forcing exit');
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      // Execute all shutdown handlers in parallel
      const shutdownPromises = this.shutdownHandlers.map(async (handler, index) => {
        try {
          logger.info(`Executing shutdown handler ${index + 1}/${this.shutdownHandlers.length}`);
          await handler();
          logger.info(`✅ Shutdown handler ${index + 1} completed`);
        } catch (error) {
          logger.error(`❌ Shutdown handler ${index + 1} failed:`, error);
        }
      });

      await Promise.allSettled(shutdownPromises);
      
      clearTimeout(forceExitTimer);
      logger.info('✅ Graceful shutdown completed');
      
      process.exit(exitCode);
    } catch (error) {
      logger.error('❌ Error during graceful shutdown:', error);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  }

  /**
   * Check if shutdown is in progress
   */
  isShuttingDownNow(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Create a shutdown-aware wrapper for async operations
   */
  createShutdownAwareWrapper<T>(operation: () => Promise<T>): () => Promise<T | null> {
    return async (): Promise<T | null> => {
      if (this.isShuttingDown) {
        logger.warn('Operation skipped due to shutdown in progress');
        return null;
      }

      try {
        return await operation();
      } catch (error) {
        if (this.isShuttingDown) {
          logger.info('Operation interrupted by shutdown');
          return null;
        }
        throw error;
      }
    };
  }

  /**
   * Create a shutdown-aware interval
   */
  createShutdownAwareInterval(callback: () => Promise<void>, interval: number): NodeJS.Timeout {
    const wrappedCallback = this.createShutdownAwareWrapper(callback);
    
    const intervalId = setInterval(async () => {
      if (this.isShuttingDown) {
        clearInterval(intervalId);
        return;
      }
      
      await wrappedCallback();
    }, interval);

    // Register cleanup for this interval
    this.register(async () => {
      clearInterval(intervalId);
    });

    return intervalId;
  }

  /**
   * Create a shutdown-aware timeout
   */
  createShutdownAwareTimeout(callback: () => Promise<void>, timeout: number): NodeJS.Timeout {
    const wrappedCallback = this.createShutdownAwareWrapper(callback);
    
    const timeoutId = setTimeout(async () => {
      if (!this.isShuttingDown) {
        await wrappedCallback();
      }
    }, timeout);

    // Register cleanup for this timeout
    this.register(async () => {
      clearTimeout(timeoutId);
    });

    return timeoutId;
  }

  /**
   * Wait for shutdown signal (useful for testing)
   */
  async waitForShutdown(): Promise<void> {
    return new Promise((resolve) => {
      const checkShutdown = () => {
        if (this.isShuttingDown) {
          resolve();
        } else {
          setTimeout(checkShutdown, 100);
        }
      };
      checkShutdown();
    });
  }
}