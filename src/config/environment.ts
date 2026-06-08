import { config as dotenvConfig } from 'dotenv';
import path from 'path';

// Load environment variables from project root .env
dotenvConfig({ path: path.resolve(process.cwd(), '.env') });

export interface AppConfig {
  // Server Configuration
  PORT: number;
  NODE_ENV: string;
  SERVICE_NAME?: string;
  
  // API Configuration
  API: {
    PORT: number;
    HOST: string;
  };
  
  // CORS Configuration
  CORS_ORIGIN: string;

  /** Painel web (OAuth redirect + cookies devem usar a mesma origem do browser) */
  DASHBOARD: {
    PORT: number;
    FRONTEND_URL: string;
  };
  
  // Discord Configuration
  DISCORD: {
    TOKEN: string;
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    ENABLE_SLASH_COMMANDS: boolean;
    AUTO_RECONNECT: boolean;
    MAX_RECONNECT_ATTEMPTS: number;
  };

  GOOGLE: {
    CLIENT_ID: string;
    CLIENT_SECRET: string;
  };
  
  // Database Configuration
  DATABASE: {
    URL: string;
    MONGODB_URL: string;
    MONGO_PASSWORD: string;
    CONNECTION_TIMEOUT: number;
    MAX_POOL_SIZE: number;
    OPTIONS: Record<string, any>;
  };
  
  // Redis Configuration
  REDIS: {
    URL: string;
    PASSWORD?: string;
    MAX_RETRIES: number;
    RETRY_DELAY: number;
    OPTIONS: Record<string, any>;
  };
  
  // Queue Configuration
  QUEUE: {
    REDIS_KEY_PREFIX: string;
    MAX_RETRY: number;
    DELAY_MULTIPLIER: number;
    CONCURRENCY: number;
    MAX_JOBS: number;
  };
  
  // WhatsApp Configuration
  WHATSAPP: {
    SESSION_TIMEOUT: number;
    RECONNECT_ATTEMPTS: number;
    HEADLESS: boolean;
    RATE_LIMIT_MESSAGES_PER_MINUTE: number;
    /** Máximo de QR codes antes de abortar (Evolution QRCODE.LIMIT) */
    QRCODE_LIMIT: number;
    /** Tempo máximo aguardando QR na API connect (ms) */
    CONNECT_QR_WAIT_MS: number;
  };
  
  // Security Configuration
  SECURITY: {
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    SESSION_SECRET: string;
    BCRYPT_ROUNDS: number;
    COOKIE_SECURE: boolean;
    COOKIE_HTTP_ONLY: boolean;
  };
  
  // Logging Configuration
  LOGGING: {
    LEVEL: string;
    FORMAT: string;
    ENABLE_CONSOLE: boolean;
    ENABLE_FILE: boolean;
    ENABLE_DATABASE: boolean;
  };
  
  // Rate Limiting Configuration
  RATE_LIMIT: {
    MAX_REQUESTS: number;
    WINDOW_MS: number;
    SKIP_FAILED_REQUESTS: boolean;
    REDIS_KEY_PREFIX: string;
  };
  
  // Health Check Configuration
  HEALTH: {
    CHECK_INTERVAL: number;
    TIMEOUT: number;
    RETRIES: number;
  };
}

/**
 * Parse boolean from environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse number from environment variable
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get required environment variable
 */
function getRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
function getOptional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/** `npm run dev` sempre usa pretty; produção/docker usa JSON salvo em LOG_FORMAT. */
function resolveLogFormat(): string {
  if (process.env.npm_lifecycle_event === 'dev') {
    return 'pretty';
  }
  const explicit = process.env.LOG_FORMAT?.trim();
  if (explicit) return explicit;
  return process.env.NODE_ENV === 'production' ? 'json' : 'pretty';
}

/**
 * Application configuration
 */
