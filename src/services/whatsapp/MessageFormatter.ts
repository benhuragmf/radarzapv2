import { Template } from '@/models';
import { createServiceLogger } from '@/utils/logger';

/**
 * Message formatter for WhatsApp messages using templates
 */
export class MessageFormatter {
  private serviceLogger = createServiceLogger('MessageFormatter');

  /**
   * Format message using template and extracted data
   */
  async formatMessage(
    clientId: string,
    templateName: string,
    extractedData: any,
    customVariables?: Record<string, any>
  ): Promise<string> {
    try {
      // Get template
      const template = await Template.findByName(templateName, clientId as any);
      
      if (!template) {
        // Use default template if specific template not found
        const defaultTemplate = await Template.findByName('game-promotion');
        if (!defaultTemplate) {
          return this.createFallbackMessage(extractedData);
        }
        return this.renderTemplate(defaultTemplate, extractedData, customVariables);
      }

      // Increment template usage
      await template.incrementUsage();

      return this.renderTemplate(template, extractedData, customVariables);

    } catch (error) {
      this.serviceLogger.error('Error formatting message:', error);
      return this.createFallbackMessage(extractedData);
    }
  }

  /**
   * Render template with data
   */
  private renderTemplate(
    template: any,
    extractedData: any,
    customVariables?: Record<string, any>
  ): string {
    // Prepare variables for template
    const variables = {
      // Extracted data
      title: extractedData.title || 'Game',
      price: this.formatPrice(extractedData.price),
      discount: this.formatDiscount(extractedData.discount),
      store: extractedData.store || '',
      description: extractedData.description || '',
      
      // Links
      purchaseLink: extractedData.links?.purchase || '',
      wishlistLink: extractedData.links?.wishlist || '',
      readMoreLink: extractedData.links?.readMore || '',
      
      // Image
      image: extractedData.image || '',
      
      // Tags
      tags: extractedData.tags?.join(', ') || '',
      
      // Custom variables
      ...customVariables,
      
      // System variables
      timestamp: new Date().toLocaleString('pt-BR'),
      date: new Date().toLocaleDateString('pt-BR'),
      time: new Date().toLocaleTimeString('pt-BR')
    };

    // Validate template variables
    const validation = template.validateVariables(variables);
    if (!validation.valid) {
      this.serviceLogger.warn('Template validation failed', {
        templateName: template.name,
        missingVariables: validation.missing
      });
      
      // Fill missing variables with defaults
      for (const missing of validation.missing) {
        (variables as any)[missing] = this.getDefaultValue(missing);
      }
    }

    // Render template
    let rendered = template.render(variables);

    // Post-process the rendered message
    rendered = this.postProcessMessage(rendered);

    return rendered;
  }

