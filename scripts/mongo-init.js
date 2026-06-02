// MongoDB initialization script
// This script runs automatically when the MongoDB container starts

// Switch to the discord-whatsapp database
db = db.getSiblingDB('discord-whatsapp');

// Create collections with validation schemas
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['discordUserId', 'plan', 'limits', 'usage', 'createdAt'],
      properties: {
        discordUserId: {
          bsonType: 'string',
          description: 'Discord user ID must be a string and is required'
        },
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          description: 'Email must be a valid email address'
        },
        plan: {
          enum: ['free', 'premium', 'enterprise'],
          description: 'Plan must be one of: free, premium, enterprise'
        },
        limits: {
          bsonType: 'object',
          required: ['messagesPerDay', 'groupsMax', 'templatesMax'],
          properties: {
            messagesPerDay: { bsonType: 'int', minimum: 0 },
            groupsMax: { bsonType: 'int', minimum: 0 },
            templatesMax: { bsonType: 'int', minimum: 0 }
          }
        },
        usage: {
          bsonType: 'object',
          required: ['messagesUsed', 'lastReset'],
          properties: {
            messagesUsed: { bsonType: 'int', minimum: 0 },
            lastReset: { bsonType: 'date' }
          }
        },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('whatsappSessions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['clientId', 'type', 'status', 'createdAt'],
      properties: {
        clientId: { bsonType: 'objectId' },
        type: {
          enum: ['web', 'business'],
          description: 'Type must be either web or business'
        },
        sessionData: { bsonType: 'string' },
        status: {
          enum: ['active', 'inactive', 'expired'],
          description: 'Status must be one of: active, inactive, expired'
        },
        deviceInfo: {
          bsonType: 'object',
          properties: {
            platform: { bsonType: 'string' },
            browser: { bsonType: 'string' },
            version: { bsonType: 'string' }
          }
        },
        lastActivity: { bsonType: 'date' },
        expiresAt: { bsonType: 'date' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('discordChannels', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['guildId', 'channelId', 'clientId', 'isActive', 'createdAt'],
      properties: {
        guildId: { bsonType: 'string' },
        channelId: { bsonType: 'string' },
        clientId: { bsonType: 'objectId' },
        isActive: { bsonType: 'bool' },
        filters: {
          bsonType: 'object',
          properties: {
            keywords: { bsonType: 'array', items: { bsonType: 'string' } },
            excludeKeywords: { bsonType: 'array', items: { bsonType: 'string' } },
            minPrice: { bsonType: 'number', minimum: 0 },
            maxPrice: { bsonType: 'number', minimum: 0 }
          }
        },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('messageQueue', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['clientId', 'content', 'destinations', 'status', 'priority', 'scheduledFor', 'attempts', 'maxAttempts', 'createdAt'],
      properties: {
        clientId: { bsonType: 'objectId' },
        content: {
          bsonType: 'object',
          required: ['text', 'template'],
          properties: {
            text: { bsonType: 'string' },
            image: { bsonType: 'string' },
            template: { bsonType: 'string' },
            variables: { bsonType: 'object' }
          }
        },
        destinations: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['type', 'identifier', 'name'],
            properties: {
              type: { enum: ['group', 'contact'] },
              identifier: { bsonType: 'string' },
              name: { bsonType: 'string' }
            }
          }
        },
        status: {
          enum: ['pending', 'processing', 'sent', 'failed'],
          description: 'Status must be one of: pending, processing, sent, failed'
        },
        priority: { bsonType: 'int', minimum: 0, maximum: 10 },
        scheduledFor: { bsonType: 'date' },
        attempts: { bsonType: 'int', minimum: 0 },
        maxAttempts: { bsonType: 'int', minimum: 1 },
        lastError: { bsonType: 'string' },
        createdAt: { bsonType: 'date' },
        processedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('templates', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['clientId', 'name', 'content', 'variables', 'isDefault', 'usage', 'createdAt'],
      properties: {
        clientId: { bsonType: 'objectId' },
        name: { bsonType: 'string', minLength: 1, maxLength: 100 },
        content: { bsonType: 'string', minLength: 1 },
        variables: { bsonType: 'array', items: { bsonType: 'string' } },
        isDefault: { bsonType: 'bool' },
        usage: {
          bsonType: 'object',
          required: ['timesUsed', 'lastUsed'],
          properties: {
            timesUsed: { bsonType: 'int', minimum: 0 },
            lastUsed: { bsonType: 'date' }
          }
        },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('destinations', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['clientId', 'type', 'identifier', 'name', 'consent', 'isActive', 'createdAt'],
      properties: {
        clientId: { bsonType: 'objectId' },
        type: { enum: ['group', 'contact'] },
        identifier: { bsonType: 'string' },
        name: { bsonType: 'string' },
        consent: {
          bsonType: 'object',
          required: ['granted', 'grantedAt', 'source', 'ipAddress'],
          properties: {
            granted: { bsonType: 'bool' },
            grantedAt: { bsonType: 'date' },
            source: { bsonType: 'string' },
            ipAddress: { bsonType: 'string' }
          }
        },
        isActive: { bsonType: 'bool' },
        lastMessageSent: { bsonType: 'date' },
        createdAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('systemLogs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['level', 'service', 'message', 'metadata', 'timestamp', 'traceId'],
      properties: {
        level: { enum: ['info', 'warn', 'error', 'debug'] },
        service: { bsonType: 'string' },
        clientId: { bsonType: 'objectId' },
        message: { bsonType: 'string' },
        metadata: { bsonType: 'object' },
        timestamp: { bsonType: 'date' },
        traceId: { bsonType: 'string' }
      }
    }
  }
});

// Create indexes for optimal performance
print('Creating indexes...');

// Users indexes
db.users.createIndex({ discordUserId: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
db.users.createIndex({ plan: 1 });
db.users.createIndex({ createdAt: 1 });

// WhatsApp Sessions indexes
db.whatsappSessions.createIndex({ clientId: 1 });
db.whatsappSessions.createIndex({ status: 1 });
db.whatsappSessions.createIndex({ expiresAt: 1 });
db.whatsappSessions.createIndex({ lastActivity: 1 });

// Discord Channels indexes
db.discordChannels.createIndex({ guildId: 1, channelId: 1 }, { unique: true });
db.discordChannels.createIndex({ clientId: 1 });
db.discordChannels.createIndex({ isActive: 1 });

// Message Queue indexes
db.messageQueue.createIndex({ clientId: 1 });
db.messageQueue.createIndex({ status: 1 });
db.messageQueue.createIndex({ priority: -1, scheduledFor: 1 });
db.messageQueue.createIndex({ createdAt: 1 });
db.messageQueue.createIndex({ scheduledFor: 1 });

// Templates indexes
db.templates.createIndex({ clientId: 1 });
db.templates.createIndex({ name: 1, clientId: 1 }, { unique: true });
db.templates.createIndex({ isDefault: 1 });

// Destinations indexes
db.destinations.createIndex({ clientId: 1 });
db.destinations.createIndex({ identifier: 1, clientId: 1 }, { unique: true });
db.destinations.createIndex({ type: 1 });
db.destinations.createIndex({ isActive: 1 });
db.destinations.createIndex({ 'consent.granted': 1 });

// System Logs indexes
db.systemLogs.createIndex({ timestamp: -1 });
db.systemLogs.createIndex({ level: 1 });
db.systemLogs.createIndex({ service: 1 });
db.systemLogs.createIndex({ clientId: 1 });
db.systemLogs.createIndex({ traceId: 1 });

// TTL index for log cleanup (30 days)
db.systemLogs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

// Create default templates
print('Creating default templates...');

db.templates.insertMany([
  {
    clientId: null, // Global template
    name: 'game-promotion',
    content: '🎮 {title}\n💰 {price} {discount}\n🛒 {purchaseLink}\n⭐ {wishlistLink}\n📸 {image}',
    variables: ['title', 'price', 'discount', 'purchaseLink', 'wishlistLink', 'image'],
    isDefault: true,
    usage: {
      timesUsed: 0,
      lastUsed: new Date()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    clientId: null, // Global template
    name: 'news-update',
    content: '📰 {title}\n📝 {summary}\n🔗 {readMoreLink}',
    variables: ['title', 'summary', 'readMoreLink'],
    isDefault: true,
    usage: {
      timesUsed: 0,
      lastUsed: new Date()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    clientId: null, // Global template
    name: 'simple-message',
    content: '{message}',
    variables: ['message'],
    isDefault: true,
    usage: {
      timesUsed: 0,
      lastUsed: new Date()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Create system configuration collection
db.createCollection('systemConfig');

db.systemConfig.insertOne({
  _id: 'app-config',
  version: '1.0.0',
  initialized: true,
  initDate: new Date(),
  features: {
    autoReconnect: true,
    gracefulShutdown: true,
    autoScale: true,
    circuitBreaker: true,
    metricsCollection: true,
    healthMonitoring: true
  },
  limits: {
    free: {
      messagesPerDay: 50,
      groupsMax: 3,
      templatesMax: 5
    },
    premium: {
      messagesPerDay: 500,
      groupsMax: 10,
      templatesMax: 20
    },
    enterprise: {
      messagesPerDay: -1, // unlimited
      groupsMax: -1, // unlimited
      templatesMax: -1 // unlimited
    }
  }
});

print('MongoDB initialization completed successfully!');
print('Collections created: users, whatsappSessions, discordChannels, messageQueue, templates, destinations, systemLogs, systemConfig');
print('Indexes created for optimal performance');
print('Default templates and configuration inserted');