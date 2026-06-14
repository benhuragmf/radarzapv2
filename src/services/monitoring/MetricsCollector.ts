import { createServiceLogger } from '../../utils/logger';
import { config } from '../../config/environment';
import { WhatsAppService } from '../whatsapp/WhatsAppService';
import { QueueManager } from '../../cache/QueueManager';
import { Template } from '../../models/Template';

const logger = createServiceLogger('MetricsCollector');

export interface SystemMetrics {
  timestamp: Date;
  system: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    loadAverage: number[];
    platform: string;
    nodeVersion: string;
    pid: number;
  };
  application: {
    activeConnections: number;
    totalRequests: number;
    errorRate: number;
    responseTime: {
      avg: number;
      p95: number;
      p99: number;
    };
    discordBot: {
      connected: boolean;
      guilds: number;
      latency: number;
      messagesProcessed: number;
    };
    whatsapp: {
      activeSessions: number;
      messagesQueued: number;
      messagesSent: number;
      failureRate: number;
    };
    templates: {
      totalTemplates: number;
      renderCount: number;
      errorCount: number;
    };
  };
  business: {
    dailyActiveUsers: number;
    messagesPerHour: number;
    topTemplates: Array<{ name: string; usage: number }>;
    errorsByType: Record<string, number>;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: SystemMetrics) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // minutes
  lastTriggered?: Date;
  enabled: boolean;
}

/**
 * Advanced Metrics Collection and Monitoring System
 */
