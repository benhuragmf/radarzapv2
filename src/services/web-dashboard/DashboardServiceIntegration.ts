import { ServiceRegistry } from '../ServiceRegistry';
import { DashboardService } from './DashboardService';
import { createServiceLogger } from '../../utils/logger';

const logger = createServiceLogger('DashboardServiceIntegration');

export class DashboardServiceIntegration {
  private static instance: DashboardServiceIntegration;
  private serviceRegistry: ServiceRegistry;
  private dashboardService: DashboardService;

  private constructor(serviceRegistry: ServiceRegistry, port?: number) {
    this.serviceRegistry = serviceRegistry;
    this.dashboardService = DashboardService.getInstance(port);
  }

  static getInstance(serviceRegistry: ServiceRegistry, port?: number): DashboardServiceIntegration {
    if (!DashboardServiceIntegration.instance) {
      DashboardServiceIntegration.instance = new DashboardServiceIntegration(serviceRegistry, port);
    }
    return DashboardServiceIntegration.instance;
  }

  async registerService(): Promise<void> {
    this.serviceRegistry.register('web-dashboard', this.dashboardService);
    logger.info('✅ Web dashboard service registered');
  }

  async startService(): Promise<void> {
    await this.dashboardService.start();
    logger.info('✅ Dashboard service started');
  }

  async stopService(): Promise<void> {
    await this.dashboardService.stop();
  }

  async getServiceHealth() {
    return this.dashboardService.healthCheck();
  }

  getServiceStatus() {
    return this.dashboardService.getStatus();
  }

  getService(): DashboardService {
    return this.dashboardService;
  }
}

export default DashboardServiceIntegration;
