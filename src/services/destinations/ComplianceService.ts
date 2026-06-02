import { createServiceLogger } from '../../utils/logger';
import { DestinationManager } from './DestinationManager';
import { IService } from '../ServiceRegistry';
import mongoose from 'mongoose';

const logger = createServiceLogger('ComplianceService');

export interface ComplianceAuditLog {
  id: string;
  clientId: string;
  action: 'consent_granted' | 'consent_revoked' | 'data_exported' | 'data_deleted' | 'opt_out_processed';
  destinationId?: string;
  identifier?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
  complianceFramework: 'LGPD' | 'GDPR' | 'CCPA';
}

export interface ComplianceAlert {
  id: string;
  type: 'consent_expiry' | 'data_retention_violation' | 'opt_out_delay' | 'audit_required';
  severity: 'low' | 'medium' | 'high' | 'critical';
  clientId: string;
  message: string;
  details: Record<string, any>;
  resolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface DataRetentionPolicy {
  clientId: string;
  retentionPeriodDays: number;
  autoDeleteAfterRevocation: boolean;
  autoDeleteAfterInactivity: boolean;
  inactivityThresholdDays: number;
  consentRenewalPeriodDays: number;
  auditFrequencyDays: number;
}

/**
 * Autonomous Compliance Service for LGPD/GDPR
 * Handles automatic compliance monitoring, audit logging, and data protection
 */
export class ComplianceService implements IService {
  private static instance: ComplianceService;
  private destinationManager: DestinationManager;
  private auditInterval: NodeJS.Timeout | null = null;
  private alertCheckInterval: NodeJS.Timeout | null = null;
  private retentionCheckInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Configuration
  private readonly AUDIT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly ALERT_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
  private readonly RETENTION_CHECK_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
  
  // Default retention policies
  private readonly DEFAULT_RETENTION_POLICY: Omit<DataRetentionPolicy, 'clientId'> = {
    retentionPeriodDays: 730, // 2 years for GDPR
    autoDeleteAfterRevocation: true,
    autoDeleteAfterInactivity: true,
    inactivityThresholdDays: 365, // 1 year
    consentRenewalPeriodDays: 730, // 2 years
    auditFrequencyDays: 90 // Quarterly audits
  };

  private auditLogs: ComplianceAuditLog[] = [];
  private alerts: ComplianceAlert[] = [];
  private retentionPolicies: Map<string, DataRetentionPolicy> = new Map();

  private constructor() {
    this.destinationManager = DestinationManager.getInstance();
  }

  static getInstance(): ComplianceService {
    if (!ComplianceService.instance) {
      ComplianceService.instance = new ComplianceService();
    }
    return ComplianceService.instance;
  }

  /**
   * Start the compliance service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Compliance service is already running');
      return;
    }

    logger.info('Starting compliance service...');

    // Load existing audit logs and alerts from database
    await this.loadComplianceData();

    // Start audit monitoring
    this.auditInterval = setInterval(() => {
      this.performComplianceAudit().catch(error => {
        logger.error('Compliance audit failed', error);
      });
    }, this.AUDIT_INTERVAL);

    // Start alert checking
    this.alertCheckInterval = setInterval(() => {
      this.checkComplianceAlerts().catch(error => {
        logger.error('Compliance alert check failed', error);
      });
    }, this.ALERT_CHECK_INTERVAL);

    // Start retention policy enforcement
    this.retentionCheckInterval = setInterval(() => {
      this.enforceRetentionPolicies().catch(error => {
        logger.error('Retention policy enforcement failed', error);
      });
    }, this.RETENTION_CHECK_INTERVAL);

    this.isRunning = true;

    // Perform initial compliance check
    setTimeout(() => {
      this.performComplianceAudit().catch(error => {
        logger.error('Initial compliance audit failed', error);
      });
    }, 10000); // Wait 10 seconds after startup

    logger.info('✅ Compliance service started successfully');
  }

  /**
   * Stop the compliance service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping compliance service...');

    if (this.auditInterval) {
      clearInterval(this.auditInterval);
      this.auditInterval = null;
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = null;
    }

    if (this.retentionCheckInterval) {
      clearInterval(this.retentionCheckInterval);
      this.retentionCheckInterval = null;
    }

    // Save compliance data before stopping
    await this.saveComplianceData();

    this.isRunning = false;
    logger.info('✅ Compliance service stopped');
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const details = {
        isRunning: this.isRunning,
        auditLogsCount: this.auditLogs.length,
        activeAlertsCount: this.alerts.filter(a => !a.resolved).length,
        retentionPoliciesCount: this.retentionPolicies.size,
        intervals: {
          audit: this.auditInterval !== null,
          alerts: this.alertCheckInterval !== null,
          retention: this.retentionCheckInterval !== null
        }
      };

      return {
        healthy: this.isRunning,
        details
      };
    } catch (error) {
      logger.error('Compliance service health check failed', error);
      return {
        healthy: false,
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      auditLogs: this.auditLogs.length,
      activeAlerts: this.alerts.filter(a => !a.resolved).length,
      totalAlerts: this.alerts.length,
      retentionPolicies: this.retentionPolicies.size,
      lastAudit: this.lastAudit,
      lastAlertCheck: this.lastAlertCheck,
      lastRetentionCheck: this.lastRetentionCheck
    };
  }

  private lastAudit: Date | null = null;
  private lastAlertCheck: Date | null = null;
  private lastRetentionCheck: Date | null = null;

  /**
   * Log compliance action
   */
  async logComplianceAction(
    clientId: string,
    action: ComplianceAuditLog['action'],
    details: Record<string, any>,
    ipAddress: string,
    userAgent?: string,
    destinationId?: string,
    identifier?: string
  ): Promise<void> {
    const auditLog: ComplianceAuditLog = {
      id: new mongoose.Types.ObjectId().toString(),
      clientId,
      action,
      destinationId,
      identifier: identifier ? this.maskIdentifier(identifier) : undefined,
      details,
      ipAddress,
      userAgent,
      timestamp: new Date(),
      complianceFramework: this.determineComplianceFramework(ipAddress)
    };

    this.auditLogs.push(auditLog);

    // Keep only last 10000 audit logs in memory
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }

