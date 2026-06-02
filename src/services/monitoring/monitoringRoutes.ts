import { Router } from 'express';
import { MonitoringController } from './MonitoringController';
import { createServiceLogger } from '../../utils/logger';

const logger = createServiceLogger('MonitoringRoutes');
const router = Router();

/**
 * Monitoring Routes
 * 
 * Base path: /api/v1/monitoring
 */

// System metrics endpoints
router.get('/metrics', MonitoringController.getMetrics);
router.get('/metrics/history', MonitoringController.getMetricsHistory);
router.get('/health', MonitoringController.getHealth);
router.get('/system', MonitoringController.getSystemInfo);

// Alert management endpoints
router.get('/alerts/rules', MonitoringController.getAlertRules);
router.put('/alerts/rules/:ruleId', MonitoringController.updateAlertRule);

// Logging endpoints
router.get('/logs', MonitoringController.queryLogs);
router.get('/logs/stats', MonitoringController.getLogStats);
router.get('/logs/errors', MonitoringController.getRecentErrors);
router.get('/logs/trace/:traceId', MonitoringController.getLogsByTrace);
router.post('/logs/export', MonitoringController.exportLogs);
router.get('/logs/files', MonitoringController.getLogFiles);

// Middleware for logging requests
router.use((req, res, next) => {
  logger.debug('Monitoring API request', {
    method: req.method,
    path: req.path,
    query: req.query
  });
  next();
});

export default router;