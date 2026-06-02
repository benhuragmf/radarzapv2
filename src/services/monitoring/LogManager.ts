import fs from 'fs';
import path from 'path';
import { createServiceLogger } from '../../utils/logger';
import { config } from '../../config/environment';

const logger = createServiceLogger('LogManager');

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  message: string;
  metadata?: Record<string, any>;
  traceId?: string;
  userId?: string;
  requestId?: string;
  duration?: number;
  statusCode?: number;
}

export interface LogQuery {
  level?: string[];
  service?: string[];
  startTime?: Date;
  endTime?: Date;
  search?: string;
  userId?: string;
  traceId?: string;
  limit?: number;
  offset?: number;
}

export interface LogStats {
  totalLogs: number;
  logsByLevel: Record<string, number>;
  logsByService: Record<string, number>;
  errorRate: number;
  topErrors: Array<{ message: string; count: number }>;
  timeRange: { start: Date; end: Date };
}

/**
 * Advanced Log Management System
 */
export class LogManager {
  private static instance: LogManager;
  private logs: LogEntry[] = [];
  private logFiles: Map<string, string> = new Map();
  private maxLogsInMemory = 10000;
  private logDirectory = path.join(process.cwd(), 'logs');

  private constructor() {
    this.ensureLogDirectory();
    this.startLogRotation();
  }

