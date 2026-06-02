/**
 * API Gateway Module
 * 
 * Provides a secure, scalable API gateway with:
 * - JWT Authentication and authorization
 * - Rate limiting with plan-based limits
 * - Request validation and sanitization
 * - CORS and security headers
 * - Comprehensive logging and monitoring
 * - Auto-generated API documentation
 * - Error handling and graceful shutdown
 */

export { APIGateway } from './APIGateway';
export type { APIGatewayConfig } from './APIGateway';

// Re-export middleware for external use
export { default as authMiddleware } from '@/middleware/auth';
export { default as rateLimitMiddleware } from '@/middleware/rateLimiter';
export { default as validationMiddleware } from '@/middleware/validation';
export { default as securityMiddleware } from '@/middleware/security';

// Type exports
export type { AuthenticatedRequest, JWTPayload } from '@/middleware/auth';