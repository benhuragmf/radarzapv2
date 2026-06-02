import { Template, ITemplate } from '@/models/Template';
import { createServiceLogger } from '@/utils/logger';
import mongoose from 'mongoose';

const logger = createServiceLogger('TemplateEngine');

export interface TemplateVariable {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'date' | 'url' | 'image';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export interface TemplateRenderOptions {
  fallbackToDefault?: boolean;
  removeUnusedVariables?: boolean;
  escapeHtml?: boolean;
  maxLength?: number;
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  variables: string[];
}

/**
 * Template Engine Service
 * Handles template creation, validation, rendering, and management
 */
export class TemplateEngine {
  private static instance: TemplateEngine;
  private defaultTemplates: Map<string, ITemplate> = new Map();

  private constructor() {
    // Templates are initialized lazily on first use via ensureDefaultTemplates()
    // to avoid race conditions with MongoDB connection at startup
  }

  static getInstance(): TemplateEngine {
    if (!TemplateEngine.instance) {
      TemplateEngine.instance = new TemplateEngine();
    }
    return TemplateEngine.instance;
  }

  /**
   * Ensure default templates are loaded — called lazily before any render.
   * Retries once if the first attempt fails (e.g. MongoDB not ready yet).
   */
  private async ensureDefaultTemplates(): Promise<void> {
    if (this.defaultTemplates.size > 0) return;
    await this.initializeDefaultTemplates();
    // If still empty after init (DB error), try once more
    if (this.defaultTemplates.size === 0) {
      await this.initializeDefaultTemplates();
    }
  }

