/*
 * Radar Chat / RadarGamer
 * Copyright (c) 2026 Benhur Augusto Gomes Monteiro Faria
 * Todos os direitos reservados.
 * Uso, cópia, distribuição ou modificação sem autorização é proibido.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '@/utils/logger';
import { config } from '@/config/environment';
import { DatabaseManager } from '@/database/DatabaseManager';
import { RedisManager } from '@/cache/RedisManager';

// Middleware imports
import { securityMiddleware } from '@/middleware/security';
import { rateLimiters, smartRateLimit } from '@/middleware/rateLimiter';
import { sanitizeInput } from '@/middleware/validation';
import authMiddleware from '@/middleware/auth';

// Route imports
import templateRoutes from '@/services/templates/templateRoutes';

const logger = createServiceLogger('APIGateway');

export interface APIGatewayConfig {
  port: number;
  host: string;
  enableDocs: boolean;
  enableMetrics: boolean;
  corsOrigins: string[];
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
}

/**
 * API Gateway Service
 * Central entry point for all API requests with security, validation, and routing
 */
export class APIGateway {
  private app: Application;
  private server: any;
  private config: APIGatewayConfig;

  constructor(gatewayConfig?: Partial<APIGatewayConfig>) {
    this.config = {
      port: config.PORT,
      host: '0.0.0.0',
      enableDocs: true,
      enableMetrics: true,
      corsOrigins: [config.CORS_ORIGIN || 'http://localhost:3001'],
      rateLimit: {
        enabled: true,
        windowMs: config.RATE_LIMIT.WINDOW_MS,
        maxRequests: config.RATE_LIMIT.MAX_REQUESTS
      },
      ...gatewayConfig
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware stack
   */
  private setupMiddleware(): void {
    logger.info('Setting up API Gateway middleware');

    // Trust proxy for accurate IP addresses
    this.app.set('trust proxy', 1);

    // Security middleware
    this.app.use(securityMiddleware.requestId);
    this.app.use(securityMiddleware.securityHeaders);
    this.app.use(securityMiddleware.helmet);
    this.app.use(securityMiddleware.cors);

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Input sanitization
    this.app.use(sanitizeInput);

    // API versioning
    this.app.use(securityMiddleware.apiVersioning);

    // Rate limiting
    if (this.config.rateLimit.enabled) {
      this.app.use('/api/', smartRateLimit);
      this.app.use('/auth/', rateLimiters.auth);
    }

    // Request logging
    this.app.use(this.requestLogger);

    // User agent validation for API routes
    this.app.use('/api/', securityMiddleware.validateUserAgent);

    // Content type validation for POST/PUT requests
    this.app.use(['/api/', '/auth/'], securityMiddleware.validateContentType());

    logger.info('API Gateway middleware setup complete');
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    logger.info('Setting up API Gateway routes');

    // Health check endpoint (no auth required)
    this.app.get('/health', this.healthCheck);
    this.app.get('/ping', (req, res) => res.json({ pong: true, timestamp: new Date().toISOString() }));

    // API documentation
    if (this.config.enableDocs) {
      this.app.get('/docs', this.apiDocumentation);
      this.app.get('/api/v1', this.apiInfo);
    }

    // Metrics endpoint
    if (this.config.enableMetrics) {
      this.app.get('/metrics', this.metricsEndpoint);
    }

    // Authentication routes
    this.app.post('/auth/login', this.loginEndpoint);
    this.app.post('/auth/refresh', authMiddleware.authenticateJWT, authMiddleware.refreshToken);
    this.app.post('/auth/logout', authMiddleware.authenticateJWT, this.logoutEndpoint);

    // API v1 routes
    this.app.use('/api/v1/templates', authMiddleware.authenticateJWTOrAPIKey, templateRoutes);

    // Protected routes examples
    this.app.get('/api/v1/profile', 
      authMiddleware.authenticateJWT, 
      this.getProfile
    );

    this.app.get('/api/v1/admin/stats', 
      authMiddleware.authenticateJWT,
      authMiddleware.requirePermission('admin'),
      this.getAdminStats
    );

    // Catch-all for undefined routes
    this.app.use('*', this.notFoundHandler);

    logger.info('API Gateway routes setup complete');
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use(this.errorHandler);

    // Graceful shutdown handlers
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
  }

  /**
   * Request logging middleware
   */
  private requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logData = {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentLength: res.get('Content-Length')
      };

      if (res.statusCode >= 400) {
        logger.warn('API request completed with error', logData);
      } else {
        logger.info('API request completed', logData);
      }
    });

