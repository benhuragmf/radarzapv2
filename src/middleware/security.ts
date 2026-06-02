import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from '@/config/environment';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('SecurityMiddleware');

/**
 * CORS configuration
 */
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5174',
      config.DASHBOARD.FRONTEND_URL,
      'https://discord-whatsapp-bot.vercel.app',
      'https://radar-zap.web.app',
      config.CORS_ORIGIN || 'http://localhost:3001',
    ].filter(Boolean);

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from unauthorized origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Client-Version',
    'X-Request-ID'
  ],
  
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset'
  ],
  
  credentials: true,
  maxAge: 86400 // 24 hours
};

/**
 * Helmet security configuration
 */
const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'https://api.discord.com', 'wss://gateway.discord.gg'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
  
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
};

/**
 * Request ID middleware for tracing
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || 
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // API-specific headers
  res.setHeader('X-API-Version', '1.0.0');
  res.setHeader('X-Service', 'discord-whatsapp-bot');
  
  next();
};

/**
 * IP whitelist middleware (for admin endpoints)
 */
export const ipWhitelist = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (allowedIPs.length === 0) {
      next();
      return;
    }

    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (!clientIP || !allowedIPs.includes(clientIP)) {
      logger.warn('IP not in whitelist', { 
        clientIP, 
        allowedIPs, 
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      
      res.status(403).json({
        error: 'Access denied',
        code: 'IP_NOT_WHITELISTED'
      });
      return;
    }
    
    next();
  };
};

/**
 * User agent validation middleware
 */
export const validateUserAgent = (req: Request, res: Response, next: NextFunction): void => {
  const userAgent = req.get('User-Agent');
  
  if (!userAgent) {
    logger.warn('Request without User-Agent header', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    res.status(400).json({
      error: 'User-Agent header required',
      code: 'MISSING_USER_AGENT'
    });
    return;
  }
  
  // Block known bad user agents
  const blockedUserAgents = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i
  ];
  
  // Allow legitimate bots (Discord, etc.)
  const allowedBots = [
    /Discordbot/i,
    /Postman/i,
    /curl/i,
    /HTTPie/i
  ];
  
  const isBlockedBot = blockedUserAgents.some(pattern => pattern.test(userAgent));
  const isAllowedBot = allowedBots.some(pattern => pattern.test(userAgent));
  
  if (isBlockedBot && !isAllowedBot) {
    logger.warn('Blocked user agent detected', {
      userAgent,
      ip: req.ip,
      path: req.path
    });
    
    res.status(403).json({
      error: 'User agent not allowed',
      code: 'USER_AGENT_BLOCKED'
    });
    return;
  }
  
  next();
};

/**
 * Content type validation middleware
 */
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip validation for GET requests and requests without body
    if (req.method === 'GET' || !req.body || Object.keys(req.body).length === 0) {
      next();
      return;
    }
    
    const contentType = req.get('Content-Type');
    
    if (!contentType) {
      res.status(400).json({
        error: 'Content-Type header required',
        code: 'MISSING_CONTENT_TYPE'
      });
      return;
    }
    
    const isAllowed = allowedTypes.some(type => contentType.includes(type));
    
    if (!isAllowed) {
      res.status(415).json({
        error: 'Unsupported content type',
        code: 'UNSUPPORTED_CONTENT_TYPE',
        allowedTypes,
        receivedType: contentType
      });
      return;
    }
    
    next();
  };
};

/**
 * Request size limit middleware
 */
export const requestSizeLimit = (maxSize: number = 10 * 1024 * 1024) => { // 10MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    
    if (contentLength > maxSize) {
      logger.warn('Request size limit exceeded', {
        contentLength,
        maxSize,
        ip: req.ip,
        path: req.path
      });
      
      res.status(413).json({
        error: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize,
        receivedSize: contentLength
      });
      return;
    }
    
    next();
  };
};

/**
 * Slow request detection middleware
 */
export const slowRequestDetection = (threshold: number = 5000) => { // 5 seconds
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      if (duration > threshold) {
        logger.warn('Slow request detected', {
          duration,
          threshold,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          ip: req.ip
        });
      }
    });
    
    next();
  };
};

/**
 * API versioning middleware
 */
export const apiVersioning = (req: Request, res: Response, next: NextFunction): void => {
  const acceptedVersion = req.get('Accept-Version') || req.query.version || 'v1';
  const supportedVersions = ['v1'];
  
  if (!supportedVersions.includes(acceptedVersion as string)) {
    res.status(400).json({
      error: 'Unsupported API version',
      code: 'UNSUPPORTED_API_VERSION',
      supportedVersions,
      requestedVersion: acceptedVersion
    });
    return;
  }
  
  req.headers['x-api-version'] = acceptedVersion as string;
  res.setHeader('X-API-Version', acceptedVersion as string);
  
  next();
};

/**
 * Export configured middleware
 */
export const securityMiddleware = {
  cors: cors(corsOptions),
  helmet: helmet(helmetOptions as any),
  requestId,
  securityHeaders,
  ipWhitelist,
  validateUserAgent,
  validateContentType,
  requestSizeLimit,
  slowRequestDetection,
  apiVersioning
};

export default securityMiddleware;