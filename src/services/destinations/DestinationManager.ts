import { createServiceLogger } from '../../utils/logger';
import mongoose from 'mongoose';

const logger = createServiceLogger('DestinationManager');

export interface ConsentRecord {
  granted: boolean;
  grantedAt: Date;
  source: 'manual' | 'api' | 'import' | 'discord_command';
  ipAddress: string;
  userAgent?: string;
  revokedAt?: Date;
  revokeReason?: string;
}

export interface DestinationData {
  id?: string;
  clientId: string;
  type: 'group' | 'contact';
  identifier: string;
  name: string;
  consent: ConsentRecord;
  isActive: boolean;
  metadata?: Record<string, any>;
  lastMessageSent?: Date;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceReport {
  totalDestinations: number;
  withConsent: number;
  withoutConsent: number;
  recentOptOuts: number;
  complianceRate: number;
  dataRetentionStatus: {
    toBeDeleted: number;
    scheduledDeletion: Date[];
  };
}

/**
 * Destination Management with LGPD/GDPR Compliance
 */
export class DestinationManager {
  private static instance: DestinationManager;

  private constructor() {
    this.startComplianceMonitoring();
  }

  static getInstance(): DestinationManager {
    if (!DestinationManager.instance) {
      DestinationManager.instance = new DestinationManager();
    }
    return DestinationManager.instance;
  }

  /**
   * Start compliance monitoring
   */
  private startComplianceMonitoring(): void {
    // Check compliance daily
    setInterval(() => {
      this.performComplianceCheck();
    }, 24 * 60 * 60 * 1000);

    // Clean up expired data every hour
    setInterval(() => {
      this.cleanupExpiredData();
    }, 60 * 60 * 1000);

    logger.info('Compliance monitoring started');
  }

  /**
   * Add destination with consent
   */
  async addDestination(
    clientId: string,
    type: 'group' | 'contact',
    identifier: string,
    name: string,
    consentData: {
      source: ConsentRecord['source'];
      ipAddress: string;
      userAgent?: string;
    }
  ): Promise<DestinationData> {
    try {
      // Import Destination model dynamically
      const { Destination } = await import('../../models/Destination');

      // Check if destination already exists
      const existing = await Destination.findOne({
        clientId: new mongoose.Types.ObjectId(clientId),
        identifier
      });

      if (existing) {
        throw new Error('Destination already exists');
      }

      // Validate identifier format
      this.validateIdentifier(type, identifier);

      const destination = new Destination({
        clientId: new mongoose.Types.ObjectId(clientId),
        type,
        identifier,
        name,
        consent: {
          granted: true,
          grantedAt: new Date(),
          source: consentData.source,
          ipAddress: consentData.ipAddress,
          userAgent: consentData.userAgent
        },
        isActive: true,
        messageCount: 0
      });

      await destination.save();

      logger.info('Destination added with consent', {
        clientId,
        type,
        identifier: this.maskIdentifier(identifier),
        source: consentData.source
      });

      return this.mapToDestinationData(destination);
    } catch (error) {
      logger.error('Failed to add destination', error as Error, {
        clientId,
        type,
        identifier: this.maskIdentifier(identifier)
      });
      throw error;
    }
  }

  /**
   * Remove destination (opt-out)
   */
  async removeDestination(
    clientId: string,
    identifier: string,
    reason: string = 'user_request'
  ): Promise<boolean> {
    try {
      const { Destination } = await import('../../models/Destination');

      const destination = await Destination.findOne({
        clientId: new mongoose.Types.ObjectId(clientId),
        identifier
      });

      if (!destination) {
        return false;
      }

      // Update consent record
      destination.consent.granted = false;
      (destination.consent as any).revokedAt = new Date();
      (destination.consent as any).revokeReason = reason;
      destination.isActive = false;

      await destination.save();

      logger.info('Destination removed (opt-out)', {
        clientId,
        identifier: this.maskIdentifier(identifier),
        reason
      });

      // Schedule for deletion after retention period
      this.scheduleDataDeletion(destination._id.toString(), 30); // 30 days

      return true;
    } catch (error) {
      logger.error('Failed to remove destination', error as Error, {
        clientId,
        identifier: this.maskIdentifier(identifier)
      });
      return false;
    }
  }

