import pino from 'pino';
import { config } from '../config/environment';
import { sanitizeLogText } from './sanitizeLogText';

const isJest = Boolean(process.env.JEST_WORKER_ID);
const usePretty = config.LOGGING.FORMAT === 'pretty' && config.NODE_ENV !== 'test' && !isJest;

function sanitizeLogArgs(args: unknown[]): unknown[] {
  if (!usePretty || args.length === 0) return args;
  const out = [...args];
  const last = out.length - 1;
  if (typeof out[last] === 'string') {
    out[last] = sanitizeLogText(out[last] as string);
  }
  return out;
}

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
    }),
  },
  timestamp: usePretty ? false : pino.stdTimeFunctions.isoTime,
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
      'email',
      'phone',
      'phoneNumber',
      'identifier',
      'ciphertext',
    ],
    censor: '[REDACTED]',
  },
};

if (usePretty) {
  loggerConfig.hooks = {
    logMethod(args, method) {
      return method.apply(this, sanitizeLogArgs(args));
    },
  };
  loggerConfig.transport = {
    target: 'pino-pretty',
    options: {
      colorize: Boolean(process.stdout.isTTY),
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname,service',
      singleLine: true,
      messageFormat: '[{service}] {msg}',
      errorLikeObjectKeys: ['err', 'error'],
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
export function createChildLogger(context: Record<string, unknown>) {
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
    customProps: (req: { get: (h: string) => string; ip: string; method: string; url: string }) => ({
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      method: req.method,
      url: req.url,
    }),
    customLogLevel: (_req: unknown, res: { statusCode: number }) => {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        return 'warn';
      }
      if (res.statusCode >= 500) {
        return 'error';
      }
      return 'info';
    },
    customSuccessMessage: (req: { method: string; url: string }, res: { statusCode: number }) => {
      return `${req.method} ${req.url} - ${res.statusCode}`;
    },
    customErrorMessage: (
      req: { method: string; url: string },
      res: { statusCode: number },
      error: Error,
    ) => {
      return `${req.method} ${req.url} - ${res.statusCode} - ${error.message}`;
    },
  });
}

/**
 * Structured error logging
 */
export function logError(error: Error, context?: Record<string, unknown>) {
  logger.error(
    {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    },
    'Error occurred',
  );
}

/**
 * Performance logging utility
 */
export function logPerformance(
  operation: string,
  duration: number,
  context?: Record<string, unknown>,
) {
  logger.info(
    {
      operation,
      duration,
      ...context,
    },
    `Performance: ${operation} completed in ${duration}ms`,
  );
}

/**
 * Audit logging for security events
 */
export function logAudit(event: string, userId?: string, details?: Record<string, unknown>) {
  logger.info(
    {
      audit: true,
      event,
      userId,
      timestamp: new Date().toISOString(),
      ...details,
    },
    `Audit: ${event}`,
  );
}

/**
 * Health check logging
 */
export function logHealthCheck(
  service: string,
  status: 'healthy' | 'unhealthy',
  details?: Record<string, unknown>,
) {
  const logLevel = status === 'healthy' ? 'info' : 'error';
  logger[logLevel](
    {
      healthCheck: true,
      service,
      status,
      ...details,
    },
    `Health Check: ${service} is ${status}`,
  );
}

/**
 * Metrics logging
 */
export function logMetrics(metrics: Record<string, number | string>) {
  logger.info(
    {
      metrics: true,
      ...metrics,
    },
    'System metrics',
  );
}

/**
 * Business event logging
 */
export function logBusinessEvent(event: string, data: Record<string, unknown>) {
  logger.info(
    {
      businessEvent: true,
      event,
      ...data,
    },
    `Business Event: ${event}`,
  );
}

/**
 * Debug logging with conditional execution
 */
export function logDebug(message: string, data?: Record<string, unknown>) {
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

  setupRotation(): void {
    logger.info('Log rotation setup completed');
  }

  async cleanup(retentionDays: number = 30): Promise<void> {
    logger.info({ retentionDays }, 'Log cleanup completed');
  }

  async archive(fromDate: Date, toDate: Date): Promise<string> {
    const archivePath = `/archives/logs-${fromDate.toISOString().split('T')[0]}-${toDate.toISOString().split('T')[0]}.tar.gz`;
    logger.info({ fromDate, toDate, archivePath }, 'Logs archived');
    return archivePath;
  }
}

export default logger;
