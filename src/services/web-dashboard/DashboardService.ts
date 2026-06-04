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
import { createServiceLogger, logError } from '../../utils/logger';
import { QueueManager } from '../../cache/QueueManager';
import { SessionCache } from '../../cache/SessionCache';
import { RedisManager } from '../../cache/RedisManager';
import { User, Destination, SystemLog, WhatsAppSession, DiscordChannel, MessageQueue, ContactGroup } from '../../models';
import { CampaignDispatchService, type CampaignPriority } from '../send/CampaignDispatchService';
import { ConsentService } from '../consent/ConsentService';
import { OrganizationService } from '../organization/OrganizationService';
import { Organization } from '../../models/Organization';
import { CompanyMember } from '../../models/CompanyMember';
import { CompanyRole } from '../../auth/rbac/roles';
import { isBlockedStatus, ConsentStatus } from '../../types/consent';
import { Rule } from '../../models/Rule';
import { Template } from '../../models/Template';
import { config } from '../../config/environment';
import {
  normalizeDelayBetweenMs,
  validateCampaignCreate,
  validateCampaignTitle,
  validateDestinationAdd,
  validateMessageText,
  WHATSAPP_LIMITS,
} from '../../config/limits';
import { processContactImport } from '../destinations/contactCsvImportService';
import { exportContactsCsv } from '../destinations/contactCsvExportService';
import {
  PlatformTemplate,
  extractTemplateVariables,
  type PlatformTemplateCategory,
} from '../../models/PlatformTemplate';
import {
  PLATFORM_WA_VARIABLE_DOCS,
  renderPlatformCatalogTemplate,
  previewPlatformTemplateContent,
  isPlatformCatalogName,
} from '../../constants/platform-whatsapp-templates';
import {
  listMergedPlatformTemplates,
} from '../platform/platformTemplateCatalog';
import { renderPlatformTemplateForClient } from '../platform/platformTemplateRender';
import { buildPlatformWhatsAppVariables } from '../../utils/platform-wa-variables';
import { BirthdayAutomationRule, type IBirthdayAutomationRule } from '../../models/BirthdayAutomationRule';
import { DiscordNavAlertsService } from '../discord/DiscordNavAlertsService';
import { RuleGroupBlockService } from '../rules/RuleGroupBlockService';
import { BirthdayAutomationService } from '../platform/BirthdayAutomationService';
import {
  validateAutomationPayload,
} from '../../constants/platform-automation-triggers';
import mongoose from 'mongoose';
import { mountBullBoard } from '../monitoring/bullBoard';
import { WhatsAppService } from '../whatsapp/WhatsAppService';
import {
  loadAuthContext,
  requireCapability,
  requireSelfOrStaff,
  assertOwnClient,
  authContextToJson,
  buildAuthContext,
  syncGuildMemberships,
  Cap,
  DashboardRequest,
} from '../../auth/rbac';

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
  private discordUsernameCache = new Map<string, { name: string; expires: number }>();

  /** Resolve Discord display name (global_name ou username) via API do bot */
  private async resolveDiscordDisplayName(discordUserId: string): Promise<string> {
    const cached = this.discordUsernameCache.get(discordUserId);
    if (cached && cached.expires > Date.now()) return cached.name;

    if (!config.DISCORD.TOKEN) return discordUserId;

    try {
      const res = await fetch(`https://discord.com/api/v10/users/${discordUserId}`, {
        headers: { Authorization: `Bot ${config.DISCORD.TOKEN}` },
      });
      if (res.ok) {
        const data = await res.json() as { username?: string; global_name?: string | null };
        const name = data.global_name || data.username || discordUserId;
        this.discordUsernameCache.set(discordUserId, {
          name,
          expires: Date.now() + 60 * 60 * 1000,
        });
        return name;
      }
    } catch {
      // fallback abaixo
    }
    return discordUserId;
  }

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

  /** URL pública do painel (deve ser a mesma origem do browser para o cookie de sessão) */
  private getFrontendBase(): string {
    return config.DASHBOARD.FRONTEND_URL;
  }

  /** Discord OAuth — redirect_uri deve coincidir com o portal do Discord e com FRONTEND_URL */
  private getOAuthRedirectUri(): string {
    return `${this.getFrontendBase()}/auth/discord/callback`;
  }

  private saveSession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.save(err => (err ? reject(err) : resolve()));
    });
  }

  private setupExpress(): void {
    this.app.set('trust proxy', 1);
    /** VCF/CSV com milhares de contatos; padrão Express é 100kb */
    this.app.use(express.json({ limit: '16mb' }));

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
          const ok = await redisManager.setWithTTL(`${SESSION_PREFIX}${sid}`, JSON.stringify(sess), SESSION_TTL);
          if (!ok) {
            cb?.(new Error('Falha ao gravar sessão no Redis'));
            return;
          }
          cb?.();
        } catch (e) { cb?.(e); }
      }
      async touch(sid: string, sess: session.SessionData, cb?: (err?: any) => void) {
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

    const isProd = config.NODE_ENV === 'production';

    this.app.use(session({
      name: 'radarzap.sid',
      store: new IORedisSesionStore(),
      secret: config.SECURITY.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        secure: isProd ? config.SECURITY.COOKIE_SECURE : false,
        httpOnly: config.SECURITY.COOKIE_HTTP_ONLY,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        path: '/',
      },
    }));

    // Serve built React frontend
    const publicDir = path.join(__dirname, 'public');
    this.app.use(express.static(publicDir));

    // Auth routes (public)
    this.setupAuthRoutes();

    // Protected API routes — carrega AuthContext + capabilities
    this.app.use('/api', (req, res, next) => {
      loadAuthContext(req as DashboardRequest, res, next).catch(next);
    });
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

  /** Google OAuth redirect URI */
  private getGoogleOAuthRedirectUri(): string {
    return `${this.getFrontendBase()}/auth/google/callback`;
  }

  /**
   * Discord OAuth2 routes
   */
  private setupAuthRoutes(): void {
    const REDIRECT_URI = this.getOAuthRedirectUri();
    const GOOGLE_REDIRECT_URI = this.getGoogleOAuthRedirectUri();
    const SCOPES = 'identify';
    const orgSvc = OrganizationService.getInstance();

    logger.info('Discord OAuth redirect URI (cadastre no Discord Developer Portal)', {
      redirectUri: REDIRECT_URI,
      frontendUrl: this.getFrontendBase(),
    });
    logger.info('Google OAuth redirect URI (cadastre no Google Cloud Console → Credentials → Redirect URIs)', {
      redirectUri: GOOGLE_REDIRECT_URI,
      frontendUrl: this.getFrontendBase(),
    });

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
      const frontendBase = this.getFrontendBase();
      if (!code) return res.redirect(`${frontendBase}/?error=no_code`);

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
          const frontendBase = this.getFrontendBase();
          return res.redirect(`${frontendBase}/?error=token_failed`);
        }

        // Get Discord user info
        const userRes = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const discordUser = await userRes.json() as any;

        let dbUser = await User.findOne({ discordUserId: discordUser.id });
        if (!dbUser) {
          const created = await orgSvc.getOrCreateForDiscord(discordUser.id);
          dbUser = await User.findById(created._id);
          if (!dbUser) throw new Error('Falha ao criar usuário Discord');
          logger.info(`Conta RadarZap criada no login Discord: ${discordUser.username}`);
        } else {
          await orgSvc.ensureOrganization(dbUser);
        }

        const panelName =
          (discordUser.global_name as string | null)?.trim() ||
          (discordUser.username as string)?.trim();
        if (panelName) {
          dbUser.displayName = panelName;
          await dbUser.save();
        }

        const tenantId = await orgSvc.resolveClientId((dbUser._id as mongoose.Types.ObjectId).toString());

        // Store in session
        const sess = req.session as any;
        sess.userId       = (dbUser._id as mongoose.Types.ObjectId).toString();
        sess.discordId    = discordUser.id;
        sess.authProvider = 'discord';
        sess.username     = discordUser.username;
        sess.email        = dbUser.email ?? null;
        sess.avatar       = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : null;

        logger.info(`User logged in: ${discordUser.username} (${discordUser.id})`, {
          userId: sess.userId,
          organizationId: tenantId,
        });

        // Sincroniza papéis Discord (owner/admin) nos servidores do bot
        syncGuildMemberships(
          (dbUser._id as mongoose.Types.ObjectId).toString(),
          discordUser.id,
        ).catch(err => logger.warn('Guild sync failed on login', err));

        await this.saveSession(req);
        res.redirect(`${frontendBase}/dashboard`);

      } catch (err) {
        logger.error('OAuth2 callback error:', err);
        res.redirect(`${frontendBase}/?error=oauth_error`);
      }
    });

    // ── Google OAuth (dono da empresa / pagante) ───────────────────────────
    this.app.get('/auth/google', (_req, res) => {
      const clientId = config.GOOGLE.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return res.status(503).json({ error: 'Google OAuth não configurado (GOOGLE_CLIENT_ID)' });
      }
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('access_type', 'online');
      url.searchParams.set('prompt', 'select_account');
      res.redirect(url.toString());
    });

    this.app.get('/auth/google/callback', async (req: Request, res: Response) => {
      const { code } = req.query as { code?: string };
      const frontendBase = this.getFrontendBase();
      const clientId = config.GOOGLE.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
      const clientSecret = config.GOOGLE.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
      if (!code) return res.redirect(`${frontendBase}/?error=no_code`);
      if (!clientId || !clientSecret) {
        return res.redirect(`${frontendBase}/?error=google_not_configured`);
      }

      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code',
          }),
        });
        const tokenRaw = await tokenRes.text();
        let tokenData: { access_token?: string; error?: string; error_description?: string };
        try {
          tokenData = JSON.parse(tokenRaw) as typeof tokenData;
        } catch (parseErr) {
          logError(parseErr as Error, { step: 'google_token_json', status: tokenRes.status, raw: tokenRaw.slice(0, 200) });
          return res.redirect(`${frontendBase}/?error=token_failed`);
        }
        if (!tokenData.access_token) {
          logger.error('Google token exchange failed', {
            status: tokenRes.status,
            error: tokenData.error,
            description: tokenData.error_description,
            redirectUri: GOOGLE_REDIRECT_URI,
          });
          const errCode = tokenData.error === 'redirect_uri_mismatch' ? 'google_redirect_mismatch' : 'token_failed';
          return res.redirect(`${frontendBase}/?error=${errCode}`);
        }

        const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profile = await profileRes.json() as {
          sub?: string;
          email?: string;
          name?: string;
          picture?: string;
        };
        if (!profile.sub || !profile.email) {
          logger.warn('Google profile incomplete', { status: profileRes.status, profile });
          return res.redirect(`${frontendBase}/?error=google_profile`);
        }

        const { user } = await orgSvc.getOrCreateForGoogle({
          sub: profile.sub,
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
        });

        const sess = req.session as any;
        sess.userId = (user._id as mongoose.Types.ObjectId).toString();
        sess.authProvider = 'google';
        sess.email = profile.email;
        sess.username = profile.name ?? profile.email;
        sess.avatar = profile.picture ?? null;
        sess.discordId = user.discordUserId ?? null;

        logger.info(`Google login: ${profile.email}`, { userId: sess.userId });
        await this.saveSession(req);
        res.redirect(`${frontendBase}/dashboard`);
      } catch (err) {
        const message = (err as Error).message ?? '';
        logError(err as Error, { step: 'google_oauth_callback', redirectUri: GOOGLE_REDIRECT_URI });
        const errParam = message.includes('E11000') ? 'google_account_conflict' : 'oauth_error';
        res.redirect(`${frontendBase}/?error=${errParam}`);
      }
    });

    // Get current session info + RBAC (used by frontend)
    this.app.get('/auth/me', async (req: Request, res: Response) => {
      const sess = req.session as any;
      if (!sess?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      try {
        const user = await User.findById(sess.userId);
        if (!user) return res.status(401).json({ error: 'Not authenticated' });
        const ctx = await buildAuthContext({
          user,
          userId: sess.userId,
          discordUserId: sess.discordId ?? user.discordUserId,
          username: sess.username ?? user.displayName ?? user.email ?? 'Usuário',
          avatar: sess.avatar ?? null,
          authProvider: sess.authProvider,
          email: sess.email ?? user.email,
        });
        res.json(authContextToJson(ctx));
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
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
    r.get('/stats', requireCapability(Cap.DASHBOARD_VIEW), async (req, res) => {
      try {
        const stats = await this.buildStats();
        res.json(stats);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/platform/stats', requireCapability(Cap.DASHBOARD_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        res.json(await this.buildPlatformStats(auth));
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Health ─────────────────────────────────────────────────────────────
    r.get('/services/health', (_req, res) => {
      res.json({ healthy: true, uptime: process.uptime() });
    });

    // ── Sessions ───────────────────────────────────────────────────────────
    r.get('/sessions', requireCapability(Cap.WHATSAPP_SESSION_VIEW), async (req, res) => {
      try {
        res.json(await this.buildSessionsList(req as DashboardRequest));
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    /** Iniciar conexão WhatsApp (Evolution-style — retorna estado + QR) */
    r.post('/sessions/connect', requireCapability(Cap.WHATSAPP_SESSION_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientId = auth.clientId;
        const user = await User.findById(auth.userId);
        const org = await Organization.findById(clientId);
        if (!user && !org) {
          return res.status(400).json({
            error: 'Conta não encontrada. Faça login novamente.',
          });
        }

        const forceQr = (req.body as { forceQr?: boolean })?.forceQr === true;
        const wa = WhatsAppService.getInstance();
        const result = await wa.connectInstance(clientId, { forceQr });
        res.json({ ok: true, clientId, ...result });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    /** Evolution: GET /instance/connectionState/:instanceName */
    r.get('/sessions/:id/connectionState', requireCapability(Cap.WHATSAPP_SESSION_VIEW), requireSelfOrStaff('id'), async (req, res) => {
      try {
        const wa = WhatsAppService.getInstance();
        res.json(await wa.getConnectionState(req.params.id));
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    /** Evolution: GET /instance/connect/:instanceName — connect + QR síncrono */
    r.get('/sessions/:id/connect', requireCapability(Cap.WHATSAPP_SESSION_MANAGE), requireSelfOrStaff('id'), async (req, res) => {
      try {
        const wa = WhatsAppService.getInstance();
        const result = await wa.connectInstance(req.params.id);
        res.json(result);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/sessions/:id/connect', requireCapability(Cap.WHATSAPP_SESSION_MANAGE), requireSelfOrStaff('id'), async (req, res) => {
      try {
        const wa = WhatsAppService.getInstance();
        const result = await wa.connectInstance(req.params.id);
        res.json({ ok: true, ...result });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    /** Disconnect temporário — mantém credenciais */
    r.post('/sessions/:id/disconnect', requireCapability(Cap.WHATSAPP_SESSION_MANAGE), requireSelfOrStaff('id'), async (req, res) => {
      try {
        const wa = WhatsAppService.getInstance();
        const result = await wa.temporaryDisconnect(req.params.id);
        res.json({ ok: true, ...result });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    /** Evolution: DELETE /instance/logout — limpa credenciais WhatsApp */
    r.delete('/sessions/:id/logout', requireCapability(Cap.WHATSAPP_SESSION_MANAGE), requireSelfOrStaff('id'), async (req, res) => {
      try {
        const wa = WhatsAppService.getInstance();
        const result = await wa.logoutInstance(req.params.id);
        res.json({ ok: true, ...result });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    /** Evolution: POST /instance/restart */
    r.post('/sessions/:id/restart', requireCapability(Cap.WHATSAPP_SESSION_MANAGE), requireSelfOrStaff('id'), async (req, res) => {
      try {
        const wa = WhatsAppService.getInstance();
        const result = await wa.restartInstance(req.params.id);
        res.json({ ok: true, ...result });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Rules ──────────────────────────────────────────────────────────────
    r.get('/rules', requireCapability(Cap.SEND_RULES_MANAGE, { guildFromQuery: true }), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const orgSvc = OrganizationService.getInstance();
        const relatedIds = await orgSvc.getRelatedClientIds(auth.clientId);
        const { guildId } = req.query as { guildId?: string };
        const query: any = { clientId: { $in: relatedIds } };
        // Filter by guild if provided (rules have channelIds from that guild)
        if (guildId) {
          const channels = await DiscordChannel.find({ guildId, isActive: true }).lean();
          const channelIds = channels.map(c => c.channelId);
          if (channelIds.length > 0) {
            query['conditions.channelIds'] = { $in: channelIds };
          }
        }
        const rules = await Rule.find(query).sort({ createdAt: -1 }).lean();
        const blockSvc = RuleGroupBlockService.getInstance();
        const enriched = await Promise.all(
          rules.map(async rule => {
            if (!rule.isActive) return rule;
            const block = await blockSvc.checkRuleBlocked(
              auth.clientId,
              rule.action?.destinationIds as mongoose.Types.ObjectId[] | undefined,
            );
            if (!block.blocked) return rule;
            return {
              ...rule,
              executionBlock: {
                reason: block.reason,
                blockedGroupNames: block.blockedGroupNames,
              },
            };
          }),
        );
        res.json(enriched);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Alertas do menu Discord (notificação em Regras, Logs, etc.) ───────
    r.get('/discord/nav-alerts', requireCapability(Cap.SEND_RULES_MANAGE, { guildFromQuery: true }), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { guildId } = req.query as { guildId?: string };
        const data = await DiscordNavAlertsService.getInstance().getAlerts(
          auth.clientId,
          guildId,
        );
        res.json(data);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/rules', requireCapability(Cap.SEND_RULES_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const { name, priority, templateName, keywords, destinationIdentifiers, channelIds } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });

        // Resolve destination identifiers to ObjectIds
        let destinationIds: mongoose.Types.ObjectId[] = [];
        if (destinationIdentifiers?.length) {
          for (const identifier of destinationIdentifiers) {
            const dest = await Destination.findOne({ clientId: clientOid, identifier });
            if (dest) destinationIds.push(dest._id as mongoose.Types.ObjectId);
          }
        }

        const rule = await Rule.create({
          clientId: clientOid,
          name,
          isActive: true,
          conditions: {
            channelIds: channelIds ?? [],
            requireKeywords: keywords ? keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean) : [],
          },
          action: {
            destinationIds,
            templateName: templateName || 'dw-padrao',
            priority: priority || 'medium',
            addDelay: 0,
          },
        });
        res.json(rule);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.put('/rules/:id', requireCapability(Cap.SEND_RULES_MANAGE), async (req, res) => {
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

    r.post('/rules/:id/toggle', requireCapability(Cap.SEND_RULES_MANAGE), async (req, res) => {
      try {
        const rule = await Rule.findById(req.params.id);
        if (!rule) return res.status(404).json({ error: 'Rule not found' });
        await rule.toggle();
        res.json({ ok: true, isActive: rule.isActive });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.delete('/rules/:id', requireCapability(Cap.SEND_RULES_MANAGE), async (req, res) => {
      try {
        await Rule.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Templates (Discord → WhatsApp) ───────────────────────────────────────
    r.get('/templates', requireCapability(Cap.SEND_TEMPLATES_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const globals = await Template.find({ clientId: null, isDefault: true })
          .sort({ discordKind: 1, name: 1 })
          .lean();
        const overrides = await Template.find({ clientId: clientOid, isDefault: false })
          .sort({ name: 1 })
          .lean();
        const overrideByName = new Map(overrides.map(t => [t.name, t]));
        const merged = globals.map(g => overrideByName.get(g.name) ?? g);
        for (const o of overrides) {
          if (!merged.some(m => m.name === o.name)) merged.push(o);
        }
        res.json(merged);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/templates/variables', requireCapability(Cap.SEND_TEMPLATES_MANAGE), async (_req, res) => {
      try {
        const { DISCORD_WA_VARIABLE_DOCS } = await import('@/constants/discord-whatsapp-templates');
        res.json(DISCORD_WA_VARIABLE_DOCS);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch('/templates/:id', requireCapability(Cap.SEND_TEMPLATES_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { content, description } = req.body as { content?: string; description?: string };
        if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

        const tpl = await Template.findById(req.params.id);
        if (!tpl) return res.status(404).json({ error: 'Template not found' });

        const clientOid = new mongoose.Types.ObjectId(auth.clientId);

        if (tpl.isDefault && !tpl.clientId) {
          let customDoc = await Template.findOne({ name: tpl.name, clientId: clientOid });
          if (!customDoc) {
            const created = await Template.createTemplate(
              tpl.name,
              content.trim(),
              clientOid,
              false
            );
            created.description = description ?? tpl.description;
            created.discordKind = tpl.discordKind;
            await created.save();
            return res.json(created.toObject());
          } else {
            customDoc.content = content.trim();
            if (description !== undefined) customDoc.description = description;
            await customDoc.save();
          }
          return res.json(customDoc.toObject());
        }

        if (tpl.clientId && tpl.clientId.toString() !== auth.clientId) {
          return res.status(403).json({ error: 'Sem permissão' });
        }

        tpl.content = content.trim();
        if (description !== undefined) tpl.description = description;
        await tpl.save();
        res.json(tpl);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/templates/:id/reset', requireCapability(Cap.SEND_TEMPLATES_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const tpl = await Template.findById(req.params.id);
        if (!tpl) return res.status(404).json({ error: 'Template not found' });

        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        await Template.deleteOne({ name: tpl.name, clientId: clientOid, isDefault: false });

        const fresh = await Template.findByName(tpl.name);
        res.json(fresh ?? { ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Destinations ───────────────────────────────────────────────────────
    r.get('/destinations', requireCapability(Cap.CONSENT_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const destinations = await Destination.find({
          clientId: auth.clientId,
        }).lean();
        res.json(
          destinations.map(d => ({
            ...d,
            consentStatus:
              d.consentStatus ??
              (d.consent?.granted ? ConsentStatus.ACCEPTED : ConsentStatus.PENDING),
          })),
        );
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Grupos de contato (listas / segmentos) ─────────────────────────────
    r.get('/contact-groups', requireCapability(Cap.CONSENT_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const groups = await ContactGroup.find({ clientId: clientOid })
          .sort({ name: 1 })
          .lean();

        const counts = await Destination.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
          { $match: { clientId: clientOid, type: 'contact', isActive: true } },
          { $unwind: '$contactGroupIds' },
          { $group: { _id: '$contactGroupIds', count: { $sum: 1 } } },
        ]);
        const countMap = new Map(counts.map(c => [String(c._id), c.count]));

        res.json(
          groups.map(g => ({
            ...g,
            memberCount: countMap.get(String(g._id)) ?? 0,
          })),
        );
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/contact-groups', requireCapability(Cap.SEND_DESTINATION_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { name, description } = req.body as { name?: string; description?: string };
        const trimmed = name?.trim();
        if (!trimmed) return res.status(400).json({ error: 'name is required' });

        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const existing = await ContactGroup.findOne({ clientId: clientOid, name: trimmed });
        if (existing) return res.status(409).json({ error: 'Já existe um grupo com este nome' });

        const group = await ContactGroup.create({
          clientId: clientOid,
          name: trimmed,
          description: description?.trim() || undefined,
        });
        res.json({ ...group.toObject(), memberCount: 0 });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch('/contact-groups/:id', requireCapability(Cap.SEND_DESTINATION_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { name, description } = req.body as { name?: string; description?: string };
        const group = await ContactGroup.findOne({
          _id: req.params.id,
          clientId: auth.clientId,
        });
        if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });

        if (name !== undefined) {
          const trimmed = name.trim();
          if (!trimmed) return res.status(400).json({ error: 'name cannot be empty' });
          const dup = await ContactGroup.findOne({
            clientId: auth.clientId,
            name: trimmed,
            _id: { $ne: group._id },
          });
          if (dup) return res.status(409).json({ error: 'Já existe um grupo com este nome' });
          group.name = trimmed;
        }
        if (description !== undefined) {
          group.description = description.trim() || undefined;
        }
        await group.save();

        const memberCount = await Destination.countDocuments({
          clientId: auth.clientId,
          type: 'contact',
          isActive: true,
          contactGroupIds: group._id,
        });
        res.json({ ...group.toObject(), memberCount });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.delete('/contact-groups/:id', requireCapability(Cap.SEND_DESTINATION_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const group = await ContactGroup.findOne({
          _id: req.params.id,
          clientId: auth.clientId,
        });
        if (!group) return res.status(404).json({ error: 'Grupo não encontrado' });

        await Destination.updateMany(
          { clientId: auth.clientId, contactGroupIds: group._id },
          { $pull: { contactGroupIds: group._id } },
        );
        await group.deleteOne();
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch('/destinations/:id', requireCapability(Cap.SEND_DESTINATION_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const dest = await Destination.findOne({
          _id: req.params.id,
          clientId: auth.clientId,
        });
        if (!dest) return res.status(404).json({ error: 'Destino não encontrado' });

        const { name, contactGroupIds, email, notes, organization } = req.body as {
          name?: string;
          contactGroupIds?: string[];
          email?: string;
          notes?: string;
          organization?: string;
        };

        if (name !== undefined) {
          const trimmed = name.trim();
          if (!trimmed) return res.status(400).json({ error: 'name cannot be empty' });
          dest.name = trimmed;
        }
        if (email !== undefined) dest.email = email.trim() || undefined;
        if (notes !== undefined) dest.notes = notes.trim() || undefined;
        if (organization !== undefined) dest.organization = organization.trim() || undefined;

        if (contactGroupIds !== undefined) {
          if (!Array.isArray(contactGroupIds)) {
            return res.status(400).json({ error: 'contactGroupIds must be an array' });
          }
          const validGroups = await ContactGroup.find({
            clientId: auth.clientId,
            _id: { $in: contactGroupIds.filter(Boolean) },
          }).select('_id');
          const validIds = new Set(validGroups.map(g => String(g._id)));
          dest.contactGroupIds = contactGroupIds
            .filter(id => validIds.has(String(id)))
            .map(id => new mongoose.Types.ObjectId(id));
        }

        await dest.save();
        res.json({
          ...dest.toObject(),
          consentStatus:
            dest.consentStatus ??
            (dest.consent?.granted ? ConsentStatus.ACCEPTED : ConsentStatus.PENDING),
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/destinations', requireCapability(Cap.SEND_DESTINATION_MANAGE), async (req, res) => {
      try {
        const { type, identifier, name, contactGroupIds, email, organization, notes } = req.body;
        if (!type || !identifier || !name) return res.status(400).json({ error: 'type, identifier and name are required' });
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const org = await Organization.findById(clientOid);
        const user = await User.findById(auth.userId);
        if (!user && !org) return res.status(400).json({ error: 'Usuário não encontrado' });

        const limits = org?.limits ?? user!.limits;
        const activeCount = await Destination.countDocuments({
          clientId: clientOid,
          isActive: true,
        });
        const destQuota = validateDestinationAdd(limits, activeCount);
        if (destQuota.ok === false) return res.status(429).json({ error: destQuota.error });

        let normalizedId = String(identifier).trim();
        if (type === 'contact' && !normalizedId.startsWith('+')) {
          normalizedId = `+${normalizedId.replace(/\D/g, '')}`;
        }
        const dest = await Destination.createDestination(
          clientOid, type, normalizedId, name, 'manual', '127.0.0.1'
        );

        if (type === 'contact') {
          if (email !== undefined && String(email).trim()) {
            dest.email = String(email).trim();
          }
          if (organization !== undefined && String(organization).trim()) {
            dest.organization = String(organization).trim();
          }
          if (notes !== undefined && String(notes).trim()) {
            dest.notes = String(notes).trim();
          }
          if (Array.isArray(contactGroupIds) && contactGroupIds.length > 0) {
            const validGroups = await ContactGroup.find({
              clientId: auth.clientId,
              _id: { $in: contactGroupIds.filter(Boolean) },
            }).select('_id');
            dest.contactGroupIds = validGroups.map(g => g._id as mongoose.Types.ObjectId);
          }
          await dest.save();
        }

        res.json({
          ...dest.toObject(),
          consentStatus:
            dest.consentStatus ??
            (dest.consent?.granted ? ConsentStatus.ACCEPTED : ConsentStatus.PENDING),
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/destinations/import-csv', requireCapability(Cap.SEND_DESTINATION_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const body = req.body as {
          csv?: string;
          content?: string;
          dryRun?: boolean;
          format?: 'csv' | 'vcf' | 'auto';
        };
        const { dryRun = false, format = 'auto' } = body;
        const fileText =
          typeof body.content === 'string' && body.content.trim()
            ? body.content
            : body.csv;
        if (!fileText || typeof fileText !== 'string' || !fileText.trim()) {
          return res.status(400).json({
            error: 'Campo csv ou content é obrigatório (texto do arquivo)',
          });
        }
        const result = await processContactImport(auth.clientId, fileText, {
          dryRun: Boolean(dryRun),
          ipAddress: req.ip ?? '127.0.0.1',
          format,
        });
        res.json({
          success: true,
          format: result.format,
          profile: result.profile,
          preview: result.preview,
          totalLinhasDados: result.totalLinhasDados,
          report: result.report,
        });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.get('/destinations/export-csv', requireCapability(Cap.CONSENT_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const profile = req.query.profile as string | undefined;
        const { csv, filename, count, profile: usedProfile } = await exportContactsCsv(
          auth.clientId,
          profile,
        );
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-Export-Profile', usedProfile);
        res.setHeader('X-Export-Count', String(count));
        res.send(csv);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    // ── Templates Plataforma (pw-*, espelha fluxo dw-* Discord) ───────────
    const platformCats: PlatformTemplateCategory[] = [
      'birthday', 'informative', 'promo', 'reminder', 'custom',
    ];

    r.get('/platform/templates', requireCapability(Cap.SEND_TEMPLATES_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const merged = await listMergedPlatformTemplates(clientOid);
        res.json(merged);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/platform/templates/variables', requireCapability(Cap.SEND_TEMPLATES_MANAGE), async (_req, res) => {
      try {
        res.json(PLATFORM_WA_VARIABLE_DOCS);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/platform/templates/preview', requireCapability(Cap.SEND_TEMPLATES_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { name, content, variables, destinationId, mensagem } = req.body as {
          name?: string;
          content?: string;
          variables?: Record<string, string>;
          destinationId?: string;
          mensagem?: string;
        };
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        let vars = variables ?? {};

        if (destinationId) {
          const dest = await Destination.findOne({
            _id: destinationId,
            clientId: clientOid,
          });
          if (!dest) {
            return res.status(404).json({ error: 'Destino não encontrado' });
          }
          const org = await Organization.findById(auth.clientId);
          const owner = org
            ? await User.findById(org.ownerUserId)
            : await User.findById(auth.clientId);
          vars = {
            ...buildPlatformWhatsAppVariables(dest, org, owner, {
              mensagem: mensagem?.trim(),
            }),
            ...vars,
          };
        }

        let text: string | null = null;
        if (name?.trim()) {
          text = await renderPlatformTemplateForClient(clientOid, name.trim(), vars);
          if (!text) {
            text = renderPlatformCatalogTemplate(name.trim(), vars);
          }
        }
        if (!text && content?.trim()) {
          if (Object.keys(vars).length > 0) {
            let out = content.trim();
            for (const [k, v] of Object.entries(vars)) {
              out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v ?? ''));
            }
            text = out.replace(/\{[^}]+\}/g, '').trim();
          } else {
            text = previewPlatformTemplateContent(content.trim());
          }
        }
        if (!text) {
          return res.status(400).json({ error: 'Informe name (catálogo) ou content' });
        }
        res.json({ preview: text, variables: vars });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch('/platform/templates/:id', requireCapability(Cap.SEND_TEMPLATES_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { content, description } = req.body as { content?: string; description?: string };
        if (!content?.trim()) return res.status(400).json({ error: 'content é obrigatório' });

        const tpl = await PlatformTemplate.findById(req.params.id);
        if (!tpl) return res.status(404).json({ error: 'Modelo não encontrado' });

        const clientOid = new mongoose.Types.ObjectId(auth.clientId);

        if (tpl.isDefault && !tpl.clientId) {
          let customDoc = await PlatformTemplate.findOne({
            name: tpl.name,
            clientId: clientOid,
            isDefault: false,
          });
          if (!customDoc) {
            customDoc = await PlatformTemplate.create({
              organizationId: auth.organizationId
                ? new mongoose.Types.ObjectId(auth.organizationId)
                : null,
              clientId: clientOid,
              name: tpl.name,
              category: tpl.category,
              content: content.trim(),
              description: description ?? tpl.description,
              variables: extractTemplateVariables(content),
              isDefault: false,
            });
            return res.json(customDoc.toObject());
          }
          customDoc.content = content.trim();
          if (description !== undefined) customDoc.description = description;
          customDoc.variables = extractTemplateVariables(customDoc.content);
          await customDoc.save();
          return res.json(customDoc.toObject());
        }

        if (tpl.clientId && tpl.clientId.toString() !== auth.clientId) {
          return res.status(403).json({ error: 'Sem permissão' });
        }

        tpl.content = content.trim();
        if (description !== undefined) tpl.description = description;
        tpl.variables = extractTemplateVariables(tpl.content);
        await tpl.save();
        res.json(tpl);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/platform/templates/:id/reset', requireCapability(Cap.SEND_TEMPLATES_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const tpl = await PlatformTemplate.findById(req.params.id);
        if (!tpl) return res.status(404).json({ error: 'Modelo não encontrado' });

        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        await PlatformTemplate.deleteOne({
          name: tpl.name,
          clientId: clientOid,
          isDefault: false,
        });

        const fresh = await PlatformTemplate.findByName(tpl.name, clientOid);
        res.json(fresh ?? { ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/platform/templates', requireCapability(Cap.SEND_TEMPLATES_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { name, category, content } = req.body as {
          name?: string;
          category?: PlatformTemplateCategory;
          content?: string;
        };
        if (!name?.trim() || !content?.trim()) {
          return res.status(400).json({ error: 'name e content são obrigatórios' });
        }
        const trimmedName = name.trim();
        if (isPlatformCatalogName(trimmedName)) {
          return res.status(400).json({
            error: 'Nomes pw-* são reservados ao catálogo. Edite o modelo existente.',
          });
        }
        const cat = category && platformCats.includes(category) ? category : 'custom';
        const doc = await PlatformTemplate.create({
          organizationId: auth.organizationId
            ? new mongoose.Types.ObjectId(auth.organizationId)
            : null,
          clientId: new mongoose.Types.ObjectId(auth.clientId),
          name: trimmedName,
          category: cat,
          content: content.trim(),
          variables: extractTemplateVariables(content),
          isDefault: false,
        });
        res.status(201).json(doc);
      } catch (e: unknown) {
        const msg = (e as { code?: number }).code === 11000
          ? 'Já existe um modelo com este nome'
          : (e as Error).message;
        res.status(400).json({ error: msg });
      }
    });

    r.delete('/platform/templates/:id', requireCapability(Cap.SEND_TEMPLATES_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const doc = await PlatformTemplate.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Modelo não encontrado' });
        if (doc.isDefault && !doc.clientId) {
          return res.status(403).json({ error: 'Modelos do catálogo pw-* não podem ser removidos' });
        }
        if (isPlatformCatalogName(doc.name) && doc.clientId === null) {
          return res.status(403).json({ error: 'Modelos do catálogo pw-* não podem ser removidos' });
        }
        if (doc.clientId && doc.clientId.toString() !== auth.clientId) {
          return res.status(403).json({ error: 'Sem permissão' });
        }
        await doc.deleteOne();
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.delete('/destinations/:id', requireCapability(Cap.SEND_DESTINATION_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const dest = await Destination.findById(req.params.id);
        if (!dest) return res.status(404).json({ error: 'Destination not found' });
        if (dest.clientId.toString() !== auth.clientId) {
          return res.status(403).json({ error: 'Sem permissão' });
        }
        if (dest.type === 'contact') {
          const st =
            dest.consentStatus ??
            (dest.consent?.granted ? ConsentStatus.ACCEPTED : ConsentStatus.PENDING);
          if (isBlockedStatus(st) && !auth.capabilities.includes(Cap.CONSENT_CLEAR_REFUSAL)) {
            return res.status(403).json({
              error:
                'Contato com recusa registrada — apenas o dono pode remover. Use "Solicitar novo aceite" se o plano permitir.',
            });
          }
        }
        await dest.deleteOne();
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/destinations/:id/consent/history', requireCapability(Cap.CONSENT_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const dest = await Destination.findOne({
          _id: req.params.id,
          clientId: auth.clientId,
        });
        if (!dest) return res.status(404).json({ error: 'Contato não encontrado' });
        const history = await ConsentService.getInstance().getHistory(auth.clientId, req.params.id);
        res.json(history);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/destinations/:id/consent/request-renewal', requireCapability(Cap.CONSENT_REQUEST_RENEWAL), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { reason } = req.body as { reason?: string };
        const reqDoc = await ConsentService.getInstance().requestRenewal(
          auth.clientId,
          req.params.id,
          { userId: auth.userId, username: auth.username ?? auth.userId },
          reason,
        );
        res.json(reqDoc);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/destinations/:id/consent/clear-refusal', requireCapability(Cap.CONSENT_CLEAR_REFUSAL), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        await ConsentService.getInstance().clearRefusal(
          auth.clientId,
          req.params.id,
          { userId: auth.userId, username: auth.username ?? auth.userId },
        );
        res.json({ ok: true });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.get('/consent/renewals', requireCapability(Cap.CONSENT_APPROVE_RENEWAL), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const items = await ConsentService.getInstance().listPendingRenewals(auth.clientId);
        res.json(items);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/consent/renewals/:id/approve', requireCapability(Cap.CONSENT_APPROVE_RENEWAL), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        await ConsentService.getInstance().approveRenewal(
          auth.clientId,
          req.params.id,
          { userId: auth.userId, username: auth.username ?? auth.userId },
        );
        res.json({ ok: true });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/admin/destinations/:id/block', requireCapability(Cap.CONSENT_MANUAL_BLOCK), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        await ConsentService.getInstance().manualBlock(req.params.id, auth.userId);
        res.json({ ok: true });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    // ── Discord Channels ───────────────────────────────────────────────────
    r.get('/channels', requireCapability(Cap.DISCORD_CHANNELS_MANAGE, { guildFromQuery: true }), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const relatedIds = await OrganizationService.getInstance().getRelatedClientIds(auth.clientId);
        const { guildId } = req.query as { guildId?: string };
        const query: any = { isActive: true, clientId: { $in: relatedIds } };
        if (guildId) query.guildId = guildId;
        const channels = await DiscordChannel.find(query).lean();
        res.json(channels);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Discord Guilds + Channels from bot (for channel picker) ────────────
    r.get('/discord/guilds', requireCapability(Cap.DISCORD_SERVER_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const token = config.DISCORD.TOKEN;
        const botId  = config.DISCORD.CLIENT_ID;
        if (!token) return res.status(400).json({ error: 'DISCORD_TOKEN not configured' });

        const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
          headers: { Authorization: `Bot ${token}` },
        });
        const guilds = await guildsRes.json() as any[];

        const allowedIds = auth.isInternalStaff
          ? null
          : new Set(auth.guilds.map(g => g.guildId));

        const filtered = allowedIds
          ? guilds.filter((g: any) => allowedIds.has(g.id))
          : guilds;

        res.json(filtered.map((g: any) => ({
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

    r.get('/discord/guilds/:guildId/channels', requireCapability(Cap.DISCORD_CHANNELS_MANAGE, { guildFromParams: 'guildId' }), async (req, res) => {
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

    r.post('/channels', requireCapability(Cap.DISCORD_CHANNELS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const { guildId, channelId, channelName } = req.body;
        if (!guildId || !channelId) return res.status(400).json({ error: 'guildId and channelId are required' });
        const existing = await DiscordChannel.findOne({ guildId, channelId });
        if (existing) return res.status(409).json({ error: 'Channel already configured' });
        await OrganizationService.getInstance().linkGuildToOrganization(auth.clientId, guildId);
        const ch = await DiscordChannel.createChannel(guildId, channelId, clientOid);
        // Store channelName if provided (best-effort update)
        if (channelName) {
          await DiscordChannel.findByIdAndUpdate(ch._id, { channelName });
        }
        res.json(ch);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.delete('/channels/:id', requireCapability(Cap.DISCORD_CHANNELS_MANAGE), async (req, res) => {
      try {
        await DiscordChannel.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch('/channels/:id/toggle', requireCapability(Cap.DISCORD_CHANNELS_MANAGE), async (req, res) => {
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
    r.get('/queue', requireCapability(Cap.QUEUE_VIEW), async (_req, res) => {
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

    r.get('/queue/failed', requireCapability(Cap.QUEUE_VIEW), async (_req, res) => {
      try {
        // BullMQ doesn't expose failed jobs directly via QueueManager — return empty for now
        // TODO: expose getFailedJobs() in QueueManager
        res.json([]);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/queue/:id/retry', requireCapability(Cap.QUEUE_RETRY), async (req, res) => {
      try {
        // TODO: implement retry via QueueManager
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Logs ───────────────────────────────────────────────────────────────
    r.get('/logs', requireCapability(Cap.LOGS_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const {
          level,
          service,
          stage,
          q,
          discord,
          tenant,
          limit = '100',
        } = req.query as Record<string, string>;

        const and: Record<string, unknown>[] = [];
        const wantsTenant = tenant === '1';
        const hasGlobalLogs = auth.capabilities.includes(Cap.LOGS_GLOBAL);
        if (wantsTenant || (!hasGlobalLogs && !auth.isInternalStaff)) {
          and.push({ clientId: new mongoose.Types.ObjectId(auth.clientId) });
        }
        if (level) and.push({ level });
        if (stage) and.push({ 'metadata.stage': stage });
        if (service) {
          and.push({ service });
        } else if (discord === '1') {
          and.push({
            service: {
              $in: [
                'DiscordBotService',
                'QueueProcessorService',
                'WhatsAppService',
                'RulesEngine',
              ],
            },
          });
        }
        if (q?.trim()) {
          const term = q.trim();
          and.push({
            $or: [
              { message: { $regex: term, $options: 'i' } },
              { traceId: term },
              { 'metadata.messageId': term },
              { 'metadata.destination': { $regex: term, $options: 'i' } },
              { 'metadata.primaryLink': { $regex: term, $options: 'i' } },
              { 'metadata.pipeline': term },
            ],
          });
        }

        const query = and.length > 0 ? { $and: and } : {};

        const logs = await SystemLog.find(query)
          .sort({ timestamp: -1 })
          .limit(Math.min(parseInt(limit, 10) || 100, 300))
          .lean();
        res.json(logs);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Equipe da empresa ──────────────────────────────────────────────────
    r.get('/team/members', requireCapability(Cap.COMPANY_MEMBERS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const members = await OrganizationService.getInstance().listMembers(auth.organizationId);
        res.json(members);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/team/members', requireCapability(Cap.COMPANY_MEMBERS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { email, role } = req.body as { email?: string; role?: CompanyRole };
        if (!email?.trim()) return res.status(400).json({ error: 'E-mail obrigatório' });
        const validRoles = [CompanyRole.ADMIN, CompanyRole.ATTENDANT];
        if (!role || !validRoles.includes(role)) {
          return res.status(400).json({ error: 'Papel inválido (ADMIN ou ATTENDANT)' });
        }
        const member = await OrganizationService.getInstance().inviteMember(
          auth.organizationId,
          email.trim(),
          role,
          auth.userId,
        );
        res.json(member);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.delete('/team/members/:id', requireCapability(Cap.COMPANY_MEMBERS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        if (auth.companyRole !== CompanyRole.OWNER) {
          return res.status(403).json({ error: 'Apenas o dono pode remover membros' });
        }
        await OrganizationService.getInstance().removeMember(
          auth.organizationId,
          req.params.id,
          auth.companyRole!,
        );
        res.json({ ok: true });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    // ── Billing (conta própria — USER) ───────────────────────────────────
    r.get('/billing/me', requireCapability(Cap.BILLING_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const org = await Organization.findById(auth.organizationId).lean();
        if (!org) return res.status(404).json({ error: 'Organization not found' });
        res.json({
          _id: auth.organizationId,
          organizationName: org.name,
          plan: org.plan,
          limits: org.limits,
          usage: org.usage,
          companyRole: auth.companyRole,
          primaryRole: auth.primaryRole,
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Users / Plans (admin) ──────────────────────────────────────────────
    r.get('/users', requireCapability(Cap.SYSTEM_USERS_VIEW), async (_req, res) => {
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

    r.put('/users/:id/plan', requireCapability(Cap.SYSTEM_PLANS_MANAGE), async (req, res) => {
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

    r.post('/users/:id/reset-usage', requireCapability(Cap.SYSTEM_PLANS_MANAGE), async (req, res) => {
      try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        await user.resetDailyUsage();
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    const mountPlatformAutomationRoutes = (basePath: string) => {
    r.get(basePath, requireCapability(Cap.SEND_SCHEDULE_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const orgOid = new mongoose.Types.ObjectId(auth.clientId);
        const rules = await BirthdayAutomationRule.find({ organizationId: orgOid })
          .sort({ updatedAt: -1 })
          .lean();
        res.json(rules);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post(basePath, requireCapability(Cap.SEND_SCHEDULE_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const body = req.body as {
          name?: string;
          templateName?: string;
          triggerType?: string;
          dayOfMonth?: number;
          intervalMonths?: number;
          nthBusinessDay?: number;
          weekday?: number;
          scheduledAt?: string;
          sendTime?: string;
          active?: boolean;
          destinationScope?: string;
          contactGroupIds?: string[];
          whatsappDestinationIds?: string[];
          messageMode?: string;
          customMessage?: string;
          destinationFilterTags?: string[];
          mensagemExtra?: string;
        };
        const validationErr = validateAutomationPayload(body);
        if (validationErr) return res.status(400).json({ error: validationErr });
        const doc = await BirthdayAutomationRule.create({
          organizationId: new mongoose.Types.ObjectId(auth.clientId),
          name: body.name?.trim() || 'Automação',
          templateName: body.templateName?.trim() || 'pw-aniversario',
          triggerType: body.triggerType ?? 'on_contact_birthday',
          dayOfMonth: body.dayOfMonth,
          intervalMonths: body.intervalMonths,
          nthBusinessDay: body.nthBusinessDay,
          weekday: body.weekday,
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
          sendTime: body.sendTime?.trim() || '09:00',
          active: body.active !== false,
          destinationScope: body.destinationScope ?? 'contacts',
          contactGroupIds: body.contactGroupIds?.map(id => new mongoose.Types.ObjectId(id)),
          whatsappDestinationIds: body.whatsappDestinationIds?.map(
            id => new mongoose.Types.ObjectId(id),
          ),
          messageMode: body.messageMode ?? 'platform_template',
          customMessage: body.customMessage?.trim(),
          destinationFilterTags: body.destinationFilterTags?.filter(Boolean),
          mensagemExtra: body.mensagemExtra?.trim(),
        });
        res.status(201).json(doc);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch(`${basePath}/:id`, requireCapability(Cap.SEND_SCHEDULE_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const doc = await BirthdayAutomationRule.findOne({
          _id: req.params.id,
          organizationId: new mongoose.Types.ObjectId(auth.clientId),
        });
        if (!doc) return res.status(404).json({ error: 'Regra não encontrada' });
        const body = req.body as Record<string, unknown>;
        const merged = {
          triggerType: (body.triggerType ?? doc.triggerType) as string,
          dayOfMonth: (body.dayOfMonth ?? doc.dayOfMonth) as number | undefined,
          intervalMonths: (body.intervalMonths ?? doc.intervalMonths) as number | undefined,
          nthBusinessDay: (body.nthBusinessDay ?? doc.nthBusinessDay) as number | undefined,
          weekday: (body.weekday ?? doc.weekday) as number | undefined,
          scheduledAt: (body.scheduledAt ?? doc.scheduledAt?.toISOString()) as string | undefined,
          messageMode: (body.messageMode ?? doc.messageMode) as string,
          customMessage: (body.customMessage ?? doc.customMessage) as string | undefined,
          mensagemExtra: (body.mensagemExtra ?? doc.mensagemExtra) as string | undefined,
          destinationScope: (body.destinationScope ?? doc.destinationScope) as string,
        };
        const validationErr = validateAutomationPayload(merged);
        if (validationErr) return res.status(400).json({ error: validationErr });
        if (body.name !== undefined) doc.name = String(body.name).trim() || 'Automação';
        if (body.templateName !== undefined) doc.templateName = String(body.templateName).trim();
        if (body.triggerType !== undefined) doc.triggerType = body.triggerType as IBirthdayAutomationRule['triggerType'];
        if (body.dayOfMonth !== undefined) doc.dayOfMonth = Number(body.dayOfMonth);
        if (body.intervalMonths !== undefined) doc.intervalMonths = Number(body.intervalMonths);
        if (body.nthBusinessDay !== undefined) doc.nthBusinessDay = Number(body.nthBusinessDay);
        if (body.weekday !== undefined) doc.weekday = Number(body.weekday);
        if (body.scheduledAt !== undefined) doc.scheduledAt = new Date(String(body.scheduledAt));
        if (body.sendTime !== undefined) doc.sendTime = String(body.sendTime).trim();
        if (body.active !== undefined) doc.active = Boolean(body.active);
        if (body.destinationScope !== undefined) {
          doc.destinationScope = body.destinationScope as IBirthdayAutomationRule['destinationScope'];
        }
        if (body.contactGroupIds !== undefined) {
          doc.contactGroupIds = (body.contactGroupIds as string[]).map(
            id => new mongoose.Types.ObjectId(id),
          );
        }
        if (body.whatsappDestinationIds !== undefined) {
          doc.whatsappDestinationIds = (body.whatsappDestinationIds as string[]).map(
            id => new mongoose.Types.ObjectId(id),
          );
        }
        if (body.messageMode !== undefined) {
          doc.messageMode = body.messageMode as IBirthdayAutomationRule['messageMode'];
        }
        if (body.customMessage !== undefined) doc.customMessage = String(body.customMessage).trim();
        if (body.destinationFilterTags !== undefined) {
          doc.destinationFilterTags = (body.destinationFilterTags as string[]).filter(Boolean);
        }
        if (body.mensagemExtra !== undefined) doc.mensagemExtra = String(body.mensagemExtra).trim();
        await doc.save();
        res.json(doc);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.delete(`${basePath}/:id`, requireCapability(Cap.SEND_SCHEDULE_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const result = await BirthdayAutomationRule.deleteOne({
          _id: req.params.id,
          organizationId: new mongoose.Types.ObjectId(auth.clientId),
        });
        if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'Regra não encontrada' });
        }
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post(`${basePath}/run-now`, requireCapability(Cap.SEND_SCHEDULE_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const rules = await BirthdayAutomationRule.find({
          organizationId: new mongoose.Types.ObjectId(auth.clientId),
          active: true,
        });
        const svc = BirthdayAutomationService.getInstance();
        let total = 0;
        for (const rule of rules) {
          total += await svc.processRule(rule);
        }
        res.json({ ok: true, enqueued: total });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });
    };

    mountPlatformAutomationRoutes('/platform/automations');
    mountPlatformAutomationRoutes('/platform/birthday-automation');

    // ── Campanhas / Enviar agora ───────────────────────────────────────────
    r.get('/campaigns', requireCapability(Cap.SEND_TEST), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const status = (req.query.status as string) || undefined;
        const items = await MessageQueue.findByClientId(clientOid, status);
        const destDocs = await Destination.find({ clientId: clientOid }).lean();
        const consentByPhone = new Map(
          destDocs
            .filter(d => d.type === 'contact')
            .map(d => [
              d.identifier,
              d.consentStatus ??
                (d.consent?.granted ? ConsentStatus.ACCEPTED : ConsentStatus.PENDING),
            ]),
        );
        res.json(
          items.map(m => ({
            _id: m._id,
            title: (m.content.variables as { title?: string })?.title ?? 'Envio',
            message: m.content.text,
            destinations: m.destinations.map(d => ({
              ...d,
              consentStatus:
                d.type === 'contact' ? consentByPhone.get(d.identifier) : undefined,
            })),
            status: m.status,
            priority: m.priority,
            scheduledFor: m.scheduledFor,
            createdAt: m.createdAt,
            processedAt: m.processedAt,
            lastError: m.lastError,
            delayBetweenMs: (m.content.variables as { delayBetweenMs?: number })?.delayBetweenMs,
            sentCount: (m.content.variables as { sentCount?: number })?.sentCount ?? 0,
            acceptWhatsAppRisk: (m.content.variables as { acceptWhatsAppRisk?: boolean })?.acceptWhatsAppRisk === true,
            messageMode: (m.content.variables as { messageMode?: string })?.messageMode,
            platformTemplateName: (m.content.variables as { platformTemplateName?: string })?.platformTemplateName,
          })),
        );
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/campaigns/validate-destinations', requireCapability(Cap.SEND_TEST), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const destinationIds = (req.body as { destinationIds?: string[] })?.destinationIds;
        if (!destinationIds?.length) {
          return res.json({ ok: true });
        }

        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const destDocs = await Destination.find({
          _id: { $in: destinationIds },
          clientId: clientOid,
        });

        const groupDests = destDocs
          .filter(d => d.type === 'group')
          .map(d => ({
            identifier: d.identifier,
            name: d.name,
            destinationId: String(d._id),
          }));
        const contactDests = destDocs
          .filter(d => d.type === 'contact')
          .map(d => ({
            identifier: d.identifier,
            name: d.name,
            destinationId: String(d._id),
          }));

        if (groupDests.length === 0) {
          return res.json({ ok: true, contactsNotInGroup: [] as string[] });
        }

        const waCheck = WhatsAppService.getInstance();
        if (!waCheck.isClientConnected(auth.clientId)) {
          return res.json({
            ok: false,
            error:
              'WhatsApp não conectado — reconecte para validar envio em grupos.',
            contactsNotInGroup: [] as string[],
          });
        }

        const allContactDocs = await Destination.find({
          clientId: clientOid,
          type: 'contact',
        });
        const contactsNotInGroup = await waCheck.listContactIdsNotInGroups(
          auth.clientId,
          groupDests,
          allContactDocs.map(d => ({
            identifier: d.identifier,
            destinationId: String(d._id),
          })),
        );

        const { error: groupErr, invalidDestinationIds } =
          await waCheck.validateGroupMembershipDetailed(
            auth.clientId,
            groupDests,
            contactDests,
          );
        if (groupErr) {
          return res.json({
            ok: false,
            error: groupErr,
            invalidDestinationIds,
            contactsNotInGroup: [], // erro de sessão — não marcar todos os contatos
          });
        }

        res.json({ ok: true, contactsNotInGroup });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/campaigns', requireCapability(Cap.SEND_TEST), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const body = req.body as {
          title?: string;
          message?: string;
          destinationIds?: string[];
          sendAt?: string | null;
          priority?: CampaignPriority;
          delayBetweenMs?: number;
          requireConnected?: boolean;
          acceptWhatsAppRisk?: boolean;
          messageMode?: 'plain' | 'platform_template';
          platformTemplateName?: string;
          templateMensagem?: string;
        };

        const usePlatformTemplate =
          body.messageMode === 'platform_template' && !!body.platformTemplateName?.trim();

        if (!usePlatformTemplate) {
          const msgCheck = validateMessageText(body.message);
          if (msgCheck.ok === false) return res.status(400).json({ error: msgCheck.error });
        } else if (!body.platformTemplateName?.startsWith('pw-')) {
          return res.status(400).json({ error: 'Selecione um modelo plataforma (pw-*)' });
        }

        const titleCheck = validateCampaignTitle(body.title);
        if (titleCheck.ok === false) return res.status(400).json({ error: titleCheck.error });

        if (!body.destinationIds?.length) {
          return res.status(400).json({ error: 'Selecione ao menos um destino' });
        }

        const createCheck = validateCampaignCreate(body.destinationIds.length);
        if (createCheck.ok === false) {
          return res.status(400).json({ error: createCheck.error });
        }

        const acceptRisk = body.acceptWhatsAppRisk === true;

        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const destDocs = await Destination.find({
          _id: { $in: body.destinationIds },
          clientId: clientOid,
        });

        if (destDocs.length !== body.destinationIds.length) {
          return res.status(400).json({ error: 'Um ou mais destinos são inválidos ou inativos' });
        }

        const consentSvc = ConsentService.getInstance();
        for (const d of destDocs) {
          if (d.type === 'group') {
            if (!d.isActive) {
              return res.status(400).json({ error: `${d.name}: grupo inativo ou removido` });
            }
            continue;
          }
          const err = consentSvc.assertCanSend(d);
          if (err) {
            return res.status(400).json({ error: `${d.name}: ${err}` });
          }
          if (!d.isActive && d.hasValidConsent()) {
            d.isActive = true;
            await d.save();
          }
        }

        const groupDests = destDocs
          .filter(d => d.type === 'group')
          .map(d => ({
            identifier: d.identifier,
            name: d.name,
            destinationId: String(d._id),
          }));
        const contactDests = destDocs
          .filter(d => d.type === 'contact')
          .map(d => ({
            identifier: d.identifier,
            name: d.name,
            destinationId: String(d._id),
          }));

        if (groupDests.length > 0) {
          const waCheck = WhatsAppService.getInstance();
          if (!waCheck.isClientConnected(auth.clientId)) {
            return res.status(400).json({
              error:
                'WhatsApp não está conectado. Reconecte em Plataforma → Conexão WhatsApp antes de enviar para grupos.',
            });
          }
          const groupErr = await waCheck.validateGroupMembershipForSend(
            auth.clientId,
            groupDests,
            contactDests,
          );
          if (groupErr) {
            return res.status(400).json({ error: groupErr });
          }
        }

        let sendAt: Date | undefined;
        if (body.sendAt) {
          sendAt = new Date(body.sendAt);
          if (Number.isNaN(sendAt.getTime())) {
            return res.status(400).json({ error: 'Data/horário de agendamento inválido' });
          }
          if (sendAt <= new Date()) {
            return res.status(400).json({ error: 'O agendamento deve ser no futuro' });
          }
        }

        const wa = WhatsAppService.getInstance();
        const isImmediate = !sendAt;
        if (isImmediate && !wa.isClientConnected(auth.clientId)) {
          return res.status(400).json({
            error:
              'WhatsApp não está conectado. Reconecte em Plataforma → Conexão WhatsApp antes de enviar agora.',
          });
        }

        const dispatcher = CampaignDispatchService.getInstance();
        const msg = await dispatcher.createCampaign({
          clientId: auth.clientId,
          title: body.title?.trim() || `Envio ${new Date().toLocaleString('pt-BR')}`,
          message: (body.message ?? '').trim() || ' ',
          destinations: destDocs.map(d => ({
            type: d.type as 'group' | 'contact',
            identifier: d.identifier,
            name: d.name,
          })),
          sendAt,
          priority: body.priority,
          delayBetweenMs: normalizeDelayBetweenMs(body.delayBetweenMs, acceptRisk),
          requireConnected: body.requireConnected,
          acceptWhatsAppRisk: acceptRisk,
          messageMode: usePlatformTemplate ? 'platform_template' : 'plain',
          platformTemplateName: usePlatformTemplate
            ? body.platformTemplateName!.trim()
            : undefined,
          templateVariables: usePlatformTemplate
            ? { mensagem: body.templateMensagem?.trim() }
            : undefined,
          perDestinationRender: true,
        });

        const isScheduled = Boolean(sendAt && sendAt > new Date());
        const vars = msg.content.variables as { sentIndex?: number; sentCount?: number };
        const queued = msg.status === 'pending' && (vars.sentIndex ?? 0) < destDocs.length;

        let resultMessage: string;
        if (isScheduled) {
          resultMessage = `Agendado para ${sendAt!.toLocaleString('pt-BR')}`;
        } else if (msg.status === 'sent') {
          resultMessage = `Enviado para ${destDocs.length} destino(s)`;
        } else if (queued) {
          const done = vars.sentCount ?? vars.sentIndex ?? 0;
          resultMessage = acceptRisk
            ? `Enviando ${done}/${destDocs.length}… restante continua na fila.`
            : `Fila segura: ${done}/${destDocs.length} enviados — lotes de ~${WHATSAPP_LIMITS.SAFE_BATCH_SIZE}/min até concluir.`;
        } else if (msg.lastError) {
          resultMessage = msg.lastError;
        } else {
          resultMessage = 'Campanha criada — acompanhe em Agendamentos / Histórico.';
        }

        res.json({
          ok: true,
          id: msg._id,
          status: msg.status,
          scheduled: isScheduled,
          queued,
          message: resultMessage,
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.delete('/campaigns/:id', requireCapability(Cap.SEND_TEST), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const ok = await CampaignDispatchService.getInstance().cancelCampaign(
          req.params.id,
          auth.clientId,
        );
        if (!ok) return res.status(404).json({ error: 'Agendamento não encontrado ou já processado' });
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Test Send (legado — um destino) ────────────────────────────────────
    r.post('/test-send', requireCapability(Cap.SEND_TEST), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { destination, message } = req.body as { destination?: string; message?: string };
        if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
        if (!destination?.trim()) {
          return res.status(400).json({ error: 'Selecione um destino WhatsApp' });
        }

        const clientId = auth.clientId;
        const clientOid = new mongoose.Types.ObjectId(clientId);
        const wa = WhatsAppService.getInstance();

        if (!wa.isClientConnected(clientId)) {
          return res.status(400).json({
            error:
              'WhatsApp não está conectado nesta empresa. Abra Plataforma → Conexão WhatsApp (com a mesma conta do painel) e escaneie o QR.',
          });
        }

        const destDoc = await Destination.findByIdentifier(destination.trim(), clientOid);
        if (!destDoc) {
          return res.status(400).json({ error: `Destino "${destination}" não encontrado na sua conta` });
        }

        await wa.sendTestMessageFromDashboard(clientId, destination.trim(), message.trim());

        res.json({
          ok: true,
          message: `Mensagem enviada para ${destDoc.name}`,
          destination: destDoc.name,
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    this.app.use('/api', r);

    this.app.use((err: { type?: string; status?: number; statusCode?: number; message?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      const tooLarge =
        err?.type === 'entity.too.large' ||
        err?.status === 413 ||
        err?.statusCode === 413;
      if (tooLarge) {
        return res.status(413).json({
          error:
            'Arquivo muito grande. O limite é 16 MB por importação (até ~5000 contatos em VCF/CSV).',
        });
      }
      next(err);
    });
  }

  // ─── Socket.IO ────────────────────────────────────────────────────────────

  private setupSocket(): void {
    this.io.on('connection', (socket) => {
      logger.debug(`Dashboard client connected: ${socket.id}`);
      this.buildStats().then(stats => socket.emit('stats', stats)).catch(() => {});
      socket.on('disconnect', () => logger.debug(`Dashboard client disconnected: ${socket.id}`));
    });
  }

  /** Lista sessões WhatsApp com estado live e perfil WA */
  private async buildSessionsList(req: DashboardRequest): Promise<Array<{
    clientId: string;
    discordUserId: string;
    displayName: string;
    status: string;
    state: string;
    lastActivity?: Date | string;
    qrCode?: string;
    qrCount?: number;
    profileName?: string;
    phoneNumber?: string;
        profilePictureUrl?: string;
        wuid?: string;
        hasPersistedSession: boolean;
        waAccountType?: 'web' | 'business';
      }>> {
    const wa = WhatsAppService.getInstance();
    const auth = req.auth!;

    if (!auth.isInternalStaff) {
      const clientId = auth.clientId;
      const details = await wa.getSessionDetails(clientId);
      const user = await User.findById(auth.userId).lean();
      const displayName =
        auth.organizationName ??
        (await this.resolveDiscordDisplayName(user?.discordUserId)) ??
        auth.username;

      return [{
        clientId,
        discordUserId: user?.discordUserId ?? auth.discordUserId ?? '',
        displayName,
        status: details.status,
        state: details.state,
        lastActivity: details.lastActivity,
        qrCode: details.qrCode,
        qrCount: details.qrCount,
        profileName: details.profileName,
        phoneNumber: details.phoneNumber,
        profilePictureUrl: details.profilePictureUrl,
        wuid: details.wuid,
        waAccountType: details.waAccountType,
        hasPersistedSession: details.hasPersistedSession,
      }];
    }

    const users = await User.find({ discordUserId: { $ne: 'system' } }).lean();

    const sessions = await Promise.all(users.map(async (u) => {
      const userId = (u._id as mongoose.Types.ObjectId).toString();
      const clientId = await OrganizationService.getInstance().resolveClientId(userId);
      const details = await wa.getSessionDetails(clientId);
      const displayName = await this.resolveDiscordDisplayName(u.discordUserId);

      return {
        clientId,
        discordUserId: u.discordUserId,
        displayName,
        status: details.status,
        state: details.state,
        lastActivity: details.lastActivity,
        qrCode: details.qrCode,
        qrCount: details.qrCount,
        profileName: details.profileName,
        phoneNumber: details.phoneNumber,
        profilePictureUrl: details.profilePictureUrl,
        wuid: details.wuid,
        waAccountType: details.waAccountType,
        hasPersistedSession: details.hasPersistedSession,
      };
    }));

    return sessions
      .filter((s) => {
        if (s.clientId === auth.clientId) return true;
        return s.status !== 'disconnected';
      })
      .sort((a, b) => {
      const rank = (s: typeof a) => {
        if (s.status === 'connected') return 0;
        if (s.status === 'qr-required' || s.status === 'connecting') return 1;
        if (s.hasPersistedSession) return 2;
        return 3;
      };
      return rank(a) - rank(b);
    });
  }

  private async buildPlatformStats(auth: DashboardRequest['auth']) {
    const clientOid = new mongoose.Types.ObjectId(auth!.clientId);
    const orgOid = new mongoose.Types.ObjectId(auth!.organizationId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const wa = WhatsAppService.getInstance();
    const [contactsCount, messagesToday, waState, org, queuePending, discordRules] =
      await Promise.all([
        Destination.countDocuments({ clientId: clientOid, type: 'contact', isActive: true }),
        SystemLog.countDocuments({
          clientId: clientOid,
          message: 'Message sent successfully',
          timestamp: { $gte: startOfDay },
        }),
        wa.getConnectionState(auth!.clientId).catch(() => ({ state: 'close', status: 'disconnected' })),
        Organization.findById(orgOid).lean(),
        MessageQueue.countDocuments({
          clientId: clientOid,
          status: { $in: ['pending', 'processing'] },
        }),
        Rule.countDocuments({ clientId: clientOid, isActive: true }),
      ]);

    const linkedGuilds = org?.linkedGuildIds?.length ?? 0;
    const waStatus =
      (waState as { status?: string }).status ??
      ((waState as { state?: string }).state === 'open' ? 'connected' : 'disconnected');

    return {
      contactsCount,
      messagesToday,
      waStatus,
      waState: (waState as { state?: string }).state ?? 'close',
      queuePending,
      discord: {
        linkedGuilds,
        activeRules: discordRules,
        enabled: linkedGuilds > 0 || discordRules > 0,
      },
    };
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

    // Real-time WhatsApp session updates (QR, connected, etc.)
    try {
      await this.redisManager.subscribe('radarzap:wa-session', (message) => {
        try {
          const payload = JSON.parse(message) as Record<string, unknown>;

          if (payload.event === 'QRCODE_UPDATED') {
            const data = payload.data as { qrcode?: { base64?: string } };
            this.io.emit('session:update', {
              event: 'QRCODE_UPDATED',
              clientId: payload.clientId,
              qrCode: data?.qrcode?.base64,
              status: 'qr-required',
            });
          } else if (payload.event === 'CONNECTION_UPDATE') {
            const data = payload.data as { state?: string };
            const statusMap: Record<string, string> = {
              open: 'connected',
              connecting: 'connecting',
              close: 'disconnected',
            };
            this.io.emit('session:update', {
              event: 'CONNECTION_UPDATE',
              clientId: payload.clientId,
              status: statusMap[data?.state ?? ''] ?? 'disconnected',
            });
          } else if (payload.clientId && payload.status) {
            this.io.emit('session:update', {
              ...payload,
              status: payload.status,
            });
          }
        } catch {
          // ignore malformed messages
        }
      });
    } catch (err) {
      logger.warn('Redis pub/sub for sessions unavailable — dashboard will poll only');
    }

    mountBullBoard(this.app, (req, res, next) => {
      loadAuthContext(req as DashboardRequest, res, () => {
        requireCapability(Cap.QUEUE_GLOBAL)(req as DashboardRequest, res, next);
      }).catch(next);
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