  /**
   * Get destinations for client
   */
  async getDestinations(
    clientId: string,
    options: {
      type?: 'group' | 'contact';
      activeOnly?: boolean;
      withConsent?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ destinations: DestinationData[]; total: number }> {
    try {
      const { Destination } = await import('../../models/Destination');

      const query: any = {
        clientId: new mongoose.Types.ObjectId(clientId)
      };

      if (options.type) {
        query.type = options.type;
      }

      if (options.activeOnly) {
        query.isActive = true;
      }

      if (options.withConsent) {
        query['consent.granted'] = true;
      }

      const total = await Destination.countDocuments(query);
      
      let destinations = await Destination.find(query)
        .sort({ createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.offset || 0);

      const mappedDestinations = destinations.map(dest => this.mapToDestinationData(dest));

      logger.debug('Destinations retrieved', {
        clientId,
        count: mappedDestinations.length,
        total,
        options
      });

      return {
        destinations: mappedDestinations,
        total
      };
    } catch (error) {
      logger.error('Failed to get destinations', error as Error, { clientId });
      return { destinations: [], total: 0 };
    }
  }

  /**
   * Update destination consent
   */
  async updateConsent(
    clientId: string,
    identifier: string,
    granted: boolean,
    consentData: {
      source: ConsentRecord['source'];
      ipAddress: string;
      userAgent?: string;
      reason?: string;
    }
  ): Promise<boolean> {
    try {
      const { Destination } = await import('../../models/Destination');

      const destination = await Destination.findOne({
        clientId: new mongoose.Types.ObjectId(clientId),
        identifier
      });

      if (!destination) {
        return false;
      }

      if (granted) {
        destination.consent.granted = true;
        destination.consent.grantedAt = new Date();
        destination.consent.source = consentData.source;
        destination.consent.ipAddress = consentData.ipAddress;
        (destination.consent as any).userAgent = consentData.userAgent;
        destination.isActive = true;
        
        // Clear revocation data
        (destination.consent as any).revokedAt = undefined;
        (destination.consent as any).revokeReason = undefined;
      } else {
        destination.consent.granted = false;
        (destination.consent as any).revokedAt = new Date();
        (destination.consent as any).revokeReason = consentData.reason || 'consent_withdrawn';
        destination.isActive = false;
      }

      await destination.save();

      logger.info('Destination consent updated', {
        clientId,
        identifier: this.maskIdentifier(identifier),
        granted,
        source: consentData.source
      });

      return true;
    } catch (error) {
      logger.error('Failed to update consent', error as Error, {
        clientId,
        identifier: this.maskIdentifier(identifier)
      });
      return false;
    }
  }

  /**
   * Validate destination before sending
   */
  async validateDestination(clientId: string, identifier: string): Promise<{
    valid: boolean;
    reason?: string;
    destination?: DestinationData;
  }> {
    try {
      const { Destination } = await import('../../models/Destination');

      const destination = await Destination.findOne({
        clientId: new mongoose.Types.ObjectId(clientId),
        identifier
      });

      if (!destination) {
        return { valid: false, reason: 'destination_not_found' };
      }

      if (!destination.isActive) {
        return { valid: false, reason: 'destination_inactive' };
      }

      if (!destination.consent.granted) {
        return { valid: false, reason: 'consent_not_granted' };
      }

      // Check if consent is recent (within 2 years for GDPR compliance)
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      if (destination.consent.grantedAt < twoYearsAgo) {
        return { valid: false, reason: 'consent_expired' };
      }

      return {
        valid: true,
        destination: this.mapToDestinationData(destination)
      };
    } catch (error) {
      logger.error('Failed to validate destination', error as Error, {
        clientId,
        identifier: this.maskIdentifier(identifier)
      });
      return { valid: false, reason: 'validation_error' };
    }
  }

  /**
   * Record message sent to destination
   */
  async recordMessageSent(clientId: string, identifier: string): Promise<void> {
    try {
      const { Destination } = await import('../../models/Destination');

      await Destination.updateOne(
        {
          clientId: new mongoose.Types.ObjectId(clientId),
          identifier
        },
        {
          $inc: { messageCount: 1 },
          $set: { lastMessageSent: new Date() }
        }
      );

      logger.debug('Message sent recorded', {
        clientId,
        identifier: this.maskIdentifier(identifier)
      });
    } catch (error) {
      logger.error('Failed to record message sent', error as Error, {
        clientId,
        identifier: this.maskIdentifier(identifier)
      });
    }
  }

  /**
   * Get compliance report
   */
  async getComplianceReport(clientId: string): Promise<ComplianceReport> {
    try {
      const { Destination } = await import('../../models/Destination');

      const clientObjectId = new mongoose.Types.ObjectId(clientId);
      
      const [
        totalDestinations,
        withConsent,
        withoutConsent,
        recentOptOuts
      ] = await Promise.all([
        Destination.countDocuments({ clientId: clientObjectId }),
        Destination.countDocuments({ 
          clientId: clientObjectId, 
          'consent.granted': true 
        }),
        Destination.countDocuments({ 
          clientId: clientObjectId, 
          'consent.granted': false 
        }),
        Destination.countDocuments({
          clientId: clientObjectId,
          'consent.revokedAt': {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        })
      ]);

      const complianceRate = totalDestinations > 0 ? withConsent / totalDestinations : 1;

      // Get destinations scheduled for deletion
      const toBeDeleted = await Destination.countDocuments({
        clientId: clientObjectId,
        'consent.granted': false,
        'consent.revokedAt': { $exists: true }
      });

      return {
        totalDestinations,
        withConsent,
        withoutConsent,
        recentOptOuts,
        complianceRate,
        dataRetentionStatus: {
          toBeDeleted,
          scheduledDeletion: [] // TODO: Implement scheduled deletion dates
        }
      };
    } catch (error) {
      logger.error('Failed to generate compliance report', error as Error, { clientId });
      return {
        totalDestinations: 0,
        withConsent: 0,
        withoutConsent: 0,
        recentOptOuts: 0,
        complianceRate: 0,
        dataRetentionStatus: {
          toBeDeleted: 0,
          scheduledDeletion: []
        }
      };
    }
  }

  /**
   * Export destination data (GDPR data portability)
   */
  async exportDestinationData(clientId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const { destinations } = await this.getDestinations(clientId, { limit: 10000 });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `destinations-export-${clientId}-${timestamp}.${format}`;
      
      // TODO: Implement actual file export
      logger.info('Destination data exported', { clientId, format, count: destinations.length });
      
      return filename;
    } catch (error) {
      logger.error('Failed to export destination data', error as Error, { clientId });
      throw error;
    }
  }

  /**
   * Delete all data for client (right to be forgotten)
   */
  async deleteAllClientData(clientId: string, reason: string = 'gdpr_request'): Promise<boolean> {
    try {
      const { Destination } = await import('../../models/Destination');

      const result = await Destination.deleteMany({
        clientId: new mongoose.Types.ObjectId(clientId)
      });

      logger.warn('All client destination data deleted', {
        clientId,
        deletedCount: result.deletedCount,
        reason
      });

      return true;
    } catch (error) {
      logger.error('Failed to delete client data', error as Error, { clientId });
      return false;
    }
  }

  /**
   * Perform compliance check
   */
  private async performComplianceCheck(): Promise<void> {
    try {
      logger.info('Starting compliance check');

      // TODO: Implement comprehensive compliance checks
      // - Check for expired consents
      // - Identify data that should be deleted
      // - Generate compliance alerts

      logger.info('Compliance check completed');
    } catch (error) {
      logger.error('Compliance check failed', error as Error);
    }
  }

  /**
   * Clean up expired data
   */
  private async cleanupExpiredData(): Promise<void> {
    try {
      const { Destination } = await import('../../models/Destination');

      // Delete destinations that have been revoked for more than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const result = await Destination.deleteMany({
        'consent.granted': false,
        'consent.revokedAt': { $lt: thirtyDaysAgo }
      });

      if (result.deletedCount > 0) {
        logger.info('Expired destination data cleaned up', {
          deletedCount: result.deletedCount
        });
      }
    } catch (error) {
      logger.error('Failed to cleanup expired data', error as Error);
    }
  }

