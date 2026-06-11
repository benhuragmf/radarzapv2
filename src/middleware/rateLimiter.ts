import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config, isDevelopment } from '@/config/environment';
import { createServiceLogger } from '@/utils/logger';
import { AuthenticatedRequest } from './auth';

const logger = createServiceLogger('RateLimiter');

const dashboardApiMax = isDevelopment()
  ? 20_000
  : Math.max(config.RATE_LIMIT.MAX_REQUESTS, 500);

/**
 * Rate limiting configuration by endpoint type
 */
const rateLimitConfigs = {
  // General API endpoints
  general: {
    windowMs: config.RATE_LIMIT.WINDOW_MS,
    max: dashboardApiMax,
    message: {
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    }
  },
  
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 login attempts per window
    message: {
      error: 'Too many authentication attempts',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    }
  },
  
  // Template operations
  templates: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 template operations per window
    message: {
      error: 'Too many template requests',
      code: 'TEMPLATE_RATE_LIMIT_EXCEEDED',
      retryAfter: '5 minutes'
    }
  },
  
  // Message sending
  messages: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 messages per minute
    message: {
      error: 'Too many message requests',
      code: 'MESSAGE_RATE_LIMIT_EXCEEDED',
      retryAfter: '1 minute'
    }
  },
  
  // Heavy operations
  heavy: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 heavy operations per hour
    message: {
      error: 'Too many heavy operations',
      code: 'HEAVY_RATE_LIMIT_EXCEEDED',
      retryAfter: '1 hour'
    }
  }
};

/**
 * Create rate limiter with custom configuration
 */
const createRateLimiter = (configKey: keyof typeof rateLimitConfigs) => {
  const config = rateLimitConfigs[configKey];
  
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    
    // Custom key generator to include user ID if authenticated
    keyGenerator: (req: AuthenticatedRequest) => {
      const baseKey = req.ip || req.socket?.remoteAddress || 'unknown';
      if (req.user) {
        return `${baseKey}:${req.user.id}`;
      }
      return baseKey;
    },
    
    // Custom handler for rate limit exceeded
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        userId: (req as AuthenticatedRequest).user?.id
      });
      
      res.status(429).json({
        ...config.message,
        timestamp: new Date().toISOString(),
        path: req.path
      });
    },
    
    // Painel faz polling frequente — leituras não entram na cota
    skip: (req: Request) => {
      if (configKey !== 'general') return false;
      return req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
    },
  });
};

/**
 * Plan-based rate limiting
 */
const createPlanBasedRateLimiter = (
  freeLimit: number,
  premiumLimit: number,
  enterpriseLimit: number,
  windowMs: number = 15 * 60 * 1000
) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      // Apply strictest limit for unauthenticated users
      return createRateLimiter('general')(req, res, next);
    }

    const limits = {
      free: freeLimit,
      premium: premiumLimit,
      enterprise: enterpriseLimit
    };

    const userLimit = limits[req.user.plan] || freeLimit;
    
    const planRateLimiter = rateLimit({
      windowMs,
      max: userLimit,
      keyGenerator: () => `plan:${req.user!.id}`,
      message: {
        error: 'Plan rate limit exceeded',
        code: 'PLAN_RATE_LIMIT_EXCEEDED',
        currentPlan: req.user.plan,
        limit: userLimit,
        retryAfter: Math.ceil(windowMs / 60000) + ' minutes'
      },
      handler: (req: Request, res: Response) => {
        logger.warn('Plan-based rate limit exceeded', {
          userId: (req as AuthenticatedRequest).user?.id,
          plan: (req as AuthenticatedRequest).user?.plan,
          limit: userLimit,
          path: req.path
        });
        
        res.status(429).json({
          error: 'Plan rate limit exceeded',
          code: 'PLAN_RATE_LIMIT_EXCEEDED',
          currentPlan: (req as AuthenticatedRequest).user?.plan,
          limit: userLimit,
          retryAfter: Math.ceil(windowMs / 60000) + ' minutes',
          upgradeMessage: 'Upgrade your plan for higher limits'
        });
      }
    });

    return planRateLimiter(req, res, next);
  };
};

/**
 * IP-based blocking for suspicious activity
 */
const suspiciousActivityTracker = new Map<string, { count: number; firstSeen: number; blocked: boolean }>();

const blockSuspiciousIPs = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour window
  const maxSuspiciousRequests = 1000; // Block after 1000 requests in 1 hour
  
  let activity = suspiciousActivityTracker.get(ip);
  
  if (!activity) {
    activity = { count: 1, firstSeen: now, blocked: false };
    suspiciousActivityTracker.set(ip, activity);
  } else {
    // Reset counter if window has passed
    if (now - activity.firstSeen > windowMs) {
      activity.count = 1;
      activity.firstSeen = now;
      activity.blocked = false;
    } else {
      activity.count++;
    }
    
    // Block if threshold exceeded
    if (activity.count > maxSuspiciousRequests) {
      activity.blocked = true;
    }
  }
  
  if (activity.blocked) {
    logger.error('IP blocked for suspicious activity', {
      ip,
      requestCount: activity.count,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      error: 'IP temporarily blocked due to suspicious activity',
      code: 'IP_BLOCKED',
      retryAfter: '1 hour'
    });
    return;
  }
  
  next();
};

/**
 * Clean up old entries from suspicious activity tracker
 */
setInterval(() => {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  
  for (const [ip, activity] of suspiciousActivityTracker.entries()) {
    if (now - activity.firstSeen > windowMs) {
      suspiciousActivityTracker.delete(ip);
    }
  }
}, 10 * 60 * 1000); // Clean up every 10 minutes

/**
 * Export rate limiters
 */
export const rateLimiters = {
  general: createRateLimiter('general'),
  auth: createRateLimiter('auth'),
  templates: createRateLimiter('templates'),
  messages: createRateLimiter('messages'),
  heavy: createRateLimiter('heavy'),
  
  // Plan-based limiters
  templateOperations: createPlanBasedRateLimiter(10, 50, 200), // per 15 minutes
  messageOperations: createPlanBasedRateLimiter(5, 20, 100, 60 * 1000), // per minute
  apiCalls: createPlanBasedRateLimiter(100, 500, 2000), // per 15 minutes
  
  // Security
  blockSuspiciousIPs
};

/**
 * Apply rate limiting based on endpoint pattern
 */
export const smartRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path.toLowerCase();
  
  // Authentication endpoints
  if (path.includes('/auth/') || path.includes('/login') || path.includes('/register')) {
    return rateLimiters.auth(req, res, next);
  }
  
  // Template endpoints
  if (path.includes('/templates/')) {
    return rateLimiters.templates(req, res, next);
  }
  
  // Message endpoints
  if (path.includes('/messages/') || path.includes('/send')) {
    return rateLimiters.messages(req, res, next);
  }
  
  // Heavy operations
  if (path.includes('/stats') || path.includes('/export') || path.includes('/backup')) {
    return rateLimiters.heavy(req, res, next);
  }
  
  // Default general rate limiting
  return rateLimiters.general(req, res, next);
};

export default {
  rateLimiters,
  smartRateLimit,
  createRateLimiter,
  createPlanBasedRateLimiter
};