export const config: AppConfig = {
  // Server Configuration
  PORT: parseNumber(process.env.PORT, 8080),
  NODE_ENV: getOptional('NODE_ENV', 'development'),
  SERVICE_NAME: process.env.SERVICE_NAME,
  
  // API Configuration
  API: {
    PORT: parseNumber(process.env.API_PORT, 3000),
    HOST: getOptional('API_HOST', '0.0.0.0')
  },
  
  // CORS Configuration
  CORS_ORIGIN: getOptional('CORS_ORIGIN', 'http://localhost:3001'),

  DASHBOARD: {
    PORT: parseNumber(process.env.DASHBOARD_PORT, 3001),
    /** URL que o usuário abre no browser (5174 = Vite dev; 3001 = só npm run dev) */
    FRONTEND_URL: getOptional('FRONTEND_URL', 'http://localhost:5174').replace(/\/$/, ''),
  },
  
  // Discord Configuration
  DISCORD: {
    TOKEN: getOptional('DISCORD_TOKEN', ''),
    CLIENT_ID: getOptional('DISCORD_CLIENT_ID', ''),
    CLIENT_SECRET: getOptional('DISCORD_CLIENT_SECRET', ''),
    ENABLE_SLASH_COMMANDS: parseBoolean(process.env.DISCORD_ENABLE_SLASH_COMMANDS, true),
    AUTO_RECONNECT: parseBoolean(process.env.DISCORD_AUTO_RECONNECT, true),
    MAX_RECONNECT_ATTEMPTS: parseNumber(process.env.DISCORD_MAX_RECONNECT_ATTEMPTS, 5)
  },

  GOOGLE: {
    CLIENT_ID: getOptional('GOOGLE_CLIENT_ID', ''),
    CLIENT_SECRET: getOptional('GOOGLE_CLIENT_SECRET', ''),
  },
  
  // Database Configuration
  DATABASE: {
    URL: getOptional('MONGODB_URL', 'mongodb://localhost:27017/discord-whatsapp'),
    MONGODB_URL: getOptional('MONGODB_URL', 'mongodb://localhost:27017/discord-whatsapp'),
    MONGO_PASSWORD: getOptional('MONGO_PASSWORD', ''),
    CONNECTION_TIMEOUT: parseNumber(process.env.DB_CONNECTION_TIMEOUT, 10000),
    MAX_POOL_SIZE: parseNumber(process.env.DB_MAX_POOL_SIZE, 10),
    OPTIONS: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: parseNumber(process.env.DB_CONNECTION_TIMEOUT, 10000),
      maxPoolSize: parseNumber(process.env.DB_MAX_POOL_SIZE, 10)
    }
  },
  
  // Redis Configuration
  REDIS: {
    URL: getOptional('REDIS_URL', 'redis://localhost:6379'),
    PASSWORD: process.env.REDIS_PASSWORD,
    MAX_RETRIES: parseNumber(process.env.REDIS_MAX_RETRIES, 3),
    RETRY_DELAY: parseNumber(process.env.REDIS_RETRY_DELAY, 1000),
    OPTIONS: {
      connectTimeout: parseNumber(process.env.REDIS_CONNECT_TIMEOUT, 10000),
      lazyConnect: true,
      maxRetriesPerRequest: 3
    }
  },
  
  // Queue Configuration
  QUEUE: {
    REDIS_KEY_PREFIX: getOptional('QUEUE_REDIS_KEY_PREFIX', 'discord-whatsapp:'),
    MAX_RETRY: parseNumber(process.env.QUEUE_MAX_RETRY, 3),
    DELAY_MULTIPLIER: parseNumber(process.env.QUEUE_DELAY_MULTIPLIER, 2000),
    CONCURRENCY: parseNumber(process.env.QUEUE_CONCURRENCY, 2),
    MAX_JOBS: parseNumber(process.env.QUEUE_MAX_JOBS, 1000)
  },
  
  // WhatsApp Configuration
  WHATSAPP: {
    SESSION_TIMEOUT: parseNumber(process.env.WHATSAPP_SESSION_TIMEOUT, 30 * 24 * 60 * 60 * 1000), // 30 days
    RECONNECT_ATTEMPTS: parseNumber(process.env.WHATSAPP_RECONNECT_ATTEMPTS, 3),
    HEADLESS: parseBoolean(process.env.WHATSAPP_HEADLESS, true),
    RATE_LIMIT_MESSAGES_PER_MINUTE: parseNumber(process.env.WHATSAPP_RATE_LIMIT, 20),
    QRCODE_LIMIT: parseNumber(process.env.WHATSAPP_QRCODE_LIMIT, 6),
    CONNECT_QR_WAIT_MS: parseNumber(process.env.WHATSAPP_CONNECT_QR_WAIT_MS, 5000),
  },
  
  // Security Configuration
  SECURITY: {
    JWT_SECRET: getOptional('JWT_SECRET', 'your-super-secret-jwt-key-change-in-production'),
    JWT_EXPIRES_IN: getOptional('JWT_EXPIRES_IN', '7d'),
    SESSION_SECRET: getOptional('SESSION_SECRET', 'your-super-secret-session-key-change-in-production'),
    BCRYPT_ROUNDS: parseNumber(process.env.BCRYPT_ROUNDS, 12),
    COOKIE_SECURE: parseBoolean(process.env.COOKIE_SECURE, false),
    COOKIE_HTTP_ONLY: parseBoolean(process.env.COOKIE_HTTP_ONLY, true)
  },
  
  // Logging Configuration
  LOGGING: {
    LEVEL: getOptional('LOG_LEVEL', 'info'),
    FORMAT: resolveLogFormat(),
    ENABLE_CONSOLE: parseBoolean(process.env.LOG_ENABLE_CONSOLE, true),
    ENABLE_FILE: parseBoolean(process.env.LOG_ENABLE_FILE, false),
    ENABLE_DATABASE: parseBoolean(process.env.LOG_ENABLE_DATABASE, false)
  },
  
  // Rate Limiting Configuration
  RATE_LIMIT: {
    MAX_REQUESTS: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 50),
    WINDOW_MS: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 900000), // 15 minutes
    SKIP_FAILED_REQUESTS: parseBoolean(process.env.RATE_LIMIT_SKIP_FAILED_REQUESTS, false),
    REDIS_KEY_PREFIX: getOptional('RATE_LIMIT_REDIS_KEY_PREFIX', 'rate_limit:')
  },
  
  // Health Check Configuration
  HEALTH: {
    CHECK_INTERVAL: parseNumber(process.env.HEALTH_CHECK_INTERVAL, 30000), // 30 seconds
    TIMEOUT: parseNumber(process.env.HEALTH_CHECK_TIMEOUT, 10000), // 10 seconds
    RETRIES: parseNumber(process.env.HEALTH_CHECK_RETRIES, 3)
  }
};