  /**
   * Schedule data deletion
   */
  private scheduleDataDeletion(destinationId: string, daysFromNow: number): void {
    // TODO: Implement scheduled deletion system
    logger.debug('Data deletion scheduled', { destinationId, daysFromNow });
  }

  /**
   * Validate identifier format
   */
  private validateIdentifier(type: 'group' | 'contact', identifier: string): void {
    if (type === 'contact') {
      // Validate phone number format
      if (!/^\+?[1-9]\d{1,14}$/.test(identifier.replace(/\s/g, ''))) {
        throw new Error('Invalid phone number format');
      }
    } else if (type === 'group') {
      // Validate group ID format
      if (!/^[0-9]+-[0-9]+@g\.us$/.test(identifier)) {
        throw new Error('Invalid group ID format');
      }
    }
  }

  /**
   * Mask identifier for logging
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
   * Map database model to DestinationData
   */
  private mapToDestinationData(destination: any): DestinationData {
    return {
      id: destination._id.toString(),
      clientId: destination.clientId.toString(),
      type: destination.type,
      identifier: destination.identifier,
      name: destination.name,
      consent: destination.consent,
      isActive: destination.isActive,
      metadata: destination.metadata,
      lastMessageSent: destination.lastMessageSent,
      messageCount: destination.messageCount || 0,
      createdAt: destination.createdAt,
      updatedAt: destination.updatedAt
    };
  }
}

export default DestinationManager;