  /**
   * Initialize default templates
   */
  private async initializeDefaultTemplates(): Promise<void> {
    try {
      const defaultTemplates = [
        {
          name: 'game-promotion-basic',
          content: '🎮 **{title}**\n\n💰 Preço: {price}\n🏪 Loja: {store}\n🔗 Link: {purchaseLink}',
          description: 'Template básico para promoções de jogos'
        },
        {
          name: 'game-promotion-discount',
          content: '🎮 **{title}**\n\n💰 ~~{originalPrice}~~ **{price}** ({discount}% OFF)\n🏪 {store}\n⏰ Oferta por tempo limitado!\n\n🔗 {purchaseLink}',
          description: 'Template para jogos com desconto'
        },
        {
          name: 'game-free',
          content: '🆓 **JOGO GRÁTIS!**\n\n🎮 {title}\n🏪 {store}\n⏰ Disponível até: {endDate}\n\n🔗 Pegue agora: {purchaseLink}',
          description: 'Template para jogos gratuitos'
        },
        {
          name: 'game-dlc',
          content: '🎮 **{title}** - {dlcName}\n\n💰 Preço: {price}\n🏪 {store}\n📦 DLC/Expansão\n\n🔗 {purchaseLink}',
          description: 'Template para DLCs e expansões'
        },
        {
          name: 'custom-message',
          content: '{message}',
          description: 'Template simples para mensagens personalizadas'
        },
        // ── Templates RadarZap ──────────────────────────────────────────────
        {
          name: 'radarzap-padrao',
          content: '📢 *{canal}* — {servidor}\n\n{mensagem}\n\n🔗 {link}\n\n_Enviado em {data} às {hora}_',
          description: 'Template padrão do RadarZap com canal, servidor e link'
        },
        {
          name: 'radarzap-com-embed',
          content: '📢 *{embed_titulo}*\n\n{embed_desc}\n\n🔗 {link}\n\n_Via {canal} • {data}_',
          description: 'Template RadarZap para mensagens com embed'
        },
        {
          name: 'radarzap-simples',
          content: '{mensagem}',
          description: 'Template RadarZap minimalista — só o texto da mensagem'
        },
        {
          name: 'radarzap-alerta',
          content: '🚨 *ALERTA — {canal}*\n\n{mensagem}\n\n_Por {autor} em {data} às {hora}_',
          description: 'Template RadarZap para alertas com autor e horário'
        }
      ];

      for (const template of defaultTemplates) {
        try {
          const existing = await Template.findByName(template.name);
          if (!existing) {
            const newTemplate = await Template.createTemplate(
              template.name,
              template.content,
              undefined, // No clientId for global templates
              true // isDefault
            );
            this.defaultTemplates.set(template.name, newTemplate);
            logger.info('Default template created', { name: template.name });
          } else {
            this.defaultTemplates.set(template.name, existing);
          }
        } catch (error) {
          logger.error('Failed to create default template', error as Error, { name: template.name });
        }
      }

      logger.info('Default templates initialized', { count: this.defaultTemplates.size });
    } catch (error) {
      logger.error('Failed to initialize default templates', error as Error);
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(
    name: string,
    content: string,
    clientId?: mongoose.Types.ObjectId,
    isDefault: boolean = false
  ): Promise<ITemplate> {
    try {
      // Validate template content
      const validation = this.validateTemplate(content);
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }

      const template = await Template.createTemplate(name, content, clientId, isDefault);
      
      logger.info('Template created successfully', {
        templateId: template._id,
        name,
        clientId,
        variables: template.variables.length
      });

      return template;
    } catch (error) {
      logger.error('Failed to create template', error as Error, { name, clientId });
      throw error;
    }
  }

  /**
   * Get template by name
   */
  async getTemplate(name: string, clientId?: mongoose.Types.ObjectId): Promise<ITemplate | null> {
    try {
      return await Template.findByName(name, clientId);
    } catch (error) {
      logger.error('Failed to get template', error as Error, { name, clientId });
      return null;
    }
  }

  /**
   * Get templates for a client
   */
  async getClientTemplates(clientId: mongoose.Types.ObjectId, includeDefaults: boolean = true): Promise<ITemplate[]> {
    try {
      return await Template.findByClientId(clientId, includeDefaults);
    } catch (error) {
      logger.error('Failed to get client templates', error as Error, { clientId });
      return [];
    }
  }

  /**
   * Render template with variables
   */
  async renderTemplate(
    templateName: string,
    variables: Record<string, any>,
    clientId?: mongoose.Types.ObjectId,
    options: TemplateRenderOptions = {}
  ): Promise<string> {
    try {
      // Ensure defaults are loaded (lazy init after MongoDB is ready)
      await this.ensureDefaultTemplates();

      // Get template
      let template = await this.getTemplate(templateName, clientId);
      
      // Fallback to default template if not found
      if (!template && options.fallbackToDefault) {
        template = this.defaultTemplates.get('radarzap-padrao') ||
                   this.defaultTemplates.get('game-promotion-basic') ||
                   null;
        if (template) {
          logger.warn('Using fallback template', { requestedTemplate: templateName, fallbackTemplate: template.name });
        }
      }

      if (!template) {
        // Last resort: inline fallback so the pipeline never silently drops a message
        logger.warn(`Template "${templateName}" not found — using inline fallback`);
        const vars = variables as Record<string, string>;
        const text = [
          vars.mensagem || vars.message || '',
          vars.link ? `🔗 ${vars.link}` : '',
          vars.canal ? `_Via ${vars.canal}_` : '',
        ].filter(Boolean).join('\n\n');
        return text || JSON.stringify(variables);
      }

      // Validate variables
      const validation = template.validateVariables(variables);
      if (!validation.valid && validation.missing.length > 0) {
        logger.warn('Missing template variables', {
          templateName,
          missing: validation.missing,
          provided: Object.keys(variables)
        });
      }

      // Render template
      let rendered = template.render(variables);

      // Apply options
      if (options.removeUnusedVariables) {
        rendered = rendered.replace(/\{[^}]+\}/g, '');
      }

      if (options.escapeHtml) {
        rendered = this.escapeHtml(rendered);
      }

      if (options.maxLength && rendered.length > options.maxLength) {
        rendered = rendered.substring(0, options.maxLength - 3) + '...';
        logger.warn('Template output truncated', {
          templateName,
          originalLength: rendered.length + 3,
          maxLength: options.maxLength
        });
      }

      // Increment usage
      await template.incrementUsage();

      logger.debug('Template rendered successfully', {
        templateName,
        outputLength: rendered.length,
        variablesUsed: Object.keys(variables).length
      });

      return rendered;
    } catch (error) {
      logger.error('Failed to render template', error as Error, { templateName, clientId });
      throw error;
    }
  }

  /**
   * Validate template content
   */
  validateTemplate(content: string): TemplateValidationResult {
    const result: TemplateValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      variables: []
    };

