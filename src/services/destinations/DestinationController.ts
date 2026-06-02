import { Request, Response } from 'express';
import { DestinationManager } from './DestinationManager';
import { createServiceLogger } from '../../utils/logger';
import mongoose from 'mongoose';

const logger = createServiceLogger('DestinationController');
const destinationManager = DestinationManager.getInstance();

/**
 * Destination Controller
 * Handles HTTP requests for destination management with LGPD/GDPR compliance
 */
export class DestinationController {

  /**
   * Get destinations for a client
   */
  static async getDestinations(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { 
        type, 
        activeOnly = 'true', 
        withConsent = 'true',
        limit = '50',
        offset = '0'
      } = req.query;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT_ID'
        });
        return;
      }

      const options = {
        type: type as 'group' | 'contact' | undefined,
        activeOnly: activeOnly === 'true',
        withConsent: withConsent === 'true',
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      };

      const result = await destinationManager.getDestinations(clientId, options);

      res.json({
        success: true,
        data: result.destinations,
        pagination: {
          total: result.total,
          limit: options.limit,
          offset: options.offset,
          hasMore: result.total > options.offset + options.limit
        }
      });

      logger.info('Destinations retrieved', { 
        clientId, 
        count: result.destinations.length,
        total: result.total 
      });
    } catch (error) {
      logger.error('Failed to get destinations', error as Error, { clientId: req.params.clientId });
      res.status(500).json({
        error: 'Failed to retrieve destinations',
        code: 'DESTINATIONS_RETRIEVAL_ERROR'
      });
    }
  }

  /**
   * Add new destination with consent
   */
  static async addDestination(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { type, identifier, name, consentSource = 'manual' } = req.body;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT_ID'
        });
        return;
      }

      if (!type || !identifier || !name) {
        res.status(400).json({
          error: 'Type, identifier, and name are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
        return;
      }

      if (!['group', 'contact'].includes(type)) {
        res.status(400).json({
          error: 'Type must be either "group" or "contact"',
          code: 'INVALID_TYPE'
        });
        return;
      }

      const consentData = {
        source: consentSource as any,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent')
      };

      const destination = await destinationManager.addDestination(
        clientId,
        type,
        identifier,
        name,
        consentData
      );

      res.status(201).json({
        success: true,
        data: destination,
        message: 'Destination added successfully with consent'
      });

      logger.info('Destination added', { 
        clientId, 
        type, 
        destinationId: destination.id 
      });
    } catch (error) {
      logger.error('Failed to add destination', error as Error, { 
        clientId: req.params.clientId 
      });
      
      if ((error as Error).message.includes('already exists')) {
        res.status(409).json({
          error: 'Destination already exists',
          code: 'DESTINATION_EXISTS'
        });
      } else if ((error as Error).message.includes('Invalid')) {
        res.status(400).json({
          error: (error as Error).message,
          code: 'VALIDATION_ERROR'
        });
      } else {
        res.status(500).json({
          error: 'Failed to add destination',
          code: 'DESTINATION_ADD_ERROR'
        });
      }
    }
  }

  /**
   * Remove destination (opt-out)
   */
  static async removeDestination(req: Request, res: Response): Promise<void> {
    try {
      const { clientId, identifier } = req.params;
      const { reason = 'user_request' } = req.body;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT_ID'
        });
        return;
      }

      const success = await destinationManager.removeDestination(
        clientId,
        identifier,
        reason
      );

      if (!success) {
        res.status(404).json({
          error: 'Destination not found',
          code: 'DESTINATION_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Destination removed successfully (opt-out processed)'
      });

      logger.info('Destination removed (opt-out)', { 
        clientId, 
        identifier: identifier.substring(0, 8) + '***',
        reason 
      });
    } catch (error) {
      logger.error('Failed to remove destination', error as Error, { 
        clientId: req.params.clientId,
        identifier: req.params.identifier 
      });
      res.status(500).json({
        error: 'Failed to remove destination',
        code: 'DESTINATION_REMOVE_ERROR'
      });
    }
  }

  /**
   * Update destination consent
   */
  static async updateConsent(req: Request, res: Response): Promise<void> {
    try {
      const { clientId, identifier } = req.params;
      const { granted, source = 'manual', reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT_ID'
        });
        return;
      }

      if (typeof granted !== 'boolean') {
        res.status(400).json({
          error: 'Granted must be a boolean value',
          code: 'INVALID_GRANTED_VALUE'
        });
        return;
      }

      const consentData = {
        source: source as any,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent'),
        reason
      };

      const success = await destinationManager.updateConsent(
        clientId,
        identifier,
        granted,
        consentData
      );

      if (!success) {
        res.status(404).json({
          error: 'Destination not found',
          code: 'DESTINATION_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        message: `Consent ${granted ? 'granted' : 'revoked'} successfully`
      });

      logger.info('Destination consent updated', { 
        clientId, 
        identifier: identifier.substring(0, 8) + '***',
        granted,
        source 
      });
    } catch (error) {
      logger.error('Failed to update consent', error as Error, { 
        clientId: req.params.clientId,
        identifier: req.params.identifier 
      });
      res.status(500).json({
        error: 'Failed to update consent',
        code: 'CONSENT_UPDATE_ERROR'
      });
    }
  }

  /**
   * Validate destination for messaging
   */
  static async validateDestination(req: Request, res: Response): Promise<void> {
    try {
      const { clientId, identifier } = req.params;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT_ID'
        });
        return;
      }

      const validation = await destinationManager.validateDestination(clientId, identifier);

      res.json({
        success: true,
        data: validation
      });

      logger.debug('Destination validated', { 
        clientId, 
        identifier: identifier.substring(0, 8) + '***',
        valid: validation.valid,
        reason: validation.reason 
      });
    } catch (error) {
      logger.error('Failed to validate destination', error as Error, { 
        clientId: req.params.clientId,
        identifier: req.params.identifier 
      });
      res.status(500).json({
        error: 'Failed to validate destination',
        code: 'DESTINATION_VALIDATION_ERROR'
      });
    }
  }

  /**
   * Get compliance report
   */
  static async getComplianceReport(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT_ID'
        });
        return;
      }

      const report = await destinationManager.getComplianceReport(clientId);

      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString()
      });

      logger.info('Compliance report generated', { 
        clientId, 
        totalDestinations: report.totalDestinations,
        complianceRate: report.complianceRate 
      });
    } catch (error) {
      logger.error('Failed to generate compliance report', error as Error, { 
        clientId: req.params.clientId 
      });
      res.status(500).json({
        error: 'Failed to generate compliance report',
        code: 'COMPLIANCE_REPORT_ERROR'
      });
    }
  }

  /**
   * Export destination data (GDPR data portability)
   */
  static async exportData(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { format = 'json' } = req.query;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT_ID'
        });
        return;
      }

      if (!['json', 'csv'].includes(format as string)) {
        res.status(400).json({
          error: 'Format must be either "json" or "csv"',
          code: 'INVALID_FORMAT'
        });
        return;
      }

      const filename = await destinationManager.exportDestinationData(
        clientId,
        format as 'json' | 'csv'
      );

      res.json({
        success: true,
        message: 'Data export completed',
        filename,
        format
      });

      logger.info('Destination data exported', { clientId, format, filename });
    } catch (error) {
      logger.error('Failed to export destination data', error as Error, { 
        clientId: req.params.clientId 
      });
      res.status(500).json({
        error: 'Failed to export data',
        code: 'DATA_EXPORT_ERROR'
      });
    }
  }

  /**
   * Delete all client data (right to be forgotten)
   */
  static async deleteAllData(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { reason = 'gdpr_request', confirmation } = req.body;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT_ID'
        });
        return;
      }

      // Require explicit confirmation for data deletion
      if (confirmation !== 'DELETE_ALL_DATA') {
        res.status(400).json({
          error: 'Confirmation required. Set confirmation to "DELETE_ALL_DATA"',
          code: 'CONFIRMATION_REQUIRED'
        });
        return;
      }

      const success = await destinationManager.deleteAllClientData(clientId, reason);

      if (!success) {
        res.status(500).json({
          error: 'Failed to delete client data',
          code: 'DATA_DELETION_ERROR'
        });
        return;
      }

      res.json({
        success: true,
        message: 'All client destination data deleted successfully',
        reason
      });

      logger.warn('All client destination data deleted', { clientId, reason });
    } catch (error) {
      logger.error('Failed to delete all client data', error as Error, { 
        clientId: req.params.clientId 
      });
      res.status(500).json({
        error: 'Failed to delete client data',
        code: 'DATA_DELETION_ERROR'
      });
    }
  }

  /**
   * Record message sent (for tracking purposes)
   */
  static async recordMessageSent(req: Request, res: Response): Promise<void> {
    try {
      const { clientId, identifier } = req.params;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT_ID'
        });
        return;
      }

      await destinationManager.recordMessageSent(clientId, identifier);

      res.json({
        success: true,
        message: 'Message sent recorded'
      });

      logger.debug('Message sent recorded', { 
        clientId, 
        identifier: identifier.substring(0, 8) + '***' 
      });
    } catch (error) {
      logger.error('Failed to record message sent', error as Error, { 
        clientId: req.params.clientId,
        identifier: req.params.identifier 
      });
      res.status(500).json({
        error: 'Failed to record message sent',
        code: 'MESSAGE_RECORD_ERROR'
      });
    }
  }

  /**
   * Bulk import destinations with consent
   */
  static async bulkImport(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { destinations, consentSource = 'import' } = req.body;

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT_ID'
        });
        return;
      }

      if (!Array.isArray(destinations) || destinations.length === 0) {
        res.status(400).json({
          error: 'Destinations array is required and cannot be empty',
          code: 'INVALID_DESTINATIONS'
        });
        return;
      }

      const results = {
        successful: 0,
        failed: 0,
        errors: [] as Array<{ identifier: string; error: string }>
      };

      const consentData = {
        source: consentSource as any,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent')
      };

      for (const dest of destinations) {
        try {
          await destinationManager.addDestination(
            clientId,
            dest.type,
            dest.identifier,
            dest.name,
            consentData
          );
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            identifier: dest.identifier,
            error: (error as Error).message
          });
        }
      }

      res.json({
        success: true,
        data: results,
        message: `Bulk import completed: ${results.successful} successful, ${results.failed} failed`
      });

      logger.info('Bulk destination import completed', { 
        clientId, 
        total: destinations.length,
        successful: results.successful,
        failed: results.failed 
      });
    } catch (error) {
      logger.error('Failed to bulk import destinations', error as Error, { 
        clientId: req.params.clientId 
      });
      res.status(500).json({
        error: 'Failed to bulk import destinations',
        code: 'BULK_IMPORT_ERROR'
      });
    }
  }
}

export default DestinationController;