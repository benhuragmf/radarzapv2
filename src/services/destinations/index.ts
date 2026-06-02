/**
 * Destination Management Service Module
 * 
 * Provides comprehensive destination management with LGPD/GDPR compliance including:
 * - Contact and group management with automatic validation
 * - Consent tracking with automatic LGPD/GDPR compliance
 * - Opt-out mechanisms with automatic processing
 * - Destination health checking with automatic cleanup
 * - Automatic contact synchronization and updates
 * - Data export for portability rights
 * - Right to be forgotten implementation
 * - Compliance reporting and monitoring
 * - Autonomous health monitoring and maintenance
 * - Real-time compliance auditing and alerting
 * - Automated data retention policy enforcement
 */

export { DestinationManager } from './DestinationManager';
export { DestinationController } from './DestinationController';
export { DestinationHealthService } from './DestinationHealthService';
export { ComplianceService } from './ComplianceService';
export { DestinationSyncService } from './DestinationSyncService';
export { DestinationServiceIntegration } from './DestinationServiceIntegration';
export { default as destinationRoutes } from './destinationRoutes';

// Type exports
export type {
  ConsentRecord,
  DestinationData,
  ComplianceReport
} from './DestinationManager';

export type {
  ComplianceAuditLog,
  ComplianceAlert,
  DataRetentionPolicy
} from './ComplianceService';

export type {
  SyncResult,
  SyncStats
} from './DestinationSyncService';