    next();
  };

  /**
   * Health check endpoint
   */
  private healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const dbManager = DatabaseManager.getInstance();
      const redisManager = RedisManager.getInstance();

      let dbHealthy = false;
      let redisHealthy = false;

      try {
        dbHealthy = dbManager.isConnected();
      } catch {}

      try {
        redisHealthy = redisManager.isConnected();
      } catch {}

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        environment: config.NODE_ENV,
        checks: {
          api: true,
          database: dbHealthy,
          redis: redisHealthy,
          memory: process.memoryUsage().heapUsed < 500 * 1024 * 1024
        }
      };

      const allHealthy = Object.values(health.checks).every(check => check === true);
      const statusCode = allHealthy ? 200 : 503;
      if (!allHealthy) health.status = 'degraded';

      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check failed', error as Error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  };

  /**
   * API documentation endpoint
   */
  private apiDocumentation = (req: Request, res: Response): void => {
    const docs = {
      title: 'Discord WhatsApp Bot API',
      version: '1.0.0',
      description: 'API for managing Discord to WhatsApp message automation',
      baseUrl: `http://${req.get('host')}`,
      endpoints: {
        authentication: {
          login: 'POST /auth/login',
          refresh: 'POST /auth/refresh',
          logout: 'POST /auth/logout'
        },
        templates: {
          list: 'GET /api/v1/templates/client/:clientId',
          create: 'POST /api/v1/templates/client/:clientId',
          get: 'GET /api/v1/templates/client/:clientId/template/:name',
          update: 'PUT /api/v1/templates/client/:clientId/:templateId',
          delete: 'DELETE /api/v1/templates/client/:clientId/:templateId',
          render: 'POST /api/v1/templates/client/:clientId/template/:name/render'
        },
        system: {
          health: 'GET /health',
          metrics: 'GET /metrics',
          docs: 'GET /docs'
        }
      },
      authentication: {
        type: 'Bearer Token (JWT)',
        header: 'Authorization: Bearer <token>'
      },
      rateLimit: {
        general: '100 requests per 15 minutes',
        auth: '10 requests per 15 minutes',
        templates: '50 requests per 5 minutes'
      }
    };

    res.json(docs);
  };

  /**
   * API info endpoint
   */
  private apiInfo = (req: Request, res: Response): void => {
    res.json({
      name: 'Discord WhatsApp Bot API',
      version: '1.0.0',
      description: 'RESTful API for Discord to WhatsApp automation',
      documentation: `http://${req.get('host')}/docs`,
      health: `http://${req.get('host')}/health`,
      timestamp: new Date().toISOString()
    });
  };

  /**
   * Metrics endpoint
   */
  private metricsEndpoint = (req: Request, res: Response): void => {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid
      }
    };

    res.json(metrics);
  };

  /**
   * Login endpoint (placeholder)
   */
  private loginEndpoint = async (req: Request, res: Response): Promise<void> => {
    try {
      const { discordUserId, email } = req.body;

      if (config.NODE_ENV === 'production') {
        res.status(501).json({
          error: 'Direct API login is not enabled in production',
          code: 'LOGIN_NOT_ENABLED'
        });
        return;
      }

      if (!discordUserId) {
        res.status(400).json({
          error: 'Discord user ID required',
          code: 'MISSING_DISCORD_USER_ID'
        });
        return;
      }

      // Generate JWT token (placeholder)
      const token = authMiddleware.generateToken({
        id: 'user_' + discordUserId,
        clientId: 'client_' + discordUserId,
        discordUserId,
        plan: 'free',
        permissions: ['user']
      });

      res.json({
        success: true,
        token,
        expiresIn: config.SECURITY.JWT_EXPIRES_IN,
        user: {
          id: 'user_' + discordUserId,
          discordUserId,
          email,
          plan: 'free'
        }
      });

      logger.info('User logged in', { discordUserId, email });
    } catch (error) {
      logger.error('Login failed', error as Error);
      res.status(500).json({
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  };

  /**
   * Logout endpoint
   */
  private logoutEndpoint = (req: Request, res: Response): void => {
    // TODO: Implement token blacklisting
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  };

  /**
   * Get user profile endpoint
   */
  private getProfile = (req: any, res: Response): void => {
    const user = req.user;
    res.json({
      success: true,
      user: {
        id: user.id,
        clientId: user.clientId,
        discordUserId: user.discordUserId,
        plan: user.plan,
        permissions: user.permissions
      }
    });
  };

  /**
   * Admin stats endpoint
   */
  private getAdminStats = (req: Request, res: Response): void => {
    // TODO: Implement actual admin statistics
    res.json({
      success: true,
      stats: {
        totalUsers: 0,
        totalTemplates: 0,
        totalMessages: 0,
        systemHealth: 'healthy'
      }
    });
  };

  /**
   * 404 handler
   */
  private notFoundHandler = (req: Request, res: Response): void => {
    logger.warn('Route not found', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(404).json({
      error: 'Route not found',
      code: 'ROUTE_NOT_FOUND',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  };

  /**
   * Global error handler
   */
  private errorHandler = (error: Error, req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id'] as string;

    logger.error('Unhandled API error', error, {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Don't expose internal errors in production
    const isDevelopment = config.NODE_ENV === 'development';

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      requestId,
      timestamp: new Date().toISOString(),
      ...(isDevelopment && { details: error.message, stack: error.stack })
    });
  };

  /**
   * Start the API Gateway server
   */
  async start(): Promise<void> {
    try {
      this.server = this.app.listen(this.config.port, this.config.host, () => {
        logger.info('API Gateway started successfully', {
          port: this.config.port,
          host: this.config.host,
          environment: config.NODE_ENV,
          pid: process.pid
        });
      });

      // Handle server errors
      this.server.on('error', (error: Error) => {
        logger.error('API Gateway server error', error);
      });

    } catch (error) {
      logger.error('Failed to start API Gateway', error as Error);
      throw error;
    }
  }

  /**
   * Stop the API Gateway server
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('API Gateway stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, starting graceful shutdown`);
    
    try {
      await this.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', error as Error);
      process.exit(1);
    }
  }

  /**
   * Get Express app instance
   */
  getApp(): Application {
    return this.app;
  }
}

export default APIGateway;
