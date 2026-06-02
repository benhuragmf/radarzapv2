import { logger, createServiceLogger } from '@/utils/logger';

/**
 * Service interface for all services
 */
export interface IService {
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; details: any }>;
  getStatus(): any;
}

/**
 * Service registry for managing all microservices
 */
export class ServiceRegistry {
  private services: Map<string, IService> = new Map();
  private serviceLogger = createServiceLogger('ServiceRegistry');

  /**
   * Register a service
   */
  register(name: string, service: IService): void {
    this.services.set(name, service);
    this.serviceLogger.info(`Service registered: ${name}`);
  }

  /**
   * Unregister a service
   */
  unregister(name: string): void {
    this.services.delete(name);
    this.serviceLogger.info(`Service unregistered: ${name}`);
  }

  /**
   * Get a service by name
   */
  get(name: string): IService | undefined {
    return this.services.get(name);
  }

  /**
   * Get all services
   */
  getAll(): Map<string, IService> {
    return new Map(this.services);
  }

  /**
   * Start all services
   */
  async startAll(): Promise<void> {
    this.serviceLogger.info('Starting all services...');

    const startPromises = Array.from(this.services.entries()).map(async ([name, service]) => {
      try {
        await service.start();
        this.serviceLogger.info(`✅ Service started: ${name}`);
      } catch (error) {
        this.serviceLogger.error(`❌ Failed to start service ${name}:`, error);
        throw error;
      }
    });

    await Promise.all(startPromises);
    this.serviceLogger.info('✅ All services started successfully');
  }

  /**
   * Stop all services
   */
  async stopAll(): Promise<void> {
    this.serviceLogger.info('Stopping all services...');

    const stopPromises = Array.from(this.services.entries()).map(async ([name, service]) => {
      try {
        await service.stop();
        this.serviceLogger.info(`✅ Service stopped: ${name}`);
      } catch (error) {
        this.serviceLogger.error(`❌ Error stopping service ${name}:`, error);
      }
    });

    await Promise.allSettled(stopPromises);
    this.serviceLogger.info('✅ All services stopped');
  }

  /**
   * Health check for all services
   */
  async healthCheckAll(): Promise<{ [serviceName: string]: { healthy: boolean; details: any } }> {
    const healthChecks: { [serviceName: string]: { healthy: boolean; details: any } } = {};

    const healthPromises = Array.from(this.services.entries()).map(async ([name, service]) => {
      try {
        const health = await service.healthCheck();
        healthChecks[name] = health;
      } catch (error) {
        healthChecks[name] = {
          healthy: false,
          details: { error: error.message }
        };
      }
    });

    await Promise.allSettled(healthPromises);
    return healthChecks;
  }

  /**
   * Get status of all services
   */
  getStatusAll(): { [serviceName: string]: any } {
    const statuses: { [serviceName: string]: any } = {};

    for (const [name, service] of this.services) {
      try {
        statuses[name] = service.getStatus();
      } catch (error) {
        statuses[name] = { error: error.message };
      }
    }

    return statuses;
  }

  /**
   * Get service count
   */
  getServiceCount(): number {
    return this.services.size;
  }

  /**
   * List service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }
}