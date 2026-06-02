import { createServiceLogger } from '../../utils/logger';
import { DestinationManager } from './DestinationManager';
import { IService } from '../ServiceRegistry';
import mongoose from 'mongoose';

const logger = createServiceLogger('DestinationSyncService');

export interface SyncResult {
  destinationId: string;
  identifier: string;
  status: 'success' | 'failed' | 'not_found' | 'invalid' | 'no_change';
  changes?: {
    name?: { old: string; new: string };
    isActive?: { old: boolean; new: boolean };
    metadata?: Record<string, any>;
  };
  error?: string;
  lastSyncAt: Date;
}

export interface SyncStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  notFound: number;
  invalid: number;
  noChange: number;
  lastSyncRun: Date | null;
  averageSyncTime: number;
}

/**
 * Destination Synchronization Service
 * Handles automatic contact and group synchronization with WhatsApp
 */
export class DestinationSyncService implements IService {
  private static instance: DestinationSyncService;
  private destinationManager: DestinationManager;
  private syncInterval: NodeJS.Timeout | null = null;
  private validationInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Configuration
  private readonly SYNC_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
  private readonly VALIDATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly BATCH_SIZE = 50; // Process destinations in batches
  private readonly SYNC_TIMEOUT = 30000; // 30 seconds timeout per destination

