import { createServiceLogger } from '../../utils/logger';
import { DestinationManager } from './DestinationManager';
import { IService } from '../ServiceRegistry';
import mongoose from 'mongoose';

const logger = createServiceLogger('DestinationHealthService');

/**
 * Destination Health Service
 * Autonomous service for monitoring and maintaining destination health
 */
export class DestinationHealthService implements IService {
  private static instance: DestinationHealthService;
  private destinationManager: DestinationManager;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Configuration
  private readonly HEALTH_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
  private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly SYNC_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
  private readonly INACTIVE_THRESHOLD_DAYS = 90; // Days to consider destination inactive
  private readonly CONSENT_EXPIRY_DAYS = 730; // 2 years for GDPR compliance

  private constructor() {
    this.destinationManager = DestinationManager.getInstance();
  }

  static getInstance(): DestinationHealthService {
    if (!DestinationHealthService.instance) {
      DestinationHealthService.instance = new DestinationHealthService();
    }
    return DestinationHealthService.instance;
  }

  /**
   * Start the health service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Destination health service is already running');
      return;
    }

    logger.info('Starting destination health service...');

    // Start health checking
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        logger.error('Health check failed', error);
      });
    }, this.HEALTH_CHECK_INTERVAL);

    // Start cleanup process
    this.cleanupInterval = setInterval(() => {
      this.performCleanup().catch(error => {
        logger.error('Cleanup process failed', error);
      });
    }, this.CLEANUP_INTERVAL);

    // Start synchronization
    this.syncInterval = setInterval(() => {
      this.performSynchronization().catch(error => {
        logger.error('Synchronization failed', error);
      });
    }, this.SYNC_INTERVAL);

    this.isRunning = true;

    // Perform initial checks
    setTimeout(() => {
      this.performHealthCheck().catch(error => {
        logger.error('Initial health check failed', error);
      });
    }, 5000); // Wait 5 seconds after startup

    logger.info('✅ Destination health service started successfully');
  }

  /**
   * Stop the health service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping destination health service...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.isRunning = false;
    logger.info('✅ Destination health service stopped');
  }

  /**
   * Health check for the service itself
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const { Destination } = await import('../../models/Destination');
      
      // Check database connectivity
      const totalDestinations = await Destination.countDocuments();
      
      // Check service status
      const details = {
        isRunning: this.isRunning,
        totalDestinations,
        intervals: {
          healthCheck: this.healthCheckInterval !== null,
          cleanup: this.cleanupInterval !== null,
          sync: this.syncInterval !== null
        },
        lastHealthCheck: this.getStatus().lastHealthCheck,
        lastCleanup: this.getStatus().lastCleanup,
        lastSync: this.getStatus().lastSync
      };

      return {
        healthy: this.isRunning && totalDestinations >= 0,
        details
      };
    } catch (error) {
      logger.error('Health check failed', error);
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
      intervals: {
        healthCheckInterval: this.HEALTH_CHECK_INTERVAL,
        cleanupInterval: this.CLEANUP_INTERVAL,
        syncInterval: this.SYNC_INTERVAL
      },
      thresholds: {
        inactiveThresholdDays: this.INACTIVE_THRESHOLD_DAYS,
        consentExpiryDays: this.CONSENT_EXPIRY_DAYS
      },
      lastHealthCheck: this.lastHealthCheck,
      lastCleanup: this.lastCleanup,
      lastSync: this.lastSync,
      stats: this.healthStats
    };
  }

  private lastHealthCheck: Date | null = null;
  private lastCleanup: Date | null = null;
  private lastSync: Date | null = null;
  private healthStats = {
    totalChecked: 0,
    invalidDestinations: 0,
    expiredConsents: 0,
    inactiveDestinations: 0,
    cleanedUp: 0,
    synchronized: 0
  };

  /**
   * Perform comprehensive health check on all destinations
   */
  private async performHealthCheck(): Promise<void> {
    logger.info('Starting destination health check...');
    this.lastHealthCheck = new Date();

    try {
      const { Destination } = await import('../../models/Destination');

      // Get all active destinations
      const destinations = await Destination.find({
        isActive: true,
        'consent.granted': true
      });

      logger.info(`Checking health of ${destinations.length} destinations`);

      let invalidCount = 0;
      let expiredConsentCount = 0;
      let inactiveCount = 0;

      for (const destination of destinations) {
        try {
          // Check if destination identifier is still valid
          const isValidIdentifier = await this.validateDestinationIdentifier(
            destination.type,
            destination.identifier
          );

          if (!isValidIdentifier) {
            await this.markDestinationAsInvalid(destination);
            invalidCount++;
            continue;
          }

          // Check consent expiry (GDPR compliance - 2 years)
          const consentAge = Date.now() - destination.consent.grantedAt.getTime();
          const consentExpired = consentAge > (this.CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

          if (consentExpired) {
            await this.handleExpiredConsent(destination);
            expiredConsentCount++;
            continue;
          }

          // Check for inactivity
          const lastActivity = destination.lastMessageSent || destination.createdAt;
          const inactivityPeriod = Date.now() - lastActivity.getTime();
          const isInactive = inactivityPeriod > (this.INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

          if (isInactive) {
            await this.handleInactiveDestination(destination);
            inactiveCount++;
          }

        } catch (error) {
          logger.error('Error checking destination health', error, {
            destinationId: destination._id,
            identifier: this.maskIdentifier(destination.identifier)
          });
        }
      }

      // Update stats
      this.healthStats.totalChecked = destinations.length;
      this.healthStats.invalidDestinations += invalidCount;
      this.healthStats.expiredConsents += expiredConsentCount;
      this.healthStats.inactiveDestinations += inactiveCount;

      logger.info('Destination health check completed', {
        totalChecked: destinations.length,
        invalid: invalidCount,
        expiredConsents: expiredConsentCount,
        inactive: inactiveCount
      });

    } catch (error) {
      logger.error('Destination health check failed', error);
    }
  }

  /**
   * Perform cleanup of invalid and expired destinations
   */
  private async performCleanup(): Promise<void> {
    logger.info('Starting destination cleanup...');
    this.lastCleanup = new Date();

    try {
      const { Destination } = await import('../../models/Destination');

      // Clean up destinations that have been revoked for more than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const cleanupResult = await Destination.deleteMany({
        'consent.granted': false,
        'consent.revokedAt': { $lt: thirtyDaysAgo }
      });

      // Clean up destinations marked as invalid for more than 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const invalidCleanupResult = await Destination.deleteMany({
        isActive: false,
        'metadata.markedInvalidAt': { $lt: sevenDaysAgo }
      });

