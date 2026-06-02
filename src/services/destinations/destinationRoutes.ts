import { Router } from 'express';
import { DestinationController } from './DestinationController';
import { DestinationHealthService } from './DestinationHealthService';
import { ComplianceService } from './ComplianceService';
import { DestinationSyncService } from './DestinationSyncService';
import { createServiceLogger } from '../../utils/logger';

const logger = createServiceLogger('DestinationRoutes');
const router = Router();

// Get service instances
const healthService = DestinationHealthService.getInstance();
const complianceService = ComplianceService.getInstance();
const syncService = DestinationSyncService.getInstance();

/**
 * Destination Routes
 * 
 * Base path: /api/v1/destinations
 */

// Client-specific destination routes
router.get('/client/:clientId', DestinationController.getDestinations);
router.post('/client/:clientId', DestinationController.addDestination);
router.post('/client/:clientId/bulk-import', DestinationController.bulkImport);

// Individual destination management
router.delete('/client/:clientId/:identifier', DestinationController.removeDestination);
router.put('/client/:clientId/:identifier/consent', DestinationController.updateConsent);
router.get('/client/:clientId/:identifier/validate', DestinationController.validateDestination);
router.post('/client/:clientId/:identifier/message-sent', DestinationController.recordMessageSent);

// Compliance and data management
router.get('/client/:clientId/compliance-report', DestinationController.getComplianceReport);
router.get('/client/:clientId/export', DestinationController.exportData);
router.delete('/client/:clientId/all-data', DestinationController.deleteAllData);

// Health Service Routes
router.get('/health/status', async (req, res) => {
  try {
    const status = healthService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Failed to get health status', error);
    res.status(500).json({ error: 'Failed to get health status' });
  }
});

router.get('/health/stats', async (req, res) => {
  try {
    const stats = healthService.getHealthStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get health stats', error);
    res.status(500).json({ error: 'Failed to get health stats' });
  }
});

router.post('/health/force-check', async (req, res) => {
  try {
    await healthService.forceHealthCheck();
    res.json({ success: true, message: 'Health check initiated' });
  } catch (error) {
    logger.error('Failed to force health check', error);
    res.status(500).json({ error: 'Failed to initiate health check' });
  }
});

router.post('/health/force-cleanup', async (req, res) => {
  try {
    await healthService.forceCleanup();
    res.json({ success: true, message: 'Cleanup initiated' });
  } catch (error) {
    logger.error('Failed to force cleanup', error);
    res.status(500).json({ error: 'Failed to initiate cleanup' });
  }
});

// Compliance Service Routes
router.get('/compliance/alerts', async (req, res) => {
  try {
    const { clientId, resolved = 'false' } = req.query;
    const status = complianceService.getStatus();
    
    // Filter alerts if clientId is provided
    let alerts = status.alerts || [];
    if (clientId) {
      alerts = alerts.filter((alert: any) => alert.clientId === clientId);
    }
    
    // Filter by resolved status
    if (resolved !== 'all') {
      const isResolved = resolved === 'true';
      alerts = alerts.filter((alert: any) => alert.resolved === isResolved);
    }
    
    res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('Failed to get compliance alerts', error);
    res.status(500).json({ error: 'Failed to get compliance alerts' });
  }
});

router.post('/compliance/alerts/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { resolution } = req.body;
    
    if (!resolution) {
      res.status(400).json({ error: 'Resolution message is required' });
      return;
    }
    
    const success = await complianceService.resolveAlert(alertId, resolution);
    
    if (!success) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    
    res.json({ success: true, message: 'Alert resolved successfully' });
  } catch (error) {
    logger.error('Failed to resolve alert', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

router.get('/compliance/client/:clientId/report', async (req, res) => {
  try {
    const { clientId } = req.params;
    const report = await complianceService.getComplianceReport(clientId);
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Failed to get compliance report', error);
    res.status(500).json({ error: 'Failed to get compliance report' });
  }
});

router.get('/compliance/client/:clientId/export', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { format = 'json' } = req.query;
    
    const filename = await complianceService.exportComplianceData(
      clientId, 
      format as 'json' | 'csv'
    );
    
    res.json({ 
      success: true, 
      data: { filename, format },
      message: 'Compliance data export completed'
    });
  } catch (error) {
    logger.error('Failed to export compliance data', error);
    res.status(500).json({ error: 'Failed to export compliance data' });
  }
});

router.post('/compliance/client/:clientId/opt-out/:identifier', async (req, res) => {
  try {
    const { clientId, identifier } = req.params;
    const { reason = 'user_request' } = req.body;
    
    const success = await complianceService.processOptOut(
      clientId,
      identifier,
      reason,
      req.ip || 'unknown',
      req.get('User-Agent')
    );
    
    if (!success) {
      res.status(404).json({ error: 'Destination not found' });
      return;
    }
    
    res.json({ 
      success: true, 
      message: 'Opt-out processed successfully with compliance logging' 
    });
  } catch (error) {
    logger.error('Failed to process opt-out', error);
    res.status(500).json({ error: 'Failed to process opt-out' });
  }
});

// Sync Service Routes
router.get('/sync/status', async (req, res) => {
  try {
    const status = syncService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Failed to get sync status', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

router.get('/sync/stats', async (req, res) => {
  try {
    const stats = syncService.getSyncStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get sync stats', error);
    res.status(500).json({ error: 'Failed to get sync stats' });
  }
});

router.post('/sync/client/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const results = await syncService.syncClient(clientId);
    
    res.json({ 
      success: true, 
      data: results,
      message: `Sync completed for ${results.length} destinations`
    });
  } catch (error) {
    logger.error('Failed to sync client', error);
    res.status(500).json({ error: 'Failed to sync client destinations' });
  }
});

router.post('/sync/force-full', async (req, res) => {
  try {
    await syncService.forceFullSync();
    res.json({ success: true, message: 'Full synchronization initiated' });
  } catch (error) {
    logger.error('Failed to force full sync', error);
    res.status(500).json({ error: 'Failed to initiate full synchronization' });
  }
});

router.post('/sync/force-validation', async (req, res) => {
  try {
    await syncService.forceFullValidation();
    res.json({ success: true, message: 'Full validation initiated' });
  } catch (error) {
    logger.error('Failed to force validation', error);
    res.status(500).json({ error: 'Failed to initiate full validation' });
  }
});

// Service Management Routes
router.get('/services/status', async (req, res) => {
  try {
    const [healthCheck, complianceCheck, syncCheck] = await Promise.all([
      healthService.healthCheck(),
      complianceService.healthCheck(),
      syncService.healthCheck()
    ]);
    
    res.json({
      success: true,
      data: {
        health: healthCheck,
        compliance: complianceCheck,
        sync: syncCheck,
        overall: healthCheck.healthy && complianceCheck.healthy && syncCheck.healthy
      }
    });
  } catch (error) {
    logger.error('Failed to get services status', error);
    res.status(500).json({ error: 'Failed to get services status' });
  }
});

// Middleware for logging requests
router.use((req, res, next) => {
  logger.debug('Destination API request', {
    method: req.method,
    path: req.path,
    clientId: req.params.clientId,
    identifier: req.params.identifier ? req.params.identifier.substring(0, 8) + '***' : undefined
  });
  next();
});

export default router;