/**
 * Validate service-specific configuration
 */
export function validateServiceConfig(serviceName: string): void {
  const errors: string[] = [];
  
  switch (serviceName) {
    case 'discord-bot':
      if (!config.DISCORD.TOKEN) {
        errors.push('DISCORD_TOKEN is required for discord-bot service');
      }
      if (!config.DISCORD.CLIENT_ID) {
        errors.push('DISCORD_CLIENT_ID is required for discord-bot service');
      }
      break;
      
    case 'whatsapp-service':
      if (config.WHATSAPP.SESSION_TIMEOUT < 60000) {
        errors.push('WHATSAPP_SESSION_TIMEOUT should be at least 60000ms (1 minute)');
      }
      break;
      
    case 'queue-processor':
      if (config.QUEUE.CONCURRENCY < 1) {
        errors.push('QUEUE_CONCURRENCY should be at least 1');
      }
      break;
  }
  
  if (errors.length > 0) {
    throw new Error(`Service configuration validation failed for ${serviceName}:\n${errors.join('\n')}`);
  }
}

/**
 * Validate configuration
 */
export function validateConfig(): void {
  const errors: string[] = [];
  
  // Validate required Discord configuration in production
  if (config.NODE_ENV === 'production') {
    if (!config.DISCORD.TOKEN) {
      errors.push('DISCORD_TOKEN is required in production');
    }
    
    if (!config.DISCORD.CLIENT_ID) {
      errors.push('DISCORD_CLIENT_ID is required in production');
    }
    
    if (!config.DATABASE.MONGODB_URL) {
      errors.push('MONGODB_URL is required in production');
    }
    
    if (config.SECURITY.JWT_SECRET.includes('change-in-production')) {
      errors.push('JWT_SECRET must be changed in production');
    }
    
    if (config.SECURITY.SESSION_SECRET.includes('change-in-production')) {
      errors.push('SESSION_SECRET must be changed in production');
    }

    if (config.SECURITY.SESSION_SECRET.length < 32) {
      errors.push('SESSION_SECRET must be at least 32 characters in production');
    }

    if (!process.env.SESSION_ENCRYPTION_KEY || process.env.SESSION_ENCRYPTION_KEY.length < 32) {
      errors.push('SESSION_ENCRYPTION_KEY must be set with at least 32 characters in production');
    }

    if (!config.SECURITY.COOKIE_SECURE) {
      errors.push('COOKIE_SECURE must be true in production');
    }
  }
  
  // Validate numeric ranges
  if (config.PORT < 1 || config.PORT > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }
  
  if (config.SECURITY.BCRYPT_ROUNDS < 10 || config.SECURITY.BCRYPT_ROUNDS > 15) {
    errors.push('BCRYPT_ROUNDS should be between 10 and 15');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Get configuration summary for logging
 */
export function getConfigSummary(): Record<string, any> {
  return {
    NODE_ENV: config.NODE_ENV,
    PORT: config.PORT,
    DISCORD_CONFIGURED: !!config.DISCORD.TOKEN,
    DATABASE_CONFIGURED: !!config.DATABASE.MONGODB_URL,
    REDIS_CONFIGURED: !!config.REDIS.URL,
    LOGGING_LEVEL: config.LOGGING.LEVEL,
    HEALTH_CHECK_INTERVAL: config.HEALTH.CHECK_INTERVAL
  };
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return config.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return config.NODE_ENV === 'production';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return config.NODE_ENV === 'test';
}

export default config;