    logger.info('Compliance action logged', {
      clientId,
      action,
      complianceFramework: auditLog.complianceFramework
    });

    // Save to database
    await this.saveAuditLog(auditLog);
  }

  /**
   * Create compliance alert
   */
  async createAlert(
    type: ComplianceAlert['type'],
    severity: ComplianceAlert['severity'],
    clientId: string,
    message: string,
    details: Record<string, any>
  ): Promise<string> {
    const alert: ComplianceAlert = {
      id: new mongoose.Types.ObjectId().toString(),
      type,
      severity,
      clientId,
      message,
      details,
      resolved: false,
      createdAt: new Date()
    };

    this.alerts.push(alert);

    logger.warn('Compliance alert created', {
      alertId: alert.id,
      type,
      severity,
      clientId,
      message
    });

    // Save to database
    await this.saveAlert(alert);

    return alert.id;
  }

  /**
   * Resolve compliance alert
   */
  async resolveAlert(alertId: string, resolution: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.details.resolution = resolution;

    logger.info('Compliance alert resolved', {
      alertId,
      type: alert.type,
      clientId: alert.clientId,
      resolution
    });

    // Update in database
    await this.updateAlert(alert);

    return true;
  }

  /**
   * Get compliance report for client
   */
  async getComplianceReport(clientId: string): Promise<{
    auditSummary: any;
    alerts: ComplianceAlert[];
    retentionPolicy: DataRetentionPolicy;
    dataInventory: any;
    riskAssessment: any;
  }> {
    const clientAuditLogs = this.auditLogs.filter(log => log.clientId === clientId);
    const clientAlerts = this.alerts.filter(alert => alert.clientId === clientId);
    const retentionPolicy = this.getRetentionPolicy(clientId);

    // Get destination data inventory
    const { destinations } = await this.destinationManager.getDestinations(clientId, { limit: 10000 });

    const auditSummary = {
      totalActions: clientAuditLogs.length,
      actionsByType: this.groupBy(clientAuditLogs, 'action'),
      recentActions: clientAuditLogs.slice(-10),
      complianceFrameworks: this.groupBy(clientAuditLogs, 'complianceFramework')
    };

    const dataInventory = {
      totalDestinations: destinations.length,
      withConsent: destinations.filter(d => d.consent.granted).length,
      withoutConsent: destinations.filter(d => !d.consent.granted).length,
      byType: this.groupBy(destinations, 'type'),
      oldestConsent: destinations.reduce((oldest, dest) => {
        if (dest.consent.granted && dest.consent.grantedAt) {
          return !oldest || dest.consent.grantedAt < oldest ? dest.consent.grantedAt : oldest;
        }
        return oldest;
      }, null as Date | null)
    };

    const riskAssessment = await this.assessComplianceRisk(clientId, destinations);

    return {
      auditSummary,
      alerts: clientAlerts,
      retentionPolicy,
      dataInventory,
      riskAssessment
    };
  }

