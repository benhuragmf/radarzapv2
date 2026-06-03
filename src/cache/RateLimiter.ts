import { RedisManager } from './RedisManager';
import { config } from '@/config/environment';
import { logger, createServiceLogger } from '@/utils/logger';

/**
 * Rate Limiter using Token Bucket algorithm with Redis
 */
export class RateLimiter {
  private static instance: RateLimiter;
  private redisManager: RedisManager;
  private serviceLogger = createServiceLogger('RateLimiter');

  private constructor() {
    this.redisManager = RedisManager.getInstance();
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Token Bucket Rate Limiting Implementation
   */
  async checkRateLimit(
    key: string,
    maxTokens: number,
    refillRate: number,
    windowMs: number = 60000
  ): Promise<{ allowed: boolean; tokensRemaining: number; resetTime: number }> {
    const bucketKey = `${config.RATE_LIMIT.REDIS_KEY_PREFIX}${key}`;
    const now = Date.now();
    
    try {
      // Lua script for atomic token bucket operations
      const luaScript = `
        local bucket_key = KEYS[1]
        local max_tokens = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local window_ms = tonumber(ARGV[3])
        local now = tonumber(ARGV[4])
        local tokens_requested = tonumber(ARGV[5])
        
        local bucket = redis.call('HMGET', bucket_key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1]) or max_tokens
        local last_refill = tonumber(bucket[2]) or now
        
        -- Calculate tokens to add based on time elapsed
        local time_elapsed = now - last_refill
        local tokens_to_add = math.floor(time_elapsed * refill_rate / window_ms)
        
        -- Add tokens but don't exceed max
        tokens = math.min(max_tokens, tokens + tokens_to_add)
        
        local allowed = 0
        local reset_time = now + ((max_tokens - tokens) * window_ms / refill_rate)
        
        if tokens >= tokens_requested then
          tokens = tokens - tokens_requested
          allowed = 1
        end
        
        -- Update bucket
        redis.call('HMSET', bucket_key, 'tokens', tokens, 'last_refill', now)
        redis.call('EXPIRE', bucket_key, math.ceil(window_ms / 1000) * 2)
        
        return {allowed, tokens, reset_time}
      `;

      const result = await this.redisManager.evalScript(
        luaScript,
        [bucketKey],
        [maxTokens.toString(), refillRate.toString(), windowMs.toString(), now.toString(), '1']
      );

      const [allowed, tokensRemaining, resetTime] = result as [number, number, number];

      this.serviceLogger.debug('Rate limit check', {
        key,
        allowed: allowed === 1,
        tokensRemaining,
        resetTime: new Date(resetTime)
      });

      return {
        allowed: allowed === 1,
        tokensRemaining,
        resetTime
      };

    } catch (error) {
      this.serviceLogger.error('Rate limit check failed:', error);
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        tokensRemaining: maxTokens,
        resetTime: now + windowMs
      };
    }
  }

  /**
   * Check rate limit for user messages
   */
  async checkUserMessageLimit(
    userId: string,
    userPlan: 'free' | 'premium' | 'enterprise' = 'free'
  ): Promise<{ allowed: boolean; tokensRemaining: number; resetTime: number }> {
    const limits = this.getUserLimits(userPlan);
    
    return await this.checkRateLimit(
      `user:${userId}:messages`,
      limits.messagesPerDay,
      limits.refillRate,
      24 * 60 * 60 * 1000 // 24 hours
    );
  }

  /**
   * Check rate limit for API endpoints
   */
  async checkAPILimit(
    clientId: string,
    endpoint: string,
    userPlan: 'free' | 'premium' | 'enterprise' = 'free'
  ): Promise<{ allowed: boolean; tokensRemaining: number; resetTime: number }> {
    const limits = this.getAPILimits(userPlan);
    
    return await this.checkRateLimit(
      `api:${clientId}:${endpoint}`,
      limits.requestsPerMinute,
      limits.refillRate,
      60 * 1000 // 1 minute
    );
  }