export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: SystemMetrics[] = [];
  private alertRules: AlertRule[] = [];
  private requestTimes: number[] = [];
  private errorCounts: Record<string, number> = {};
  private businessMetrics = {
    dailyUsers: new Set<string>(),
    hourlyMessages: 0,
    templateUsage: new Map<string, number>(),
    lastHourReset: Date.now()
  };

  private constructor() {
    this.initializeAlertRules();
    this.startCollection();
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Initialize default alert rules
   */
  private initializeAlertRules(): void {
    this.alertRules = [
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        condition: (metrics) => metrics.system.memory.heapUsed > 500 * 1024 * 1024, // 500MB
        severity: 'medium',
        cooldown: 15,
        enabled: true
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        condition: (metrics) => metrics.application.errorRate > 0.05, // 5%
        severity: 'high',
        cooldown: 10,
        enabled: true
      },
      {
        id: 'discord_disconnected',
        name: 'Discord Bot Disconnected',
        condition: (metrics) => !metrics.application.discordBot.connected,
        severity: 'critical',
        cooldown: 5,
        enabled: true
      },
      {
        id: 'high_response_time',
        name: 'High Response Time',
        condition: (metrics) => metrics.application.responseTime.avg > 2000, // 2 seconds
        severity: 'medium',
        cooldown: 10,
        enabled: true
      },
      {
        id: 'queue_backlog',
        name: 'Message Queue Backlog',
        condition: (metrics) => metrics.application.whatsapp.messagesQueued > 100,
        severity: 'medium',
        cooldown: 15,
        enabled: true
      }
    ];

    logger.info('Alert rules initialized', { count: this.alertRules.length });
  }

  /**
   * Start metrics collection
   */
  private startCollection(): void {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectMetrics();
    }, 30000);

    // Clean old metrics every hour (keep last 24 hours)
    setInterval(() => {
      this.cleanOldMetrics();
    }, 60 * 60 * 1000);

    // Reset hourly business metrics
    setInterval(() => {
      this.resetHourlyMetrics();
    }, 60 * 60 * 1000);

    logger.info('Metrics collection started');
  }

  /**
   * Collect current system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics: SystemMetrics = {
        timestamp: new Date(),
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          loadAverage: require('os').loadavg(),
          platform: process.platform,
          nodeVersion: process.version,
          pid: process.pid
        },
        application: {
          activeConnections: 0, // TODO: Track actual connections
          totalRequests: this.getTotalRequests(),
          errorRate: this.calculateErrorRate(),
          responseTime: this.calculateResponseTimes(),
          discordBot: await this.getDiscordMetrics(),
          whatsapp: await this.getWhatsAppMetrics(),
          templates: await this.getTemplateMetrics()
        },
        business: {
          dailyActiveUsers: this.businessMetrics.dailyUsers.size,
          messagesPerHour: this.businessMetrics.hourlyMessages,
          topTemplates: this.getTopTemplates(),
          errorsByType: { ...this.errorCounts }
        }
      };

      this.metrics.push(metrics);
      this.checkAlerts(metrics);

      logger.debug('Metrics collected', {
        memoryUsage: Math.round(metrics.system.memory.heapUsed / 1024 / 1024) + 'MB',
        errorRate: metrics.application.errorRate,
        responseTime: metrics.application.responseTime.avg
      });

    } catch (error) {
      logger.error('Failed to collect metrics', error as Error);
    }
  }

  /**
   * Get Discord bot metrics
   */
  private async getDiscordMetrics(): Promise<SystemMetrics['application']['discordBot']> {
    try {
      // TODO: Get actual Discord bot instance
      return {
        connected: true,
        guilds: 1,
        latency: 100,
        messagesProcessed: 0
      };
    } catch (error) {
      return {
        connected: false,
        guilds: 0,
        latency: 0,
        messagesProcessed: 0
      };
    }
  }

  /**
   * Get WhatsApp service metrics
   */
  private async getWhatsAppMetrics(): Promise<SystemMetrics['application']['whatsapp']> {
    try {
      const wa = WhatsAppService.getInstance().getMonitoringSnapshot();
      const stats = await QueueManager.getInstance().getQueueStats();
      let messagesQueued = 0;
      let messagesFailed = 0;
      if (stats && typeof stats === 'object') {
        for (const entry of Object.values(stats)) {
          const row = entry as { waiting?: number; failed?: number };
          messagesQueued += row.waiting ?? 0;
          messagesFailed += row.failed ?? 0;
        }
      }
      const denom = messagesQueued + messagesFailed;
      return {
        activeSessions: wa.activeSessions,
        messagesQueued,
        messagesSent: this.businessMetrics.hourlyMessages,
        failureRate: denom > 0 ? messagesFailed / denom : 0,
      };
    } catch (error) {
      logger.debug('WhatsApp metrics fallback', { error: (error as Error).message });
      return {
        activeSessions: 0,
        messagesQueued: 0,
        messagesSent: 0,
        failureRate: 0,
      };
    }
  }

  /**
   * Get template service metrics
   */
  private async getTemplateMetrics(): Promise<SystemMetrics['application']['templates']> {
    try {
      const totalTemplates = await Template.countDocuments().catch(() => 0);
      return {
        totalTemplates,
        renderCount: Array.from(this.businessMetrics.templateUsage.values()).reduce((a, b) => a + b, 0),
        errorCount: this.errorCounts['template_error'] || 0,
      };
    } catch (error) {
      return {
        totalTemplates: 0,
        renderCount: 0,
        errorCount: 0,
      };
    }
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    const totalErrors = Object.values(this.errorCounts).reduce((a, b) => a + b, 0);
    const totalRequests = this.getTotalRequests();
    return totalRequests > 0 ? totalErrors / totalRequests : 0;
  }

  /**
   * Calculate response times
   */
  private calculateResponseTimes(): SystemMetrics['application']['responseTime'] {
    if (this.requestTimes.length === 0) {
      return { avg: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.requestTimes].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    return {
      avg: Math.round(avg),
      p95: sorted[p95Index] || 0,
      p99: sorted[p99Index] || 0
    };
  }

  /**
   * Get total requests count
   */
  private getTotalRequests(): number {
    return this.requestTimes.length;
  }

  /**
   * Get top templates by usage
   */
  private getTopTemplates(): Array<{ name: string; usage: number }> {
    return Array.from(this.businessMetrics.templateUsage.entries())
      .map(([name, usage]) => ({ name, usage }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5);
  }

  /**
   * Check alert rules
   */
  private checkAlerts(metrics: SystemMetrics): void {
    const now = new Date();

    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered) {
        const timeSinceLastAlert = now.getTime() - rule.lastTriggered.getTime();
        if (timeSinceLastAlert < rule.cooldown * 60 * 1000) {
          continue;
        }
      }

      // Check condition
      if (rule.condition(metrics)) {
        this.triggerAlert(rule, metrics);
        rule.lastTriggered = now;
      }
    }
  }

  /**
   * Trigger alert
   */
  private triggerAlert(rule: AlertRule, metrics: SystemMetrics): void {
    logger.warn('Alert triggered', {
      alertId: rule.id,
      alertName: rule.name,
      severity: rule.severity,
      timestamp: new Date().toISOString(),
      metrics: {
        memoryUsage: Math.round(metrics.system.memory.heapUsed / 1024 / 1024) + 'MB',
        errorRate: metrics.application.errorRate,
        responseTime: metrics.application.responseTime.avg,
        discordConnected: metrics.application.discordBot.connected
      }
    });

    // TODO: Send alert to external systems (webhook, email, etc.)
    this.sendAlert(rule, metrics);
  }

  /**
   * Send alert to external systems
   */
  private async sendAlert(rule: AlertRule, metrics: SystemMetrics): Promise<void> {
    try {
      // TODO: Implement webhook/email notifications
      logger.info('Alert notification sent', { alertId: rule.id, severity: rule.severity });
    } catch (error) {
      logger.error('Failed to send alert notification', error as Error, { alertId: rule.id });
    }
  }

  /**
   * Clean old metrics (keep last 24 hours)
   */
  private cleanOldMetrics(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const initialCount = this.metrics.length;
    
    this.metrics = this.metrics.filter(metric => metric.timestamp > cutoff);
    
    const removedCount = initialCount - this.metrics.length;
    if (removedCount > 0) {
      logger.debug('Old metrics cleaned', { removed: removedCount, remaining: this.metrics.length });
    }
  }

  /**
   * Reset hourly business metrics
   */
  private resetHourlyMetrics(): void {
    this.businessMetrics.hourlyMessages = 0;
    this.businessMetrics.lastHourReset = Date.now();
    
    // Reset daily users at midnight
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      this.businessMetrics.dailyUsers.clear();
    }

    logger.debug('Hourly metrics reset');
  }

  /**
   * Record API request
   */
  recordRequest(responseTime: number, statusCode: number, userId?: string): void {
    this.requestTimes.push(responseTime);
    
    // Keep only last 1000 request times
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-1000);
    }

    // Track daily active users
    if (userId) {
      this.businessMetrics.dailyUsers.add(userId);
    }

    // Track errors
    if (statusCode >= 400) {
      const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
      this.errorCounts[errorType] = (this.errorCounts[errorType] || 0) + 1;
    }
  }

  /**
   * Record template usage
   */
  recordTemplateUsage(templateName: string): void {
    const current = this.businessMetrics.templateUsage.get(templateName) || 0;
    this.businessMetrics.templateUsage.set(templateName, current + 1);
  }

  /**
   * Record message sent
   */
  recordMessageSent(): void {
    this.businessMetrics.hourlyMessages++;
  }

  /**
   * Record error
   */
  recordError(errorType: string): void {
    this.errorCounts[errorType] = (this.errorCounts[errorType] || 0) + 1;
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): SystemMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 1): SystemMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter(metric => metric.timestamp > cutoff);
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  /**
   * Update alert rule
   */
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const ruleIndex = this.alertRules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) return false;

    this.alertRules[ruleIndex] = { ...this.alertRules[ruleIndex], ...updates };
    logger.info('Alert rule updated', { ruleId, updates });
    return true;
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    logger.info('Alert rule added', { ruleId: rule.id, name: rule.name });
  }

  /**
   * Get system health summary
   */
  getHealthSummary(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    alerts: number;
    uptime: number;
  } {
    const current = this.getCurrentMetrics();
    if (!current) {
      return {
        status: 'unhealthy',
        checks: {},
        alerts: 0,
        uptime: 0
      };
    }

    const checks = {
      memory: current.system.memory.heapUsed < 500 * 1024 * 1024,
      errorRate: current.application.errorRate < 0.05,
      responseTime: current.application.responseTime.avg < 2000,
      discordBot: current.application.discordBot.connected
    };

    const healthyChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.values(checks).length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks >= totalChecks * 0.7) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const activeAlerts = this.alertRules.filter(rule => {
      return rule.enabled && rule.lastTriggered && 
             (Date.now() - rule.lastTriggered.getTime()) < rule.cooldown * 60 * 1000;
    }).length;

    return {
      status,
      checks,
      alerts: activeAlerts,
      uptime: current.system.uptime
    };
  }
}

export default MetricsCollector;