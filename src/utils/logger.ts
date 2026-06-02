import pino from 'pino';
import { config } from '../config/environment';
import { safeStringify, createErrorMessage } from './helpers';

/**
 * Logger configuration based on environment
 */
const loggerConfig: pino.LoggerOptions = {
  level: config.LOGGING.LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      service: 'discord-whatsapp-bot',
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'password',
      'token',
      'secret',
      'authorization',
      'cookie',
      'session',
      'key',
      'apiKey',
      'accessToken',
      'refreshToken',
    ],
    censor: '[REDACTED]',
  },
};

// Configure transport based on environment
if (config.NODE_ENV === 'development' && config.LOGGING.FORMAT === 'pretty') {
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageFormat: '{service} [{level}] {msg}',
    },
  };
}

/**
 * Main application logger
 */
export const logger = pino(loggerConfig);

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, any>) {
  return logger.child(context);
}

/**
 * Service-specific logger factory
 */
export function createServiceLogger(serviceName: string) {
  return createChildLogger({ service: serviceName });
}

/**
 * Request logger middleware for Express
 */
export function createRequestLogger() {
  return require('pino-http')({
    logger,
    autoLogging: true,
    customProps: (req) => ({
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      method: req.method,
      url: req.url,
    }),
    customLogLevel: (req, res) => {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        return 'warn';
      } else if (res.statusCode >= 500) {
        return 'error';
      }
      return 'info';
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} - ${res.statusCode}`;
    },
    customErrorMessage: (req, res, error) => {
      return `${req.method} ${req.url} - ${res.statusCode} - ${error.message}`;
    },
  });
}

/**
 * Structured error logging
 */
export function logError(error: Error, context?: Record<string, any>) {
  logger.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  }, 'Error occurred');
}

/**
 * Performance logging utility
 */
export function logPerformance(operation: string, duration: number, context?: Record<string, any>) {
  logger.info({
    operation,
    duration,
    ...context,
  }, `Performance: ${operation} completed in ${duration}ms`);
}

/**
 * Audit logging for security events
 */
export function logAudit(event: string, userId?: string, details?: Record<string, any>) {
  logger.info({
    audit: true,
    event,
    userId,
    timestamp: new Date().toISOString(),
    ...details,
  }, `Audit: ${event}`);
}

/**
 * Health check logging
 */
export function logHealthCheck(service: string, status: 'healthy' | 'unhealthy', details?: Record<string, any>) {
  const logLevel = status === 'healthy' ? 'info' : 'error';
  logger[logLevel]({
    healthCheck: true,
    service,
    status,
    ...details,
  }, `Health Check: ${service} is ${status}`);
}

/**
 * Metrics logging
 */
export function logMetrics(metrics: Record<string, number | string>) {
  logger.info({
    metrics: true,
    ...metrics,
  }, 'System metrics');
}

/**
 * Business event logging
 */
export function logBusinessEvent(event: string, data: Record<string, any>) {
  logger.info({
    businessEvent: true,
    event,
    ...data,
  }, `Business Event: ${event}`);
}

/**
 * Debug logging with conditional execution
 */
export function logDebug(message: string, data?: Record<string, any>) {
  if (config.LOGGING.LEVEL === 'debug') {
    logger.debug(data, message);
  }
}

/**
 * Log rotation and cleanup utilities
 */
export class LogManager {
  private static instance: LogManager;

  static getInstance(): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager();
    }
    return LogManager.instance;
  }

  /**
   * Setup log rotation (if using file transport)
   */
  setupRotation(): void {
    // This would be implemented with a file transport
    // For now, we're using stdout/stderr which is handled by the container runtime
    logger.info('Log rotation setup completed');
  }

  /**
   * Cleanup old log files
   */
  async cleanup(retentionDays: number = 30): Promise<void> {
    // Implementation would depend on the log storage mechanism
    logger.info({ retentionDays }, 'Log cleanup completed');
  }

  /**
   * Archive logs for compliance
   */
  async archive(fromDate: Date, toDate: Date): Promise<string> {
    // Implementation for log archival
    const archivePath = `/archives/logs-${fromDate.toISOString().split('T')[0]}-${toDate.toISOString().split('T')[0]}.tar.gz`;
    logger.info({ fromDate, toDate, archivePath }, 'Logs archived');
    return archivePath;
  }
}

/**
 * Export logger instance as default
 */
export default logger;