  /**
   * Check global rate limit
   */
  async checkGlobalLimit(
    operation: string,
    maxOperations: number = 1000,
    windowMs: number = 60000
  ): Promise<{ allowed: boolean; tokensRemaining: number; resetTime: number }> {
    return await this.checkRateLimit(
      `global:${operation}`,
      maxOperations,
      maxOperations / (windowMs / 1000), // refill rate per second
      windowMs
    );
  }

  /**
   * Check WhatsApp sending rate limit
   */
  async checkWhatsAppSendingLimit(
    sessionId: string
  ): Promise<{ allowed: boolean; tokensRemaining: number; resetTime: number }> {
    const maxPerMinute = config.WHATSAPP.RATE_LIMIT_MESSAGES_PER_MINUTE;
    return await this.checkRateLimit(
      `whatsapp:${sessionId}:sending`,
      maxPerMinute,
      maxPerMinute / 60,
      60 * 1000,
    );
  }

  /**
   * Get user-specific limits based on plan
   */
  private getUserLimits(plan: 'free' | 'premium' | 'enterprise') {
    switch (plan) {
      case 'free':
        return {
          messagesPerDay: 50,
          refillRate: 50 / (24 * 60 * 60) // 50 messages per 24 hours
        };
      case 'premium':
        return {
          messagesPerDay: 500,
          refillRate: 500 / (24 * 60 * 60) // 500 messages per 24 hours
        };
      case 'enterprise':
        return {
          messagesPerDay: 10000,
          refillRate: 10000 / (24 * 60 * 60) // 10000 messages per 24 hours
        };
      default:
        return {
          messagesPerDay: 50,
          refillRate: 50 / (24 * 60 * 60)
        };
    }
  }

