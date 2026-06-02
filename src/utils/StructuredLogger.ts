import { randomUUID } from 'crypto';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  service: string;
  timestamp: Date;
  traceId: string;
  clientId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerConfig {
  service: string;
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableDatabase: boolean;
  filePath?: string;
}

export class StructuredLogger {
  private static instances: Map<string, StructuredLogger> = new Map();
  private config: LoggerConfig;
  private traceId: string;

  private constructor(config: LoggerConfig) {
    this.config = config;
    this.traceId = randomUUID();
  }

  /**
   * Get or create logger instance for service
   */
  static getLogger(serviceName: string, config?: Partial<LoggerConfig>): StructuredLogger {
    if (!StructuredLogger.instances.has(serviceName)) {
      const defaultConfig: LoggerConfig = {
        service: serviceName,
        level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
        enableConsole: true,
        enableFile: false,
        enableDatabase: false,
        filePath: `./logs/${serviceName}.log`
      };

      const finalConfig = { ...defaultConfig, ...config };
      StructuredLogger.instances.set(serviceName, new StructuredLogger(finalConfig));
    }

    return StructuredLogger.instances.get(serviceName)!;
  }

  /**
   * Set trace ID for request correlation
   */
  setTraceId(traceId: string): void {
    this.traceId = traceId;
  }

  /**
   * Generate new trace ID
   */
  generateTraceId(): string {
    this.traceId = randomUUID();
    return this.traceId;
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, any>, clientId?: string): void {
    this.log(LogLevel.DEBUG, message, metadata, clientId);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, any>, clientId?: string): void {
    this.log(LogLevel.INFO, message, metadata, clientId);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, any>, clientId?: string): void {
    this.log(LogLevel.WARN, message, metadata, clientId);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: Record<string, any>, clientId?: string): void {
    const errorInfo = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : undefined;

    this.log(LogLevel.ERROR, message, metadata, clientId, errorInfo);
  }

  /**
   * Log fatal message
   */
  fatal(message: string, error?: Error, metadata?: Record<string, any>, clientId?: string): void {
    const errorInfo = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : undefined;

    this.log(LogLevel.FATAL, message, metadata, clientId, errorInfo);
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    clientId?: string,
    error?: { name: string; message: string; stack?: string }
  ): void {
    // Check if log level should be processed
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      service: this.config.service,
      timestamp: new Date(),
      traceId: this.traceId,
      clientId,
      metadata,
      error
    };

    // Output to different destinations
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    if (this.config.enableFile && this.config.filePath) {
      this.logToFile(logEntry);
    }

    if (this.config.enableDatabase) {
      this.logToDatabase(logEntry);
    }
  }

  /**
   * Check if log level should be processed
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Log to console with colors
   */
  private logToConsole(entry: LogEntry): void {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.FATAL]: '\x1b[35m'  // Magenta
    };

    const reset = '\x1b[0m';
    const color = colors[entry.level];

    const timestamp = entry.timestamp.toISOString();
    const prefix = `${color}[${timestamp}] ${entry.level.toUpperCase()} [${entry.service}]${reset}`;
    
    let logMessage = `${prefix} ${entry.message}`;
    
    if (entry.clientId) {
      logMessage += ` (client: ${entry.clientId})`;
    }
    
    if (entry.traceId) {
      logMessage += ` (trace: ${entry.traceId.substring(0, 8)})`;
    }

    console.log(logMessage);

    // Log metadata if present
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      console.log(`${color}  Metadata:${reset}`, JSON.stringify(entry.metadata, null, 2));
    }

    // Log error details if present
    if (entry.error) {
      console.log(`${color}  Error:${reset}`, entry.error.message);
      if (entry.error.stack) {
        console.log(`${color}  Stack:${reset}`, entry.error.stack);
      }
    }
  }

  /**
   * Log to file (placeholder - would need fs implementation)
   */
  private logToFile(entry: LogEntry): void {
    // In a real implementation, this would write to a file
    // For now, we'll just prepare the JSON string
    const logLine = JSON.stringify(entry) + '\n';
    
    // TODO: Implement file writing with rotation
    // fs.appendFileSync(this.config.filePath!, logLine);
  }

  /**
   * Log to database (placeholder - would need database connection)
   */
  private logToDatabase(entry: LogEntry): void {
    // In a real implementation, this would save to MongoDB
    // TODO: Implement database logging
  }

  /**
   * Create child logger with additional context
   */
  child(additionalMetadata: Record<string, any>): ChildLogger {
    return new ChildLogger(this, additionalMetadata);
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, metadata?: Record<string, any>): void {
    this.info(`Performance: ${operation}`, {
      operation,
      duration_ms: duration,
      ...metadata
    });
  }

  /**
   * Log API request
   */
  apiRequest(method: string, path: string, statusCode: number, duration: number, clientId?: string): void {
    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    this.log(level, `API ${method} ${path} - ${statusCode}`, {
      method,
      path,
      statusCode,
      duration_ms: duration,
      type: 'api_request'
    }, clientId);
  }

  /**
   * Log business event
   */
  businessEvent(event: string, metadata?: Record<string, any>, clientId?: string): void {
    this.info(`Business Event: ${event}`, {
      event,
      type: 'business_event',
      ...metadata
    }, clientId);
  }

  /**
   * Log security event
   */
  securityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: Record<string, any>): void {
    const level = severity === 'critical' ? LogLevel.FATAL : 
                 severity === 'high' ? LogLevel.ERROR :
                 severity === 'medium' ? LogLevel.WARN : LogLevel.INFO;

    this.log(level, `Security Event: ${event}`, {
      event,
      severity,
      type: 'security_event',
      ...metadata
    });
  }
}

/**
 * Child logger with additional context
 */
class ChildLogger {
  constructor(
    private parent: StructuredLogger,
    private additionalMetadata: Record<string, any>
  ) {}

  private mergeMetadata(metadata?: Record<string, any>): Record<string, any> {
    return { ...this.additionalMetadata, ...metadata };
  }

  debug(message: string, metadata?: Record<string, any>, clientId?: string): void {
    this.parent.debug(message, this.mergeMetadata(metadata), clientId);
  }

  info(message: string, metadata?: Record<string, any>, clientId?: string): void {
    this.parent.info(message, this.mergeMetadata(metadata), clientId);
  }

  warn(message: string, metadata?: Record<string, any>, clientId?: string): void {
    this.parent.warn(message, this.mergeMetadata(metadata), clientId);
  }

  error(message: string, error?: Error, metadata?: Record<string, any>, clientId?: string): void {
    this.parent.error(message, error, this.mergeMetadata(metadata), clientId);
  }

  fatal(message: string, error?: Error, metadata?: Record<string, any>, clientId?: string): void {
    this.parent.fatal(message, error, this.mergeMetadata(metadata), clientId);
  }
}

export default StructuredLogger;