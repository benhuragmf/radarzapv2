import makeWASocket, {
  ConnectionState,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  MessageUpsertType,
  WAMessage,
  BaileysEventMap
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import { config } from '@/config/environment';
import { logger, createServiceLogger } from '@/utils/logger';
import { SessionCache } from '@/cache/SessionCache';
import { QueueManager } from '@/cache/QueueManager';
import { RateLimiter } from '@/cache/RateLimiter';
import { WhatsAppSession, User, Destination } from '@/models';
import { CircuitBreaker } from '../common/CircuitBreaker';
import { RedisManager } from '@/cache/RedisManager';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import {
  WaConnectionState,
  WaInstanceState,
  WaQrCodePayload,
  WaSessionEvent,
  cacheStatusToState,
  delay,
} from './waSessionEvents';

/** Redis cache TTL for live WA state (QR, connected) — 7 days */
const WA_CACHE_TTL_SEC = 7 * 24 * 60 * 60;
/** MongoDB backup expiry — 30 days, renewed on activity */
const WA_DB_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const WA_SESSION_CHANNEL = 'radarzap:wa-session';

/**
 * WhatsApp Service with autonomous session management
 */
export class WhatsAppService {
  private static instance: WhatsAppService;
  private sessions: Map<string, WASocket> = new Map();
  private sessionStates: Map<string, any> = new Map();
  private sessionIntervals: Map<string, NodeJS.Timeout> = new Map();
  private pendingConnections: Map<string, { discordUserId: string; channelId: string; qrMessageId?: string }> = new Map();
  private qrCounts: Map<string, number> = new Map();
  private connectingClients: Set<string> = new Set();
  private serviceLogger = createServiceLogger('WhatsAppService');
  private sessionCache: SessionCache;
  private queueManager: QueueManager;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private isInitialized = false;
  private sessionCleanupInterval: NodeJS.Timeout | null = null;
  private destinationCleanupInterval: NodeJS.Timeout | null = null;

  /** Read all Baileys auth files from the session directory */
  private readSessionDirectory(sessionDir: string): Record<string, string> {
    const files: Record<string, string> = {};
    if (!fs.existsSync(sessionDir)) return files;
    for (const name of fs.readdirSync(sessionDir)) {
      const filePath = path.join(sessionDir, name);
      if (fs.statSync(filePath).isFile()) {
        files[name] = fs.readFileSync(filePath, 'utf8');
      }
    }
    return files;
  }

  /** Write Baileys auth files back to disk (restore after restart) */
  private writeSessionDirectory(sessionDir: string, files: Record<string, string>): void {
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(sessionDir, name), content, 'utf8');
    }
  }

  /** Push session state to Redis cache + dashboard via pub/sub (Evolution-style events) */
  private async notifySessionUpdate(
    clientId: string,
    data: {
      status: 'connecting' | 'connected' | 'disconnected' | 'qr-required';
      qrCode?: string;
      qrCodeRaw?: string;
      qrCount?: number;
      statusReason?: number;
      wuid?: string;
      profileName?: string;
      deviceInfo?: { platform: string; browser: string; version: string };
      lastActivity?: Date;
    },
  ): Promise<void> {
    await this.sessionCache.setWhatsAppSession(clientId, {
      ...data,
      lastActivity: data.lastActivity ?? new Date(),
    }, WA_CACHE_TTL_SEC);

    const state = cacheStatusToState(data.status, data.status === 'connected');
    const now = (data.lastActivity ?? new Date()).toISOString();

    const events: WaSessionEvent[] = [];
    if (data.qrCode) {
      events.push({
        event: 'QRCODE_UPDATED',
        clientId,
        data: {
          qrcode: {
            base64: data.qrCode,
            code: data.qrCodeRaw ?? '',
            count: data.qrCount ?? 1,
          },
        },
        date_time: now,
      });
    }
    events.push({
      event: 'CONNECTION_UPDATE',
      clientId,
      data: {
        state,
        statusReason: data.statusReason,
        wuid: data.wuid,
        profileName: data.profileName,
      },
      date_time: now,
    });

    try {
      const redis = RedisManager.getInstance();
      for (const ev of events) {
        await redis.publish(WA_SESSION_CHANNEL, JSON.stringify(ev));
      }
      // Compat legado para o dashboard
      await redis.publish(
        WA_SESSION_CHANNEL,
        JSON.stringify({
          clientId,
          status: data.status,
          qrCode: data.qrCode,
          qrCount: data.qrCount,
          statusReason: data.statusReason,
          lastActivity: now,
        }),
      );
    } catch {
      // pub/sub optional — dashboard still polls /sessions
    }
  }

  constructor() {
    this.sessionCache = SessionCache.getInstance();
    this.queueManager = QueueManager.getInstance();
    this.rateLimiter = RateLimiter.getInstance();
    this.circuitBreaker = new CircuitBreaker('whatsapp-service', {
      failureThreshold: 3,
      recoveryTimeout: 60000,
      monitorTimeout: 30000
    });
  }

  static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  /** Evolution API: GET /instance/connectionState/:instanceName */
  async getConnectionState(clientId: string): Promise<{ instance: WaInstanceState }> {
    const socket = this.sessions.get(clientId);
    if (socket?.user) {
      const wuid = socket.user.id;
      return {
        instance: {
          clientId,
          state: 'open',
          statusReason: 200,
          wuid,
          profileName: socket.user.name ?? undefined,
        },
      };
    }

    const cached = await this.sessionCache.getWhatsAppSession(clientId);
    const state = cacheStatusToState(cached?.status, false);
    return {
      instance: {
        clientId,
        state,
        statusReason: cached?.statusReason,
        wuid: cached?.wuid,
        profileName: cached?.profileName,
      },
    };
  }

  /** Evolution API: QR getter */
  async getInstanceQrCode(clientId: string): Promise<{ qrcode?: WaQrCodePayload }> {
    const cached = await this.sessionCache.getWhatsAppSession(clientId);
    if (!cached?.qrCode) return {};
    return {
      qrcode: {
        base64: cached.qrCode,
        code: cached.qrCodeRaw ?? '',
        count: cached.qrCount ?? this.qrCounts.get(clientId) ?? 1,
      },
    };
  }

  /** Evolution API: connect idempotente — retorna estado + QR sem bloquear até open */
  async connectInstance(
    clientId: string,
    options?: { discordUserId?: string; channelId?: string },
  ): Promise<{ instance: WaInstanceState; qrcode?: WaQrCodePayload }> {
    const current = await this.getConnectionState(clientId);
    if (current.instance.state === 'open') {
      return { instance: current.instance };
    }

    const cachedQr = await this.getInstanceQrCode(clientId);
    if (cachedQr.qrcode && current.instance.state === 'connecting') {
      return { instance: current.instance, qrcode: cachedQr.qrcode };
    }

    if (!this.sessions.has(clientId) && !this.connectingClients.has(clientId)) {
      this.pendingConnections.set(clientId, {
        discordUserId: options?.discordUserId ?? '',
        channelId: options?.channelId ?? '',
      });
      this.connectingClients.add(clientId);
      await this.notifySessionUpdate(clientId, { status: 'connecting', statusReason: 200 });
      this.createWhatsAppSession(clientId)
        .then(() => this.connectingClients.delete(clientId))
        .catch((err) => {
          this.connectingClients.delete(clientId);
          this.pendingConnections.delete(clientId);
          this.serviceLogger.error(`Background connect failed for ${clientId}: ${err.message}`);
        });
    }

    const waitMs = config.WHATSAPP.CONNECT_QR_WAIT_MS;
    const steps = Math.ceil(waitMs / 500);
    for (let i = 0; i < steps; i++) {
      await delay(500);
      const state = await this.getConnectionState(clientId);
      if (state.instance.state === 'open') {
        return { instance: state.instance };
      }
      const qr = await this.getInstanceQrCode(clientId);
      if (qr.qrcode) {
        return { instance: state.instance, qrcode: qr.qrcode };
      }
    }

    const finalState = await this.getConnectionState(clientId);
    const finalQr = await this.getInstanceQrCode(clientId);
    return {
      instance: finalState.instance,
      qrcode: finalQr.qrcode,
    };
  }

  /** Evolution API: DELETE /instance/logout — limpa credenciais WhatsApp */
  async logoutInstance(clientId: string): Promise<{ success: boolean; message: string }> {
    await this.disconnectSession(clientId);
    return { success: true, message: 'Logged out successfully' };
  }

  /** Evolution API: disconnect temporário — fecha socket, mantém credenciais */
  async temporaryDisconnect(clientId: string): Promise<{ success: boolean; message: string }> {
    const socket = this.sessions.get(clientId);
    if (socket) {
      socket.end(undefined);
      this.sessions.delete(clientId);
      this.sessionStates.delete(clientId);
    }

    const interval = this.sessionIntervals.get(clientId);
    if (interval) {
      clearInterval(interval);
      this.sessionIntervals.delete(clientId);
    }

    this.connectingClients.delete(clientId);
    this.pendingConnections.delete(clientId);

    await this.notifySessionUpdate(clientId, {
      status: 'disconnected',
      statusReason: 200,
      lastActivity: new Date(),
    });

    return { success: true, message: 'Disconnected temporarily' };
  }

  /** Evolution API: POST /instance/restart */
  async restartInstance(clientId: string): Promise<{ success: boolean; message: string }> {
    await this.temporaryDisconnect(clientId);
    await this.connectInstance(clientId);
    return { success: true, message: 'Restart initiated' };
  }

  /**
   * Start WhatsApp service
   */
  async start(): Promise<void> {
    try {
      this.serviceLogger.info('🚀 Starting WhatsApp Service...');

      // Ensure sessions directory exists
      await this.ensureSessionsDirectory();

      // Register queue processors
      await this.registerQueueProcessors();

      // Setup session cleanup
      this.setupSessionCleanup();

      // Setup destination cleanup
      this.setupDestinationCleanup();

      // Restore existing sessions
      await this.restoreExistingSessions();

      this.isInitialized = true;
      this.serviceLogger.info('✅ WhatsApp Service started successfully');

    } catch (error) {
      this.serviceLogger.error('❌ Failed to start WhatsApp Service:', error);
      throw error;
    }
  }

  /**
   * Stop WhatsApp service
   */
  async stop(): Promise<void> {
    try {
      this.serviceLogger.info('🛑 Stopping WhatsApp Service...');

      // Clear cleanup intervals
      if (this.sessionCleanupInterval) {
        clearInterval(this.sessionCleanupInterval);
        this.sessionCleanupInterval = null;
      }

      if (this.destinationCleanupInterval) {
        clearInterval(this.destinationCleanupInterval);
        this.destinationCleanupInterval = null;
      }

      // Clear all session intervals
      for (const [clientId, interval] of this.sessionIntervals) {
        clearInterval(interval);
      }
      this.sessionIntervals.clear();

      // Persist session files before closing sockets
      for (const clientId of this.sessions.keys()) {
        await this.saveSessionToDatabase(clientId);
      }

      // Close all sessions
      await this.closeAllSessions();

      this.isInitialized = false;
      this.serviceLogger.info('✅ WhatsApp Service stopped');

    } catch (error) {
      this.serviceLogger.error('Error stopping WhatsApp Service:', error);
    }
  }

  /**
   * Ensure sessions directory exists
   */
  private async ensureSessionsDirectory(): Promise<void> {
    const sessionsDir = path.join(process.cwd(), 'sessions');

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
      this.serviceLogger.info('Created sessions directory');
    }
  }

  /**
   * Register queue processors for WhatsApp operations
   */
  private async registerQueueProcessors(): Promise<void> {
    // WhatsApp connection processor — handles connect, disconnect, and list-groups
    await this.queueManager.registerProcessor(
      'whatsapp-connection',
      async (job: any) => {
        const { name, data } = job;

        switch (name) {
          case 'connect-whatsapp':
            return await this.handleConnectWhatsApp(data);
          case 'disconnect-whatsapp':
            return await this.handleTemporaryDisconnect(data);
          case 'logout-whatsapp':
            return await this.handleLogoutWhatsApp(data);
          case 'restart-whatsapp':
            return await this.handleRestartWhatsApp(data);
          case 'list-groups': {
            const { clientId, resultKey } = data;
            const groups = await this.listGroups(clientId);
            // Store result directly in Redis (bypass SessionCache wrapper)
            const redisManager = (this.sessionCache as any).redisManager;
            await redisManager.setWithTTL(resultKey, JSON.stringify(groups), 30);
            return { ok: true, count: groups.length };
          }
          default:
            throw new Error(`Unknown WhatsApp connection job: ${name}`);
        }
      },
      2 // Concurrency of 2 for connection operations
    );

    // WhatsApp sending processor
    await this.queueManager.registerProcessor(
      'whatsapp-sending',
      async (job: any) => {
        const { name, data } = job;

        switch (name) {
          case 'send-message':
            return await this.handleSendMessage(data);
          case 'send-test-message':
            return await this.handleSendTestMessage(data);
          case 'send-bulk-messages':
            return await this.handleSendBulkMessages(data);
          default:
            throw new Error(`Unknown WhatsApp sending job: ${name}`);
        }
      },
      3 // Concurrency of 3 for sending operations
    );
  }

  /**
   * Setup automatic session cleanup
   */
  private setupSessionCleanup(): void {
    this.sessionCleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, config.WHATSAPP.SESSION_TIMEOUT / 2); // Check every 30 minutes

    this.serviceLogger.info('✅ Session cleanup scheduled');
  }

  /**
   * Schedule automatic destination cleanup
   */
  private setupDestinationCleanup(): void {
    // Run cleanup every 24 hours
    this.destinationCleanupInterval = setInterval(async () => {
      try {
        // Get all active clients
        const activeSessions = Array.from(this.sessions.keys());

        for (const clientId of activeSessions) {
          try {
            await this.performDestinationCleanup(clientId);
          } catch (error) {
            this.serviceLogger.error(`Cleanup failed for client ${clientId}:`, error);
          }
        }
      } catch (error) {
        this.serviceLogger.error('Error during scheduled destination cleanup:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    this.serviceLogger.info('✅ Destination cleanup scheduled');
  }

  /**
   * Restore existing sessions from database
   */
  private async restoreExistingSessions(): Promise<void> {
    try {
      const activeSessions = await WhatsAppSession.find({
        status: { $in: ['active', 'inactive'] },
        expiresAt: { $gt: new Date() },
        sessionData: { $nin: ['no-creds', ''] },
      });

      this.serviceLogger.info(`Found ${activeSessions.length} active sessions to restore`);

      for (const sessionDoc of activeSessions) {
        try {
          await this.restoreSession(sessionDoc.clientId.toString());
        } catch (error) {
          const msg = (error as Error).message;
          this.serviceLogger.error(`Failed to restore session for client ${sessionDoc.clientId}:`, error);
          // Only expire if it's not just missing local files (those can be re-authenticated)
          if (!msg.includes('Session files not found')) {
            await sessionDoc.markAsExpired();
          }
        }
      }

    } catch (error) {
      this.serviceLogger.error('Error restoring existing sessions:', error);
    }
  }

  /**
   * Handle WhatsApp connection request (non-blocking — retorna após QR ou timeout curto)
   */
  private async handleConnectWhatsApp(data: any): Promise<any> {
    const { clientId, discordUserId, channelId } = data;

    try {
      this.serviceLogger.info(`Connecting WhatsApp for client: ${clientId}`);

      if (this.sessions.has(clientId)) {
        const state = await this.getConnectionState(clientId);
        return { success: true, message: 'Already connected', ...state };
      }

      const result = await this.connectInstance(clientId, { discordUserId, channelId });

      return {
        success: true,
        message: result.instance.state === 'open' ? 'Connected successfully' : 'QR code sent',
        instance: result.instance,
        qrcode: result.qrcode,
      };

    } catch (error) {
      this.pendingConnections.delete(clientId);
      this.connectingClients.delete(clientId);
      this.serviceLogger.error(`Failed to connect WhatsApp for client ${clientId}: ${(error as Error).message}`, { stack: (error as Error).stack });
      this.circuitBreaker.recordFailure();
      throw error;
    }
  }

  /** Disconnect temporário (mantém credenciais para reconectar) */
  private async handleTemporaryDisconnect(data: any): Promise<any> {
    const { clientId } = data;
    try {
      this.serviceLogger.info(`Temporary disconnect WhatsApp for client: ${clientId}`);
      return await this.temporaryDisconnect(clientId);
    } catch (error) {
      this.serviceLogger.error(`Failed to disconnect WhatsApp for client ${clientId}:`, error);
      throw error;
    }
  }

  /** Logout completo (limpa credenciais) */
  private async handleLogoutWhatsApp(data: any): Promise<any> {
    const { clientId } = data;
    try {
      this.serviceLogger.info(`Logging out WhatsApp for client: ${clientId}`);
      return await this.logoutInstance(clientId);
    } catch (error) {
      this.serviceLogger.error(`Failed to logout WhatsApp for client ${clientId}:`, error);
      throw error;
    }
  }

  /** Reinicia conexão sem apagar sessão */
  private async handleRestartWhatsApp(data: any): Promise<any> {
    const { clientId } = data;
    try {
      this.serviceLogger.info(`Restarting WhatsApp for client: ${clientId}`);
      return await this.restartInstance(clientId);
    } catch (error) {
      this.serviceLogger.error(`Failed to restart WhatsApp for client ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Create new WhatsApp session
   */
  private async createWhatsAppSession(clientId: string): Promise<{ qrCode?: string; connected: boolean }> {
    const sessionDir = path.join(process.cwd(), 'sessions', clientId);

    // Ensure session directory exists
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: this.createBaileysLogger(),
      browser: ['Discord-WhatsApp Bot', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      markOnlineOnConnect: false
    });

    return new Promise((resolve, reject) => {
      let qrCode: string | undefined;
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.end(new Error('Connection timeout'));
          reject(new Error('WhatsApp connection timeout'));
        }
      }, 120000); // 2 minutes timeout

      socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        this.serviceLogger.info(`Connection update for ${clientId}: connection=${connection}, hasQR=${!!qr}, errorCode=${(lastDisconnect?.error as Boom)?.output?.statusCode}`);

        if (qr && !resolved) {
          try {
            const count = (this.qrCounts.get(clientId) ?? 0) + 1;
            this.qrCounts.set(clientId, count);

            if (count > config.WHATSAPP.QRCODE_LIMIT) {
              this.serviceLogger.warn(`QR limit (${config.WHATSAPP.QRCODE_LIMIT}) reached for client: ${clientId}`);
              await this.notifySessionUpdate(clientId, {
                status: 'disconnected',
                statusReason: 408,
              });
              this.connectingClients.delete(clientId);
              this.pendingConnections.delete(clientId);
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                socket.end(undefined);
                reject(new Error('QR code limit reached'));
              }
              return;
            }

            qrCode = await QRCode.toDataURL(qr);
            this.serviceLogger.info(`QR code #${count} generated for client: ${clientId}`);

            await this.notifySessionUpdate(clientId, {
              status: 'qr-required',
              qrCode,
              qrCodeRaw: qr,
              qrCount: count,
              statusReason: 200,
            });

            const pending = this.pendingConnections.get(clientId);
            if (pending?.discordUserId && pending?.channelId) {
              const msgId = await this.sendQRCodeToDiscord(pending.discordUserId, pending.channelId, qrCode);
              if (msgId) {
                this.pendingConnections.set(clientId, { ...pending, qrMessageId: msgId });
              }
            }
          } catch (error) {
            this.serviceLogger.error('Failed to generate QR code:', error);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== DisconnectReason.forbidden;

          if (!resolved) {
            if (shouldReconnect) {
              this.serviceLogger.info(`WhatsApp connection closed (${statusCode}), reconnecting for client: ${clientId}`);
              // For restartRequired (515), create a new socket
              if (statusCode === DisconnectReason.restartRequired) {
                socket.end(undefined);
                const newResult = await this.createWhatsAppSession(clientId);
                if (!resolved) {
                  resolved = true;
                  clearTimeout(timeout);
                  resolve(newResult);
                }
              }
            } else {
              resolved = true;
              clearTimeout(timeout);
              await this.cleanupSession(clientId);
              reject(new Error('WhatsApp logged out'));
            }
          }
        } else if (connection === 'open') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);

            // Delete QR code message from Discord now that we're connected
            const pending = this.pendingConnections.get(clientId);
            if (pending?.qrMessageId) {
              await this.deleteDiscordMessage(pending.channelId, pending.qrMessageId);
            }
            this.pendingConnections.delete(clientId);

            // Store session
            this.sessions.set(clientId, socket);
            this.sessionStates.set(clientId, state);

            // Setup event handlers
            this.setupSocketEventHandlers(socket, clientId);

            // Save session to database (all auth files)
            await this.saveSessionToDatabase(clientId);

            // Update cache + dashboard
            await this.notifySessionUpdate(clientId, {
              status: 'connected',
              statusReason: 200,
              wuid: socket.user?.id,
              profileName: socket.user?.name ?? undefined,
              deviceInfo: {
                platform: 'web',
                browser: 'chrome',
                version: '1.0.0',
              },
            });

            this.qrCounts.delete(clientId);
            this.connectingClients.delete(clientId);

            this.serviceLogger.info(`WhatsApp connected successfully for client: ${clientId}`);
            this.circuitBreaker.recordSuccess();

            resolve({ connected: true });
          }
        }
      });

      socket.ev.on('creds.update', async () => {
        saveCreds();
        await this.saveSessionToDatabase(clientId);
      });
    });
  }

  /**
   * Setup socket event handlers
   */
  private setupSocketEventHandlers(socket: WASocket, clientId: string): void {
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut ||
                            statusCode === DisconnectReason.forbidden;

        this.serviceLogger.warn(`WhatsApp connection closed for client: ${clientId} (code=${statusCode})`);

        if (isLoggedOut) {
          // Permanent disconnect — clean up everything
          this.serviceLogger.info(`Client ${clientId} logged out, cleaning up session`);
          await this.handleSessionDisconnect(clientId);
        } else {
          // Transient disconnect (428, 408, etc.) — attempt silent reconnect
          this.serviceLogger.info(`Transient disconnect for client ${clientId}, attempting reconnect...`);
          // Remove stale socket from map but keep session files
          this.sessions.delete(clientId);
          this.sessionStates.delete(clientId);
          await this.sessionCache.setWhatsAppSession(clientId, {
            status: 'connecting',
            lastActivity: new Date(),
          }, WA_CACHE_TTL_SEC);
          // Reconnect in background — don't block the event handler
          this.createWhatsAppSession(clientId).then(() => {
            this.serviceLogger.info(`Reconnected successfully for client: ${clientId}`);
          }).catch((err) => {
            this.serviceLogger.error(`Reconnect failed for client ${clientId}: ${err.message}`);
            // Fall back to full cleanup so the user can /connect-whatsapp again
            this.handleSessionDisconnect(clientId).catch(() => {});
          });
        }
      }
    });

    socket.ev.on('messages.upsert', async (m) => {
      // Handle incoming messages if needed
      this.serviceLogger.debug(`Received ${m.messages.length} messages for client: ${clientId}`);
    });

    // Keep session alive - store interval reference for cleanup
    const keepAliveInterval = setInterval(async () => {
      try {
        if (this.sessions.has(clientId)) {
          await this.sessionCache.updateWhatsAppActivity(clientId);
        } else {
          // Clear interval if session no longer exists
          clearInterval(keepAliveInterval);
          this.sessionIntervals.delete(clientId);
        }
      } catch (error) {
        this.serviceLogger.error(`Failed to update activity for client ${clientId}:`, error);
      }
    }, 30000); // Every 30 seconds

    // Store interval reference for cleanup
    this.sessionIntervals.set(clientId, keepAliveInterval);
  }

  /**
   * Handle session disconnect
   */
  private async handleSessionDisconnect(clientId: string): Promise<void> {
    try {
      // Remove from active sessions
      this.sessions.delete(clientId);
      this.sessionStates.delete(clientId);

      // Update cache
      await this.notifySessionUpdate(clientId, {
        status: 'disconnected',
        statusReason: 401,
        lastActivity: new Date(),
      });

      // Update database
      const sessionDoc = await WhatsAppSession.findOne({ clientId });
      if (sessionDoc) {
        await sessionDoc.markAsExpired();
      }

      this.serviceLogger.info(`Session disconnected and cleaned up for client: ${clientId}`);

    } catch (error) {
      this.serviceLogger.error(`Error handling session disconnect for client ${clientId}:`, error);
    }
  }

  /**
   * Send QR code to Discord channel
   */
  private async sendQRCodeToDiscord(discordUserId: string | undefined, channelId: string | undefined, qrCode: string): Promise<string | undefined> {
    if (!discordUserId || !channelId) return undefined;
    try {
      const { REST, Routes } = await import('discord.js');
      const token = process.env.DISCORD_TOKEN;

      if (!token) {
        this.serviceLogger.error('DISCORD_TOKEN not set, cannot send QR code');
        return undefined;
      }

      const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const rest = new REST({ version: '10' }).setToken(token);

      const message: any = await rest.post(Routes.channelMessages(channelId), {
        body: {
          content: `<@${discordUserId}> 📱 **WhatsApp QR Code**\n\nEscaneie com seu WhatsApp:\n1. Abra o WhatsApp\n2. Configurações > Aparelhos conectados\n3. Conectar aparelho\n4. Escaneie o código\n\n⏱️ Expira em 60 segundos.`
        },
        files: [{
          name: 'qrcode.png',
          data: buffer
        }]
      });

      this.serviceLogger.info(`QR code sent to Discord channel ${channelId}`);
      return message?.id;
    } catch (error) {
      this.serviceLogger.error(`Failed to send QR code to Discord: ${(error as Error).message}`);
      return undefined;
    }
  }

  private async deleteDiscordMessage(channelId: string | undefined, messageId: string | undefined): Promise<void> {
    if (!channelId || !messageId) return;
    try {
      const { REST, Routes } = await import('discord.js');
      const token = process.env.DISCORD_TOKEN;
      if (!token) return;
      const rest = new REST({ version: '10' }).setToken(token);
      await rest.delete(Routes.channelMessage(channelId, messageId));
      this.serviceLogger.info(`QR code message deleted from Discord channel ${channelId}`);
    } catch (error) {
      this.serviceLogger.error(`Failed to delete QR code message: ${(error as Error).message}`);
    }
  }

  /**
   * Handle send message request
   */
  private formatJid(identifier: string, type: 'contact' | 'group' = 'contact'): string {
    // Already fully formatted
    if (identifier.includes('@')) return identifier;
    // Strip leading + and any non-digit characters except for group IDs
    const cleaned = type === 'group'
      ? identifier.replace(/[^0-9\-]/g, '')
      : identifier.replace(/[^0-9]/g, '');
    const suffix = type === 'group' ? '@g.us' : '@s.whatsapp.net';
    return `${cleaned}${suffix}`;
  }

  private async handleSendMessage(data: any): Promise<any> {
    const { clientId, destination, content, messageId } = data;

    try {
      const clientObjectId = new mongoose.Types.ObjectId(clientId);

      // Check rate limiting
      const rateLimitResult = await this.rateLimiter.checkWhatsAppSendingLimit(clientId);
      if (!rateLimitResult.allowed) {
        throw new Error('Rate limit exceeded for WhatsApp sending');
      }

      const socket = this.sessions.get(clientId);
      if (!socket) {
        throw new Error('WhatsApp session not found or not connected');
      }

      // Validate destination and consent before sending
      const destinationDoc = await Destination.findByIdentifier(destination, clientObjectId);
      if (!destinationDoc) {
        throw new Error('Destination not found or not configured');
      }

      if (!destinationDoc.hasValidConsent()) {
        throw new Error('Destination does not have valid consent for messaging');
      }

      // Format JID correctly for Baileys
      const jid = this.formatJid(destination, destinationDoc.type as 'contact' | 'group');

      // For contacts, resolve the actual JID via onWhatsApp (handles BR 9-digit quirk)
      let resolvedJid = jid;
      if (destinationDoc.type === 'contact') {
        try {
          const plainNumber = jid.replace('@s.whatsapp.net', '');
          const [result] = await socket.onWhatsApp(plainNumber);
          if (result?.exists && result.jid) {
            resolvedJid = result.jid;
            this.serviceLogger.debug(`Resolved JID for ${destination}: ${resolvedJid}`);
          } else {
            this.serviceLogger.warn(`Number ${destination} not found on WhatsApp, attempting send anyway`);
          }
        } catch {
          // onWhatsApp failed — fall back to formatted JID
        }
      }

      // Send message
      const result = await socket.sendMessage(resolvedJid, {
        text: content.text,
        ...(content.image && { image: { url: content.image } })
      });

      // Update destination last message sent
      await destinationDoc.updateLastMessageSent();

      // Update user usage
      const user = await User.findById(clientId);
      if (user) {
        await user.incrementUsage();
      }

      this.serviceLogger.info(`Message sent successfully`, {
        clientId,
        destination,
        messageId: result?.key?.id
      });

      this.circuitBreaker.recordSuccess();

      return {
        success: true,
        messageId: result?.key?.id,
        timestamp: new Date()
      };

    } catch (error) {
      const errMsg = (error as Error).message || 'Unknown error during send';
      this.serviceLogger.error(`Failed to send message: ${errMsg}`, { stack: (error as Error).stack, destination, clientId });
      this.circuitBreaker.recordFailure();
      throw new Error(errMsg);
    }
  }

  /**
   * Handle send test message request
   */
  private async handleSendTestMessage(data: any): Promise<any> {
    const { clientId, message, destination, discordUserId, channelId } = data;
    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    try {
      // Get destinations — specific one or all active
      let destinations;
      if (destination) {
        const doc = await Destination.findByIdentifier(destination, clientObjectId);
        if (!doc) {
          const anyDoc = await Destination.findByIdentifier(destination);
          if (anyDoc) {
            throw new Error(`Destination "${destination}" exists but belongs to a different user`);
          }
          const allDests = await Destination.find({ clientId: clientObjectId });
          const identifiers = allDests.map((d: any) => d.identifier).join(', ') || 'none';
          this.serviceLogger.warn(`Destination not found. clientId=${clientId}, requested="${destination}", existing=[${identifiers}]`);
          throw new Error(`Destination "${destination}" not found. Your registered destinations: [${identifiers}]`);
        }
        destinations = [doc];
      } else {
        destinations = await Destination.findByClientId(clientObjectId, true);
      }

      if (destinations.length === 0) {
        throw new Error('No WhatsApp destinations configured');
      }

      const results = [];
      for (const dest of destinations) {
        const result = await this.handleSendMessage({
          clientId,
          destination: dest.identifier,
          content: { text: `🧪 Test Message: ${message}` },
          messageId: `test-${Date.now()}`
        });
        results.push({ name: dest.name, ...result });
      }

      const names = destinations.map((d: any) => `**${d.name}**`).join(', ');

      // Notify Discord of success
      await this.queueManager.addJob(
        'discord-notifications',
        'send-notification',
        {
          discordUserId,
          channelId,
          message: `✅ Test message sent to ${names}!`
        },
        { priority: 7 }
      );

      return { success: true, results };

    } catch (error) {
      await this.queueManager.addJob(
        'discord-notifications',
        'send-notification',
        {
          discordUserId,
          channelId,
          message: `❌ Failed to send test message: ${(error as Error).message}`
        },
        { priority: 7 }
      );
      throw error;
    }
  }

  /**
   * Handle bulk message sending
   */
  private async handleSendBulkMessages(data: any): Promise<any> {
    const { clientId, messages } = data;

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const messageData of messages) {
      try {
        const result = await this.handleSendMessage({
          clientId,
          ...messageData
        });

        results.push({ ...messageData, result, success: true });
        successCount++;

        // Add delay between messages to respect rate limits
        await this.sleep(3000); // 3 seconds between messages

      } catch (error) {
        results.push({
          ...messageData,
          error: error.message,
          success: false
        });
        failureCount++;
      }
    }

    return {
      success: true,
      totalMessages: messages.length,
      successCount,
      failureCount,
      results
    };
  }

  /**
   * Disconnect session
   */
  private async disconnectSession(clientId: string): Promise<void> {
    const socket = this.sessions.get(clientId);

    if (socket) {
      await socket.logout();
      socket.end(undefined);
    }

    await this.cleanupSession(clientId);
  }

  /**
   * Cleanup session data
   */
  private async cleanupSession(clientId: string): Promise<void> {
    // Remove from memory
    this.sessions.delete(clientId);
    this.sessionStates.delete(clientId);

    // Clear session interval if exists
    const interval = this.sessionIntervals.get(clientId);
    if (interval) {
      clearInterval(interval);
      this.sessionIntervals.delete(clientId);
    }

    // Clean up session files
    const sessionDir = path.join(process.cwd(), 'sessions', clientId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    // Update cache
    await this.sessionCache.deleteSession(`whatsapp:${clientId}`);
    this.qrCounts.delete(clientId);
    this.connectingClients.delete(clientId);

    // Update database
    const sessionDoc = await WhatsAppSession.findOne({ clientId });
    if (sessionDoc) {
      await sessionDoc.markAsExpired();
    }

    this.serviceLogger.info(`Session cleaned up for client: ${clientId}`);
  }

  /**
   * Close all sessions
   */
  private async closeAllSessions(): Promise<void> {
    const closePromises = Array.from(this.sessions.keys()).map(async (clientId) => {
      try {
        await this.disconnectSession(clientId);
      } catch (error) {
        this.serviceLogger.error(`Error closing session ${clientId}:`, error);
      }
    });

    await Promise.allSettled(closePromises);
    this.serviceLogger.info('All WhatsApp sessions closed');
  }

  /**
   * Cleanup expired sessions
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      // Clean up expired sessions from database
      const expiredCount = await WhatsAppSession.cleanupExpiredSessions();

      // Clean up expired sessions from cache
      const cacheCleanedCount = await this.sessionCache.cleanupExpiredSessions();

      if (expiredCount > 0 || cacheCleanedCount > 0) {
        this.serviceLogger.info(`Cleaned up expired sessions: ${expiredCount} from DB, ${cacheCleanedCount} from cache`);
      }

    } catch (error) {
      this.serviceLogger.error('Error during session cleanup:', error);
    }
  }

  /**
   * Restore session from database
   */
  private async restoreSession(clientId: string): Promise<void> {
    const sessionDir = path.join(process.cwd(), 'sessions', clientId);

    if (!fs.existsSync(sessionDir) || !fs.existsSync(path.join(sessionDir, 'creds.json'))) {
      // Try to restore from database first
      const restored = await this.restoreSessionFromDatabase(clientId);
      if (!restored) {
        this.serviceLogger.warn(`Session files not found for client ${clientId}, marking as expired`);
        throw new Error('Session files not found');
      }
    }

    // Try to restore the session
    await this.createWhatsAppSession(clientId);
  }

  /**
   * Save all session auth files to database (encrypted bundle — survives restarts)
   */
  private async saveSessionToDatabase(clientId: string): Promise<void> {
    try {
      const sessionDir = path.join(process.cwd(), 'sessions', clientId);
      const files = this.readSessionDirectory(sessionDir);

      if (!files['creds.json']) {
        return;
      }

      const tempDoc = new WhatsAppSession();
      const sessionData = tempDoc.encrypt(JSON.stringify(files));

      const deviceInfo = {
        platform: 'web',
        browser: 'chrome',
        version: '1.0.0',
      };

      const expiresAt = new Date(Date.now() + WA_DB_EXPIRY_MS);

      await WhatsAppSession.findOneAndUpdate(
        { clientId },
        {
          clientId,
          type: 'web',
          sessionData,
          status: 'active',
          deviceInfo,
          lastActivity: new Date(),
          expiresAt,
        },
        { upsert: true, new: true },
      );

      this.serviceLogger.info(`Session saved to database for client: ${clientId} (${Object.keys(files).length} files)`);
    } catch (error) {
      this.serviceLogger.error('Failed to save session to database:', error);
    }
  }

  /**
   * Restore all session auth files from database to local disk
   */
  private async restoreSessionFromDatabase(clientId: string): Promise<boolean> {
    try {
      const sessionDoc = await WhatsAppSession.findOne({
        clientId,
        status: { $in: ['active', 'inactive'] },
        expiresAt: { $gt: new Date() },
      });

      if (!sessionDoc || sessionDoc.sessionData === 'no-creds') {
        return false;
      }

      const sessionDir = path.join(process.cwd(), 'sessions', clientId);
      const decrypted = sessionDoc.decrypt();

      let files: Record<string, string>;
      try {
        files = JSON.parse(decrypted) as Record<string, string>;
      } catch {
        // Legacy: only creds.json was stored
        files = { 'creds.json': decrypted };
      }

      if (!files['creds.json']) {
        return false;
      }

      this.writeSessionDirectory(sessionDir, files);

      this.serviceLogger.info(
        `Session credentials restored from database for client: ${clientId} (${Object.keys(files).length} files)`,
      );
      return true;
    } catch (error) {
      this.serviceLogger.error(`Failed to restore session from database for client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Create Baileys logger
   */
  private createBaileysLogger(): any {
    // Baileys requires a Pino-compatible logger with .child() support
    // Use silent level to suppress all Baileys internal logs
    const pino = require('pino');
    return pino({ level: 'silent' });
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      activeSessions: this.sessions.size,
      circuitBreakerState: this.circuitBreaker.getState(),
      lastActivity: new Date()
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const activeSessions = this.sessions.size;
      const circuitBreakerHealthy = this.circuitBreaker.getState() !== 'open';

      return {
        healthy: this.isInitialized && circuitBreakerHealthy,
        details: {
          initialized: this.isInitialized,
          activeSessions,
          circuitBreakerState: this.circuitBreaker.getState(),
          circuitBreakerHealthy,
          timestamp: new Date()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: { error: error.message }
      };
    }
  }

  /**
   * Validate destination (contact or group) on WhatsApp
   */
  async validateDestination(clientId: string, destination: string): Promise<boolean> {
    try {
      const socket = this.sessions.get(clientId);
      if (!socket) {
        throw new Error('WhatsApp session not found');
      }

      // Check if destination exists on WhatsApp
      try {
        // onWhatsApp expects plain number without suffix
        const plainNumber = destination.replace(/@s\.whatsapp\.net|@g\.us/, '');
        const [result] = await socket.onWhatsApp(plainNumber);
        return Boolean(result?.exists) || false;
      } catch (error) {
        this.serviceLogger.warn(`Failed to validate destination ${destination}:`, error);
        return false;
      }
    } catch (error) {
      this.serviceLogger.error(`Error validating destination ${destination}:`, error);
      return false;
    }
  }

  /**
   * Get contact information from WhatsApp
   */
  async getContactInfo(clientId: string, destination: string): Promise<any> {
    try {
      const socket = this.sessions.get(clientId);
      if (!socket) {
        throw new Error('WhatsApp session not found');
      }

      // Get contact info
      const contactInfo = await socket.getBusinessProfile(destination);

      return {
        exists: true,
        businessProfile: contactInfo,
        lastSeen: null // WhatsApp Web doesn't provide last seen for privacy
      };
    } catch (error) {
      this.serviceLogger.error(`Error getting contact info for ${destination}:`, error);
      return { exists: false };
    }
  }

  /**
   * Auto-cleanup invalid destinations
   */
  async performDestinationCleanup(clientId: string): Promise<{ cleaned: number; errors: string[] }> {
    try {
      this.serviceLogger.info(`Starting destination cleanup for client: ${clientId}`);

      const destinations = await Destination.findByClientId(clientId as any, true);
      let cleanedCount = 0;
      const errors: string[] = [];

      for (const destination of destinations) {
        try {
          const isValid = await this.validateDestination(clientId, destination.identifier);

          if (!isValid) {
            await destination.deactivate();
            cleanedCount++;
            this.serviceLogger.info(`Deactivated invalid destination: ${destination.identifier}`);
          }
        } catch (error) {
          const errorMsg = `Failed to validate destination ${destination.identifier}: ${error.message}`;
          errors.push(errorMsg);
          this.serviceLogger.error(errorMsg);
        }

        // Add delay to avoid rate limiting
        await this.sleep(1000);
      }

      this.serviceLogger.info(`Destination cleanup completed: ${cleanedCount} destinations cleaned`);

      return { cleaned: cleanedCount, errors };
    } catch (error) {
      this.serviceLogger.error('Error during destination cleanup:', error);
      throw error;
    }
  }

  /**
   * Add new destination with validation
   */
  async addDestination(
    clientId: string,
    type: 'group' | 'contact',
    identifier: string,
    name: string,
    consentSource: string = 'manual',
    ipAddress: string = '127.0.0.1'
  ): Promise<any> {
    try {
      // Validate destination exists on WhatsApp
      const isValid = await this.validateDestination(clientId, identifier);
      if (!isValid) {
        throw new Error('Destination does not exist on WhatsApp');
      }

      // Create destination in database
      const destination = await Destination.createDestination(
        clientId as any,
        type,
        identifier,
        name,
        consentSource,
        ipAddress
      );

      this.serviceLogger.info(`New destination added and validated`, {
        clientId,
        destinationId: destination._id,
        type,
        identifier,
        name
      });

      return {
        success: true,
        destination: {
          id: destination._id,
          type: destination.type,
          identifier: destination.identifier,
          name: destination.name,
          isActive: destination.isActive,
          hasConsent: destination.hasValidConsent()
        }
      };
    } catch (error) {
      this.serviceLogger.error(`Failed to add destination:`, error);
      throw error;
    }
  }

  /**
   * Remove destination (revoke consent and deactivate)
   */
  async removeDestination(clientId: string, identifier: string): Promise<void> {
    try {
      const destination = await Destination.findByIdentifier(identifier, clientId as any);
      if (!destination) {
        throw new Error('Destination not found');
      }

      await destination.revokeConsent();

      this.serviceLogger.info(`Destination removed`, {
        clientId,
        destinationId: destination._id,
        identifier
      });
    } catch (error) {
      this.serviceLogger.error(`Failed to remove destination ${identifier}:`, error);
      throw error;
    }
  }

  /**
   * Get group information
   */
  async getGroupInfo(clientId: string, groupId: string): Promise<any> {
    try {
      const socket = this.sessions.get(clientId);
      if (!socket) {
        throw new Error('WhatsApp session not found');
      }

      const groupMetadata = await socket.groupMetadata(groupId);

      return {
        id: groupMetadata.id,
        subject: groupMetadata.subject,
        description: groupMetadata.desc,
        participantsCount: groupMetadata.participants.length,
        isAdmin: groupMetadata.participants.some(p =>
          p.id === socket.user?.id && (p.admin === 'admin' || p.admin === 'superadmin')
        ),
        createdAt: new Date(groupMetadata.creation * 1000)
      };
    } catch (error) {
      this.serviceLogger.error(`Error getting group info for ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * List all groups the WhatsApp session is part of
   */
  async listGroups(clientId: string): Promise<Array<{ id: string; name: string; participantsCount: number; isAdmin: boolean }>> {
    const socket = this.sessions.get(clientId);
    if (!socket) throw new Error('WhatsApp session not found');

    const groups = await socket.groupFetchAllParticipating();

    return Object.values(groups).map(g => ({
      id: g.id,
      name: g.subject,
      participantsCount: g.participants.length,
      isAdmin: g.participants.some(p =>
        p.id === socket.user?.id && (p.admin === 'admin' || p.admin === 'superadmin')
      ),
    }));
  }

  /**
   * Monitor health of a specific WhatsApp session.
   * A session is considered stale when there has been no activity for > 10 minutes.
   */
  async monitorSessionHealth(clientId: string): Promise<{
    healthy: boolean;
    details: { connected: boolean; isStale: boolean; lastActivity?: Date; error?: string };
  }> {
    try {
      const socket = this.sessions.get(clientId);

      if (!socket) {
        return {
          healthy: false,
          details: { connected: false, isStale: false, error: 'Session not found' }
        };
      }

      const isConnected = this.sessions.has(clientId); // session is removed on disconnect

      const cached = await this.sessionCache.getWhatsAppSession(clientId);
      const lastActivity: Date | undefined = cached?.lastActivity;

      const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
      const isStale = lastActivity
        ? Date.now() - lastActivity.getTime() > STALE_THRESHOLD_MS
        : false;

      return {
        healthy: isConnected && !isStale,
        details: { connected: isConnected, isStale, lastActivity }
      };
    } catch (error) {
      return {
        healthy: false,
        details: { connected: false, isStale: false, error: (error as Error).message }
      };
    }
  }

  /**
   * Return aggregated statistics for the service: sessions, destinations and circuit breaker.
   */
  async getServiceStats(): Promise<{
    sessions: { total: number; healthy: number };
    destinations: any;
    circuitBreaker: any;
    uptime: number;
  }> {
    const startTime = (this as any).startTime as number | undefined;
    const uptime = startTime ? Date.now() - startTime : process.uptime() * 1000;

    // Count healthy sessions
    let healthy = 0;
    for (const clientId of this.sessions.keys()) {
      const { healthy: h } = await this.monitorSessionHealth(clientId);
      if (h) healthy++;
    }

    const destinations = await Destination.getDestinationStats();

    return {
      sessions: { total: this.sessions.size, healthy },
      destinations,
      circuitBreaker: this.circuitBreaker.getState(),
      uptime
    };
  }

  /**
   * Sleep utility function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}