import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '@/config/environment';
import { createServiceLogger } from '@/utils/logger';
import { ApiKey } from '@/models/ApiKey';
import { Organization } from '@/models/Organization';
import { User } from '@/models/User';
import { hashApiKey } from '@/utils/api-key';

const logger = createServiceLogger('AuthMiddleware');

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    clientId: string;
    discordUserId: string;
    plan: 'free' | 'premium' | 'enterprise';
    permissions: string[];
    iat: number;
    exp: number;
  };
  [key: string]: any;
}

export interface JWTPayload {
  id: string;
  clientId: string;
  discordUserId: string;
  plan: 'free' | 'premium' | 'enterprise';
  permissions: string[];
  iat: number;
  exp: number;
}

/**
 * JWT Authentication Middleware
 */
export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        error: 'Authorization header missing',
        code: 'MISSING_AUTH_HEADER'
      });
      return;
    }

    const token = authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      res.status(401).json({
        error: 'Token missing from authorization header',
        code: 'MISSING_TOKEN'
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.SECURITY.JWT_SECRET) as JWTPayload;
    
    // Attach user info to request
    req.user = decoded;
    
    logger.debug('JWT authentication successful', {
      userId: decoded.id,
      clientId: decoded.clientId,
      plan: decoded.plan
    });

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    } else {
      logger.error('JWT authentication error', error as Error);
      res.status(500).json({
        error: 'Authentication error',
        code: 'AUTH_ERROR'
      });
    }
  }
};

/**
 * Optional JWT Authentication (doesn't fail if no token)
 */
export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      next();
      return;
    }

    // Try to verify token
    const decoded = jwt.verify(token, config.SECURITY.JWT_SECRET) as JWTPayload;
    req.user = decoded;
    
    logger.debug('Optional JWT authentication successful', {
      userId: decoded.id,
      clientId: decoded.clientId
    });

    next();
  } catch (error) {
    // Don't fail on optional auth, just log and continue
    logger.debug('Optional JWT authentication failed', error as Error);
    next();
  }
};

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    if (!req.user.permissions.includes(permission) && !req.user.permissions.includes('admin')) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission
      });
      return;
    }

    logger.debug('Permission check passed', {
      userId: req.user.id,
      permission,
      userPermissions: req.user.permissions
    });

    next();
  };
};

/**
 * Plan-based authorization middleware
 */
export const requirePlan = (requiredPlan: 'free' | 'premium' | 'enterprise') => {
  const planHierarchy = { free: 0, premium: 1, enterprise: 2 };
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const userPlanLevel = planHierarchy[req.user.plan];
    const requiredPlanLevel = planHierarchy[requiredPlan];

    if (userPlanLevel < requiredPlanLevel) {
      res.status(403).json({
        error: 'Plan upgrade required',
        code: 'PLAN_UPGRADE_REQUIRED',
        currentPlan: req.user.plan,
        requiredPlan
      });
      return;
    }

    logger.debug('Plan check passed', {
      userId: req.user.id,
      userPlan: req.user.plan,
      requiredPlan
    });

    next();
  };
};

/**
 * Client ownership validation middleware
 */
export const validateClientOwnership = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  const { clientId } = req.params;
  
  if (!clientId) {
    res.status(400).json({
      error: 'Client ID required',
      code: 'MISSING_CLIENT_ID'
    });
    return;
  }

  // Check if user owns this client or has admin permissions
  if (req.user.clientId !== clientId && !req.user.permissions.includes('admin')) {
    res.status(403).json({
      error: 'Access denied to this client',
      code: 'CLIENT_ACCESS_DENIED'
    });
    return;
  }

  logger.debug('Client ownership validated', {
    userId: req.user.id,
    clientId,
    userClientId: req.user.clientId
  });

  next();
};

