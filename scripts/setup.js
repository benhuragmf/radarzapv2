#!/usr/bin/env node

/**
 * Autonomous setup script for Discord-WhatsApp Bot
 * This script runs automatically in the auto-setup container
 */

const { MongoClient } = require('mongodb');
const Redis = require('ioredis');

class AutoSetup {
  constructor() {
    this.mongoUrl = process.env.MONGODB_URL;
    this.redisUrl = process.env.REDIS_URL;
    this.setupTimeout = parseInt(process.env.SETUP_TIMEOUT || '300000');
    this.retryDelay = 5000; // 5 seconds
    this.maxRetries = 60; // 5 minutes total
  }

  async run() {
    console.log('🚀 Starting autonomous setup...');
    
    try {
      // Set timeout for entire setup process
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Setup timeout reached')), this.setupTimeout);
      });

      await Promise.race([
        this.performSetup(),
        timeoutPromise
      ]);

      console.log('✅ Autonomous setup completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      process.exit(1);
    }
  }

  async performSetup() {
    // Wait for dependencies to be ready
    await this.waitForDependencies();
    
    // Initialize database
    await this.initializeDatabase();
    
    // Initialize Redis
    await this.initializeRedis();
    
    // Verify setup
    await this.verifySetup();
  }

  async waitForDependencies() {
    console.log('⏳ Waiting for dependencies...');
    
    await Promise.all([
      this.waitForMongoDB(),
      this.waitForRedis()
    ]);
    
    console.log('✅ All dependencies are ready');
  }

  async waitForMongoDB() {
    console.log('⏳ Waiting for MongoDB...');
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const client = new MongoClient(this.mongoUrl);
        await client.connect();
        await client.db().admin().ping();
        await client.close();
        
        console.log('✅ MongoDB is ready');
        return;
      } catch (error) {
        console.log(`MongoDB attempt ${attempt}/${this.maxRetries} failed: ${error.message}`);
        
        if (attempt === this.maxRetries) {
          throw new Error('MongoDB connection timeout');
        }
        
        await this.sleep(this.retryDelay);
      }
    }
  }

  async waitForRedis() {
    console.log('⏳ Waiting for Redis...');
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const redis = new Redis(this.redisUrl);
        await redis.ping();
        await redis.disconnect();
        
        console.log('✅ Redis is ready');
        return;
      } catch (error) {
        console.log(`Redis attempt ${attempt}/${this.maxRetries} failed: ${error.message}`);
        
        if (attempt === this.maxRetries) {
          throw new Error('Redis connection timeout');
        }
        
        await this.sleep(this.retryDelay);
      }
    }
  }

  async initializeDatabase() {
    console.log('🔧 Initializing database...');
    
    const client = new MongoClient(this.mongoUrl);
    
    try {
      await client.connect();
      const db = client.db();
      
      // Check if already initialized
      const config = await db.collection('systemConfig').findOne({ _id: 'app-config' });
      if (config && config.initialized) {
        console.log('✅ Database already initialized');
        return;
      }
      
      // Create additional indexes if needed
      await this.createAdditionalIndexes(db);
      
      // Insert initial system data
      await this.insertInitialData(db);
      
      console.log('✅ Database initialization completed');
    } finally {
      await client.close();
    }
  }

  async createAdditionalIndexes(db) {
    console.log('📊 Creating additional indexes...');
    
    // Performance optimization indexes
    await db.collection('messageQueue').createIndex(
      { status: 1, priority: -1, scheduledFor: 1 },
      { name: 'queue_processing_idx' }
    );
    
    await db.collection('whatsappSessions').createIndex(
      { clientId: 1, status: 1 },
      { name: 'session_lookup_idx' }
    );
    
    await db.collection('systemLogs').createIndex(
      { service: 1, level: 1, timestamp: -1 },
      { name: 'log_analysis_idx' }
    );
    
    console.log('✅ Additional indexes created');
  }

  async insertInitialData(db) {
    console.log('📝 Inserting initial system data...');
    
    // Update system configuration
    await db.collection('systemConfig').updateOne(
      { _id: 'app-config' },
      {
        $set: {
          initialized: true,
          setupDate: new Date(),
          version: '1.0.0',
          autoSetupCompleted: true
        }
      },
      { upsert: true }
    );
    
    // Create system user for internal operations
    await db.collection('users').updateOne(
      { discordUserId: 'system' },
      {
        $set: {
          discordUserId: 'system',
          email: 'system@discord-whatsapp-bot.local',
          plan: 'enterprise',
          limits: {
            messagesPerDay: -1,
            groupsMax: -1,
            templatesMax: -1
          },
          usage: {
            messagesUsed: 0,
            lastReset: new Date()
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log('✅ Initial system data inserted');
  }

  async initializeRedis() {
    console.log('🔧 Initializing Redis...');
    
    const redis = new Redis(this.redisUrl);
    
    try {
      // Clear any existing data (fresh start)
      await redis.flushdb();
      
      // Set initial configuration
      await redis.hset('system:config', {
        initialized: 'true',
        setupDate: new Date().toISOString(),
        version: '1.0.0'
      });
      
      // Initialize queue statistics
      await redis.hset('queue:stats', {
        pending: '0',
        processing: '0',
        completed: '0',
        failed: '0',
        total_processed: '0'
      });
      
      // Set up rate limiting structure
      await redis.set('rate_limit:global:setup', '1', 'EX', 3600);
      
      console.log('✅ Redis initialization completed');
    } finally {
      await redis.disconnect();
    }
  }

  async verifySetup() {
    console.log('🔍 Verifying setup...');
    
    // Verify MongoDB
    const mongoClient = new MongoClient(this.mongoUrl);
    try {
      await mongoClient.connect();
      const db = mongoClient.db();
      
      const config = await db.collection('systemConfig').findOne({ _id: 'app-config' });
      if (!config || !config.initialized) {
        throw new Error('MongoDB setup verification failed');
      }
      
      const collections = await db.listCollections().toArray();
      const expectedCollections = [
        'users', 'whatsappSessions', 'discordChannels', 
        'messageQueue', 'templates', 'destinations', 
        'systemLogs', 'systemConfig'
      ];
      
      for (const expected of expectedCollections) {
        if (!collections.find(c => c.name === expected)) {
          throw new Error(`Missing collection: ${expected}`);
        }
      }
      
      console.log('✅ MongoDB verification passed');
    } finally {
      await mongoClient.close();
    }
    
    // Verify Redis
    const redis = new Redis(this.redisUrl);
    try {
      const initialized = await redis.hget('system:config', 'initialized');
      if (initialized !== 'true') {
        throw new Error('Redis setup verification failed');
      }
      
      console.log('✅ Redis verification passed');
    } finally {
      await redis.disconnect();
    }
    
    console.log('✅ Setup verification completed');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the setup
const setup = new AutoSetup();
setup.run();