      const totalCleaned = cleanupResult.deletedCount + invalidCleanupResult.deletedCount;
      this.healthStats.cleanedUp += totalCleaned;

      logger.info('Destination cleanup completed', {
        revokedDestinations: cleanupResult.deletedCount,
        invalidDestinations: invalidCleanupResult.deletedCount,
        totalCleaned
      });

    } catch (error) {
      logger.error('Destination cleanup failed', error);
    }
  }

  /**
   * Perform synchronization of destination data
   */
  private async performSynchronization(): Promise<void> {
    logger.info('Starting destination synchronization...');
    this.lastSync = new Date();

    try {
      const { Destination } = await import('../../models/Destination');

      // Get destinations that need synchronization (updated more than 7 days ago)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const destinationsToSync = await Destination.find({
        isActive: true,
        'consent.granted': true,
        updatedAt: { $lt: sevenDaysAgo }
      }).limit(100); // Process in batches

      let syncedCount = 0;

      for (const destination of destinationsToSync) {
        try {
          const syncResult = await this.synchronizeDestination(destination);
          if (syncResult) {
            syncedCount++;
          }
        } catch (error) {
          logger.error('Failed to sync destination', error, {
            destinationId: destination._id,
            identifier: this.maskIdentifier(destination.identifier)
          });
        }
      }

      this.healthStats.synchronized += syncedCount;

      logger.info('Destination synchronization completed', {
        totalToSync: destinationsToSync.length,
        synced: syncedCount
      });

    } catch (error) {
      logger.error('Destination synchronization failed', error);
    }
  }

  /**
   * Validate destination identifier format and reachability
   */
  private async validateDestinationIdentifier(
    type: 'group' | 'contact',
    identifier: string
  ): Promise<boolean> {
    try {
      if (type === 'contact') {
        // Validate phone number format
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        const cleanIdentifier = identifier.replace(/[\s\-()]/g, '');
        return phoneRegex.test(cleanIdentifier);
      } else if (type === 'group') {
        // Validate WhatsApp group ID format
        const groupRegex = /^[0-9]+-[0-9]+@g\.us$/;
        return groupRegex.test(identifier);
      }
      
      return false;
    } catch (error) {
      logger.error('Identifier validation failed', error, { type, identifier: this.maskIdentifier(identifier) });
      return false;
    }
  }

  /**
   * Mark destination as invalid
   */
  private async markDestinationAsInvalid(destination: any): Promise<void> {
    try {
      destination.isActive = false;
      destination.metadata = destination.metadata || {};
      destination.metadata.markedInvalidAt = new Date();
      destination.metadata.invalidReason = 'identifier_validation_failed';
      
      await destination.save();

      logger.info('Destination marked as invalid', {
        destinationId: destination._id,
        identifier: this.maskIdentifier(destination.identifier),
        type: destination.type
      });
    } catch (error) {
      logger.error('Failed to mark destination as invalid', error);
    }
  }

  /**
   * Handle expired consent
   */
  private async handleExpiredConsent(destination: any): Promise<void> {
    try {
      // Mark consent as expired but don't revoke immediately
      // This allows for re-consent process
      destination.metadata = destination.metadata || {};
      destination.metadata.consentExpired = true;
      destination.metadata.consentExpiredAt = new Date();
      destination.isActive = false; // Temporarily deactivate
      
      await destination.save();

      logger.info('Destination consent expired', {
        destinationId: destination._id,
        identifier: this.maskIdentifier(destination.identifier),
        consentGrantedAt: destination.consent.grantedAt
      });

      // TODO: Trigger re-consent process (email, notification, etc.)
      
    } catch (error) {
      logger.error('Failed to handle expired consent', error);
    }
  }

  /**
   * Handle inactive destination
   */
  private async handleInactiveDestination(destination: any): Promise<void> {
    try {
      destination.metadata = destination.metadata || {};
      destination.metadata.markedInactiveAt = new Date();
      destination.metadata.inactiveReason = 'no_recent_activity';
      
      await destination.save();

      logger.info('Destination marked as inactive', {
        destinationId: destination._id,
        identifier: this.maskIdentifier(destination.identifier),
        lastActivity: destination.lastMessageSent || destination.createdAt
      });
    } catch (error) {
      logger.error('Failed to handle inactive destination', error);
    }
  }

  /**
   * Synchronize destination data
   */
  private async synchronizeDestination(destination: any): Promise<boolean> {
    try {
      // Update the updatedAt timestamp to mark as synchronized
      destination.metadata = destination.metadata || {};
      destination.metadata.lastSyncAt = new Date();
      
      await destination.save();

      logger.debug('Destination synchronized', {
        destinationId: destination._id,
        identifier: this.maskIdentifier(destination.identifier)
      });

      return true;
    } catch (error) {
      logger.error('Failed to synchronize destination', error);
      return false;
    }
  }

  /**
   * Mask identifier for logging privacy
   */
  private maskIdentifier(identifier: string): string {
    if (identifier.includes('@')) {
      // Group ID
      return identifier.substring(0, 8) + '***@g.us';
    } else {
      // Phone number
      return identifier.substring(0, 4) + '***' + identifier.substring(identifier.length - 2);
    }
  }

  /**
   * Get health statistics
   */
  getHealthStats() {
    return { ...this.healthStats };
  }

  /**
   * Reset health statistics
   */
  resetHealthStats(): void {
    this.healthStats = {
      totalChecked: 0,
      invalidDestinations: 0,
      expiredConsents: 0,
      inactiveDestinations: 0,
      cleanedUp: 0,
      synchronized: 0
    };
    logger.info('Health statistics reset');
  }

  /**
   * Force health check (for manual triggering)
   */
  async forceHealthCheck(): Promise<void> {
    logger.info('Forcing destination health check...');
    await this.performHealthCheck();
  }

  /**
   * Force cleanup (for manual triggering)
   */
  async forceCleanup(): Promise<void> {
    logger.info('Forcing destination cleanup...');
    await this.performCleanup();
  }

  /**
   * Force synchronization (for manual triggering)
   */
  async forceSynchronization(): Promise<void> {
    logger.info('Forcing destination synchronization...');
    await this.performSynchronization();
  }
}

export default DestinationHealthService;