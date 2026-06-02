import { EventEmitter } from 'events';

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database?: boolean;
    redis?: boolean;
    discord_api?: boolean;
    whatsapp_service?: boolean;
    memory?: boolean;
    disk?: boolean;
  };
  uptime: number;
  version: string;
  timestamp: Date;
  responseTime?: number;
}

export interface ServiceMetrics {
  cpu_usage: number;
  memory_usage: number;
  active_connections: number;
  requests_per_minute: number;
  error_rate: number;
  uptime: number;
}

export class HealthMonitor extends EventEmitter {
  private static instance: HealthMonitor;
  private checks: Map<string, () => Promise<boolean>> = new Map();
  private metrics: ServiceMetrics;
  private startTime: number;
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.startTime = Date.now();
    this.metrics = {
      cpu_usage: 0,
      memory_usage: 0,
      active_connections: 0,
      requests_per_minute: 0,
      error_rate: 0,
      uptime: 0
    };
  }

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  /**
   * Register a health check for a service
   */
  registerCheck(serviceName: string, checkFunction: () => Promise<boolean>): void {
    this.checks.set(serviceName, checkFunction);
  }

  /**
   * Start monitoring with specified interval
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);

    // Perform initial check
    this.performHealthCheck();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheck> {
    const startTime = Date.now();
    const checks: Record<string, boolean> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Execute all registered checks
    for (const [serviceName, checkFunction] of this.checks) {
      try {
        checks[serviceName] = await checkFunction();
        if (!checks[serviceName]) {
          overallStatus = overallStatus === 'healthy' ? 'degraded' : 'unhealthy';
        }
      } catch (error) {
        checks[serviceName] = false;
        overallStatus = 'unhealthy';
        this.emit('check_failed', { service: serviceName, error });
      }
    }

    // Update metrics
    await this.updateMetrics();

    const healthCheck: HealthCheck = {
      service: 'discord-whatsapp-bot',
      status: overallStatus,
      checks,
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date(),
      responseTime: Date.now() - startTime
    };

    // Emit events based on status
    this.emit('health_check', healthCheck);
    
    if (overallStatus === 'unhealthy') {
      this.emit('service_unhealthy', healthCheck);
    } else if (overallStatus === 'degraded') {
      this.emit('service_degraded', healthCheck);
    }

    return healthCheck;
  }

  /**
   * Get current health status
   */
  async getHealthStatus(): Promise<HealthCheck> {
    return await this.performHealthCheck();
  }

  /**
   * Get service metrics
   */
  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Update system metrics
   */
  private async updateMetrics(): Promise<void> {
    const memUsage = process.memoryUsage();
    
    this.metrics = {
      cpu_usage: process.cpuUsage().user / 1000000, // Convert to seconds
      memory_usage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      active_connections: 0, // Will be updated by services
      requests_per_minute: 0, // Will be updated by API gateway
      error_rate: 0, // Will be calculated from logs
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Register default system checks
   */
  registerDefaultChecks(): void {
    // Memory check
    this.registerCheck('memory', async () => {
      const memUsage = process.memoryUsage();
      const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      return memoryUsagePercent < 90; // Healthy if memory usage < 90%
    });

    // Process check
    this.registerCheck('process', async () => {
      return process.uptime() > 0;
    });

    // Environment check
    this.registerCheck('environment', async () => {
      const requiredEnvVars = ['NODE_ENV'];
      return requiredEnvVars.every(envVar => process.env[envVar] !== undefined);
    });
  }

  /**
   * Create a database health check
   */
  createDatabaseCheck(connectionTest: () => Promise<boolean>): () => Promise<boolean> {
    return async () => {
      try {
        return await connectionTest();
      } catch (error) {
        return false;
      }
    };
  }

  /**
   * Create a Redis health check
   */
  createRedisCheck(pingTest: () => Promise<boolean>): () => Promise<boolean> {
    return async () => {
      try {
        return await pingTest();
      } catch (error) {
        return false;
      }
    };
  }

  /**
   * Create an external API health check
   */
  createExternalAPICheck(
    apiName: string, 
    healthEndpoint: string, 
    timeout: number = 5000
  ): () => Promise<boolean> {
    return async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(healthEndpoint, {
          signal: controller.signal,
          method: 'GET'
        });

        clearTimeout(timeoutId);
        return response.ok;
      } catch (error) {
        return false;
      }
    };
  }

  /**
   * Get health check summary for dashboard
   */
  async getHealthSummary(): Promise<{
    status: string;
    uptime: string;
    checks: number;
    healthy: number;
    unhealthy: number;
    lastCheck: Date;
  }> {
    const health = await this.getHealthStatus();
    const checksArray = Object.values(health.checks);
    
    return {
      status: health.status,
      uptime: this.formatUptime(health.uptime),
      checks: checksArray.length,
      healthy: checksArray.filter(check => check === true).length,
      unhealthy: checksArray.filter(check => check === false).length,
      lastCheck: health.timestamp
    };
  }

  /**
   * Format uptime in human readable format
   */
  private formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

export default HealthMonitor;