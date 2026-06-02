import { ServiceRegistry } from '../ServiceRegistry';
import { DestinationHealthService } from './DestinationHealthService';
import { ComplianceService } from './ComplianceService';
import { DestinationSyncService } from './DestinationSyncService';
import { createServiceLogger } from '../../utils/logger';

const logger = createServiceLogger('DestinationServiceIntegration');

/**
 * Destination Service Integration
 * Registers all destination-related services with the main service registry
 */
export class DestinationServiceIntegration {
  private static instance: DestinationServiceIntegration;
  private serviceRegistry: ServiceRegistry;
  private services: {
    health: DestinationHealthService;
    compliance: ComplianceService;
    sync: DestinationSyncService;
  };

  private constructor(serviceRegistry: ServiceRegistry) {
    this.serviceRegistry = serviceRegistry;
    this.services = {
      health: DestinationHealthService.getInstance(),
      compliance: ComplianceService.getInstance(),
      sync: DestinationSyncService.getInstance()
    };
  }

  static getInstance(serviceRegistry: ServiceRegistry): DestinationServiceIntegration {
    if (!DestinationServiceIntegration.instance) {
      DestinationServiceIntegration.instance = new DestinationServiceIntegration(serviceRegistry);
    }
    return DestinationServiceIntegration.instance;
  }

  /**
   * Register all destination services
   */
  async registerServices(): Promise<void> {
    try {
      logger.info('Registering destination services...');

      // Register health service
      this.serviceRegistry.register('destination-health', this.services.health);
      logger.info('✅ Destination health service registered');

      // Register compliance service
      this.serviceRegistry.register('destination-compliance', this.services.compliance);
      logger.info('✅ Destination compliance service registered');

      // Register sync service
      this.serviceRegistry.register('destination-sync', this.services.sync);
      logger.info('✅ Destination sync service registered');

      logger.info('✅ All destination services registered successfully');
    } catch (error) {
      logger.error('Failed to register destination services', error);
      throw error;
    }
  }

  /**
   * Start all destination services
   */
  async startServices(): Promise<void> {
    try {
      logger.info('Starting destination services...');

      // Start services in order (compliance first, then health, then sync)
      await this.services.compliance.start();
      logger.info('✅ Compliance service started');

      await this.services.health.start();
      logger.info('✅ Health service started');

      await this.services.sync.start();
      logger.info('✅ Sync service started');

      logger.info('✅ All destination services started successfully');
    } catch (error) {
      logger.error('Failed to start destination services', error);
      throw error;
    }
  }

  /**
   * Stop all destination services
   */
  async stopServices(): Promise<void> {
    try {
      logger.info('Stopping destination services...');

      // Stop services in reverse order
      await this.services.sync.stop();
      logger.info('✅ Sync service stopped');

      await this.services.health.stop();
      logger.info('✅ Health service stopped');

      await this.services.compliance.stop();
      logger.info('✅ Compliance service stopped');

      logger.info('✅ All destination services stopped successfully');
    } catch (error) {
      logger.error('Failed to stop destination services', error);
      throw error;
    }
  }

  /**
   * Get health status of all destination services
   */
  async getServicesHealth(): Promise<{
    overall: boolean;
    services: {
      health: { healthy: boolean; details: any };
      compliance: { healthy: boolean; details: any };
      sync: { healthy: boolean; details: any };
    };
  }> {
    try {
      const [healthCheck, complianceCheck, syncCheck] = await Promise.all([
        this.services.health.healthCheck(),
        this.services.compliance.healthCheck(),
        this.services.sync.healthCheck()
      ]);

      const overall = healthCheck.healthy && complianceCheck.healthy && syncCheck.healthy;

      return {
        overall,
        services: {
          health: healthCheck,
          compliance: complianceCheck,
          sync: syncCheck
        }
      };
    } catch (error) {
      logger.error('Failed to get services health', error);
      return {
        overall: false,
        services: {
          health: { healthy: false, details: { error: 'Health check failed' } },
          compliance: { healthy: false, details: { error: 'Health check failed' } },
          sync: { healthy: false, details: { error: 'Health check failed' } }
        }
      };
    }
  }

  /**
   * Get status of all destination services
   */
  getServicesStatus(): {
    health: any;
    compliance: any;
    sync: any;
  } {
    return {
      health: this.services.health.getStatus(),
      compliance: this.services.compliance.getStatus(),
      sync: this.services.sync.getStatus()
    };
  }

  /**
   * Get service instances (for direct access if needed)
   */
  getServices() {
    return { ...this.services };
  }

  /**
   * Force health check on all services
   */
  async forceHealthCheckAll(): Promise<void> {
    logger.info('Forcing health check on all destination services...');
    
    try {
      await Promise.all([
        this.services.health.forceHealthCheck(),
        this.services.sync.forceFullValidation()
      ]);
      
      logger.info('✅ Health check completed on all destination services');
    } catch (error) {
      logger.error('Failed to force health check on all services', error);
      throw error;
    }
  }

  /**
   * Force cleanup on all services
   */
  async forceCleanupAll(): Promise<void> {
    logger.info('Forcing cleanup on all destination services...');
    
    try {
      await Promise.all([
        this.services.health.forceCleanup(),
        this.services.sync.forceFullSync()
      ]);
      
      logger.info('✅ Cleanup completed on all destination services');
    } catch (error) {
      logger.error('Failed to force cleanup on all services', error);
      throw error;
    }
  }

  /**
   * Reset statistics on all services
   */
  resetAllStats(): void {
    logger.info('Resetting statistics on all destination services...');
    
    try {
      this.services.health.resetHealthStats();
      this.services.sync.resetSyncStats();
      
      logger.info('✅ Statistics reset on all destination services');
    } catch (error) {
      logger.error('Failed to reset statistics on all services', error);
    }
  }
}

export default DestinationServiceIntegration;