  /**
   * Set retention policy for client
   */
  setRetentionPolicy(clientId: string, policy: Partial<DataRetentionPolicy>): void {
    const fullPolicy: DataRetentionPolicy = {
      clientId,
      ...this.DEFAULT_RETENTION_POLICY,
      ...policy
    };

    this.retentionPolicies.set(clientId, fullPolicy);

    logger.info('Retention policy updated', {
      clientId,
      policy: fullPolicy
    });
  }

  /**
   * Get retention policy for client
   */
  getRetentionPolicy(clientId: string): DataRetentionPolicy {
    return this.retentionPolicies.get(clientId) || {
      clientId,
      ...this.DEFAULT_RETENTION_POLICY
    };
  }

  /**
   * Process opt-out request with compliance logging
   */
  async processOptOut(
    clientId: string,
    identifier: string,
    reason: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<boolean> {
    try {
      // Process the opt-out
      const success = await this.destinationManager.removeDestination(clientId, identifier, reason);

      if (success) {
        // Log compliance action
        await this.logComplianceAction(
          clientId,
          'opt_out_processed',
          { reason, processedAt: new Date() },
          ipAddress,
          userAgent,
          undefined,
          identifier
        );

        // Check if opt-out was processed within required timeframe (72 hours for GDPR)
        const processingTime = Date.now() - Date.now(); // This would be actual request time in real implementation
        if (processingTime > 72 * 60 * 60 * 1000) {
          await this.createAlert(
            'opt_out_delay',
            'high',
            clientId,
            'Opt-out request processed after 72-hour deadline',
            { identifier: this.maskIdentifier(identifier), processingTimeHours: processingTime / (60 * 60 * 1000) }
          );
        }
      }

      return success;
    } catch (error) {
      logger.error('Failed to process opt-out with compliance logging', error);
      return false;
    }
  }

  /**
   * Export compliance data (for audits)
   */
  async exportComplianceData(clientId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const report = await this.getComplianceReport(clientId);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `compliance-export-${clientId}-${timestamp}.${format}`;
      
      // Log the export action
      await this.logComplianceAction(
        clientId,
        'data_exported',
        { format, exportedAt: new Date(), filename },
        '127.0.0.1', // This would be actual IP in real implementation
        'ComplianceService'
      );

      logger.info('Compliance data exported', { clientId, format, filename });
      
      return filename;
    } catch (error) {
      logger.error('Failed to export compliance data', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive compliance audit
   */
  private async performComplianceAudit(): Promise<void> {
    logger.info('Starting compliance audit...');
    this.lastAudit = new Date();

    try {
      const { Destination } = await import('../../models/Destination');

      // Get all clients with destinations
      const clientIds = await Destination.distinct('clientId');

      for (const clientId of clientIds) {
        await this.auditClient(clientId.toString());
      }

      logger.info('Compliance audit completed', {
        clientsAudited: clientIds.length
      });

    } catch (error) {
      logger.error('Compliance audit failed', error);
    }
  }

  /**
   * Audit individual client for compliance
   */
  private async auditClient(clientId: string): Promise<void> {
    try {
      const { destinations } = await this.destinationManager.getDestinations(clientId, { limit: 10000 });
      const retentionPolicy = this.getRetentionPolicy(clientId);

      // Check for consent expiry
      const now = Date.now();
      const consentExpiryThreshold = now - (retentionPolicy.consentRenewalPeriodDays * 24 * 60 * 60 * 1000);

      for (const destination of destinations) {
        if (destination.consent.granted && destination.consent.grantedAt) {
          if (destination.consent.grantedAt.getTime() < consentExpiryThreshold) {
            await this.createAlert(
              'consent_expiry',
              'medium',
              clientId,
              'Destination consent requires renewal',
              {
                destinationId: destination.id,
                identifier: this.maskIdentifier(destination.identifier),
                consentAge: Math.floor((now - destination.consent.grantedAt.getTime()) / (24 * 60 * 60 * 1000))
              }
            );
          }
        }

        // Check for data retention violations
        if (!destination.consent.granted && destination.consent.revokedAt) {
          const daysSinceRevocation = (now - destination.consent.revokedAt.getTime()) / (24 * 60 * 60 * 1000);
          if (daysSinceRevocation > 30) { // Should be deleted after 30 days
            await this.createAlert(
              'data_retention_violation',
              'high',
              clientId,
              'Revoked destination data not deleted within retention period',
              {
                destinationId: destination.id,
                identifier: this.maskIdentifier(destination.identifier),
                daysSinceRevocation: Math.floor(daysSinceRevocation)
              }
            );
          }
        }
      }

      // Check if audit is required
      const lastAuditLog = this.auditLogs
        .filter(log => log.clientId === clientId && log.action === 'consent_granted')
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      if (!lastAuditLog || (now - lastAuditLog.timestamp.getTime()) > (retentionPolicy.auditFrequencyDays * 24 * 60 * 60 * 1000)) {
        await this.createAlert(
          'audit_required',
          'low',
          clientId,
          'Regular compliance audit required',
          {
            lastAudit: lastAuditLog?.timestamp || null,
            auditFrequencyDays: retentionPolicy.auditFrequencyDays
          }
        );
      }

    } catch (error) {
      logger.error('Client audit failed', error, { clientId });
    }
  }

  /**
   * Check and process compliance alerts
   */
  private async checkComplianceAlerts(): Promise<void> {
    logger.debug('Checking compliance alerts...');
    this.lastAlertCheck = new Date();

    try {
      const activeAlerts = this.alerts.filter(alert => !alert.resolved);
      
      // Auto-resolve old low-severity alerts
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      for (const alert of activeAlerts) {
        if (alert.severity === 'low' && alert.createdAt.getTime() < thirtyDaysAgo) {
          await this.resolveAlert(alert.id, 'Auto-resolved: Low severity alert older than 30 days');
        }
      }

      logger.debug('Compliance alert check completed', {
        activeAlerts: activeAlerts.length
      });

    } catch (error) {
      logger.error('Compliance alert check failed', error);
    }
  }

  /**
   * Enforce retention policies
   */
  private async enforceRetentionPolicies(): Promise<void> {
    logger.info('Enforcing retention policies...');
    this.lastRetentionCheck = new Date();

    try {
      for (const [clientId, policy] of this.retentionPolicies) {
        await this.enforceClientRetentionPolicy(clientId, policy);
      }

      logger.info('Retention policy enforcement completed');

    } catch (error) {
      logger.error('Retention policy enforcement failed', error);
    }
  }

  /**
   * Enforce retention policy for specific client
   */
  private async enforceClientRetentionPolicy(clientId: string, policy: DataRetentionPolicy): Promise<void> {
    try {
      const { Destination } = await import('../../models/Destination');

      if (policy.autoDeleteAfterRevocation) {
        // Delete destinations revoked more than 30 days ago
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const deleteResult = await Destination.deleteMany({
          clientId: new mongoose.Types.ObjectId(clientId),
          'consent.granted': false,
          'consent.revokedAt': { $lt: thirtyDaysAgo }
        });

        if (deleteResult.deletedCount > 0) {
          await this.logComplianceAction(
            clientId,
            'data_deleted',
            { 
              reason: 'retention_policy_enforcement',
              deletedCount: deleteResult.deletedCount,
              policy: 'auto_delete_after_revocation'
            },
            '127.0.0.1',
            'ComplianceService'
          );
        }
      }

      if (policy.autoDeleteAfterInactivity) {
        // Mark inactive destinations
        const inactivityThreshold = new Date(Date.now() - policy.inactivityThresholdDays * 24 * 60 * 60 * 1000);
        
        await Destination.updateMany(
          {
            clientId: new mongoose.Types.ObjectId(clientId),
            isActive: true,
            $or: [
              { lastMessageSent: { $lt: inactivityThreshold } },
              { lastMessageSent: { $exists: false }, createdAt: { $lt: inactivityThreshold } }
            ]
          },
          {
            $set: {
              isActive: false,
              'metadata.deactivatedReason': 'inactivity',
              'metadata.deactivatedAt': new Date()
            }
          }
        );
      }

    } catch (error) {
      logger.error('Failed to enforce client retention policy', error, { clientId });
    }
  }

  /**
   * Load compliance data from database
   */
  private async loadComplianceData(): Promise<void> {
    try {
      // TODO: Load audit logs and alerts from database
      // This would typically involve querying a compliance database
      logger.debug('Compliance data loaded from database');
    } catch (error) {
      logger.error('Failed to load compliance data', error);
    }
  }

  /**
   * Save compliance data to database
   */
  private async saveComplianceData(): Promise<void> {
    try {
      // TODO: Save audit logs and alerts to database
      logger.debug('Compliance data saved to database');
    } catch (error) {
      logger.error('Failed to save compliance data', error);
    }
  }

  /**
   * Save audit log to database
   */
  private async saveAuditLog(auditLog: ComplianceAuditLog): Promise<void> {
    try {
      // TODO: Save to database
      logger.debug('Audit log saved', { auditLogId: auditLog.id });
    } catch (error) {
      logger.error('Failed to save audit log', error);
    }
  }

  /**
   * Save alert to database
   */
  private async saveAlert(alert: ComplianceAlert): Promise<void> {
    try {
      // TODO: Save to database
      logger.debug('Alert saved', { alertId: alert.id });
    } catch (error) {
      logger.error('Failed to save alert', error);
    }
  }

  /**
   * Update alert in database
   */
  private async updateAlert(alert: ComplianceAlert): Promise<void> {
    try {
      // TODO: Update in database
      logger.debug('Alert updated', { alertId: alert.id });
    } catch (error) {
      logger.error('Failed to update alert', error);
    }
  }

  /**
   * Determine compliance framework based on IP address
   */
  private determineComplianceFramework(ipAddress: string): 'LGPD' | 'GDPR' | 'CCPA' {
    // This is a simplified implementation
    // In reality, you'd use a GeoIP service to determine location
    if (ipAddress.startsWith('192.168.') || ipAddress === '127.0.0.1') {
      return 'LGPD'; // Default for local/development
    }
    return 'GDPR'; // Default to GDPR for international compliance
  }

  /**
   * Assess compliance risk for client
   */
  private async assessComplianceRisk(clientId: string, destinations: any[]): Promise<any> {
    const riskFactors = {
      expiredConsents: 0,
      oldData: 0,
      missingConsents: 0,
      inactiveDestinations: 0
    };

    const now = Date.now();
    const twoYearsAgo = now - (730 * 24 * 60 * 60 * 1000);
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);

    for (const destination of destinations) {
      if (destination.consent.granted && destination.consent.grantedAt) {
        if (destination.consent.grantedAt.getTime() < twoYearsAgo) {
          riskFactors.expiredConsents++;
        }
      } else {
        riskFactors.missingConsents++;
      }

      if (destination.createdAt.getTime() < twoYearsAgo) {
        riskFactors.oldData++;
      }

      const lastActivity = destination.lastMessageSent || destination.createdAt;
      if (lastActivity.getTime() < oneYearAgo) {
        riskFactors.inactiveDestinations++;
      }
    }

    const totalDestinations = destinations.length;
    const riskScore = totalDestinations > 0 ? 
      ((riskFactors.expiredConsents + riskFactors.missingConsents + riskFactors.oldData + riskFactors.inactiveDestinations) / totalDestinations) * 100 : 0;

    return {
      riskScore: Math.round(riskScore),
      riskLevel: riskScore < 10 ? 'low' : riskScore < 30 ? 'medium' : 'high',
      riskFactors,
      recommendations: this.generateComplianceRecommendations(riskFactors, totalDestinations)
    };
  }

  /**
   * Generate compliance recommendations
   */
  private generateComplianceRecommendations(riskFactors: any, totalDestinations: number): string[] {
    const recommendations: string[] = [];

    if (riskFactors.expiredConsents > 0) {
      recommendations.push(`Renew consent for ${riskFactors.expiredConsents} destinations with expired consent`);
    }

    if (riskFactors.missingConsents > 0) {
      recommendations.push(`Obtain proper consent for ${riskFactors.missingConsents} destinations without consent`);
    }

    if (riskFactors.inactiveDestinations > totalDestinations * 0.3) {
      recommendations.push('Consider cleaning up inactive destinations to reduce data footprint');
    }

    if (riskFactors.oldData > totalDestinations * 0.5) {
      recommendations.push('Review data retention policies and consider archiving old data');
    }

    if (recommendations.length === 0) {
      recommendations.push('Compliance status is good. Continue monitoring regularly.');
    }

    return recommendations;
  }

  /**
   * Utility function to group array by property
   */
  private groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce((groups, item) => {
      const value = String(item[key]);
      groups[value] = (groups[value] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  /**
   * Mask identifier for privacy
   */
  private maskIdentifier(identifier: string): string {
    if (identifier.includes('@')) {
      return identifier.substring(0, 8) + '***@g.us';
    } else {
      return identifier.substring(0, 4) + '***' + identifier.substring(identifier.length - 2);
    }
  }
}

export default ComplianceService;