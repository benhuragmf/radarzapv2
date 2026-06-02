/**
 * DashboardService — RadarZap Web Panel
 *
 * Serves the React frontend and exposes a REST API consumed by it.
 * All data comes from MongoDB models and the Redis/BullMQ queue.
 *
 * NOTE (July 2026 migration): when the backend moves to NestJS + PostgreSQL,
 * replace this Express service with NestJS controllers. The React frontend
 * only needs the API contract to stay the same.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer, Server as HTTPServer } from 'http';
import session, { Store } from 'express-session';
import path from 'path';
import { createServiceLogger } from '../../utils/logger';
import { QueueManager } from '../../cache/QueueManager';
import { SessionCache } from '../../cache/SessionCache';
import { RedisManager } from '../../cache/RedisManager';
import { User, Destination, SystemLog, WhatsAppSession, DiscordChannel } from '../../models';
import { Rule } from '../../models/Rule';
import { Template } from '../../models/Template';
import { config } from '../../config/environment';
import mongoose from 'mongoose';

const logger = createServiceLogger('DashboardService');

export class DashboardService {
  private static instance: DashboardService;
  private app: Express;
  private server: HTTPServer;
  private io: SocketIOServer;
  private isRunning = false;
  private port: number;
  private queueManager: QueueManager;
  private sessionCache: SessionCache;
  private redisManager: RedisManager;
  private statsInterval: NodeJS.Timeout | null = null;

  private constructor(port = 3001) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, { cors: { origin: '*' } });
    this.queueManager = QueueManager.getInstance();
    this.sessionCache = SessionCache.getInstance();
    this.redisManager = RedisManager.getInstance();
    this.setupExpress();
    this.setupSocket();
  }

  static getInstance(port?: number): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService(port);
    }
    return DashboardService.instance;
  }

  // ─── Express ─────────────────────────────────────────────────────────────

  private setupExpress(): void {
    this.app.use(express.json());

    // Session middleware — custom Redis store using ioredis (survives restarts)
    const redisManager = this.redisManager;
    const SESSION_PREFIX = 'sess:';
    const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

    class IORedisSesionStore extends Store {
      async get(sid: string, cb: (err: any, session?: session.SessionData | null) => void) {
        try {
          const data = await redisManager.get(`${SESSION_PREFIX}${sid}`);
          cb(null, data ? JSON.parse(data) : null);
        } catch (e) { cb(e); }
      }
      async set(sid: string, sess: session.SessionData, cb?: (err?: any) => void) {
        try {
          await redisManager.setWithTTL(`${SESSION_PREFIX}${sid}`, JSON.stringify(sess), SESSION_TTL);
          cb?.();
        } catch (e) { cb?.(e); }
      }
      async destroy(sid: string, cb?: (err?: any) => void) {
        try {
          await redisManager.del(`${SESSION_PREFIX}${sid}`);
          cb?.();
        } catch (e) { cb?.(e); }
      }
    }

    this.app.use(session({
      store: new IORedisSesionStore(),
      secret: config.SECURITY.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }));

    // Serve built React frontend
    const publicDir = path.join(__dirname, 'public');
    this.app.use(express.static(publicDir));

    // Auth routes (public)
    this.setupAuthRoutes();

    // Protected API routes
    this.app.use('/api', this.requireAuth.bind(this));
    this.setupRoutes();

    // SPA fallback — serve index.html for all non-API routes
    this.app.get('*', (req: Request, res: Response) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/auth')) {
        res.sendFile(path.join(publicDir, 'index.html'));
      }
    });
  }

  /**
   * Middleware — require authenticated session
   */
  private requireAuth(req: Request, res: Response, next: NextFunction): void {
    const sess = req.session as any;
    if (sess?.userId) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized', loginUrl: '/auth/discord' });
    }
  }

  /**
   * Discord OAuth2 routes
   */
  private setupAuthRoutes(): void {
    const REDIRECT_URI = `http://localhost:${this.port}/auth/discord/callback`;
    const SCOPES = 'identify';

    // Step 1 — redirect to Discord
    this.app.get('/auth/discord', (_req, res) => {
      const url = new URL('https://discord.com/api/oauth2/authorize');
      url.searchParams.set('client_id', config.DISCORD.CLIENT_ID);
      url.searchParams.set('redirect_uri', REDIRECT_URI);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', SCOPES);
      res.redirect(url.toString());
    });

    // Step 2 — Discord redirects back with code
    this.app.get('/auth/discord/callback', async (req: Request, res: Response) => {
      const { code } = req.query as { code?: string };
      if (!code) return res.redirect('/?error=no_code');

      try {
        // Exchange code for access token
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id:     config.DISCORD.CLIENT_ID,
            client_secret: config.DISCORD.CLIENT_SECRET,
            grant_type:    'authorization_code',
            code,
            redirect_uri:  REDIRECT_URI,
          }),
        });

        const tokenData = await tokenRes.json() as any;
        if (!tokenData.access_token) {
          logger.error('Discord token exchange failed', tokenData);
          const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5174';
          return res.redirect(`${frontendBase}/?error=token_failed`);
        }

        // Get Discord user info
        const userRes = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const discordUser = await userRes.json() as any;

        // Check if this Discord user has a RadarZap account
        const dbUser = await User.findOne({ discordUserId: discordUser.id }).lean();
        if (!dbUser) {
          logger.warn(`Discord user ${discordUser.id} (${discordUser.username}) has no RadarZap account`);
          const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5174';
          return res.redirect(`${frontendBase}/?error=no_account`);
        }

        // Store in session
        const sess = req.session as any;
        sess.userId      = (dbUser._id as mongoose.Types.ObjectId).toString();
        sess.discordId   = discordUser.id;
        sess.username    = discordUser.username;
        sess.avatar      = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : null;

        logger.info(`User logged in: ${discordUser.username} (${discordUser.id})`);

        // In dev the frontend runs on :5174, in production on the same port
        const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5174';
        res.redirect(`${frontendBase}/dashboard`);

      } catch (err) {
        logger.error('OAuth2 callback error:', err);
        res.redirect('/?error=oauth_error');
      }
    });

    // Get current session info (used by frontend)
    this.app.get('/auth/me', (req: Request, res: Response) => {
      const sess = req.session as any;
      if (sess?.userId) {
        res.json({
          userId:    sess.userId,
          discordId: sess.discordId,
          username:  sess.username,
          avatar:    sess.avatar,
        });
      } else {
        res.status(401).json({ error: 'Not authenticated' });
      }
    });

    // Logout
    this.app.post('/auth/logout', (req: Request, res: Response) => {
      req.session.destroy(() => res.json({ ok: true }));
    });
  }

  private setupRoutes(): void {
    const r = express.Router();

    // ── Stats ──────────────────────────────────────────────────────────────
    r.get('/stats', async (_req, res) => {
      try {
        const stats = await this.buildStats();
        res.json(stats);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Health ─────────────────────────────────────────────────────────────
    r.get('/services/health', (_req, res) => {
      res.json({ healthy: true, uptime: process.uptime() });
    });

    // ── Sessions ───────────────────────────────────────────────────────────
    r.get('/sessions', async (_req, res) => {
      try {
        const docs = await WhatsAppSession.find({ status: 'active' }).lean();
        const sessions = await Promise.all(docs.map(async (d) => {
          const cached = await this.sessionCache.getWhatsAppSession(d.clientId.toString());
          return {
            clientId:     d.clientId.toString(),
            discordUserId: (await User.findById(d.clientId).lean())?.discordUserId ?? '',
            status:       cached?.status ?? d.status,
            lastActivity: cached?.lastActivity ?? d.lastActivity,
            qrCode:       cached?.qrCode,
          };
        }));
        res.json(sessions);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/sessions/:id/connect', async (req, res) => {
      try {
        await this.queueManager.addJob('whatsapp-connection', 'connect-whatsapp',
          { clientId: req.params.id }, { priority: 8 });
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/sessions/:id/disconnect', async (req, res) => {
      try {
        await this.queueManager.addJob('whatsapp-connection', 'disconnect-whatsapp',
          { clientId: req.params.id }, { priority: 7 });
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Rules ──────────────────────────────────────────────────────────────
    r.get('/rules', async (req, res) => {
      try {
        const sess = req.session as any;
        const { guildId } = req.query as { guildId?: string };
        const query: any = sess?.userId ? { clientId: sess.userId } : {};
        // Filter by guild if provided (rules have channelIds from that guild)
        if (guildId) {
          const channels = await DiscordChannel.find({ guildId, isActive: true }).lean();
          const channelIds = channels.map(c => c.channelId);
          if (channelIds.length > 0) {
            query['conditions.channelIds'] = { $in: channelIds };
          }
        }
        const rules = await Rule.find(query).sort({ createdAt: -1 }).lean();
        res.json(rules);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/rules', async (req, res) => {
      try {
        const { name, priority, templateName, keywords, destinationIdentifiers, channelIds } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });

        // Resolve destination identifiers to ObjectIds
        let destinationIds: mongoose.Types.ObjectId[] = [];
        if (destinationIdentifiers?.length) {
          for (const identifier of destinationIdentifiers) {
            const dest = await Destination.findOne({ identifier });
            if (dest) destinationIds.push(dest._id as mongoose.Types.ObjectId);
          }
        }

        // Use first active user as owner (single-tenant for now)
        const user = await User.findOne().lean();
        if (!user) return res.status(400).json({ error: 'No users registered' });

        const rule = await Rule.create({
          clientId: user._id,
          name,
          isActive: true,
          conditions: {
            channelIds: channelIds ?? [],
            requireKeywords: keywords ? keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean) : [],
          },
          action: {
            destinationIds,
            templateName: templateName || 'radarzap-padrao',
            priority: priority || 'medium',
            addDelay: 0,
          },
        });
        res.json(rule);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.put('/rules/:id', async (req, res) => {
      try {
        const { name, priority, templateName, keywords, destinationIdentifiers, channelIds, isActive } = req.body;

        const rule = await Rule.findById(req.params.id);
        if (!rule) return res.status(404).json({ error: 'Rule not found' });

        if (name !== undefined) rule.name = name;
        if (isActive !== undefined) rule.isActive = isActive;
        if (priority !== undefined) rule.action.priority = priority;
        if (templateName !== undefined) rule.action.templateName = templateName;
        if (channelIds !== undefined) rule.conditions.channelIds = channelIds;
        if (keywords !== undefined) {
          rule.conditions.requireKeywords = keywords
            .split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
        }
        if (destinationIdentifiers !== undefined) {
          const ids: mongoose.Types.ObjectId[] = [];
          for (const identifier of destinationIdentifiers) {
            const dest = await Destination.findOne({ identifier });
            if (dest) ids.push(dest._id as mongoose.Types.ObjectId);
          }
          rule.action.destinationIds = ids;
        }

        await rule.save();
        res.json(rule);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/rules/:id/toggle', async (req, res) => {
      try {
        const rule = await Rule.findById(req.params.id);
        if (!rule) return res.status(404).json({ error: 'Rule not found' });
        await rule.toggle();
        res.json({ ok: true, isActive: rule.isActive });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.delete('/rules/:id', async (req, res) => {
      try {
        await Rule.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Templates ──────────────────────────────────────────────────────────
    r.get('/templates', async (_req, res) => {
      try {
        const templates = await Template.find().sort({ isDefault: -1, name: 1 }).lean();
        res.json(templates);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Destinations ───────────────────────────────────────────────────────
    r.get('/destinations', async (req, res) => {
      try {
        const sess = req.session as any;
        const query: any = { isActive: true };
        if (sess?.userId) query.clientId = sess.userId;
        const destinations = await Destination.find(query).lean();
        res.json(destinations);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/destinations', async (req, res) => {
      try {
        const { type, identifier, name } = req.body;
        if (!type || !identifier || !name) return res.status(400).json({ error: 'type, identifier and name are required' });
        const sess = req.session as any;
        const user = sess?.userId
          ? await User.findById(sess.userId).lean()
          : await User.findOne().lean();
        if (!user) return res.status(400).json({ error: 'No users registered' });
        const dest = await Destination.createDestination(
          user._id as mongoose.Types.ObjectId, type, identifier, name, 'manual', '127.0.0.1'
        );
        res.json(dest);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.delete('/destinations/:id', async (req, res) => {
      try {
        const dest = await Destination.findById(req.params.id);
        if (!dest) return res.status(404).json({ error: 'Destination not found' });
        await dest.deleteOne();
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Discord Channels ───────────────────────────────────────────────────
    r.get('/channels', async (req, res) => {
      try {
        const sess = req.session as any;
        const { guildId } = req.query as { guildId?: string };
        const query: any = { isActive: true };
        if (sess?.userId) query.clientId = sess.userId;
        if (guildId) query.guildId = guildId;
        const channels = await DiscordChannel.find(query).lean();
        res.json(channels);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Discord Guilds + Channels from bot (for channel picker) ────────────
    r.get('/discord/guilds', async (_req, res) => {
      try {
        const token = config.DISCORD.TOKEN;
        const botId  = config.DISCORD.CLIENT_ID;
        if (!token) return res.status(400).json({ error: 'DISCORD_TOKEN not configured' });

        // Fetch guilds the bot is in
        const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
          headers: { Authorization: `Bot ${token}` },
        });
        const guilds = await guildsRes.json() as any[];

        res.json(guilds.map((g: any) => ({
          id:   g.id,
          name: g.name,
          icon: g.icon
            ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
            : null,
        })));
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/discord/guilds/:guildId/channels', async (req, res) => {
      try {
        const token = config.DISCORD.TOKEN;
        if (!token) return res.status(400).json({ error: 'DISCORD_TOKEN not configured' });

        const chRes = await fetch(
          `https://discord.com/api/v10/guilds/${req.params.guildId}/channels`,
          { headers: { Authorization: `Bot ${token}` } }
        );
        const channels = await chRes.json() as any[];

        // Return only text channels (type 0) and announcement channels (type 5)
        res.json(
          channels
            .filter((c: any) => c.type === 0 || c.type === 5)
            .map((c: any) => ({ id: c.id, name: c.name, type: c.type }))
            .sort((a: any, b: any) => a.name.localeCompare(b.name))
        );
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/channels', async (req, res) => {
      try {
        const { guildId, channelId, channelName } = req.body;
        if (!guildId || !channelId) return res.status(400).json({ error: 'guildId and channelId are required' });
        const user = await User.findOne().lean();
        if (!user) return res.status(400).json({ error: 'No users registered' });
        const existing = await DiscordChannel.findOne({ guildId, channelId });
        if (existing) return res.status(409).json({ error: 'Channel already configured' });
        const ch = await DiscordChannel.createChannel(
          guildId, channelId, user._id as mongoose.Types.ObjectId
        );
        // Store channelName if provided (best-effort update)
        if (channelName) {
          await DiscordChannel.findByIdAndUpdate(ch._id, { channelName });
        }
        res.json(ch);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.delete('/channels/:id', async (req, res) => {
      try {
        await DiscordChannel.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch('/channels/:id/toggle', async (req, res) => {
      try {
        const ch = await DiscordChannel.findById(req.params.id);
        if (!ch) return res.status(404).json({ error: 'Channel not found' });
        await ch.toggleActive();
        res.json({ ok: true, isActive: ch.isActive });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── WhatsApp Groups (from active session via queue job) ────────────────
    r.get('/sessions/:id/groups', async (req, res) => {
      try {
        const clientId = req.params.id;
        const resultKey = `groups-result:${clientId}:${Date.now()}`;

        await this.queueManager.addJob(
          'whatsapp-connection',
          'list-groups',
          { clientId, resultKey },
          { priority: 9, attempts: 1 }
        );

        // Poll Redis for up to 8 seconds
        const start = Date.now();
        while (Date.now() - start < 8000) {
          await new Promise(r => setTimeout(r, 500));
          const raw = await this.redisManager.get(resultKey);
          if (raw) {
            await this.redisManager.del(resultKey);
            res.json(JSON.parse(raw));
            return;
          }
        }

        res.status(504).json({ error: 'Timeout — certifique-se que o WhatsApp está conectado.' });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Queue ──────────────────────────────────────────────────────────────
    r.get('/queue', async (_req, res) => {
      try {
        const stats = await this.queueManager.getQueueStats();
        const result = Object.entries(stats).map(([name, s]: [string, any]) => ({
          name,
          waiting:   s.waiting   ?? 0,
          active:    s.active    ?? 0,
          completed: s.completed ?? 0,
          failed:    s.failed    ?? 0,
          delayed:   s.delayed   ?? 0,
        }));
        res.json(result);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/queue/failed', async (_req, res) => {
      try {
        // BullMQ doesn't expose failed jobs directly via QueueManager — return empty for now
        // TODO: expose getFailedJobs() in QueueManager
        res.json([]);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/queue/:id/retry', async (req, res) => {
      try {
        // TODO: implement retry via QueueManager
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Logs ───────────────────────────────────────────────────────────────
    r.get('/logs', async (req, res) => {
      try {
        const { level, service, limit = '100' } = req.query as Record<string, string>;
        const query: any = {};
        if (level)   query.level   = level;
        if (service) query.service = service;
        const logs = await SystemLog.find(query)
          .sort({ timestamp: -1 })
          .limit(parseInt(limit))
          .lean();
        res.json(logs);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Users / Plans ──────────────────────────────────────────────────────
    r.get('/users', async (_req, res) => {
      try {
        const users = await User.find().sort({ createdAt: -1 }).lean();
        res.json(users.map(u => ({
          _id:          (u._id as any).toString(),
          discordUserId: u.discordUserId,
          plan:          u.plan,
          limits:        u.limits,
          usage:         u.usage,
          createdAt:     u.createdAt,
        })));
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.put('/users/:id/plan', async (req, res) => {
      try {
        const { plan } = req.body;
        const validPlans = ['free', 'starter', 'pro', 'enterprise'];
        if (!validPlans.includes(plan)) {
          return res.status(400).json({ error: `Invalid plan. Must be one of: ${validPlans.join(', ')}` });
        }
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        await user.upgradePlan(plan as any);
        res.json({ ok: true, plan: user.plan, limits: user.limits });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/users/:id/reset-usage', async (req, res) => {
      try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        await user.resetDailyUsage();
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Test Send ──────────────────────────────────────────────────────────
    r.post('/test-send', async (req, res) => {
      try {
        const { destination, message } = req.body;
        if (!message) return res.status(400).json({ error: 'message is required' });

        // Find any active user to send from (first one found)
        const user = await User.findOne().lean();
        if (!user) return res.status(400).json({ error: 'No users registered' });

        await this.queueManager.addJob(
          'whatsapp-sending',
          'send-test-message',
          {
            clientId:     (user._id as mongoose.Types.ObjectId).toString(),
            message,
            destination:  destination || null,
            discordUserId: user.discordUserId,
            channelId:    null,
          },
          { priority: 6, attempts: 3 }
        );
        res.json({ ok: true, message: 'Mensagem enfileirada com sucesso!' });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    this.app.use('/api', r);
  }

  // ─── Socket.IO ────────────────────────────────────────────────────────────

  private setupSocket(): void {
    this.io.on('connection', (socket) => {
      logger.debug(`Dashboard client connected: ${socket.id}`);
      // Send initial stats on connect
      this.buildStats().then(stats => socket.emit('stats', stats)).catch(() => {});
      socket.on('disconnect', () => logger.debug(`Dashboard client disconnected: ${socket.id}`));
    });
  }

  private async buildStats() {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [users, activeSessions, queueStats, hourlyLogs] = await Promise.all([
      User.find({}, 'usage.messagesUsed').lean(),
      WhatsAppSession.countDocuments({ status: 'active' }),
      this.queueManager.getQueueStats().catch(() => ({})),
      // Count SystemLog entries per hour for the last 24h
      SystemLog.aggregate([
        { $match: { message: 'Message sent successfully', timestamp: { $gte: since24h } } },
        { $group: {
          _id: { $hour: '$timestamp' },
          count: { $sum: 1 }
        }},
        { $sort: { '_id': 1 } }
      ]).catch(() => []),
    ]);

    const totalMessages = users.reduce((sum, u) => sum + ((u as any).usage?.messagesUsed ?? 0), 0);
    const pending = Object.values(queueStats as any).reduce((s: number, q: any) => s + (q.waiting ?? 0), 0);
    const failed  = Object.values(queueStats as any).reduce((s: number, q: any) => s + (q.failed  ?? 0), 0);

    // Build 24-slot array (one per hour)
    const messagesPerHour = Array.from({ length: 24 }, (_, i) => {
      const hour = (now.getHours() - 23 + i + 24) % 24;
      const found = (hourlyLogs as any[]).find((h: any) => h._id === hour);
      return { hour: `${String(hour).padStart(2, '0')}h`, count: found?.count ?? 0 };
    });

    return { totalMessages, activeSessions, pendingJobs: pending, failedJobs: failed, messagesPerHour };
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this.isRunning) return;
    await new Promise<void>((resolve, reject) => {
      this.server.listen(this.port, () => {
        this.isRunning = true;
        logger.info(`✅ Dashboard running on http://localhost:${this.port}`);
        resolve();
      }).on('error', reject);
    });

    // Broadcast stats every 10 s
    this.statsInterval = setInterval(async () => {
      try {
        const stats = await this.buildStats();
        this.io.emit('stats', stats);
      } catch { /* ignore */ }
    }, 10_000);
  }

  async stop(): Promise<void> {
    if (this.statsInterval) clearInterval(this.statsInterval);
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
    this.isRunning = false;
    logger.info('Dashboard stopped');
  }

  async healthCheck() {
    return { healthy: this.isRunning, details: { port: this.port } };
  }

  getStatus() {
    return { running: this.isRunning, port: this.port };
  }
}
