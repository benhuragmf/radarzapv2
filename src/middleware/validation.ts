import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('ValidationMiddleware');

/**
 * Validation schemas for common data types
 */
export const schemas = {
  // MongoDB ObjectId validation
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid ObjectId format'),
  
  // Discord ID validation (snowflake)
  discordId: Joi.string().pattern(/^\d{17,19}$/).message('Invalid Discord ID format'),
  
  // Template validation
  template: {
    name: Joi.string().min(1).max(100).pattern(/^[a-zA-Z0-9\s\-_]+$/).required(),
    content: Joi.string().min(1).max(4096).required(),
    variables: Joi.array().items(Joi.string().pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)).default([]),
    isDefault: Joi.boolean().default(false)
  },
  
  // User validation
  user: {
    discordUserId: Joi.string().pattern(/^\d{17,19}$/).required(),
    email: Joi.string().email().optional(),
    plan: Joi.string().valid('free', 'premium', 'enterprise').default('free')
  },
  
  // Message validation
  message: {
    content: Joi.string().min(1).max(4096).required(),
    templateName: Joi.string().min(1).max(100).optional(),
    variables: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
    destinations: Joi.array().items(Joi.string()).min(1).required()
  },
  
  // Destination validation
  destination: {
    type: Joi.string().valid('group', 'contact').required(),
    identifier: Joi.string().min(1).max(100).required(),
    name: Joi.string().min(1).max(100).required()
  },
  
  // Pagination validation
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().default('createdAt')
  },
  
  // Search validation
  search: {
    q: Joi.string().min(1).max(100).required(),
    filters: Joi.object().optional()
  }
};

/**
 * Create validation middleware for request body
 */
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.warn('Request body validation failed', {
          path: req.path,
          method: req.method,
          errors: validationErrors
        });

        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors
        });
        return;
      }

      // Replace request body with validated and sanitized data
      req.body = value;
      next();
    } catch (err) {
      logger.error('Validation middleware error', err as Error);
      res.status(500).json({
        error: 'Validation error',
        code: 'VALIDATION_MIDDLEWARE_ERROR'
      });
    }
  };
};

/**
 * Create validation middleware for query parameters
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.warn('Query parameters validation failed', {
          path: req.path,
          method: req.method,
          errors: validationErrors
        });

        res.status(400).json({
          error: 'Query validation failed',
          code: 'QUERY_VALIDATION_ERROR',
          details: validationErrors
        });
        return;
      }

      // Replace query with validated and sanitized data
      req.query = value;
      next();
    } catch (err) {
      logger.error('Query validation middleware error', err as Error);
      res.status(500).json({
        error: 'Query validation error',
        code: 'QUERY_VALIDATION_MIDDLEWARE_ERROR'
      });
    }
  };
};

/**
 * Create validation middleware for URL parameters
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { error, value } = schema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.warn('URL parameters validation failed', {
          path: req.path,
          method: req.method,
          errors: validationErrors
        });

        res.status(400).json({
          error: 'Parameter validation failed',
          code: 'PARAMS_VALIDATION_ERROR',
          details: validationErrors
        });
        return;
      }

      // Replace params with validated data
      req.params = value;
      next();
    } catch (err) {
      logger.error('Params validation middleware error', err as Error);
      res.status(500).json({
        error: 'Parameter validation error',
        code: 'PARAMS_VALIDATION_MIDDLEWARE_ERROR'
      });
    }
  };
};

/**
 * Sanitize input to prevent XSS and injection attacks
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Recursively sanitize object
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return obj
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/on\w+\s*=/gi, '') // Remove event handlers
          .trim();
      }
      
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      
      return obj;
    };

    // Sanitize request body, query, and params
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (err) {
    logger.error('Input sanitization error', err as Error);
    res.status(500).json({
      error: 'Input sanitization error',
      code: 'SANITIZATION_ERROR'
    });
  }
};

/**
 * Common validation schemas
 */
export const commonValidations = {
  // Template operations
  createTemplate: validateBody(Joi.object({
    name: schemas.template.name,
    content: schemas.template.content,
    isDefault: schemas.template.isDefault
  })),
  
  updateTemplate: validateBody(Joi.object({
    name: schemas.template.name.optional(),
    content: schemas.template.content.optional()
  }).min(1)),
  
  renderTemplate: validateBody(Joi.object({
    variables: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
    options: Joi.object({
      fallbackToDefault: Joi.boolean().default(true),
      removeUnusedVariables: Joi.boolean().default(true),
      escapeHtml: Joi.boolean().default(false),
      maxLength: Joi.number().integer().min(1).max(4096).optional()
    }).default({})
  })),
  
  // Message operations
  sendMessage: validateBody(Joi.object({
    content: schemas.message.content.optional(),
    templateName: schemas.message.templateName,
    variables: schemas.message.variables,
    destinations: schemas.message.destinations
  })),
  
  // Destination operations
  createDestination: validateBody(Joi.object({
    type: schemas.destination.type,
    identifier: schemas.destination.identifier,
    name: schemas.destination.name
  })),
  
  // Common parameters
  clientIdParam: validateParams(Joi.object({
    clientId: schemas.objectId.required()
  })),
  
  templateIdParam: validateParams(Joi.object({
    templateId: schemas.objectId.required()
  })),
  
  // Pagination and search
  paginationQuery: validateQuery(Joi.object({
    page: schemas.pagination.page,
    limit: schemas.pagination.limit,
    sort: schemas.pagination.sort,
    sortBy: schemas.pagination.sortBy
  })),
  
  searchQuery: validateQuery(Joi.object({
    q: schemas.search.q,
    filters: schemas.search.filters
  }))
};

/**
 * File upload validation
 */
export const validateFileUpload = (
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif'],
  maxSize: number = 5 * 1024 * 1024 // 5MB
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const multerReq = req as any;
      if (!multerReq.file && !multerReq.files) {
        next();
        return;
      }

      const files = multerReq.files ? (Array.isArray(multerReq.files) ? multerReq.files : [multerReq.files]) : [multerReq.file];
      
      for (const file of files) {
        if (!file) continue;
        
        // Check file type
        if (!allowedTypes.includes(file.mimetype)) {
          res.status(400).json({
            error: 'Invalid file type',
            code: 'INVALID_FILE_TYPE',
            allowedTypes,
            receivedType: file.mimetype
          });
          return;
        }
        
        // Check file size
        if (file.size > maxSize) {
          res.status(400).json({
            error: 'File too large',
            code: 'FILE_TOO_LARGE',
            maxSize,
            receivedSize: file.size
          });
          return;
        }
      }

      logger.debug('File upload validation passed', {
        fileCount: files.length,
        totalSize: files.reduce((sum, file) => sum + (file?.size || 0), 0)
      });

      next();
    } catch (err) {
      logger.error('File upload validation error', err as Error);
      res.status(500).json({
        error: 'File validation error',
        code: 'FILE_VALIDATION_ERROR'
      });
    }
  };
};

export default {
  schemas,
  validateBody,
  validateQuery,
  validateParams,
  sanitizeInput,
  commonValidations,
  validateFileUpload
};