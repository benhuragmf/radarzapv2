import { Request, Response } from 'express';
import { TemplateEngine } from './TemplateEngine';
import { createServiceLogger } from '@/utils/logger';
import mongoose from 'mongoose';

const logger = createServiceLogger('TemplateController');
const templateEngine = TemplateEngine.getInstance();

/**
 * Template Controller
 * Handles HTTP requests for template management
 */
export class TemplateController {
  
  /**
   * Get all templates for a client
   */
  static async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.params;
      const { includeDefaults = 'true' } = req.query;
      
      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT_ID'
        });
        return;
      }

      const templates = await templateEngine.getClientTemplates(
        new mongoose.Types.ObjectId(clientId),
        includeDefaults === 'true'
      );

      res.json({
        success: true,
        data: templates,
        count: templates.length
      });

      logger.info('Templates retrieved', { clientId, count: templates.length });
    } catch (error) {
      logger.error('Failed to get templates', error as Error, { clientId: req.params.clientId });
      res.status(500).json({
        error: 'Failed to retrieve templates',
        code: 'TEMPLATE_RETRIEVAL_ERROR'
      });
    }
  }

  /**
   * Get a specific template
   */
  static async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { name, clientId } = req.params;
      
      let clientObjectId: mongoose.Types.ObjectId | undefined;
      if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
        clientObjectId = new mongoose.Types.ObjectId(clientId);
      }

      const template = await templateEngine.getTemplate(name, clientObjectId);

      if (!template) {
        res.status(404).json({
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        data: template
      });

      logger.info('Template retrieved', { name, clientId });
    } catch (error) {
      logger.error('Failed to get template', error as Error, { name: req.params.name, clientId: req.params.clientId });
      res.status(500).json({
        error: 'Failed to retrieve template',
        code: 'TEMPLATE_RETRIEVAL_ERROR'
      });
    }
  }

  /**
   * Create a new template
   */
  static async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { name, content, isDefault = false } = req.body;
      const { clientId } = req.params;

      // Validation
      if (!name || !content) {
        res.status(400).json({
          error: 'Name and content are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT_ID'
        });
        return;
      }

      // Validate template content
      const validation = templateEngine.validateTemplate(content);
      if (!validation.valid) {
        res.status(400).json({
          error: 'Template validation failed',
          code: 'TEMPLATE_VALIDATION_ERROR',
          details: {
            errors: validation.errors,
            warnings: validation.warnings
          }
        });
        return;
      }

      const template = await templateEngine.createTemplate(
        name,
        content,
        new mongoose.Types.ObjectId(clientId),
        isDefault
      );

      res.status(201).json({
        success: true,
        data: template,
        message: 'Template created successfully'
      });

      logger.info('Template created', { templateId: template._id, name, clientId });
    } catch (error) {
      logger.error('Failed to create template', error as Error, { name: req.body.name, clientId: req.params.clientId });
      
      if ((error as Error).message.includes('already exists')) {
        res.status(409).json({
          error: 'Template with this name already exists',
          code: 'TEMPLATE_NAME_CONFLICT'
        });
      } else {
        res.status(500).json({
          error: 'Failed to create template',
          code: 'TEMPLATE_CREATION_ERROR'
        });
      }
    }
  }

  /**
   * Update a template
   */
  static async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const { name, content } = req.body;
      const { clientId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        res.status(400).json({
          error: 'Invalid template ID',
          code: 'INVALID_TEMPLATE_ID'
        });
        return;
      }

      // Validate template content if provided
      if (content) {
        const validation = templateEngine.validateTemplate(content);
        if (!validation.valid) {
          res.status(400).json({
            error: 'Template validation failed',
            code: 'TEMPLATE_VALIDATION_ERROR',
            details: {
              errors: validation.errors,
              warnings: validation.warnings
            }
          });
          return;
        }
      }

      // Get and update template
      const { Template } = await import('@/models/Template');
      const template = await Template.findById(templateId);

      if (!template) {
        res.status(404).json({
          error: 'Template not found',
          code: 'TEMPLATE_NOT_FOUND'
        });
        return;
      }

      // Check ownership
      if (clientId && template.clientId && !template.clientId.equals(new mongoose.Types.ObjectId(clientId))) {
        res.status(403).json({
          error: 'Not authorized to update this template',
          code: 'TEMPLATE_ACCESS_DENIED'
        });
        return;
      }

      // Update fields
      if (name) template.name = name;
      if (content) template.content = content;

      await template.save();

      res.json({
        success: true,
        data: template,
        message: 'Template updated successfully'
      });

      logger.info('Template updated', { templateId, name: template.name, clientId });
    } catch (error) {
      logger.error('Failed to update template', error as Error, { templateId: req.params.templateId, clientId: req.params.clientId });
      res.status(500).json({
        error: 'Failed to update template',
        code: 'TEMPLATE_UPDATE_ERROR'
      });
    }
  }

  /**
   * Delete a template
   */
  static async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const { clientId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(templateId)) {
        res.status(400).json({
          error: 'Invalid template ID',
          code: 'INVALID_TEMPLATE_ID'
        });
        return;
      }

      let clientObjectId: mongoose.Types.ObjectId | undefined;
      if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
        clientObjectId = new mongoose.Types.ObjectId(clientId);
      }

      const success = await templateEngine.deleteTemplate(templateId, clientObjectId);

      if (!success) {
        res.status(404).json({
          error: 'Template not found or cannot be deleted',
          code: 'TEMPLATE_DELETE_ERROR'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Template deleted successfully'
      });

      logger.info('Template deleted', { templateId, clientId });
    } catch (error) {
      logger.error('Failed to delete template', error as Error, { templateId: req.params.templateId, clientId: req.params.clientId });
      res.status(500).json({
        error: 'Failed to delete template',
        code: 'TEMPLATE_DELETE_ERROR'
      });
    }
  }

  /**
   * Render a template with variables
   */
  static async renderTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;
      const { variables = {}, options = {} } = req.body;
      const { clientId } = req.params;

      let clientObjectId: mongoose.Types.ObjectId | undefined;
      if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
        clientObjectId = new mongoose.Types.ObjectId(clientId);
      }

      const rendered = await templateEngine.renderTemplate(
        name,
        variables,
        clientObjectId,
        {
          fallbackToDefault: true,
          removeUnusedVariables: true,
          ...options
        }
      );

      res.json({
        success: true,
        data: {
          rendered,
          length: rendered.length
        }
      });

      logger.info('Template rendered', { name, clientId, outputLength: rendered.length });
    } catch (error) {
      logger.error('Failed to render template', error as Error, { name: req.params.name, clientId: req.params.clientId });
      res.status(500).json({
        error: 'Failed to render template',
        code: 'TEMPLATE_RENDER_ERROR',
        details: (error as Error).message
      });
    }
  }

  /**
   * Validate template content
   */
  static async validateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { content } = req.body;

      if (!content) {
        res.status(400).json({
          error: 'Content is required for validation',
          code: 'MISSING_CONTENT'
        });
        return;
      }

      const validation = templateEngine.validateTemplate(content);

      res.json({
        success: true,
        data: validation
      });

      logger.info('Template validated', { valid: validation.valid, errors: validation.errors.length });
    } catch (error) {
      logger.error('Failed to validate template', error as Error);
      res.status(500).json({
        error: 'Failed to validate template',
        code: 'TEMPLATE_VALIDATION_ERROR'
      });
    }
  }

  /**
   * Search templates
   */
  static async searchTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { q: query } = req.query;
      const { clientId } = req.params;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          error: 'Search query is required',
          code: 'MISSING_SEARCH_QUERY'
        });
        return;
      }

      let clientObjectId: mongoose.Types.ObjectId | undefined;
      if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
        clientObjectId = new mongoose.Types.ObjectId(clientId);
      }

      const templates = await templateEngine.searchTemplates(query, clientObjectId);

      res.json({
        success: true,
        data: templates,
        count: templates.length,
        query
      });

      logger.info('Templates searched', { query, clientId, results: templates.length });
    } catch (error) {
      logger.error('Failed to search templates', error as Error, { query: req.query.q, clientId: req.params.clientId });
      res.status(500).json({
        error: 'Failed to search templates',
        code: 'TEMPLATE_SEARCH_ERROR'
      });
    }
  }

  /**
   * Clone a template
   */
  static async cloneTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const { newName } = req.body;
      const { clientId } = req.params;

      if (!newName) {
        res.status(400).json({
          error: 'New name is required for cloning',
          code: 'MISSING_NEW_NAME'
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(templateId) || !mongoose.Types.ObjectId.isValid(clientId)) {
        res.status(400).json({
          error: 'Invalid template ID or client ID',
          code: 'INVALID_IDS'
        });
        return;
      }

      const clonedTemplate = await templateEngine.cloneTemplate(
        templateId,
        newName,
        new mongoose.Types.ObjectId(clientId)
      );

      res.status(201).json({
        success: true,
        data: clonedTemplate,
        message: 'Template cloned successfully'
      });

      logger.info('Template cloned', { originalId: templateId, clonedId: clonedTemplate._id, newName, clientId });
    } catch (error) {
      logger.error('Failed to clone template', error as Error, { templateId: req.params.templateId, clientId: req.params.clientId });
      res.status(500).json({
        error: 'Failed to clone template',
        code: 'TEMPLATE_CLONE_ERROR',
        details: (error as Error).message
      });
    }
  }

  /**
   * Get template statistics
   */
  static async getTemplateStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await templateEngine.getTemplateStats();

      res.json({
        success: true,
        data: stats
      });

      logger.info('Template stats retrieved');
    } catch (error) {
      logger.error('Failed to get template stats', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve template statistics',
        code: 'TEMPLATE_STATS_ERROR'
      });
    }
  }

  /**
   * Get default templates
   */
  static async getDefaultTemplates(req: Request, res: Response): Promise<void> {
    try {
      const defaultTemplateNames = templateEngine.getDefaultTemplateNames();
      const { Template } = await import('@/models/Template');
      const defaultTemplates = await Template.getDefaultTemplates();

      res.json({
        success: true,
        data: defaultTemplates,
        names: defaultTemplateNames,
        count: defaultTemplates.length
      });

      logger.info('Default templates retrieved', { count: defaultTemplates.length });
    } catch (error) {
      logger.error('Failed to get default templates', error as Error);
      res.status(500).json({
        error: 'Failed to retrieve default templates',
        code: 'DEFAULT_TEMPLATES_ERROR'
      });
    }
  }
}

export default TemplateController;