  static getInstance(): LogManager {
    if (!LogManager.instance) {
      LogManager.instance = new LogManager();
    }
    return LogManager.instance;
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
        logger.info('Log directory created', { path: this.logDirectory });
      }
    } catch (error) {
      logger.error('Failed to create log directory', error as Error);
    }
  }

  /**
   * Start log rotation
   */
  private startLogRotation(): void {
    // Rotate logs daily at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.rotateLogs();
      // Then rotate every 24 hours
      setInterval(() => this.rotateLogs(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    // Clean old logs every hour
    setInterval(() => this.cleanOldLogs(), 60 * 60 * 1000);

    logger.info('Log rotation scheduled');
  }

  /**
   * Add log entry
   */
  addLog(entry: LogEntry): void {
    // Add to memory
    this.logs.push(entry);

    // Keep only recent logs in memory
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs = this.logs.slice(-this.maxLogsInMemory);
    }

    // Write to file asynchronously
    this.writeToFile(entry);
  }

  /**
   * Write log entry to file
   */
  private async writeToFile(entry: LogEntry): Promise<void> {
    try {
      const dateStr = entry.timestamp.toISOString().split('T')[0];
      const filename = `app-${dateStr}.log`;
      const filepath = path.join(this.logDirectory, filename);

      const logLine = JSON.stringify({
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        service: entry.service,
        message: entry.message,
        metadata: entry.metadata,
        traceId: entry.traceId,
        userId: entry.userId,
        requestId: entry.requestId,
        duration: entry.duration,
        statusCode: entry.statusCode
      }) + '\n';

      fs.appendFileSync(filepath, logLine);
    } catch (error) {
      // Don't use logger here to avoid infinite loop
      console.error('Failed to write log to file:', error);
    }
  }

  /**
   * Query logs
   */
  queryLogs(query: LogQuery): LogEntry[] {
    let filteredLogs = [...this.logs];

    // Filter by level
    if (query.level && query.level.length > 0) {
      filteredLogs = filteredLogs.filter(log => query.level!.includes(log.level));
    }

    // Filter by service
    if (query.service && query.service.length > 0) {
      filteredLogs = filteredLogs.filter(log => query.service!.includes(log.service));
    }

    // Filter by time range
    if (query.startTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= query.endTime!);
    }

    // Filter by user ID
    if (query.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === query.userId);
    }

    // Filter by trace ID
    if (query.traceId) {
      filteredLogs = filteredLogs.filter(log => log.traceId === query.traceId);
    }

    // Search in message and metadata
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => {
        const messageMatch = log.message.toLowerCase().includes(searchLower);
        const metadataMatch = log.metadata ? 
          JSON.stringify(log.metadata).toLowerCase().includes(searchLower) : false;
        return messageMatch || metadataMatch;
      });
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    
    return filteredLogs.slice(offset, offset + limit);
  }

  /**
   * Get log statistics
   */
  getLogStats(timeRange?: { start: Date; end: Date }): LogStats {
    let logs = [...this.logs];

    if (timeRange) {
      logs = logs.filter(log => 
        log.timestamp >= timeRange.start && log.timestamp <= timeRange.end
      );
    }

    const logsByLevel: Record<string, number> = {};
    const logsByService: Record<string, number> = {};
    const errorMessages: Record<string, number> = {};

    for (const log of logs) {
      // Count by level
      logsByLevel[log.level] = (logsByLevel[log.level] || 0) + 1;

      // Count by service
      logsByService[log.service] = (logsByService[log.service] || 0) + 1;

      // Count error messages
      if (log.level === 'error' || log.level === 'fatal') {
        errorMessages[log.message] = (errorMessages[log.message] || 0) + 1;
      }
    }

    const totalLogs = logs.length;
    const errorLogs = (logsByLevel.error || 0) + (logsByLevel.fatal || 0);
    const errorRate = totalLogs > 0 ? errorLogs / totalLogs : 0;

    const topErrors = Object.entries(errorMessages)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const timestamps = logs.map(log => log.timestamp);
    const timeRangeResult = timestamps.length > 0 ? {
      start: new Date(Math.min(...timestamps.map(t => t.getTime()))),
      end: new Date(Math.max(...timestamps.map(t => t.getTime())))
    } : {
      start: new Date(),
      end: new Date()
    };

    return {
      totalLogs,
      logsByLevel,
      logsByService,
      errorRate,
      topErrors,
      timeRange: timeRangeResult
    };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 50): LogEntry[] {
    return this.logs
      .filter(log => log.level === 'error' || log.level === 'fatal')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get logs by trace ID
   */
  getLogsByTraceId(traceId: string): LogEntry[] {
    return this.logs
      .filter(log => log.traceId === traceId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get logs by user ID
   */
  getLogsByUserId(userId: string, limit: number = 100): LogEntry[] {
    return this.logs
      .filter(log => log.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Export logs to file
   */
  async exportLogs(query: LogQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    const logs = this.queryLogs(query);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `logs-export-${timestamp}.${format}`;
    const filepath = path.join(this.logDirectory, filename);

    try {
      if (format === 'json') {
        const jsonData = JSON.stringify(logs, null, 2);
        fs.writeFileSync(filepath, jsonData);
      } else if (format === 'csv') {
        const csvHeader = 'timestamp,level,service,message,traceId,userId,duration,statusCode\n';
        const csvRows = logs.map(log => [
          log.timestamp.toISOString(),
          log.level,
          log.service,
          `"${log.message.replace(/"/g, '""')}"`,
          log.traceId || '',
          log.userId || '',
          log.duration || '',
          log.statusCode || ''
        ].join(',')).join('\n');
        
        fs.writeFileSync(filepath, csvHeader + csvRows);
      }

      logger.info('Logs exported', { filename, format, count: logs.length });
      return filepath;
    } catch (error) {
      logger.error('Failed to export logs', error as Error);
      throw error;
    }
  }

  /**
   * Rotate logs
   */
  private rotateLogs(): void {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      
      const currentFile = path.join(this.logDirectory, `app-${dateStr}.log`);
      const rotatedFile = path.join(this.logDirectory, `app-${dateStr}.log.gz`);

      if (fs.existsSync(currentFile)) {
        // TODO: Compress the file (requires zlib)
        // For now, just rename it
        const archivedFile = path.join(this.logDirectory, `app-${dateStr}.archived.log`);
        fs.renameSync(currentFile, archivedFile);
        
        logger.info('Log file rotated', { 
          original: currentFile, 
          archived: archivedFile 
        });
      }
    } catch (error) {
      logger.error('Failed to rotate logs', error as Error);
    }
  }

  /**
   * Clean old logs (keep last 30 days)
   */
  private cleanOldLogs(): void {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      const files = fs.readdirSync(this.logDirectory);
      let deletedCount = 0;

      for (const file of files) {
        if (file.startsWith('app-') && (file.endsWith('.log') || file.endsWith('.archived.log'))) {
          const filepath = path.join(this.logDirectory, file);
          const stats = fs.statSync(filepath);
          
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filepath);
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        logger.info('Old log files cleaned', { deletedCount });
      }
    } catch (error) {
      logger.error('Failed to clean old logs', error as Error);
    }
  }

  /**
   * Get log file list
   */
  getLogFiles(): Array<{ filename: string; size: number; modified: Date }> {
    try {
      const files = fs.readdirSync(this.logDirectory);
      return files
        .filter(file => file.startsWith('app-') && file.endsWith('.log'))
        .map(file => {
          const filepath = path.join(this.logDirectory, file);
          const stats = fs.statSync(filepath);
          return {
            filename: file,
            size: stats.size,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.modified.getTime() - a.modified.getTime());
    } catch (error) {
      logger.error('Failed to get log files', error as Error);
      return [];
    }
  }

  /**
   * Clear all logs (use with caution)
   */
  clearLogs(): void {
    this.logs = [];
    logger.warn('All logs cleared from memory');
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): {
    logsInMemory: number;
    estimatedMemoryUsage: string;
  } {
    const estimatedSize = JSON.stringify(this.logs).length;
    return {
      logsInMemory: this.logs.length,
      estimatedMemoryUsage: (estimatedSize / 1024 / 1024).toFixed(2) + ' MB'
    };
  }
}

export default LogManager;