    try {
      // Check for basic content
      if (!content || content.trim().length === 0) {
        result.errors.push('Template content cannot be empty');
        result.valid = false;
        return result;
      }

      // Check length
      if (content.length > 4096) {
        result.errors.push('Template content cannot exceed 4096 characters');
        result.valid = false;
      }

      // Extract and validate variables
      const variableMatches = content.match(/\{([^}]+)\}/g) || [];
      const variables = [...new Set(variableMatches.map(match => match.slice(1, -1)))];
      
      result.variables = variables;

      // Validate variable names
      for (const variable of variables) {
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(variable)) {
          result.errors.push(`Invalid variable name: ${variable}. Variables must start with a letter and contain only letters, numbers, and underscores.`);
          result.valid = false;
        }
      }

      // Check for unclosed braces
      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        result.errors.push('Mismatched braces in template');
        result.valid = false;
      }

      // Check for nested braces
      if (/\{\{|\}\}/.test(content)) {
        result.warnings.push('Nested braces detected, may cause rendering issues');
      }

      // Check for common issues
      if (variables.length === 0) {
        result.warnings.push('Template contains no variables');
      }

      if (variables.length > 20) {
        result.warnings.push('Template contains many variables, consider simplifying');
      }

    } catch (error) {
      result.errors.push(`Template validation error: ${(error as Error).message}`);
      result.valid = false;
    }

    return result;
  }

  /**
   * Search templates
   */
  async searchTemplates(query: string, clientId?: mongoose.Types.ObjectId): Promise<ITemplate[]> {
    try {
      return await Template.searchTemplates(query, clientId);
    } catch (error) {
      logger.error('Failed to search templates', error as Error, { query, clientId });
      return [];
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string, clientId?: mongoose.Types.ObjectId): Promise<boolean> {
    try {
      const template = await Template.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }

      // Check ownership
      if (clientId && template.clientId && !template.clientId.equals(clientId)) {
        throw new Error('Not authorized to delete this template');
      }

      // Prevent deletion of default templates
      if (template.isDefault && !template.clientId) {
        throw new Error('Cannot delete global default templates');
      }

      await Template.findByIdAndDelete(templateId);
      
      logger.info('Template deleted', { templateId, name: template.name, clientId });
      return true;
    } catch (error) {
      logger.error('Failed to delete template', error as Error, { templateId, clientId });
      return false;
    }
  }

  /**
   * Clone template
   */
  async cloneTemplate(
    templateId: string,
    newName: string,
    clientId: mongoose.Types.ObjectId
  ): Promise<ITemplate> {
    try {
      const template = await Template.findById(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }

      const clonedTemplate = await template.clone(newName, clientId);
      
      logger.info('Template cloned', {
        originalId: templateId,
        clonedId: clonedTemplate._id,
        newName,
        clientId
      });

      return clonedTemplate;
    } catch (error) {
      logger.error('Failed to clone template', error as Error, { templateId, newName, clientId });
      throw error;
    }
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(): Promise<any> {
    try {
      return await Template.getTemplateStats();
    } catch (error) {
      logger.error('Failed to get template stats', error as Error);
      return null;
    }
  }

  /**
   * Clean up unused templates
   */
  async cleanupUnusedTemplates(daysUnused: number = 30): Promise<number> {
    try {
      const unusedTemplates = await Template.findUnusedTemplates(daysUnused);
      let deletedCount = 0;

      for (const template of unusedTemplates) {
        try {
          await Template.findByIdAndDelete(template._id);
          deletedCount++;
        } catch (error) {
          logger.error('Failed to delete unused template', error as Error, { templateId: template._id });
        }
      }

      logger.info('Unused templates cleaned up', { deletedCount, daysUnused });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup unused templates', error as Error);
      return 0;
    }
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    
    return text.replace(/[&<>"']/g, (match) => htmlEscapes[match]);
  }

  /**
   * Get default template names
   */
  getDefaultTemplateNames(): string[] {
    return Array.from(this.defaultTemplates.keys());
  }

  /**
   * Refresh default templates from database
   */
  async refreshDefaultTemplates(): Promise<void> {
    try {
      const defaultTemplates = await Template.getDefaultTemplates();
      this.defaultTemplates.clear();
      
      for (const template of defaultTemplates) {
        this.defaultTemplates.set(template.name, template);
      }
      
      logger.info('Default templates refreshed', { count: this.defaultTemplates.size });
    } catch (error) {
      logger.error('Failed to refresh default templates', error as Error);
    }
  }
}

export default TemplateEngine;