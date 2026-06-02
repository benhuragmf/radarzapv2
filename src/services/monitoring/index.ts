/**
 * Monitoring Service Module
 * 
 * Provides comprehensive monitoring and logging functionality including:
 * - Real-time system metrics collection
 * - Advanced log management with rotation and archival
 * - Configurable alerting system with multiple severity levels
 * - Performance monitoring and health checks
 * - Log querying and export capabilities
 * - System resource monitoring
 * - Business metrics tracking
 */

export { MetricsCollector } from './MetricsCollector';
export { LogManager } from './LogManager';
export { MonitoringController } from './MonitoringController';
export { default as monitoringRoutes } from './monitoringRoutes';

// Type exports
export type {
  SystemMetrics,
  AlertRule
} from './MetricsCollector';

export type {
  LogEntry,
  LogQuery,
  LogStats
} from './LogManager';