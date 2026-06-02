import { Request, Response } from 'express';
import { MetricsCollector } from './MetricsCollector';
import { LogManager } from './LogManager';
import { createServiceLogger } from '../../utils/logger';

const logger = createServiceLogger('MonitoringController');
const metricsCollector = MetricsCollector.getInstance();
const logManager = LogManager.getInstance();

/**
 * Monitoring Controller
 * Handles HTTP requests for monitoring and logging endpoints
 */
export class MonitoringController {

  /**
   * Get current system metrics
   */
  static async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const current = metricsCollector.getCurrentMetrics();
      
      if (!current) {
        res.status(503).json({
          error: 'Metrics not available',
          code: 'METRICS_NOT_AVAILABLE'
        });
        return;
      }

      res.json({
        success: true,
        data: current,
        timestamp: new Date().toISOString()
      });

      logger.debug('Metrics retrieved');
    } catch (error) {
      logger.error('Failed to get metrics', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve metrics',
        code: 'METRICS_ERROR'
      });
    }
  }

  /**
   * Get metrics history
   */
  static async getMetricsHistory(req: Request, res: Response): Promise<void> {
    try {
      const { hours = '1' } = req.query;
      const hoursNum = parseInt(hours as string, 10);
      
      if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 24) {
        res.status(400).json({
          error: 'Hours must be between 1 and 24',
          code: 'INVALID_HOURS_PARAMETER'
        });
        return;
      }

      const history = metricsCollector.getMetricsHistory(hoursNum);

      res.json({
        success: true,
        data: history,
        count: history.length,
        timeRange: hoursNum
      });

      logger.debug('Metrics history retrieved', { hours: hoursNum, count: history.length });
    } catch (error) {
      logger.error('Failed to get metrics history', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve metrics history',
        code: 'METRICS_HISTORY_ERROR'
      });
    }
  }

  /**
   * Get system health summary
   */
  static async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = metricsCollector.getHealthSummary();
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        success: true,
        data: health,
        timestamp: new Date().toISOString()
      });

      logger.debug('Health summary retrieved', { status: health.status });
    } catch (error) {
      logger.error('Failed to get health summary', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve health summary',
        code: 'HEALTH_ERROR'
      });
    }
  }

  /**
   * Get alert rules
   */
  static async getAlertRules(req: Request, res: Response): Promise<void> {
    try {
      const rules = metricsCollector.getAlertRules();

      res.json({
        success: true,
        data: rules,
        count: rules.length
      });

      logger.debug('Alert rules retrieved', { count: rules.length });
    } catch (error) {
      logger.error('Failed to get alert rules', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve alert rules',
        code: 'ALERT_RULES_ERROR'
      });
    }
  }

  /**
   * Update alert rule
   */
  static async updateAlertRule(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params;
      const updates = req.body;

      const success = metricsCollector.updateAlertRule(ruleId, updates);

      if (!success) {
        res.status(404).json({
          error: 'Alert rule not found',
          code: 'ALERT_RULE_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Alert rule updated successfully'
      });

      logger.info('Alert rule updated', { ruleId, updates });
    } catch (error) {
      logger.error('Failed to update alert rule', error as Error);
      res.status(500).json({
        error: 'Failed to update alert rule',
        code: 'ALERT_RULE_UPDATE_ERROR'
      });
    }
  }

  /**
   * Query logs
   */
  static async queryLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        level,
        service,
        startTime,
        endTime,
        search,
        userId,
        traceId,
        limit = '100',
        offset = '0'
      } = req.query;

      const query: any = {
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      };

      if (level) {
        query.level = Array.isArray(level) ? level : [level];
      }
      if (service) {
        query.service = Array.isArray(service) ? service : [service];
      }
      if (startTime) {
        query.startTime = new Date(startTime as string);
      }
      if (endTime) {
        query.endTime = new Date(endTime as string);
      }
      if (search) {
        query.search = search as string;
      }
      if (userId) {
        query.userId = userId as string;
      }
      if (traceId) {
        query.traceId = traceId as string;
      }

      const logs = logManager.queryLogs(query);

      res.json({
        success: true,
        data: logs,
        count: logs.length,
        query
      });

      logger.debug('Logs queried', { count: logs.length, query });
    } catch (error) {
      logger.error('Failed to query logs', error as Error);
      res.status(500).json({
        error: 'Failed to query logs',
        code: 'LOG_QUERY_ERROR'
      });
    }
  }

  /**
   * Get log statistics
   */
  static async getLogStats(req: Request, res: Response): Promise<void> {
    try {
      const { startTime, endTime } = req.query;
      
      let timeRange: { start: Date; end: Date } | undefined;
      if (startTime && endTime) {
        timeRange = {
          start: new Date(startTime as string),
          end: new Date(endTime as string)
        };
      }

      const stats = logManager.getLogStats(timeRange);

      res.json({
        success: true,
        data: stats
      });

      logger.debug('Log stats retrieved');
    } catch (error) {
      logger.error('Failed to get log stats', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve log statistics',
        code: 'LOG_STATS_ERROR'
      });
    }
  }

  /**
   * Get recent errors
   */
  static async getRecentErrors(req: Request, res: Response): Promise<void> {
    try {
      const { limit = '50' } = req.query;
      const limitNum = parseInt(limit as string, 10);

      const errors = logManager.getRecentErrors(limitNum);

      res.json({
        success: true,
        data: errors,
        count: errors.length
      });

      logger.debug('Recent errors retrieved', { count: errors.length });
    } catch (error) {
      logger.error('Failed to get recent errors', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve recent errors',
        code: 'RECENT_ERRORS_ERROR'
      });
    }
  }

  /**
   * Export logs
   */
  static async exportLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        level,
        service,
        startTime,
        endTime,
        search,
        userId,
        traceId,
        format = 'json'
      } = req.body;

      const query: any = {};

      if (level) query.level = Array.isArray(level) ? level : [level];
      if (service) query.service = Array.isArray(service) ? service : [service];
      if (startTime) query.startTime = new Date(startTime);
      if (endTime) query.endTime = new Date(endTime);
      if (search) query.search = search;
      if (userId) query.userId = userId;
      if (traceId) query.traceId = traceId;

      const filepath = await logManager.exportLogs(query, format as 'json' | 'csv');

      res.json({
        success: true,
        message: 'Logs exported successfully',
        filepath,
        format
      });

      logger.info('Logs exported', { filepath, format });
    } catch (error) {
      logger.error('Failed to export logs', error as Error);
      res.status(500).json({
        error: 'Failed to export logs',
        code: 'LOG_EXPORT_ERROR'
      });
    }
  }

  /**
   * Get logs by trace ID
   */
  static async getLogsByTrace(req: Request, res: Response): Promise<void> {
    try {
      const { traceId } = req.params;

      if (!traceId) {
        res.status(400).json({
          error: 'Trace ID is required',
          code: 'MISSING_TRACE_ID'
        });
        return;
      }

      const logs = logManager.getLogsByTraceId(traceId);

      res.json({
        success: true,
        data: logs,
        count: logs.length,
        traceId
      });

      logger.debug('Logs by trace ID retrieved', { traceId, count: logs.length });
    } catch (error) {
      logger.error('Failed to get logs by trace ID', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve logs by trace ID',
        code: 'LOGS_BY_TRACE_ERROR'
      });
    }
  }

  /**
   * Get system information
   */
  static async getSystemInfo(req: Request, res: Response): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const logMemoryUsage = logManager.getMemoryUsage();

      const systemInfo = {
        process: {
          pid: process.pid,
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        },
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          unit: 'MB'
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        logs: logMemoryUsage,
        environment: {
          nodeEnv: process.env.NODE_ENV,
          port: process.env.PORT
        }
      };

      res.json({
        success: true,
        data: systemInfo,
        timestamp: new Date().toISOString()
      });

      logger.debug('System info retrieved');
    } catch (error) {
      logger.error('Failed to get system info', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve system information',
        code: 'SYSTEM_INFO_ERROR'
      });
    }
  }

  /**
   * Get log files list
   */
  static async getLogFiles(req: Request, res: Response): Promise<void> {
    try {
      const files = logManager.getLogFiles();

      res.json({
        success: true,
        data: files,
        count: files.length
      });

      logger.debug('Log files list retrieved', { count: files.length });
    } catch (error) {
      logger.error('Failed to get log files', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve log files',
        code: 'LOG_FILES_ERROR'
      });
    }
  }
}

export default MonitoringController;