  /**
   * Get API-specific limits based on plan
   */
  private getAPILimits(plan: 'free' | 'premium' | 'enterprise') {
    switch (plan) {
      case 'free':
        return {
          requestsPerMinute: 60,
          refillRate: 1 // 1 request per second
        };
      case 'premium':
        return {
          requestsPerMinute: 300,
          refillRate: 5 // 5 requests per second
        };
      case 'enterprise':
        return {
          requestsPerMinute: 1000,
          refillRate: 16.67 // ~17 requests per second
        };
      default:
        return {
          requestsPerMinute: 60,
          refillRate: 1
        };
    }
  }

  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(key: string): Promise<void> {
    const bucketKey = `${config.RATE_LIMIT.REDIS_KEY_PREFIX}${key}`;
    
    try {
      await this.redisManager.del(bucketKey);
      this.serviceLogger.info(`Rate limit reset for key: ${key}`);
    } catch (error) {
      this.serviceLogger.error(`Failed to reset rate limit for key ${key}:`, error);
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(key: string): Promise<{
    tokens: number;
    lastRefill: number;
    exists: boolean;
  }> {
    const bucketKey = `${config.RATE_LIMIT.REDIS_KEY_PREFIX}${key}`;
    
    try {
      const bucket = await this.redisManager.hgetall(bucketKey);
      
      if (!bucket || Object.keys(bucket).length === 0) {
        return {
          tokens: 0,
          lastRefill: 0,
          exists: false
        };
      }

      return {
        tokens: parseInt(bucket.tokens) || 0,
        lastRefill: parseInt(bucket.last_refill) || 0,
        exists: true
      };
    } catch (error) {
      this.serviceLogger.error(`Failed to get rate limit status for key ${key}:`, error);
      return {
        tokens: 0,
        lastRefill: 0,
        exists: false
      };
    }
  }

  /**
   * Increment usage counter (for analytics)
   */
  async incrementUsage(
    key: string,
    amount: number = 1,
    windowMs: number = 60000
  ): Promise<number> {
    const usageKey = `${config.RATE_LIMIT.REDIS_KEY_PREFIX}usage:${key}`;
    
    try {
      const count = await this.redisManager.hincrby(usageKey, 'count', amount);
      
      // Set expiration if this is a new key
      if (count === amount) {
        await this.redisManager.expire(usageKey, Math.ceil(windowMs / 1000));
      }
      
      return count || 0;
    } catch (error) {
      this.serviceLogger.error(`Failed to increment usage for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(key: string): Promise<{ count: number; exists: boolean }> {
    const usageKey = `${config.RATE_LIMIT.REDIS_KEY_PREFIX}usage:${key}`;
    
    try {
      const count = await this.redisManager.hget(usageKey, 'count');
      
      return {
        count: parseInt(count || '0'),
        exists: count !== null
      };
    } catch (error) {
      this.serviceLogger.error(`Failed to get usage stats for key ${key}:`, error);
      return {
        count: 0,
        exists: false
      };
    }
  }

  /**
   * Sliding window rate limiter (alternative implementation)
   */
  async checkSlidingWindowLimit(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<{ allowed: boolean; requestsRemaining: number; resetTime: number }> {
    const windowKey = `${config.RATE_LIMIT.REDIS_KEY_PREFIX}window:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    try {
      // Lua script for sliding window
      const luaScript = `
        local window_key = KEYS[1]
        local max_requests = tonumber(ARGV[1])
        local window_start = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local window_ms = tonumber(ARGV[4])
        
        -- Remove old entries
        redis.call('ZREMRANGEBYSCORE', window_key, 0, window_start)
        
        -- Count current requests
        local current_requests = redis.call('ZCARD', window_key)
        
        local allowed = 0
        if current_requests < max_requests then
          -- Add current request
          redis.call('ZADD', window_key, now, now)
          allowed = 1
          current_requests = current_requests + 1
        end
        
        -- Set expiration
        redis.call('EXPIRE', window_key, math.ceil(window_ms / 1000))
        
        local requests_remaining = max_requests - current_requests
        local reset_time = now + window_ms
        
        return {allowed, requests_remaining, reset_time}
      `;

      const result = await this.redisManager.evalScript(
        luaScript,
        [windowKey],
        [maxRequests.toString(), windowStart.toString(), now.toString(), windowMs.toString()]
      );

      const [allowed, requestsRemaining, resetTime] = result as [number, number, number];

      return {
        allowed: allowed === 1,
        requestsRemaining,
        resetTime
      };

    } catch (error) {
      this.serviceLogger.error('Sliding window rate limit check failed:', error);
      // Fail open
      return {
        allowed: true,
        requestsRemaining: maxRequests,
        resetTime: now + windowMs
      };
    }
  }

  /**
   * Cleanup expired rate limit keys
   */
  async cleanup(): Promise<number> {
    try {
      const pattern = `${config.RATE_LIMIT.REDIS_KEY_PREFIX}*`;
      const keys = await this.redisManager.keys(pattern);
      
      let cleanedCount = 0;
      
      for (const key of keys) {
        const ttl = await this.redisManager.ttl(key);
        
        // Remove keys that have expired or have no TTL set
        if (ttl === -1 || ttl === -2) {
          await this.redisManager.del(key);
          cleanedCount++;
        }
      }
      
      this.serviceLogger.info(`Rate limiter cleanup completed: ${cleanedCount} keys removed`);
      return cleanedCount;
      
    } catch (error) {
      this.serviceLogger.error('Rate limiter cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Get rate limiter statistics
   */
  async getStats(): Promise<any> {
    try {
      const pattern = `${config.RATE_LIMIT.REDIS_KEY_PREFIX}*`;
      const keys = await this.redisManager.keys(pattern);
      
      const stats = {
        totalKeys: keys.length,
        keysByType: {
          user: 0,
          api: 0,
          global: 0,
          whatsapp: 0,
          usage: 0,
          window: 0
        },
        activeKeys: 0
      };
      
      for (const key of keys) {
        const ttl = await this.redisManager.ttl(key);
        
        if (ttl > 0) {
          stats.activeKeys++;
        }
        
        if (key.includes(':user:')) {
          stats.keysByType.user++;
        } else if (key.includes(':api:')) {
          stats.keysByType.api++;
        } else if (key.includes(':global:')) {
          stats.keysByType.global++;
        } else if (key.includes(':whatsapp:')) {
          stats.keysByType.whatsapp++;
        } else if (key.includes(':usage:')) {
          stats.keysByType.usage++;
        } else if (key.includes(':window:')) {
          stats.keysByType.window++;
        }
      }
      
      return stats;
      
    } catch (error) {
      this.serviceLogger.error('Failed to get rate limiter stats:', error);
      return null;
    }
  }
}