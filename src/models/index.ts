/**
 * Central export file for all database models
 * This provides a single import point for all models
 */

// Import models first
import { User as UserModel, IUser } from './User';
import { WhatsAppSession as WhatsAppSessionModel, IWhatsAppSession } from './WhatsAppSession';
import { DiscordChannel as DiscordChannelModel, IDiscordChannel } from './DiscordChannel';
import { MessageQueue as MessageQueueModel, IMessageQueue } from './MessageQueue';
import { Template as TemplateModel, ITemplate } from './Template';
import { Destination as DestinationModel, IDestination } from './Destination';
import { SystemLog as SystemLogModel, ISystemLog } from './SystemLog';

// Export models
export { UserModel as User, IUser };
export { WhatsAppSessionModel as WhatsAppSession, IWhatsAppSession };
export { DiscordChannelModel as DiscordChannel, IDiscordChannel };
export { MessageQueueModel as MessageQueue, IMessageQueue };
export { TemplateModel as Template, ITemplate };
export { DestinationModel as Destination, IDestination };
export { SystemLogModel as SystemLog, ISystemLog };
export { GuildMembership, IGuildMembership } from './GuildMembership';
export { Organization, IOrganization } from './Organization';
export { CompanyMember, ICompanyMember } from './CompanyMember';
export { ContactGroup, IContactGroup } from './ContactGroup';
export { AuditLog, IAuditLog, writeAuditLog } from './AuditLog';
export { InboxDepartment, IInboxDepartment } from './InboxDepartment';
export { InboxConversation, IInboxConversation } from './InboxConversation';
export { InboxMessage, IInboxMessage } from './InboxMessage';
export { InboxTransfer, IInboxTransfer } from './InboxTransfer';

// Create aliases for internal use
const User = UserModel;
const WhatsAppSession = WhatsAppSessionModel;
const DiscordChannel = DiscordChannelModel;
const MessageQueue = MessageQueueModel;
const Template = TemplateModel;
const Destination = DestinationModel;
const SystemLog = SystemLogModel;

/**
 * Model validation utilities
 */
export class ModelValidator {
  /**
   * Validate Discord ID format
   */
  static isValidDiscordId(id: string): boolean {
    return /^\d{17,19}$/.test(id);
  }

  /**
   * Validate phone number format
   */
  static isValidPhoneNumber(phone: string): boolean {
    const cleaned = phone.replace(/[\s\-()]/g, '');
    return /^\+?[1-9]\d{1,14}$/.test(cleaned);
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Validate WhatsApp group ID format
   */
  static isValidGroupId(groupId: string): boolean {
    return /^[\w\-@.]+$/.test(groupId);
  }

  /**
   * Validate template variable name
   */
  static isValidVariableName(name: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
  }

  /**
   * Sanitize string for database storage
   */
  static sanitizeString(str: string, maxLength: number = 1000): string {
    return str.trim().substring(0, maxLength);
  }

  /**
   * Validate IP address format
   */
  static isValidIpAddress(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }
}

/**
 * Database health check utilities
 */
export class DatabaseHealth {
  /**
   * Check if all models are properly initialized
   */
  static async checkModelsHealth(): Promise<{ healthy: boolean; details: Record<string, boolean> }> {
    const models = {
      User,
      WhatsAppSession,
      DiscordChannel,
      MessageQueue,
      Template,
      Destination,
      SystemLog
    };

    const details: Record<string, boolean> = {};
    let allHealthy = true;

    for (const [name, Model] of Object.entries(models)) {
      try {
        await (Model as any).findOne().limit(1);
        details[name] = true;
      } catch (error) {
        details[name] = false;
        allHealthy = false;
      }
    }

    return { healthy: allHealthy, details };
  }

  /**
   * Get collection statistics
   */
  static async getCollectionStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    try {
      stats.users = await User.countDocuments();
      stats.whatsappSessions = await WhatsAppSession.countDocuments();
      stats.discordChannels = await DiscordChannel.countDocuments();
      stats.messageQueue = await MessageQueue.countDocuments();
      stats.templates = await Template.countDocuments();
      stats.destinations = await Destination.countDocuments();
      stats.systemLogs = await SystemLog.countDocuments();
    } catch (error) {
      stats.error = error.message;
    }

    return stats;
  }
}

/**
 * Common database operations
 */
export class DatabaseOperations {
  /**
   * Cleanup expired data across all models
   */
  static async cleanupExpiredData(): Promise<{ cleaned: Record<string, number> }> {
    const cleaned: Record<string, number> = {};

    try {
      // Cleanup expired WhatsApp sessions
      cleaned.whatsappSessions = await WhatsAppSession.cleanupExpiredSessions();

      // Cleanup old message queue items
      cleaned.messageQueue = await MessageQueue.cleanupOldMessages(7);

      // Cleanup old system logs
      cleaned.systemLogs = await SystemLog.cleanupOldLogs(30);

    } catch (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }

    return { cleaned };
  }

  /**
   * Get system-wide statistics
   */
  static async getSystemStats(): Promise<any> {
    try {
      const [
        userStats,
        sessionStats,
        channelStats,
        queueStats,
        templateStats,
        destinationStats
      ] = await Promise.all([
        User.getUserStats(),
        WhatsAppSession.getSessionStats(),
        DiscordChannel.getChannelStats(),
        MessageQueue.getQueueStats(),
        Template.getTemplateStats(),
        Destination.getDestinationStats()
      ]);

      return {
        users: userStats,
        sessions: sessionStats,
        channels: channelStats,
        queue: queueStats,
        templates: templateStats,
        destinations: destinationStats,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to get system stats: ${error.message}`);
    }
  }
}