/**
 * Generate JWT token
 */
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  try {
    const token = jwt.sign(
      payload,
      config.SECURITY.JWT_SECRET as string,
      { expiresIn: config.SECURITY.JWT_EXPIRES_IN } as jwt.SignOptions
    );

    logger.info('JWT token generated', {
      userId: payload.id,
      clientId: payload.clientId,
      plan: payload.plan
    });

    return token;
  } catch (error) {
    logger.error('Failed to generate JWT token', error as Error, { payload });
    throw new Error('Token generation failed');
  }
};

/**
 * Refresh JWT token
 */
export const refreshToken = (req: AuthenticatedRequest, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Generate new token with same payload (excluding iat/exp)
    const newToken = generateToken({
      id: req.user.id,
      clientId: req.user.clientId,
      discordUserId: req.user.discordUserId,
      plan: req.user.plan,
      permissions: req.user.permissions
    });

    res.json({
      success: true,
      token: newToken,
      expiresIn: config.SECURITY.JWT_EXPIRES_IN
    });

    logger.info('JWT token refreshed', {
      userId: req.user.id,
      clientId: req.user.clientId
    });
  } catch (error) {
    logger.error('Failed to refresh JWT token', error as Error);
    res.status(500).json({
      error: 'Token refresh failed',
      code: 'TOKEN_REFRESH_ERROR'
    });
  }
};

/**
 * API Key authentication middleware (alternative to JWT)
 */
export const authenticateAPIKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({
        error: 'API key missing',
        code: 'MISSING_API_KEY'
      });
      return;
    }

    if (!apiKey.startsWith('rz_') || apiKey.length < 32) {
      res.status(401).json({
        error: 'Invalid API key format',
        code: 'INVALID_API_KEY'
      });
      return;
    }

    const keyHash = hashApiKey(apiKey);
    const keyDoc = await ApiKey.findOne({ keyHash, active: true });

    if (!keyDoc) {
      const devBypass =
        config.NODE_ENV !== 'production' &&
        process.env.ALLOW_DEV_API_KEY_BYPASS === 'true';
      if (devBypass) {
        logger.warn('ALLOW_DEV_API_KEY_BYPASS ativo — não usar em staging compartilhado');
        req.user = {
          id: 'api-user',
          clientId: 'api-client',
          discordUserId: 'api-discord',
          plan: 'premium',
          permissions: ['api_access'],
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400
        };
        next();
        return;
      }

      res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
      return;
    }

    const organization = await Organization.findById(keyDoc.organizationId);
    if (!organization) {
      res.status(401).json({
        error: 'Invalid API key organization',
        code: 'INVALID_API_KEY_ORGANIZATION'
      });
      return;
    }

    const owner = await User.findById(organization.ownerUserId);
    if (!owner) {
      res.status(401).json({
        error: 'Invalid API key owner',
        code: 'INVALID_API_KEY_OWNER'
      });
      return;
    }

    keyDoc.lastUsedAt = new Date();
    await keyDoc.save();

    const plan = organization.plan === 'enterprise'
      ? 'enterprise'
      : organization.plan === 'free'
        ? 'free'
        : 'premium';

    req.user = {
      id: String(owner._id),
      clientId: String(organization._id),
      discordUserId: owner.discordUserId,
      plan,
      permissions: ['api_access'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400
    };

    logger.debug('API key authentication successful', {
      apiKey: apiKey.substring(0, 8) + '...',
      clientId: req.user.clientId
    });

    next();
  } catch (error) {
    logger.error('API key authentication error', error as Error);
    res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

export const authenticateJWTOrAPIKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  if (req.headers['x-api-key']) {
    await authenticateAPIKey(req, res, next);
    return;
  }
  authenticateJWT(req, res, next);
};

export default {
  authenticateJWT,
  authenticateJWTOrAPIKey,
  optionalAuth,
  requirePermission,
  requirePlan,
  validateClientOwnership,
  generateToken,
  refreshToken,
  authenticateAPIKey
};