  private syncStats: SyncStats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    notFound: 0,
    invalid: 0,
    noChange: 0,
    lastSyncRun: null,
    averageSyncTime: 0
  };

  private constructor() {
    this.destinationManager = DestinationManager.getInstance();
  }

  static getInstance(): DestinationSyncService {
    if (!DestinationSyncService.instance) {
      DestinationSyncService.instance = new DestinationSyncService();
    }
    return DestinationSyncService.instance;
  }

  /**
   * Start the sync service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Destination sync service is already running');
      return;
    }

    logger.info('Starting destination sync service...');

    // Start periodic synchronization
    this.syncInterval = setInterval(() => {
      this.performBatchSync().catch(error => {
        logger.error('Batch sync failed', error);
      });
    }, this.SYNC_INTERVAL);

    // Start periodic validation
    this.validationInterval = setInterval(() => {
      this.performValidation().catch(error => {
        logger.error('Validation failed', error);
      });
    }, this.VALIDATION_INTERVAL);

    this.isRunning = true;

    // Perform initial sync after startup
    setTimeout(() => {
      this.performBatchSync().catch(error => {
        logger.error('Initial sync failed', error);
      });
    }, 30000); // Wait 30 seconds after startup

    logger.info('✅ Destination sync service started successfully');
  }

  /**
   * Stop the sync service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping destination sync service...');

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }

    this.isRunning = false;
    logger.info('✅ Destination sync service stopped');
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const details = {
        isRunning: this.isRunning,
        syncStats: this.syncStats,
        intervals: {
          sync: this.syncInterval !== null,
          validation: this.validationInterval !== null
        },
        configuration: {
          syncInterval: this.SYNC_INTERVAL,
          validationInterval: this.VALIDATION_INTERVAL,
          batchSize: this.BATCH_SIZE,
          syncTimeout: this.SYNC_TIMEOUT
        }
      };

      return {
        healthy: this.isRunning,
        details
      };
    } catch (error) {
      logger.error('Sync service health check failed', error);
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
      syncStats: { ...this.syncStats },
      configuration: {
        syncInterval: this.SYNC_INTERVAL,
        validationInterval: this.VALIDATION_INTERVAL,
        batchSize: this.BATCH_SIZE,
        syncTimeout: this.SYNC_TIMEOUT
      }
    };
  }

  /**
   * Manually trigger synchronization for a specific client
   */
  async syncClient(clientId: string): Promise<SyncResult[]> {
    logger.info('Starting manual client sync', { clientId });

    try {
      const { destinations } = await this.destinationManager.getDestinations(clientId, {
        activeOnly: true,
        withConsent: true,
        limit: 1000
      });

      const results: SyncResult[] = [];

      for (const destination of destinations) {
        try {
          const result = await this.syncDestination(destination);
          results.push(result);
        } catch (error) {
          logger.error('Failed to sync destination', error, {
            destinationId: destination.id,
            identifier: this.maskIdentifier(destination.identifier)
          });

          results.push({
            destinationId: destination.id!,
            identifier: destination.identifier,
            status: 'failed',
            error: (error as Error).message,
            lastSyncAt: new Date()
          });
        }
      }

      logger.info('Manual client sync completed', {
        clientId,
        totalDestinations: destinations.length,
        results: this.summarizeResults(results)
      });

      return results;
    } catch (error) {
      logger.error('Manual client sync failed', error, { clientId });
      throw error;
    }
  }

  /**
   * Manually trigger synchronization for a specific destination
   */
  async syncDestination(destination: any): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      logger.debug('Syncing destination', {
        destinationId: destination.id,
        type: destination.type,
        identifier: this.maskIdentifier(destination.identifier)
      });

      // Validate destination identifier format
      if (!this.isValidIdentifier(destination.type, destination.identifier)) {
        return {
          destinationId: destination.id,
          identifier: destination.identifier,
          status: 'invalid',
          error: 'Invalid identifier format',
          lastSyncAt: new Date()
        };
      }

      // For WhatsApp integration, we would check if the contact/group still exists
      // This is a placeholder for the actual WhatsApp API integration
      const whatsappInfo = await this.getWhatsAppInfo(destination.type, destination.identifier);

      if (!whatsappInfo) {
        return {
          destinationId: destination.id,
          identifier: destination.identifier,
          status: 'not_found',
          error: 'Destination not found in WhatsApp',
          lastSyncAt: new Date()
        };
      }

      // Check if any updates are needed
      const changes = this.detectChanges(destination, whatsappInfo);

      if (Object.keys(changes).length === 0) {
        // Update sync timestamp even if no changes
        await this.updateSyncTimestamp(destination.id);

        return {
          destinationId: destination.id,
          identifier: destination.identifier,
          status: 'no_change',
          lastSyncAt: new Date()
        };
      }

      // Apply changes
      await this.applyChanges(destination.id, changes);

      const syncTime = Date.now() - startTime;
      this.updateSyncStats('success', syncTime);

      return {
        destinationId: destination.id,
        identifier: destination.identifier,
        status: 'success',
        changes,
        lastSyncAt: new Date()
      };

    } catch (error) {
      const syncTime = Date.now() - startTime;
      this.updateSyncStats('failed', syncTime);

      logger.error('Destination sync failed', error, {
        destinationId: destination.id,
        identifier: this.maskIdentifier(destination.identifier)
      });

      return {
        destinationId: destination.id,
        identifier: destination.identifier,
        status: 'failed',
        error: (error as Error).message,
        lastSyncAt: new Date()
      };
    }
  }

  /**
   * Perform batch synchronization
   */
  private async performBatchSync(): Promise<void> {
    logger.info('Starting batch synchronization...');
    this.syncStats.lastSyncRun = new Date();

    try {
      const { Destination } = await import('../../models/Destination');

      // Get destinations that need synchronization (not synced in last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const destinationsToSync = await Destination.find({
        isActive: true,
        'consent.granted': true,
        $or: [
          { 'metadata.lastSyncAt': { $lt: twentyFourHoursAgo } },
          { 'metadata.lastSyncAt': { $exists: false } }
        ]
      })
      .limit(this.BATCH_SIZE)
      .sort({ 'metadata.lastSyncAt': 1 }); // Sync oldest first

      logger.info(`Found ${destinationsToSync.length} destinations to sync`);

      const results: SyncResult[] = [];

      for (const destination of destinationsToSync) {
        try {
          const result = await this.syncDestination(destination);
          results.push(result);

          // Add small delay between syncs to avoid overwhelming the system
          await this.delay(100);
        } catch (error) {
          logger.error('Batch sync destination failed', error, {
            destinationId: destination._id,
            identifier: this.maskIdentifier(destination.identifier)
          });
        }
      }

      const summary = this.summarizeResults(results);
      logger.info('Batch synchronization completed', summary);

    } catch (error) {
      logger.error('Batch synchronization failed', error);
    }
  }

  /**
   * Perform validation of all destinations
   */
  private async performValidation(): Promise<void> {
    logger.info('Starting destination validation...');

    try {
      const { Destination } = await import('../../models/Destination');

      // Get all active destinations
      const destinations = await Destination.find({
        isActive: true,
        'consent.granted': true
      });

      let validatedCount = 0;
      let invalidatedCount = 0;

      for (const destination of destinations) {
        try {
          const isValid = await this.validateDestination(destination);
          
          if (!isValid) {
            await this.markDestinationAsInvalid(destination);
            invalidatedCount++;
          } else {
            validatedCount++;
          }

          // Add delay to avoid overwhelming the system
          await this.delay(50);
        } catch (error) {
          logger.error('Destination validation failed', error, {
            destinationId: destination._id,
            identifier: this.maskIdentifier(destination.identifier)
          });
        }
      }

      logger.info('Destination validation completed', {
        totalDestinations: destinations.length,
        validated: validatedCount,
        invalidated: invalidatedCount
      });

    } catch (error) {
      logger.error('Destination validation failed', error);
    }
  }

  /**
   * Get WhatsApp information for destination
   * This is a placeholder - in real implementation, this would integrate with WhatsApp API
   */
  private async getWhatsAppInfo(type: 'group' | 'contact', identifier: string): Promise<any | null> {
    try {
      // Simulate API call delay
      await this.delay(100);

      // This would be replaced with actual WhatsApp API calls
      if (type === 'contact') {
        // Check if phone number is valid and registered on WhatsApp
        return {
          name: `Contact ${identifier.slice(-4)}`,
          isRegistered: true,
          profilePicture: null,
          status: 'active'
        };
      } else if (type === 'group') {
        // Check if group exists and bot is still a member
        return {
          name: `Group ${identifier.slice(0, 8)}`,
          memberCount: 25,
          isActive: true,
          isMember: true
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get WhatsApp info', error, {
        type,
        identifier: this.maskIdentifier(identifier)
      });
      return null;
    }
  }

  /**
   * Detect changes between destination and WhatsApp info
   */
  private detectChanges(destination: any, whatsappInfo: any): Record<string, any> {
    const changes: Record<string, any> = {};

    // Check name changes
    if (whatsappInfo.name && whatsappInfo.name !== destination.name) {
      changes.name = {
        old: destination.name,
        new: whatsappInfo.name
      };
    }

    // Check status changes
    if (destination.type === 'contact') {
      if (!whatsappInfo.isRegistered && destination.isActive) {
        changes.isActive = {
          old: destination.isActive,
          new: false
        };
      }
    } else if (destination.type === 'group') {
      if (!whatsappInfo.isActive || !whatsappInfo.isMember) {
        changes.isActive = {
          old: destination.isActive,
          new: false
        };
      }
    }

    // Update metadata
    changes.metadata = {
      ...destination.metadata,
      whatsappInfo,
      lastSyncAt: new Date()
    };

    return changes;
  }

  /**
   * Apply changes to destination
   */
  private async applyChanges(destinationId: string, changes: Record<string, any>): Promise<void> {
    try {
      const { Destination } = await import('../../models/Destination');

      const updateData: any = {};

      if (changes.name) {
        updateData.name = changes.name.new;
      }

      if (changes.isActive) {
        updateData.isActive = changes.isActive.new;
      }

      if (changes.metadata) {
        updateData.metadata = changes.metadata;
      }

      await Destination.updateOne(
        { _id: new mongoose.Types.ObjectId(destinationId) },
        { $set: updateData }
      );

      logger.debug('Changes applied to destination', {
        destinationId,
        changes: Object.keys(changes)
      });

    } catch (error) {
      logger.error('Failed to apply changes', error, { destinationId });
      throw error;
    }
  }

  /**
   * Update sync timestamp for destination
   */
  private async updateSyncTimestamp(destinationId: string): Promise<void> {
    try {
      const { Destination } = await import('../../models/Destination');

      await Destination.updateOne(
        { _id: new mongoose.Types.ObjectId(destinationId) },
        {
          $set: {
            'metadata.lastSyncAt': new Date()
          }
        }
      );

    } catch (error) {
      logger.error('Failed to update sync timestamp', error, { destinationId });
    }
  }

  /**
   * Validate destination
   */
  private async validateDestination(destination: any): Promise<boolean> {
    try {
      // Check identifier format
      if (!this.isValidIdentifier(destination.type, destination.identifier)) {
        return false;
      }

      // Check if destination exists in WhatsApp
      const whatsappInfo = await this.getWhatsAppInfo(destination.type, destination.identifier);
      
      if (!whatsappInfo) {
        return false;
      }

      if (destination.type === 'contact') {
        return whatsappInfo.isRegistered;
      } else if (destination.type === 'group') {
        return whatsappInfo.isActive && whatsappInfo.isMember;
      }

      return false;
    } catch (error) {
      logger.error('Destination validation error', error);
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
      destination.metadata.invalidatedAt = new Date();
      destination.metadata.invalidationReason = 'sync_validation_failed';
      
      await destination.save();

      logger.info('Destination marked as invalid during sync', {
        destinationId: destination._id,
        identifier: this.maskIdentifier(destination.identifier)
      });

    } catch (error) {
      logger.error('Failed to mark destination as invalid', error);
    }
  }

  /**
   * Check if identifier is valid
   */
  private isValidIdentifier(type: 'group' | 'contact', identifier: string): boolean {
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
  }

  /**
   * Update sync statistics
   */
  private updateSyncStats(status: 'success' | 'failed', syncTime: number): void {
    this.syncStats.totalProcessed++;
    
    if (status === 'success') {
      this.syncStats.successful++;
    } else {
      this.syncStats.failed++;
    }

    // Update average sync time
    const totalTime = this.syncStats.averageSyncTime * (this.syncStats.totalProcessed - 1) + syncTime;
    this.syncStats.averageSyncTime = totalTime / this.syncStats.totalProcessed;
  }

  /**
   * Summarize sync results
   */
  private summarizeResults(results: SyncResult[]): any {
    const summary = {
      total: results.length,
      successful: 0,
      failed: 0,
      notFound: 0,
      invalid: 0,
      noChange: 0
    };

    for (const result of results) {
      summary[result.status]++;
    }

    return summary;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

  /**
   * Get sync statistics
   */
  getSyncStats(): SyncStats {
    return { ...this.syncStats };
  }

  /**
   * Reset sync statistics
   */
  resetSyncStats(): void {
    this.syncStats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      notFound: 0,
      invalid: 0,
      noChange: 0,
      lastSyncRun: null,
      averageSyncTime: 0
    };
    logger.info('Sync statistics reset');
  }

  /**
   * Force sync for all destinations (manual trigger)
   */
  async forceFullSync(): Promise<void> {
    logger.info('Forcing full synchronization...');
    await this.performBatchSync();
  }

  /**
   * Force validation for all destinations (manual trigger)
   */
  async forceFullValidation(): Promise<void> {
    logger.info('Forcing full validation...');
    await this.performValidation();
  }
}

export default DestinationSyncService;