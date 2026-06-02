/**
 * WhatsApp Service Validation Script
 * 
 * This script validates that all required components for the WhatsApp service
 * are properly implemented and can be instantiated without errors.
 */

import { WhatsAppService } from './WhatsAppService';
import { MessageFormatter } from './MessageFormatter';
import { WhatsAppServiceIntegration } from './WhatsAppServiceIntegration';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('WhatsAppServiceValidation');

/**
 * Validate WhatsApp Service implementation
 */
export async function validateWhatsAppService(): Promise<{
  success: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    logger.info('🔍 Starting WhatsApp Service validation...');

    // Test 1: WhatsApp Service instantiation
    try {
      const whatsappService = new WhatsAppService();
      const status = whatsappService.getStatus();
      
      if (!status) {
        errors.push('WhatsApp Service getStatus() returned null/undefined');
      } else {
        logger.info('✅ WhatsApp Service instantiation successful');
      }
    } catch (error) {
      errors.push(`WhatsApp Service instantiation failed: ${error.message}`);
    }

    // Test 2: Message Formatter instantiation
    try {
      const messageFormatter = new MessageFormatter();
      
      // Test basic message validation
      const validationResult = messageFormatter.validateMessage('Test message');
      if (!validationResult.valid) {
        warnings.push('Message validation failed for basic test message');
      } else {
        logger.info('✅ Message Formatter instantiation successful');
      }
    } catch (error) {
      errors.push(`Message Formatter instantiation failed: ${error.message}`);
    }

    // Test 3: WhatsApp Service Integration instantiation
    try {
      const integration = new WhatsAppServiceIntegration();
      const status = integration.getStatus();
      
      if (!status) {
        errors.push('WhatsApp Service Integration getStatus() returned null/undefined');
      } else {
        logger.info('✅ WhatsApp Service Integration instantiation successful');
      }
    } catch (error) {
      errors.push(`WhatsApp Service Integration instantiation failed: ${error.message}`);
    }

    // Test 4: Check required methods exist
    const requiredMethods = [
      'start',
      'stop',
      'validateDestination',
      'addDestination',
      'removeDestination',
      'getContactInfo',
      'performDestinationCleanup',
      'monitorSessionHealth',
      'getServiceStats',
      'healthCheck'
    ];

    const whatsappService = new WhatsAppService();
    for (const method of requiredMethods) {
      if (typeof (whatsappService as any)[method] !== 'function') {
        errors.push(`Required method '${method}' not found in WhatsApp Service`);
      }
    }

    if (errors.length === 0) {
      logger.info('✅ All required methods found in WhatsApp Service');
    }

    // Test 5: Check Message Formatter methods
    const formatterMethods = [
      'formatMessage',
      'validateMessage',
      'sanitizeMessage',
      'createTemplatePreview',
      'getTemplateStats'
    ];

    const messageFormatter = new MessageFormatter();
    for (const method of formatterMethods) {
      if (typeof (messageFormatter as any)[method] !== 'function') {
        errors.push(`Required method '${method}' not found in Message Formatter`);
      }
    }

    if (errors.length === 0) {
      logger.info('✅ All required methods found in Message Formatter');
    }

    // Test 6: Validate configuration requirements
    try {
      const { config } = await import('@/config/environment');
      
      if (!config.WHATSAPP) {
        errors.push('WhatsApp configuration not found in environment config');
      } else {
        const requiredConfig = ['SESSION_TIMEOUT', 'RECONNECT_ATTEMPTS', 'HEADLESS'];
        for (const configKey of requiredConfig) {
          if (config.WHATSAPP[configKey] === undefined) {
            warnings.push(`WhatsApp configuration '${configKey}' not defined`);
          }
        }
        
        if (warnings.length === 0) {
          logger.info('✅ WhatsApp configuration validation successful');
        }
      }
    } catch (error) {
      errors.push(`Configuration validation failed: ${error.message}`);
    }

    // Summary
    const success = errors.length === 0;
    
    if (success) {
      logger.info('🎉 WhatsApp Service validation completed successfully!');
      if (warnings.length > 0) {
        logger.warn(`⚠️  ${warnings.length} warnings found`);
      }
    } else {
      logger.error(`❌ WhatsApp Service validation failed with ${errors.length} errors`);
    }

    return {
      success,
      errors,
      warnings
    };

  } catch (error) {
    logger.error('💥 Validation process crashed:', error);
    return {
      success: false,
      errors: [`Validation process crashed: ${error.message}`],
      warnings
    };
  }
}

/**
 * Run validation if this file is executed directly
 */
if (require.main === module) {
  validateWhatsAppService()
    .then((result) => {
      console.log('\n=== WhatsApp Service Validation Results ===');
      console.log(`Success: ${result.success}`);
      console.log(`Errors: ${result.errors.length}`);
      console.log(`Warnings: ${result.warnings.length}`);
      
      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }
      
      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        result.warnings.forEach((warning, index) => {
          console.log(`  ${index + 1}. ${warning}`);
        });
      }
      
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}