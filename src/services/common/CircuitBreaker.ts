import { logger, createServiceLogger } from '@/utils/logger';

/**
 * Circuit Breaker pattern implementation for service resilience
 */
export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private serviceLogger = createServiceLogger('CircuitBreaker');

  constructor(
    private serviceName: string,
    private options: {
      failureThreshold: number;
      recoveryTimeout: number;
      monitorTimeout: number;
      successThreshold?: number;
    }
  ) {
    this.options.successThreshold = this.options.successThreshold || 3;
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.successCount++;

    if (this.state === 'half-open') {
      if (this.successCount >= this.options.successThreshold!) {
        this.state = 'closed';
        this.successCount = 0;
        this.serviceLogger.info(`Circuit breaker closed for ${this.serviceName}`);
      }
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.state === 'closed' && this.failureCount >= this.options.failureThreshold) {
      this.state = 'open';
      this.serviceLogger.warn(`Circuit breaker opened for ${this.serviceName} after ${this.failureCount} failures`);
    } else if (this.state === 'half-open') {
      this.state = 'open';
      this.serviceLogger.warn(`Circuit breaker reopened for ${this.serviceName}`);
    }
  }

  /**
   * Check if operation should be allowed
   */
  canExecute(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.options.recoveryTimeout) {
        this.state = 'half-open';
        this.successCount = 0;
        this.serviceLogger.info(`Circuit breaker half-opened for ${this.serviceName}`);
        return true;
      }
      return false;
    }

    // half-open state
    return true;
  }

  /**
   * Get current state
   */
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats(): any {
    return {
      serviceName: this.serviceName,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      options: this.options
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.serviceLogger.info(`Circuit breaker reset for ${this.serviceName}`);
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Get last failure time
   */
  getLastFailureTime(): number {
    return this.lastFailureTime;
  }
}