import { RedisManager } from './RedisManager';
import { config } from '@/config/environment';
import { logger, createServiceLogger } from '@/utils/logger';

/**
 * Session Cache with automatic TTL management
 */
export class SessionCache {
  private static instance: SessionCache;
  private redisManager: RedisManager;
  private serviceLogger = createServiceLogger('SessionCache');
  private readonly keyPrefix = 'session:';

  private constructor() {
    this.redisManager = RedisManager.getInstance();
  }

  static getInstance(): SessionCache {
    if (!SessionCache.instance) {
      SessionCache.instance = new SessionCache();
    }
    return SessionCache.instance;
  }

  /**
   * Store session data with TTL
   */
  async setSession(
    sessionId: string,
    data: any,
    ttlSeconds: number = config.WHATSAPP.SESSION_TIMEOUT / 1000
  ): Promise<boolean> {
    const key = this.getSessionKey(sessionId);
    
    try {
      const serializedData = JSON.stringify({
        ...data,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
      });

      const success = await this.redisManager.setWithTTL(key, serializedData, ttlSeconds);
      
      if (success) {
        this.serviceLogger.debug(`Session stored: ${sessionId}`, {
          ttlSeconds,
          expiresAt: new Date(Date.now() + ttlSeconds * 1000)
        });
      }
      
      return success;
    } catch (error) {
      this.serviceLogger.error(`Failed to store session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<any | null> {
    const key = this.getSessionKey(sessionId);
    
    try {
      const data = await this.redisManager.get(key);
      
      if (!data) {
        return null;
      }

      const parsedData = JSON.parse(data);
      
      // Check if session has expired
      if (parsedData.expiresAt && new Date(parsedData.expiresAt) < new Date()) {
        await this.deleteSession(sessionId);
        return null;
      }

      this.serviceLogger.debug(`Session retrieved: ${sessionId}`);
      return parsedData;
      
    } catch (error) {
      this.serviceLogger.error(`Failed to get session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Update session data (extends TTL)
   */
  async updateSession(
    sessionId: string,
    data: any,
    ttlSeconds: number = config.WHATSAPP.SESSION_TIMEOUT / 1000
  ): Promise<boolean> {
    const existingData = await this.getSession(sessionId);
    
    if (!existingData) {
      return await this.setSession(sessionId, data, ttlSeconds);
    }

    const updatedData = {
      ...existingData,
      ...data,
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString()
    };

    return await this.setSession(sessionId, updatedData, ttlSeconds);
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const key = this.getSessionKey(sessionId);
    
    try {
      const deleted = await this.redisManager.del(key);
      
      if (deleted > 0) {
        this.serviceLogger.debug(`Session deleted: ${sessionId}`);
      }
      
      return deleted > 0;
    } catch (error) {
      this.serviceLogger.error(`Failed to delete session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Check if session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    const key = this.getSessionKey(sessionId);
    
    try {
      return await this.redisManager.exists(key);
    } catch (error) {
      this.serviceLogger.error(`Failed to check session existence ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Extend session TTL
   */
  async extendSession(
    sessionId: string,
    additionalSeconds: number = config.WHATSAPP.SESSION_TIMEOUT / 1000
  ): Promise<boolean> {
    const key = this.getSessionKey(sessionId);
    
    try {
      const success = await this.redisManager.expire(key, additionalSeconds);
      
      if (success) {
        // Update the expiresAt field in the session data
        const sessionData = await this.getSession(sessionId);
        if (sessionData) {
          sessionData.expiresAt = new Date(Date.now() + additionalSeconds * 1000).toISOString();
          await this.redisManager.setWithTTL(key, JSON.stringify(sessionData), additionalSeconds);
        }
        
        this.serviceLogger.debug(`Session TTL extended: ${sessionId}`, {
          additionalSeconds,
          newExpiresAt: new Date(Date.now() + additionalSeconds * 1000)
        });
      }
      
      return success;
    } catch (error) {
      this.serviceLogger.error(`Failed to extend session TTL ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get session TTL
   */
  async getSessionTTL(sessionId: string): Promise<number> {
    const key = this.getSessionKey(sessionId);
    
    try {
      return await this.redisManager.ttl(key);
    } catch (error) {
      this.serviceLogger.error(`Failed to get session TTL ${sessionId}:`, error);
      return -1;
    }
  }

  /**
   * Get all active sessions for a client
   */
  async getClientSessions(clientId: string): Promise<string[]> {
    try {
      const pattern = `${this.keyPrefix}*:${clientId}`;
      const keys = await this.redisManager.keys(pattern);
      
      return keys.map(key => key.replace(this.keyPrefix, '').split(':')[0]);
    } catch (error) {
      this.serviceLogger.error(`Failed to get client sessions for ${clientId}:`, error);
      return [];
    }
  }

  /**
   * Store WhatsApp session state
   */
  async setWhatsAppSession(
    clientId: string,
    sessionData: {
      status: 'connecting' | 'connected' | 'disconnected' | 'qr-required';
      qrCode?: string;
      qrCodeRaw?: string;
      qrCount?: number;
      statusReason?: number;
      wuid?: string;
      profileName?: string;
      profilePictureUrl?: string;
      deviceInfo?: any;
      lastActivity?: Date;
      connectionAttempts?: number;
    },
    ttlSeconds: number = config.WHATSAPP.SESSION_TIMEOUT / 1000
  ): Promise<boolean> {
    const sessionId = `whatsapp:${clientId}`;
    
    const enrichedData = {
      ...sessionData,
      clientId,
      type: 'whatsapp',
      lastActivity: sessionData.lastActivity || new Date(),
      connectionAttempts: sessionData.connectionAttempts || 0
    };

    return await this.setSession(sessionId, enrichedData, ttlSeconds);
  }

  /**
   * Get WhatsApp session state
   */
  async getWhatsAppSession(clientId: string): Promise<any | null> {
    const sessionId = `whatsapp:${clientId}`;
    return await this.getSession(sessionId);
  }

  /**
   * Update WhatsApp session activity
   */
  async updateWhatsAppActivity(clientId: string): Promise<boolean> {
    const sessionId = `whatsapp:${clientId}`;
    const sessionData = await this.getSession(sessionId);
    
    if (!sessionData) {
      return false;
    }

    return await this.updateSession(sessionId, {
      ...sessionData,
      lastActivity: new Date(),
      status: 'connected'
    });
  }

  /**
   * Store Discord bot session state
   */
  async setDiscordSession(
    botId: string,
    sessionData: {
      status: 'connecting' | 'connected' | 'disconnected';
      guilds?: string[];
      lastActivity?: Date;
      reconnectAttempts?: number;
    },
    ttlSeconds: number = 24 * 60 * 60 // 24 hours
  ): Promise<boolean> {
    const sessionId = `discord:${botId}`;
    
    const enrichedData = {
      ...sessionData,
      botId,
      type: 'discord',
      lastActivity: sessionData.lastActivity || new Date(),
      reconnectAttempts: sessionData.reconnectAttempts || 0
    };

    return await this.setSession(sessionId, enrichedData, ttlSeconds);
  }

  /**
   * Get Discord bot session state
   */
  async getDiscordSession(botId: string): Promise<any | null> {
    const sessionId = `discord:${botId}`;
    return await this.getSession(sessionId);
  }

  /**
   * Store API session/token
   */
  async setAPISession(
    tokenId: string,
    sessionData: {
      clientId: string;
      permissions: string[];
      lastUsed?: Date;
      ipAddress?: string;
    },
    ttlSeconds: number = 7 * 24 * 60 * 60 // 7 days
  ): Promise<boolean> {
    const sessionId = `api:${tokenId}`;
    
    const enrichedData = {
      ...sessionData,
      tokenId,
      type: 'api',
      lastUsed: sessionData.lastUsed || new Date()
    };

    return await this.setSession(sessionId, enrichedData, ttlSeconds);
  }

  /**
   * Get API session/token
   */
  async getAPISession(tokenId: string): Promise<any | null> {
    const sessionId = `api:${tokenId}`;
    return await this.getSession(sessionId);
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redisManager.keys(pattern);
      
      let cleanedCount = 0;
      
      for (const key of keys) {
        const ttl = await this.redisManager.ttl(key);
        
        // Remove keys that have expired
        if (ttl === -2) {
          await this.redisManager.del(key);
          cleanedCount++;
        }
      }
      
      this.serviceLogger.info(`Session cleanup completed: ${cleanedCount} expired sessions removed`);
      return cleanedCount;
      
    } catch (error) {
      this.serviceLogger.error('Session cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<any> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redisManager.keys(pattern);
      
      const stats = {
        totalSessions: keys.length,
        sessionsByType: {
          whatsapp: 0,
          discord: 0,
          api: 0,
          other: 0
        },
        activeSessions: 0,
        expiringSoon: 0 // expires in less than 1 hour
      };
      
      for (const key of keys) {
        const ttl = await this.redisManager.ttl(key);
        
        if (ttl > 0) {
          stats.activeSessions++;
          
          if (ttl < 3600) { // less than 1 hour
            stats.expiringSoon++;
          }
        }
        
        if (key.includes(':whatsapp:')) {
          stats.sessionsByType.whatsapp++;
        } else if (key.includes(':discord:')) {
          stats.sessionsByType.discord++;
        } else if (key.includes(':api:')) {
          stats.sessionsByType.api++;
        } else {
          stats.sessionsByType.other++;
        }
      }
      
      return stats;
      
    } catch (error) {
      this.serviceLogger.error('Failed to get session stats:', error);
      return null;
    }
  }

  /**
   * Get session key with prefix
   */
  private getSessionKey(sessionId: string): string {
    return `${this.keyPrefix}${sessionId}`;
  }

  /**
   * Bulk delete sessions by pattern
   */
  async bulkDeleteSessions(pattern: string): Promise<number> {
    try {
      const searchPattern = `${this.keyPrefix}${pattern}`;
      const keys = await this.redisManager.keys(searchPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const deleted = await this.redisManager.del(...keys);
      
      this.serviceLogger.info(`Bulk deleted ${deleted} sessions matching pattern: ${pattern}`);
      return deleted;
      
    } catch (error) {
      this.serviceLogger.error(`Failed to bulk delete sessions with pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Get sessions expiring soon
   */
  async getExpiringSessions(thresholdSeconds: number = 3600): Promise<Array<{ sessionId: string; ttl: number }>> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redisManager.keys(pattern);
      
      const expiringSessions: Array<{ sessionId: string; ttl: number }> = [];
      
      for (const key of keys) {
        const ttl = await this.redisManager.ttl(key);
        
        if (ttl > 0 && ttl < thresholdSeconds) {
          expiringSessions.push({
            sessionId: key.replace(this.keyPrefix, ''),
            ttl
          });
        }
      }
      
      return expiringSessions.sort((a, b) => a.ttl - b.ttl);
      
    } catch (error) {
      this.serviceLogger.error('Failed to get expiring sessions:', error);
      return [];
    }
  }
}