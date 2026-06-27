import { WhatsAppService } from '../WhatsAppService';
import { SessionCache } from '@/cache/SessionCache';
import { QueueManager } from '@/cache/QueueManager';
import { RateLimiter } from '@/cache/RateLimiter';
import { WhatsAppSession, User, Destination, Organization } from '@/models';
import { CircuitBreaker } from '../../common/CircuitBreaker';
import mongoose from 'mongoose';

// A valid ObjectId string to use as clientId throughout the tests
const TEST_CLIENT_ID = new mongoose.Types.ObjectId().toHexString();

function mockConnectedSocket(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'test@s.whatsapp.net' },
    sendMessage: jest.fn().mockResolvedValue({ key: { id: 'msg-id' } }),
    onWhatsApp: jest.fn().mockResolvedValue([{ exists: true, jid: '1234567890@s.whatsapp.net' }]),
    ...overrides,
  };
}

// Mock dependencies
jest.mock('@/cache/SessionCache');
jest.mock('@/cache/QueueManager');
jest.mock('@/cache/RateLimiter');
jest.mock('@/models', () => ({
  WhatsAppSession: {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  User: {
    findById: jest.fn(),
    findOne: jest.fn(),
  },
  Organization: {
    findById: jest.fn(),
  },
  Destination: {
    findByClientId: jest.fn(),
    findByIdentifier: jest.fn(),
    createDestination: jest.fn(),
    getDestinationStats: jest.fn(),
  },
}));
jest.mock('@/services/consent/ConsentService', () => ({
  ConsentService: {
    getInstance: jest.fn(() => ({
      assertCanSend: jest.fn().mockReturnValue(null),
      queueOutboundUntilConsent: jest.fn().mockResolvedValue(false),
    })),
  },
}));
jest.mock('@/services/whatsapp/whatsapp-send-policy.service', () => ({
  resolveWhatsAppSendPolicy: jest.fn().mockResolvedValue({
    limitsDisabled: false,
    humanizeEnabled: true,
    composingEnabled: true,
    caps: { conversation: 30, marketing: 30, alert: 30 },
    conversation: { enabled: true, maxPerMinute: 10 },
    marketing: { enabled: true, maxPerMinute: 2 },
    alert: { enabled: true, maxPerMinute: 30 },
  }),
}));
jest.mock('../../common/CircuitBreaker');
jest.mock('@whiskeysockets/baileys');
jest.mock('qrcode');
jest.mock('fs');

describe('WhatsAppService', () => {
  let whatsappService: WhatsAppService;
  let mockSessionCache: jest.Mocked<SessionCache>;
  let mockQueueManager: jest.Mocked<QueueManager>;
  let mockRateLimiter: jest.Mocked<RateLimiter>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock CircuitBreaker prototype methods used by WhatsAppService
    (CircuitBreaker as jest.MockedClass<typeof CircuitBreaker>).prototype.getState = jest.fn().mockReturnValue('closed');
    (CircuitBreaker as jest.MockedClass<typeof CircuitBreaker>).prototype.recordSuccess = jest.fn();
    (CircuitBreaker as jest.MockedClass<typeof CircuitBreaker>).prototype.recordFailure = jest.fn();

    // Create mock instances
    mockSessionCache = {
      getInstance: jest.fn().mockReturnThis(),
      setWhatsAppSession: jest.fn(),
      getWhatsAppSession: jest.fn(),
      updateWhatsAppActivity: jest.fn(),
      deleteSession: jest.fn(),
      cleanupExpiredSessions: jest.fn()
    } as any;

    mockQueueManager = {
      getInstance: jest.fn().mockReturnThis(),
      registerProcessor: jest.fn(),
      addJob: jest.fn()
    } as any;

    mockRateLimiter = {
      getInstance: jest.fn().mockReturnThis(),
      checkWhatsAppSendingLimit: jest.fn(),
      checkWhatsAppSendLimit: jest.fn(),
    } as any;

    // Mock static methods
    (SessionCache.getInstance as jest.Mock).mockReturnValue(mockSessionCache);
    (QueueManager.getInstance as jest.Mock).mockReturnValue(mockQueueManager);
    (RateLimiter.getInstance as jest.Mock).mockReturnValue(mockRateLimiter);

    (Organization.findById as jest.Mock).mockResolvedValue(null);
    (User.findById as jest.Mock).mockResolvedValue(null);

    const rateOk = { allowed: true, tokensRemaining: 19, resetTime: Date.now() + 60_000 };
    mockRateLimiter.checkWhatsAppSendingLimit.mockResolvedValue(rateOk);
    mockRateLimiter.checkWhatsAppSendLimit.mockResolvedValue(rateOk);

    whatsappService = new WhatsAppService();
  });

  describe('Service Initialization', () => {
    it('should start successfully', async () => {
      // Mock dependencies
      mockQueueManager.registerProcessor.mockResolvedValue(undefined);
      (WhatsAppSession.find as jest.Mock).mockResolvedValue([]);

      await whatsappService.start();

      expect(mockQueueManager.registerProcessor).toHaveBeenCalledTimes(2);
      expect(mockQueueManager.registerProcessor).toHaveBeenCalledWith(
        'whatsapp-connection',
        expect.any(Function),
        2
      );
      expect(mockQueueManager.registerProcessor).toHaveBeenCalledWith(
        'whatsapp-sending',
        expect.any(Function),
        3
      );
    });

    it('should handle start errors gracefully', async () => {
      const error = new Error('Start failed');
      mockQueueManager.registerProcessor.mockRejectedValue(error);

      await expect(whatsappService.start()).rejects.toThrow('Start failed');
    });
  });

  describe('Destination Management', () => {
    it('should validate destination successfully', async () => {
      const clientId = TEST_CLIENT_ID;
      const destination = '+1234567890';

      // Mock WhatsApp socket
      const mockSocket = {
        onWhatsApp: jest.fn().mockResolvedValue([{ exists: true }])
      };
      
      // Add session to service
      (whatsappService as any).sessions.set(clientId, mockSocket);

      const result = await whatsappService.validateDestination(clientId, destination);

      expect(result).toBe(true);
      expect(mockSocket.onWhatsApp).toHaveBeenCalledWith('1234567890');
    });

    it('should return false for invalid destination', async () => {
      const clientId = TEST_CLIENT_ID;
      const destination = '+1234567890';

      // Mock WhatsApp socket
      const mockSocket = {
        onWhatsApp: jest.fn().mockResolvedValue([{ exists: false }])
      };
      
      (whatsappService as any).sessions.set(clientId, mockSocket);

      const result = await whatsappService.validateDestination(clientId, destination);

      expect(result).toBe(false);
    });

    it('should add destination with validation', async () => {
      const clientId = TEST_CLIENT_ID;
      const type = 'contact';
      const identifier = '+1234567890';
      const name = 'Test Contact';

      // Mock validation
      const mockSocket = {
        onWhatsApp: jest.fn().mockResolvedValue([{ exists: true }])
      };
      (whatsappService as any).sessions.set(clientId, mockSocket);

      // Mock destination creation
      const mockDestination = {
        _id: 'dest-id',
        type,
        identifier,
        name,
        isActive: true,
        hasValidConsent: jest.fn().mockReturnValue(true),
        save: jest.fn().mockResolvedValue(undefined),
      };
      (Destination.createDestination as jest.Mock).mockResolvedValue(mockDestination);

      const result = await whatsappService.addDestination(clientId, type, identifier, name);

      expect(result.success).toBe(true);
      expect(result.destination.identifier).toBe(identifier);
      expect(Destination.createDestination).toHaveBeenCalledWith(
        clientId,
        type,
        identifier,
        name,
        'manual',
        '127.0.0.1'
      );
    });

    it('should reject invalid destination during add', async () => {
      const clientId = TEST_CLIENT_ID;
      const type = 'contact';
      const identifier = '+1234567890';
      const name = 'Test Contact';

      // Mock validation failure
      const mockSocket = {
        onWhatsApp: jest.fn().mockResolvedValue([{ exists: false }])
      };
      (whatsappService as any).sessions.set(clientId, mockSocket);

      await expect(
        whatsappService.addDestination(clientId, type, identifier, name)
      ).rejects.toThrow('Destination does not exist on WhatsApp');
    });

    it('should remove destination successfully', async () => {
      const clientId = TEST_CLIENT_ID;
      const identifier = '+1234567890';

      const mockDestination = {
        revokeConsent: jest.fn().mockResolvedValue(undefined)
      };
      (Destination.findByIdentifier as jest.Mock).mockResolvedValue(mockDestination);

      await whatsappService.removeDestination(clientId, identifier);

      expect(Destination.findByIdentifier).toHaveBeenCalledWith(identifier, clientId);
      expect(mockDestination.revokeConsent).toHaveBeenCalled();
    });
  });

  describe('Message Sending', () => {
    it('should send message with validation', async () => {
      const clientId = TEST_CLIENT_ID;
      const destination = '+1234567890';
      const content = { text: 'Test message' };

      // Mock rate limiting
      mockRateLimiter.checkWhatsAppSendLimit.mockResolvedValue({
        allowed: true,
        tokensRemaining: 19,
        resetTime: Date.now() + 60_000,
      });

      // Mock WhatsApp socket
      const mockSocket = mockConnectedSocket();
      (whatsappService as any).sessions.set(clientId, mockSocket);

      // Mock destination
      const mockDestination = {
        hasValidConsent: jest.fn().mockReturnValue(true),
        updateLastMessageSent: jest.fn().mockResolvedValue(undefined),
        type: 'contact',
      };
      (Destination.findByIdentifier as jest.Mock).mockResolvedValue(mockDestination);

      const result = await (whatsappService as any).handleSendMessage({
        clientId,
        destination,
        content,
        messageId: 'test-msg'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-id');
      // onWhatsApp resolves the real JID (no + prefix, Baileys format)
      expect(mockSocket.sendMessage).toHaveBeenCalledWith('1234567890@s.whatsapp.net', {
        text: content.text
      });
      expect(mockDestination.updateLastMessageSent).toHaveBeenCalled();
    });

    it('should reject message when rate limited', async () => {
      const clientId = TEST_CLIENT_ID;
      const destination = '+1234567890';
      const content = { text: 'Test message' };

      // Mock rate limiting failure
      mockRateLimiter.checkWhatsAppSendLimit.mockResolvedValue({
        allowed: false,
        tokensRemaining: 0,
        resetTime: Date.now() + 60_000,
      });

      await expect(
        (whatsappService as any).handleSendMessage({
          clientId,
          destination,
          content,
          messageId: 'test-msg'
        })
      ).rejects.toThrow('Limite de envio do WhatsApp atingido');
    });

    it('should reject message without valid consent', async () => {
      const clientId = TEST_CLIENT_ID;
      const destination = '+1234567890';
      const content = { text: 'Test message' };

      // Mock rate limiting
      mockRateLimiter.checkWhatsAppSendLimit.mockResolvedValue({
        allowed: true,
        tokensRemaining: 19,
        resetTime: Date.now() + 60_000,
      });

      // Mock WhatsApp socket
      const mockSocket = mockConnectedSocket();
      (whatsappService as any).sessions.set(clientId, mockSocket);

      // Mock destination without consent
      const mockDestination = {
        hasValidConsent: jest.fn().mockReturnValue(false),
        type: 'contact',
      };
      (Destination.findByIdentifier as jest.Mock).mockResolvedValue(mockDestination);

      await expect(
        (whatsappService as any).handleSendMessage({
          clientId,
          destination,
          content,
          messageId: 'test-msg'
        })
      ).rejects.toThrow('Destino sem consentimento válido para envio');
    });
  });

  describe('Session Health Monitoring', () => {
    it('should report healthy session', async () => {
      const clientId = TEST_CLIENT_ID;

      // Mock healthy socket
      const mockSocket = {
        ws: { readyState: 1 } // WebSocket.OPEN
      };
      (whatsappService as any).sessions.set(clientId, mockSocket);

      // Mock session cache
      mockSessionCache.getWhatsAppSession.mockResolvedValue({
        lastActivity: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
      });

      const result = await whatsappService.monitorSessionHealth(clientId);

      expect(result.healthy).toBe(true);
      expect(result.details.connected).toBe(true);
      expect(result.details.isStale).toBe(false);
    });

    it('should report unhealthy session when stale', async () => {
      const clientId = TEST_CLIENT_ID;

      // Mock connected but stale socket
      const mockSocket = {
        ws: { readyState: 1 } // WebSocket.OPEN
      };
      (whatsappService as any).sessions.set(clientId, mockSocket);

      // Mock stale session cache
      mockSessionCache.getWhatsAppSession.mockResolvedValue({
        lastActivity: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
      });

      const result = await whatsappService.monitorSessionHealth(clientId);

      expect(result.healthy).toBe(false);
      expect(result.details.connected).toBe(true);
      expect(result.details.isStale).toBe(true);
    });

    it('should report unhealthy session when not found', async () => {
      const clientId = 'nonexistent-client';

      const result = await whatsappService.monitorSessionHealth(clientId);

      expect(result.healthy).toBe(false);
      expect(result.details.error).toBe('Session not found');
    });
  });

  describe('Destination Cleanup', () => {
    it('should cleanup invalid destinations', async () => {
      const clientId = TEST_CLIENT_ID;

      // Mock destinations
      const mockDestinations = [
        {
          identifier: '+1234567890',
          deactivate: jest.fn().mockResolvedValue(undefined)
        },
        {
          identifier: '+0987654321',
          deactivate: jest.fn().mockResolvedValue(undefined)
        }
      ];
      (Destination.findByClientId as jest.Mock).mockResolvedValue(mockDestinations);

      // Mock WhatsApp socket
      const mockSocket = {
        onWhatsApp: jest.fn()
          .mockResolvedValueOnce([{ exists: false }]) // First destination invalid
          .mockResolvedValueOnce([{ exists: true }])  // Second destination valid
      };
      (whatsappService as any).sessions.set(clientId, mockSocket);

      const result = await whatsappService.performDestinationCleanup(clientId);

      expect(result.cleaned).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockDestinations[0].deactivate).toHaveBeenCalled();
      expect(mockDestinations[1].deactivate).not.toHaveBeenCalled();
    });
  });

  describe('Service Statistics', () => {
    it('should return comprehensive service stats', async () => {
      // Mock active sessions — use valid ObjectId strings so monitorSessionHealth works
      const clientId1 = new mongoose.Types.ObjectId().toHexString();
      const clientId2 = new mongoose.Types.ObjectId().toHexString();
      const mockSocket = {};
      (whatsappService as any).sessions.set(clientId1, mockSocket);
      (whatsappService as any).sessions.set(clientId2, mockSocket);

      // Mock destination stats
      const mockDestinationStats = {
        byTypeAndStatus: [],
        recentActivity: []
      };
      (Destination.getDestinationStats as jest.Mock).mockResolvedValue(mockDestinationStats);

      // Mock session cache for health checks — recent activity = healthy
      mockSessionCache.getWhatsAppSession.mockResolvedValue({
        lastActivity: new Date(Date.now() - 5 * 60 * 1000)
      });

      const stats = await whatsappService.getServiceStats();

      expect(stats.sessions.total).toBe(2);
      expect(stats.sessions.healthy).toBe(2);
      expect(stats.destinations).toEqual(mockDestinationStats);
      expect(stats.circuitBreaker).toBeDefined();
      expect(stats.uptime).toBeGreaterThan(0);
    });
  });

  describe('Group Management', () => {
    it('should get group information', async () => {
      const clientId = TEST_CLIENT_ID;
      const groupId = 'group123@g.us';

      const mockGroupMetadata = {
        id: groupId,
        subject: 'Test Group',
        desc: 'Test Description',
        participants: [
          { id: 'user1@s.whatsapp.net', admin: null },
          { id: 'user2@s.whatsapp.net', admin: 'admin' }
        ],
        creation: 1640995200 // Unix timestamp
      };

      const mockSocket = {
        user: { id: 'user2@s.whatsapp.net' },
        groupMetadata: jest.fn().mockResolvedValue(mockGroupMetadata)
      };
      (whatsappService as any).sessions.set(clientId, mockSocket);

      const result = await whatsappService.getGroupInfo(clientId, groupId);

      expect(result.id).toBe(groupId);
      expect(result.subject).toBe('Test Group');
      expect(result.participantsCount).toBe(2);
      expect(result.isAdmin).toBe(true);
      expect(mockSocket.groupMetadata).toHaveBeenCalledWith(groupId);
    });
  });

  describe('Error Handling', () => {
    it('should handle circuit breaker failures', async () => {
      const clientId = TEST_CLIENT_ID;
      const destination = '+1234567890';
      const content = { text: 'Test message' };

      // Mock rate limiting
      mockRateLimiter.checkWhatsAppSendLimit.mockResolvedValue({
        allowed: true,
        tokensRemaining: 19,
        resetTime: Date.now() + 60_000,
      });

      // Mock socket that throws error on sendMessage but resolves onWhatsApp
      const mockSocket = mockConnectedSocket({
        sendMessage: jest.fn().mockRejectedValue(new Error('Network error')),
      });
      (whatsappService as any).sessions.set(clientId, mockSocket);

      // Mock destination
      const mockDestination = {
        hasValidConsent: jest.fn().mockReturnValue(true),
        type: 'contact',
        updateLastMessageSent: jest.fn().mockResolvedValue(undefined),
      };
      (Destination.findByIdentifier as jest.Mock).mockResolvedValue(mockDestination);

      await expect(
        (whatsappService as any).handleSendMessage({
          clientId,
          destination,
          content,
          messageId: 'test-msg'
        })
      ).rejects.toThrow('Network error');

      // Verify circuit breaker recorded failure
      const circuitBreaker = (whatsappService as any).circuitBreaker;
      expect(circuitBreaker.recordFailure).toHaveBeenCalled();
    });
  });
});