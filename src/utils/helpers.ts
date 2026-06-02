/**
 * Utility functions to prevent [object Object] errors
 */

/**
 * Safely stringify any value, preventing [object Object] errors
 */
export function safeStringify(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return `[Object: ${value.constructor?.name || 'Unknown'}]`;
    }
  }
  
  return String(value);
}

/**
 * Safely log any value without [object Object] errors
 */
export function safeLog(message: string, data?: any): void {
  if (data !== undefined) {
    console.log(`${message}:`, safeStringify(data));
  } else {
    console.log(message);
  }
}

/**
 * Create a safe error message
 */
export function createErrorMessage(error: any): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return safeStringify(error);
}

/**
 * Safely format objects for Discord messages
 */
export function formatForDiscord(data: any): string {
  if (typeof data === 'string') {
    return data;
  }
  
  if (typeof data === 'object' && data !== null) {
    try {
      // Format as code block for better readability
      return '```json\n' + JSON.stringify(data, null, 2) + '\n```';
    } catch (error) {
      return `[Object: ${data.constructor?.name || 'Unknown'}]`;
    }
  }
  
  return String(data);
}

/**
 * Truncate long strings for Discord (2000 char limit)
 */
export function truncateForDiscord(text: string, maxLength: number = 1900): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength) + '\n... (truncated)';
}

/**
 * Validate and sanitize environment variables
 */
export function validateEnvVar(name: string, value: string | undefined, required: boolean = true): string {
  if (!value || value.trim() === '') {
    if (required) {
      throw new Error(`Environment variable ${name} is required but not set`);
    }
    return '';
  }
  
  // Remove quotes if present
  return value.replace(/^["']|["']$/g, '').trim();
}

/**
 * Create a safe timeout promise
 */
export function createTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage?: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Deep clone an object safely
 */
export function safeClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    // Fallback for objects that can't be JSON serialized
    return { ...obj } as T;
  }
}

/**
 * Check if a value is a plain object
 */
export function isPlainObject(value: any): boolean {
  return value !== null && 
         typeof value === 'object' && 
         value.constructor === Object;
}

/**
 * Merge objects safely
 */
export function safeMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  const result = safeClone(target);
  
  for (const source of sources) {
    if (isPlainObject(source)) {
      Object.assign(result, source);
    }
  }
  
  return result;
}