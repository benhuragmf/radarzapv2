import { Router } from 'express';
import { TemplateController } from './TemplateController';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('TemplateRoutes');
const router = Router();

/**
 * Template Routes
 * 
 * Base path: /api/v1/templates
 */

// Get default templates (no client ID required)
router.get('/defaults', TemplateController.getDefaultTemplates);

// Get template statistics (admin only)
router.get('/stats', TemplateController.getTemplateStats);

// Validate template content
router.post('/validate', TemplateController.validateTemplate);

// Client-specific routes (require clientId parameter)
router.get('/client/:clientId', TemplateController.getTemplates);
router.get('/client/:clientId/search', TemplateController.searchTemplates);
router.post('/client/:clientId', TemplateController.createTemplate);

// Template-specific routes
router.get('/client/:clientId/template/:name', TemplateController.getTemplate);
router.post('/client/:clientId/template/:name/render', TemplateController.renderTemplate);

// Template management by ID
router.put('/client/:clientId/:templateId', TemplateController.updateTemplate);
router.delete('/client/:clientId/:templateId', TemplateController.deleteTemplate);
router.post('/client/:clientId/:templateId/clone', TemplateController.cloneTemplate);

// Global template routes (no client ID - for accessing by name only)
router.get('/:name', TemplateController.getTemplate);
router.post('/:name/render', TemplateController.renderTemplate);

// Middleware for logging requests
router.use((req, res, next) => {
  logger.info('Template API request', {
    method: req.method,
    path: req.path,
    clientId: req.params.clientId,
    templateName: req.params.name,
    templateId: req.params.templateId
  });
  next();
});

export default router;