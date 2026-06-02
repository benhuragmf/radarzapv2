/**
 * Template Service Module
 * 
 * Provides template management functionality including:
 * - Template creation, validation, and rendering
 * - Variable substitution and validation
 * - Default template management
 * - Template statistics and analytics
 * - REST API endpoints for template operations
 */

export { TemplateEngine } from './TemplateEngine';
export { TemplateController } from './TemplateController';
export { default as templateRoutes } from './templateRoutes';

// Re-export template model for convenience
export { Template, ITemplate } from '@/models/Template';

// Type exports
export type {
  TemplateVariable,
  TemplateRenderOptions,
  TemplateValidationResult
} from './TemplateEngine';