  /**
   * Format price for display
   */
  private formatPrice(price: number | null): string {
    if (price === null || price === undefined) {
      return '';
    }

    if (price === 0) {
      return '🆓 GRÁTIS';
    }

    // Format as Brazilian Real
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  /**
   * Format discount for display
   */
  private formatDiscount(discount: number | null): string {
    if (!discount || discount <= 0) {
      return '';
    }

    return `🔥 ${discount}% OFF`;
  }

  /**
   * Get default value for missing variables
   */
  private getDefaultValue(variableName: string): string {
    const defaults: Record<string, string> = {
      title: 'Game',
      price: '',
      discount: '',
      store: '',
      description: '',
      purchaseLink: '',
      wishlistLink: '',
      readMoreLink: '',
      image: '',
      tags: '',
      timestamp: new Date().toLocaleString('pt-BR'),
      date: new Date().toLocaleDateString('pt-BR'),
      time: new Date().toLocaleTimeString('pt-BR')
    };

    return defaults[variableName] || '';
  }

  /**
   * Post-process rendered message
   */
  private postProcessMessage(message: string): string {
    // Remove empty lines
    message = message.replace(/\n\s*\n/g, '\n');
    
    // Remove lines with only emojis and spaces if they have no content
    message = message.replace(/\n[🎮🎯🔥⭐🌟💎🎊🎉🆓💰🛒⭐📸🔗\s]*\n/g, '\n');
    
    // Trim whitespace
    message = message.trim();
    
    // Ensure message doesn't exceed WhatsApp limits (4096 characters)
    if (message.length > 4096) {
      message = message.substring(0, 4090) + '...';
    }

    return message;
  }

  /**
   * Create fallback message when template fails
   */
  private createFallbackMessage(extractedData: any): string {
    const parts = [];

    // Title
    if (extractedData.title) {
      parts.push(`🎮 ${extractedData.title}`);
    }

    // Price and discount
    const price = this.formatPrice(extractedData.price);
    const discount = this.formatDiscount(extractedData.discount);
    
    if (price || discount) {
      const priceInfo = [price, discount].filter(Boolean).join(' ');
      parts.push(`💰 ${priceInfo}`);
    }

    // Store
    if (extractedData.store) {
      parts.push(`🏪 ${extractedData.store}`);
    }

    // Links
    if (extractedData.links?.purchase) {
      parts.push(`🛒 ${extractedData.links.purchase}`);
    }

    if (extractedData.links?.wishlist) {
      parts.push(`⭐ ${extractedData.links.wishlist}`);
    }

    // Description (truncated)
    if (extractedData.description) {
      const desc = extractedData.description.length > 200 
        ? extractedData.description.substring(0, 200) + '...'
        : extractedData.description;
      parts.push(`📝 ${desc}`);
    }

    return parts.join('\n') || '🎮 Nova promoção de jogo disponível!';
  }

  /**
   * Format message for specific destination type
   */
  async formatForDestination(
    message: string,
    destinationType: 'group' | 'contact',
    _destinationName: string
  ): Promise<string> {
    // Add destination-specific formatting
    if (destinationType === 'group') {
      // For groups, might want to add @everyone or group-specific formatting
      return message;
    } else {
      // For contacts, might want to add personal greeting
      return message;
    }
  }

  /**
   * Create message with buttons (for WhatsApp Business API)
   */
  createMessageWithButtons(
    text: string,
    buttons: Array<{ id: string; title: string; url?: string }>
  ): any {
    return {
      text,
      buttons: buttons.map(button => ({
        buttonId: button.id,
        buttonText: { displayText: button.title },
        type: 1
      }))
    };
  }

  /**
   * Create message with image
   */
  createMessageWithImage(text: string, imageUrl: string): any {
    return {
      image: { url: imageUrl },
      caption: text
    };
  }

  /**
   * Validate message content
   */
  validateMessage(message: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check length
    if (message.length === 0) {
      errors.push('Message cannot be empty');
    }

    if (message.length > 4096) {
      errors.push('Message exceeds WhatsApp character limit (4096)');
    }

    // Check for invalid characters
    const invalidChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
    if (invalidChars.test(message)) {
      errors.push('Message contains invalid characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitize message content
   */
  sanitizeMessage(message: string): string {
    // Remove invalid characters
    message = message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    
    // Normalize whitespace
    message = message.replace(/\s+/g, ' ');
    
    // Trim
    message = message.trim();
    
    return message;
  }

  /**
   * Extract mentions from message
   */
  extractMentions(message: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(message)) !== null) {
      if (match[1]) {
        mentions.push(match[1]);
      }
    }

    return mentions;
  }

  /**
   * Format message for different platforms
   */
  formatForPlatform(message: string, platform: 'whatsapp' | 'telegram' | 'discord'): string {
    switch (platform) {
      case 'whatsapp':
        // WhatsApp supports emojis and basic formatting
        return message;
        
      case 'telegram':
        // Convert to Telegram markdown
        return message
          .replace(/\*\*(.*?)\*\*/g, '*$1*') // Bold
          .replace(/__(.*?)__/g, '_$1_'); // Italic
          
      case 'discord':
        // Convert to Discord markdown
        return message
          .replace(/\*\*(.*?)\*\*/g, '**$1**') // Bold
          .replace(/__(.*?)__/g, '*$1*'); // Italic
          
      default:
        return message;
    }
  }

  /**
   * Create template preview
   */
  async createTemplatePreview(
    templateName: string,
    clientId?: string,
    sampleData?: any
  ): Promise<string> {
    const template = await Template.findByName(templateName, clientId as any);
    
    if (!template) {
      throw new Error('Template not found');
    }

    const defaultSampleData = {
      title: 'Cyberpunk 2077',
      price: 59.99,
      discount: 50,
      store: 'Steam',
      description: 'Um RPG de ação em mundo aberto ambientado em Night City.',
      links: {
        purchase: 'https://store.steampowered.com/app/1091500',
        wishlist: 'https://store.steampowered.com/wishlist'
      },
      image: 'https://example.com/game-image.jpg',
      tags: ['RPG', 'Action', 'Open World']
    };

    return this.renderTemplate(template, sampleData || defaultSampleData);
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(clientId: string): Promise<any> {
    try {
      const templates = await Template.findByClientId(clientId as any);
      
      const stats = {
        totalTemplates: templates.length,
        defaultTemplates: templates.filter((t: any) => t.isDefault).length,
        customTemplates: templates.filter((t: any) => !t.isDefault).length,
        mostUsed: templates
          .sort((a: any, b: any) => b.usage.timesUsed - a.usage.timesUsed)
          .slice(0, 5)
          .map((t: any) => ({
            name: t.name,
            timesUsed: t.usage.timesUsed,
            lastUsed: t.usage.lastUsed
          })),
        totalUsage: templates.reduce((sum: number, t: any) => sum + t.usage.timesUsed, 0)
      };

      return stats;
    } catch (error) {
      this.serviceLogger.error('Error getting template stats:', error);
      return null;
    }
  }
}