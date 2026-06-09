/*
 * RadarZap / RadarGamer
 * Copyright (c) 2026 Benhur Augusto Gomes Monteiro Faria
 * Todos os direitos reservados.
 * Uso, cópia, distribuição ou modificação sem autorização é proibido.
 */

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
import crypto from 'crypto';
import { createServiceLogger, logError } from '../../utils/logger';
import { QueueManager } from '../../cache/QueueManager';
import { SessionCache } from '../../cache/SessionCache';
import { RedisManager } from '../../cache/RedisManager';
import { DatabaseManager } from '../../database/DatabaseManager';
import { User, Destination, SystemLog, WhatsAppSession, DiscordChannel, MessageQueue, ContactGroup } from '../../models';
import { CampaignDispatchService, type CampaignPriority } from '../send/CampaignDispatchService';
import { StatusDispatchService } from '../send/StatusDispatchService';
import { StatusPost } from '../../models/StatusPost';
import { parseAndValidateStatusImage } from '../../utils/safe-image-upload';
import { ConsentService } from '../consent/ConsentService';
import { OrganizationService } from '../organization/OrganizationService';
import { OrganizationDeletionService } from '../organization/OrganizationDeletionService';
import { Organization } from '../../models/Organization';
import { CompanyMember } from '../../models/CompanyMember';
import { CompanyRole } from '../../auth/rbac/roles';
import {
  assignableCapabilitiesForOrg,
  INVITEABLE_ROLES,
  permissionGroupsForOrg,
} from '../../auth/rbac/companyRolePresets';
import type { Capability } from '../../auth/rbac/capabilities';
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
import {
  buildPlatformPreviewSampleVariables,
  buildPlatformWhatsAppVariables,
} from '../../utils/platform-wa-variables';
import { validateOptionalCampaignSendAt } from '../../utils/schedule-time';
import { BirthdayAutomationRule, type IBirthdayAutomationRule } from '../../models/BirthdayAutomationRule';
import { ApiKey } from '../../models/ApiKey';
import { WebhookEndpoint, WEBHOOK_EVENTS, type WebhookEvent } from '../../models/WebhookEndpoint';
import { AuditLog, writeAuditLog } from '../../models/AuditLog';
import { generateApiKeyRaw, hashApiKey, apiKeyPrefix, generateWebhookSecret } from '../../utils/api-key';
import { OPENAPI_DASHBOARD } from '../../constants/openapi-dashboard';
import { DiscordNavAlertsService } from '../discord/DiscordNavAlertsService';
import { RuleGroupBlockService } from '../rules/RuleGroupBlockService';
import { InboxService } from '../inbox/InboxService';
import { setInboxSocketServer } from '../inbox/InboxRealtime';
import { setPanelSocketServer } from '../inbox/PanelNotifications';
import { InboxReportsService } from '../inbox/InboxReportsService';
import { BirthdayAutomationService } from '../platform/BirthdayAutomationService';
import { BillingService, BillingHttpError } from '../billing/BillingService';
import { BillingOrder } from '../../models/BillingOrder';
import { TenantBackupService } from '../tenant-backup/TenantBackupService';
import {
  validateAutomationPayload,
} from '../../constants/platform-automation-triggers';
import mongoose from 'mongoose';
import { mountBullBoard } from '../monitoring/bullBoard';
import { WhatsAppService } from '../whatsapp/WhatsAppService';
import {
  loadAuthContext,
  requireCapability,
  requireAnyCapability,
  requireSelfOrStaff,
  assertOwnClient,
  authContextToJson,
  buildAuthContext,
  syncGuildMemberships,
  Cap,
  DashboardRequest,
} from '../../auth/rbac';
import helmet from 'helmet';
import { securityMiddleware } from '../../middleware/security';
import { rateLimiters } from '../../middleware/rateLimiter';
import { redactEmail, redactOAuthError, escapeMongoRegex } from '../../utils/redact-sensitive';
import { encryptField } from '../../utils/field-encryption';
import { requireDashboardOrigin } from '../../middleware/same-origin';
import { productionSafeError } from '../../middleware/production-safe-error';
import { AiSettingsService } from '../ai/AiSettingsService';
import { AiProviderService } from '../ai/AiProviderService';
import { AiUsageMeterService } from '../ai/AiUsageMeterService';
import { AiConversationService } from '../ai/AiConversationService';

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
    const allowedSocketOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5174',
      config.DASHBOARD.FRONTEND_URL,
      config.CORS_ORIGIN,
    ].filter(Boolean);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: allowedSocketOrigins,
        credentials: true,
      },
    });
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

  /** Uma empresa → dashboard; várias → tela de escolha (mantém sessão se já válida). */
  private async resolvePostLoginPath(req: Request, userId: string): Promise<string> {
    const orgSvc = OrganizationService.getInstance();
    let orgs = await orgSvc.listOrganizationsForUser(userId);

    if (!orgs.length) {
      const user = await User.findById(userId);
      if (user) {
        await orgSvc.ensureOrganization(user);
        orgs = await orgSvc.listOrganizationsForUser(userId);
      }
    }

    const sess = req.session as { organizationId?: string };

    if (orgs.length === 1) {
      sess.organizationId = orgs[0].organizationId;
      await orgSvc.setPrimaryOrganization(userId, orgs[0].organizationId).catch(() => undefined);
      return '/dashboard';
    }

    if (orgs.length > 1) {
      const remembered = orgs.find(o => o.organizationId === sess.organizationId);
      if (remembered) return '/dashboard';
      delete sess.organizationId;
      return '/choose-company';
    }

    return '/dashboard';
  }

  private setupExpress(): void {
    this.app.set('trust proxy', 1);

    this.app.use(securityMiddleware.securityHeaders);
    this.app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );

    this.app.post(
      '/api/billing/webhook/stripe',
      express.raw({ type: 'application/json' }),
      async (req, res) => {
        try {
          const sig = req.headers['stripe-signature'];
          const result = await BillingService.getInstance().handleStripeWebhook(
            req.body as Buffer,
            String(sig ?? ''),
          );
          res.json(result);
        } catch (e) {
          const err = e as BillingHttpError;
          res.status(err.status ?? 400).json({ error: err.message ?? String(e) });
        }
      },
    );

    this.app.get('/api/integrations/whatsapp/cloud/webhook', (req, res) => {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      const expected = process.env.WHATSAPP_CLOUD_VERIFY_TOKEN?.trim();
      if (
        mode === 'subscribe' &&
        token &&
        expected &&
        token === expected &&
        challenge
      ) {
        res.status(200).send(String(challenge));
        return;
      }
      res.status(503).json({
        error: 'WhatsApp Cloud API ainda não implementado — canal padrão: Baileys',
      });
    });

    this.app.post(
      '/api/integrations/whatsapp/cloud/webhook',
      express.raw({ type: 'application/json' }),
      (_req, res) => {
        res.status(503).json({
          error: 'WhatsApp Cloud API — ingestão pendente (última fase do roadmap)',
        });
      },
    );

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

    const sessionMiddleware = session({
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
    });

    this.app.use(sessionMiddleware);
    this.io.engine.use(sessionMiddleware);
    this.io.use((socket, next) => {
      const sess = (socket.request as typeof socket.request & { session?: { userId?: string } }).session;
      if (config.NODE_ENV !== 'production' || sess?.userId) {
        next();
        return;
      }
      next(new Error('Unauthorized'));
    });

    // Serve built React frontend
    const publicDir = path.join(__dirname, 'public');
    this.app.use(express.static(publicDir));

    // Auth routes (public) — rate limit contra brute force
    this.app.use('/auth', rateLimiters.auth);
    this.setupAuthRoutes();

    // Protected API routes — rate limit + origin (prod) + AuthContext
    this.app.use('/api', rateLimiters.general);
    this.app.use('/api', requireDashboardOrigin);
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

    const beginDiscordOAuth = (req: Request, res: Response, linkMode: boolean) => {
      const state = crypto.randomBytes(24).toString('hex');
      const sess = req.session as {
        userId?: string;
        oauthStateDiscord?: string;
        oauthLinkTarget?: string;
      };
      if (linkMode) {
        if (!sess.userId) {
          return res.redirect(`${this.getFrontendBase()}/?error=login_required`);
        }
        sess.oauthLinkTarget = 'discord';
      }
      sess.oauthStateDiscord = state;
      const url = new URL('https://discord.com/api/oauth2/authorize');
      url.searchParams.set('client_id', config.DISCORD.CLIENT_ID);
      url.searchParams.set('redirect_uri', REDIRECT_URI);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', SCOPES);
      url.searchParams.set('state', state);
      res.redirect(url.toString());
    };

    const beginGoogleOAuth = (req: Request, res: Response, linkMode: boolean) => {
      const clientId = config.GOOGLE.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return res.status(503).json({ error: 'Google OAuth não configurado (GOOGLE_CLIENT_ID)' });
      }
      const state = crypto.randomBytes(24).toString('hex');
      const sess = req.session as {
        userId?: string;
        oauthStateGoogle?: string;
        oauthLinkTarget?: string;
      };
      if (linkMode) {
        if (!sess.userId) {
          return res.redirect(`${this.getFrontendBase()}/?error=login_required`);
        }
        sess.oauthLinkTarget = 'google';
      }
      sess.oauthStateGoogle = state;
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('access_type', 'online');
      url.searchParams.set('prompt', 'select_account');
      url.searchParams.set('state', state);
      res.redirect(url.toString());
    };

    // Step 1 — redirect to Discord
    this.app.get('/auth/discord', (req, res) => beginDiscordOAuth(req, res, false));
    this.app.get('/auth/discord/link', (req, res) => beginDiscordOAuth(req, res, true));

    // Step 2 — Discord redirects back with code
    this.app.get('/auth/discord/callback', async (req: Request, res: Response) => {
      const { code, state } = req.query as { code?: string; state?: string };
      const frontendBase = this.getFrontendBase();
      if (!code) return res.redirect(`${frontendBase}/?error=no_code`);
      const sess = req.session as any;
      if (!state || state !== sess.oauthStateDiscord) {
        return res.redirect(`${frontendBase}/?error=oauth_state`);
      }
      delete sess.oauthStateDiscord;

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
          logger.error('Discord token exchange failed', redactOAuthError(tokenData));
          const frontendBase = this.getFrontendBase();
          return res.redirect(`${frontendBase}/?error=token_failed`);
        }

        // Get Discord user info
        const userRes = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const discordUser = await userRes.json() as any;

        const linkTarget = sess.oauthLinkTarget as string | undefined;
        delete sess.oauthLinkTarget;

        if (linkTarget === 'discord' && sess.userId) {
          try {
            await orgSvc.linkDiscordToUser(sess.userId, discordUser);
            sess.discordId = discordUser.id;
            sess.username = discordUser.username;
            sess.avatar = discordUser.avatar
              ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
              : sess.avatar ?? null;
            syncGuildMemberships(sess.userId, discordUser.id).catch(err =>
              logger.warn('Guild sync failed on Discord link', err),
            );
            await this.saveSession(req);
            return res.redirect(`${frontendBase}/settings?linked=discord#conta`);
          } catch (linkErr) {
            const msg = encodeURIComponent((linkErr as Error).message);
            return res.redirect(`${frontendBase}/settings?error=${msg}#conta`);
          }
        }

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
        const postLoginPath = await this.resolvePostLoginPath(req, sess.userId);
        res.redirect(`${frontendBase}${postLoginPath}`);

      } catch (err) {
        logger.error('OAuth2 callback error:', err);
        res.redirect(`${frontendBase}/?error=oauth_error`);
      }
    });

    // ── Google OAuth (dono da empresa / pagante) ───────────────────────────
    this.app.get('/auth/google', (req, res) => beginGoogleOAuth(req, res, false));
    this.app.get('/auth/google/link', (req, res) => beginGoogleOAuth(req, res, true));

    this.app.get('/auth/google/callback', async (req: Request, res: Response) => {
      const { code, state } = req.query as { code?: string; state?: string };
      const frontendBase = this.getFrontendBase();
      const clientId = config.GOOGLE.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
      const clientSecret = config.GOOGLE.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
      if (!code) return res.redirect(`${frontendBase}/?error=no_code`);
      const sess = req.session as any;
      if (!state || state !== sess.oauthStateGoogle) {
        return res.redirect(`${frontendBase}/?error=oauth_state`);
      }
      delete sess.oauthStateGoogle;
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
          logger.warn('Google profile incomplete', {
            status: profileRes.status,
            hasSub: Boolean(profile.sub),
            email: redactEmail(profile.email),
          });
          return res.redirect(`${frontendBase}/?error=google_profile`);
        }

        const linkTarget = sess.oauthLinkTarget as string | undefined;
        delete sess.oauthLinkTarget;

        if (linkTarget === 'google' && sess.userId) {
          try {
            const linked = await orgSvc.linkGoogleToUser(sess.userId, {
              sub: profile.sub,
              email: profile.email,
              name: profile.name,
              picture: profile.picture,
            });
            sess.email = linked.email ?? profile.email;
            if (!sess.avatar && profile.picture) sess.avatar = profile.picture;
            await this.saveSession(req);
            return res.redirect(`${frontendBase}/settings?linked=google#conta`);
          } catch (linkErr) {
            const msg = encodeURIComponent((linkErr as Error).message);
            return res.redirect(`${frontendBase}/settings?error=${msg}#conta`);
          }
        }

        const { user } = await orgSvc.getOrCreateForGoogle({
          sub: profile.sub,
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
        });

        sess.userId = (user._id as mongoose.Types.ObjectId).toString();
        sess.authProvider = 'google';
        sess.email = profile.email;
        sess.username = profile.name ?? profile.email;
        sess.avatar = profile.picture ?? null;
        sess.discordId = user.discordUserId ?? null;

        logger.info(`Google login: ${profile.email}`, { userId: sess.userId });
        await this.saveSession(req);
        const postLoginPath = await this.resolvePostLoginPath(req, sess.userId);
        res.redirect(`${frontendBase}${postLoginPath}`);
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
          sessionOrganizationId: sess.organizationId,
        });
        res.json(authContextToJson(ctx));
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    this.app.post('/auth/organization', async (req: Request, res: Response) => {
      const sess = req.session as {
        userId?: string;
        discordId?: string;
        username?: string;
        avatar?: string | null;
        authProvider?: 'google' | 'discord';
        email?: string;
        organizationId?: string;
      };
      if (!sess?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const { organizationId } = req.body as { organizationId?: string };
      if (!organizationId) {
        return res.status(400).json({ error: 'organizationId obrigatório' });
      }

      try {
        await orgSvc.setPrimaryOrganization(sess.userId, organizationId);
        sess.organizationId = organizationId;
        await this.saveSession(req);

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
          sessionOrganizationId: organizationId,
        });
        res.json(authContextToJson(ctx));
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    this.app.patch('/auth/account/email', async (req: Request, res: Response) => {
      const sess = req.session as { userId?: string; email?: string | null };
      if (!sess?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const { email } = req.body as { email?: string };
      if (!email?.trim()) return res.status(400).json({ error: 'E-mail obrigatório' });
      try {
        const result = await orgSvc.linkAccountEmail(sess.userId, email.trim());
        sess.email = result.email;
        await this.saveSession(req);
        res.json(result);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    this.app.post('/auth/account/delete-organization', async (req: Request, res: Response) => {
      const sess = req.session as {
        userId?: string;
        organizationId?: string;
        discordId?: string;
        username?: string;
        avatar?: string | null;
        authProvider?: 'google' | 'discord';
        email?: string;
      };
      if (!sess?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const { confirmation } = req.body as { confirmation?: string };
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
          sessionOrganizationId: sess.organizationId,
        });

        if (ctx.companyRole !== CompanyRole.OWNER || !ctx.organizationId) {
          return res.status(403).json({ error: 'Apenas o dono da empresa ativa pode excluir todos os dados' });
        }

        const result = await OrganizationDeletionService.getInstance().deleteOrganization({
          organizationId: ctx.organizationId,
          requesterUserId: sess.userId,
          confirmation: confirmation ?? '',
          ip: req.ip,
        });

        await new Promise<void>(resolve => {
          req.session.destroy(() => resolve());
        }).catch(() => undefined);

        res.json({
          ok: true,
          deletedUser: result.deletedUser,
          organizationName: result.organizationName,
        });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
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

    /** @deprecated GET removido em produção (CSRF) — use POST */
    r.get('/sessions/:id/connect', requireCapability(Cap.WHATSAPP_SESSION_MANAGE), requireSelfOrStaff('id'), async (req, res) => {
      if (config.NODE_ENV === 'production') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({
          error: 'Use POST /api/sessions/:id/connect',
          code: 'METHOD_NOT_ALLOWED',
        });
      }
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

    // ── Inbox — atendimento WhatsApp ───────────────────────────────────────
    const inboxSvc = InboxService.getInstance();
    inboxSvc.startClientReplyGraceMonitor();

    r.get('/inbox/departments', requireCapability(Cap.INBOX_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const all = req.query.all === '1' || req.query.all === 'true';
        const canManageAll =
          all && (req as DashboardRequest).auth!.capabilities.includes(Cap.INBOX_DEPARTMENT_MANAGE);
        const departments = await inboxSvc.listDepartmentsForUser(
          auth.clientId,
          auth.userId,
          { all: canManageAll },
        );
        res.json(departments);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/inbox/members', requireCapability(Cap.INBOX_DEPARTMENT_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const members = await inboxSvc.listTeamMembersForAssignment(auth.clientId);
        res.json(members);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/departments', requireCapability(Cap.INBOX_DEPARTMENT_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { name, description, memberUserIds, clientVisible, internalRank } = req.body as {
          name?: string;
          description?: string;
          memberUserIds?: string[];
          clientVisible?: boolean;
          internalRank?: number;
        };
        const dept = await inboxSvc.createDepartment(auth.clientId, {
          name: name ?? '',
          description,
          memberUserIds,
          clientVisible,
          internalRank,
        });
        res.status(201).json(dept);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.patch('/inbox/departments/:id', requireCapability(Cap.INBOX_DEPARTMENT_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { name, description, memberUserIds, isActive, sortOrder, clientVisible, internalRank } = req.body as {
          name?: string;
          description?: string;
          memberUserIds?: string[];
          isActive?: boolean;
          sortOrder?: number;
          clientVisible?: boolean;
          internalRank?: number;
        };
        const dept = await inboxSvc.updateDepartment(auth.clientId, req.params.id, {
          name,
          description,
          memberUserIds,
          isActive,
          sortOrder,
          clientVisible,
          internalRank,
        });
        res.json(dept);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.get('/inbox/tickets/stats', requireCapability(Cap.INBOX_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const stats = await inboxSvc.getTicketStats(auth.clientId, auth.userId);
        res.json(stats);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/inbox/tickets', requireCapability(Cap.INBOX_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { status, departmentId, mine, search } = req.query as {
          status?: string;
          departmentId?: string;
          mine?: string;
          search?: string;
        };
        const rows = await inboxSvc.listTickets(auth.clientId, auth.userId, {
          status,
          departmentId,
          mine: mine === '1' || mine === 'true',
          search,
        });
        res.json(rows);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/inbox/tickets/:ref', requireCapability(Cap.INBOX_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const data = await inboxSvc.getTicketByRef(
          auth.clientId,
          auth.userId,
          req.params.ref,
        );
        res.json(data);
      } catch (e) {
        const msg = (e as Error).message;
        res.status(msg.includes('não encontrado') ? 404 : 403).json({ error: msg });
      }
    });

    r.post('/inbox/tickets/:ref/close', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const result = await inboxSvc.closeTicket(
          auth.clientId,
          auth.userId,
          req.params.ref,
        );
        res.json(result);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.patch('/inbox/tickets/:ref', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { assignedUserId, status } = req.body as {
          assignedUserId?: string;
          status?: string;
        };
        const ticket = await inboxSvc.updateTicket(
          auth.clientId,
          auth.userId,
          req.params.ref,
          { assignedUserId, status: status as 'open' | 'in_progress' | 'closed' | undefined },
        );
        res.json(ticket);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/tickets/:ref/internal-notes', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { body } = req.body as { body?: string };
        const note = await inboxSvc.addTicketInternalNote(
          auth.clientId,
          auth.userId,
          req.params.ref,
          body ?? '',
        );
        res.status(201).json(note);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/tickets/:ref/comments', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { body, mentionedUserIds } = req.body as {
          body?: string;
          mentionedUserIds?: string[];
        };
        const comment = await inboxSvc.addTicketComment(
          auth.clientId,
          auth.userId,
          req.params.ref,
          body ?? '',
          mentionedUserIds ?? [],
        );
        res.status(201).json(comment);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/tickets/:ref/reopen', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const result = await inboxSvc.reopenTicket(auth.clientId, auth.userId, req.params.ref);
        res.json(result);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/tickets/:ref/client-update', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const result = await inboxSvc.sendClientUpdate(
          auth.clientId,
          auth.userId,
          req.params.ref,
        );
        res.json(result);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/tickets/:ref/notify-client', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const result = await inboxSvc.sendClientUpdate(
          auth.clientId,
          auth.userId,
          req.params.ref,
        );
        res.json(result);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/tickets/:ref/forward', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { targetUserId, phone, note } = req.body as {
          targetUserId?: string;
          phone?: string;
          note?: string;
        };
        const result = await inboxSvc.forwardTicketWhatsApp(
          auth.clientId,
          auth.userId,
          req.params.ref,
          { targetUserId, phone, note },
        );
        res.json(result);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.delete('/inbox/tickets/:ref', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const result = await inboxSvc.deleteTicket(auth.clientId, auth.userId, req.params.ref);
        res.json(result);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.get('/inbox/team-members', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const members = await inboxSvc.listTeamMembersForAssignment(auth.clientId);
        res.json(members);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/inbox/conversations', requireCapability(Cap.INBOX_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { status, departmentId, mine, hasTicket, search } = req.query as {
          status?: string;
          departmentId?: string;
          mine?: string;
          hasTicket?: string;
          search?: string;
        };
        const rows = await inboxSvc.listConversations(auth.clientId, auth.userId, {
          status,
          departmentId,
          mine: mine === '1' || mine === 'true',
          hasTicket: hasTicket === '1' || hasTicket === 'true',
          search,
        });
        res.json(rows);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/inbox/conversations/:id', requireCapability(Cap.INBOX_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const data = await inboxSvc.getConversationDetail(
          auth.clientId,
          auth.userId,
          req.params.id,
        );
        res.json(data);
      } catch (e) {
        const msg = (e as Error).message;
        res.status(msg.includes('não encontrada') ? 404 : 403).json({ error: msg });
      }
    });

    r.post('/inbox/conversations/:id/assign', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const conv = await inboxSvc.assignConversation(
          auth.clientId,
          auth.userId,
          req.params.id,
        );
        res.json(conv);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/conversations/:id/reply', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { text } = req.body as { text?: string };
        const result = await inboxSvc.replyToConversation(
          auth.clientId,
          auth.userId,
          req.params.id,
          text ?? '',
        );
        res.json(result);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/conversations/:id/transfer', requireCapability(Cap.INBOX_TRANSFER), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { departmentId, reason } = req.body as { departmentId?: string; reason?: string };
        if (!departmentId) return res.status(400).json({ error: 'departmentId is required' });
        const conv = await inboxSvc.transferConversation(
          auth.clientId,
          auth.userId,
          req.params.id,
          departmentId,
          reason,
        );
        res.json(conv);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/conversations/:id/resolve', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const conv = await inboxSvc.resolveConversation(
          auth.clientId,
          auth.userId,
          req.params.id,
        );
        res.json(conv);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/conversations/:id/ticket', requireCapability(Cap.INBOX_REPLY), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const result = await inboxSvc.convertToTicket(
          auth.clientId,
          auth.userId,
          req.params.id,
        );
        res.json(result);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.get('/inbox/conversations/:id/history', requireCapability(Cap.INBOX_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const data = await inboxSvc.getConversationMessages(
          auth.clientId,
          auth.userId,
          req.params.id,
        );
        res.json(data);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.get('/inbox/quick-replies', requireCapability(Cap.INBOX_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const replies = await inboxSvc.getQuickReplies(auth.clientId);
        res.json(replies);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch('/inbox/quick-replies', requireCapability(Cap.INBOX_DEPARTMENT_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { replies } = req.body as { replies?: unknown };
        if (!Array.isArray(replies)) {
          return res.status(400).json({ error: 'replies deve ser um array' });
        }
        const saved = await inboxSvc.updateQuickReplies(auth.clientId, replies as never);
        res.json(saved);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.get('/inbox/media/:clientId/:filename', requireCapability(Cap.INBOX_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { clientId, filename } = req.params;
        if (clientId !== auth.clientId) {
          return res.status(403).json({ error: 'Acesso negado' });
        }
        const relative = `${clientId}/${filename}`;
        const { resolveInboxMediaPath } = await import('@/utils/inbox-media-storage');
        const filePath = resolveInboxMediaPath(relative);
        if (!filePath) return res.status(404).json({ error: 'Arquivo não encontrado' });
        res.sendFile(filePath);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/inbox/settings', requireCapability(Cap.INBOX_DEPARTMENT_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const settings = await inboxSvc.getSettings(auth.clientId);
        res.json(settings);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch('/inbox/settings', requireCapability(Cap.INBOX_DEPARTMENT_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const settings = await inboxSvc.updateSettings(auth.clientId, req.body ?? {});
        res.json(settings);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    const aiSettingsSvc = AiSettingsService.getInstance();
    const aiProviderSvc = AiProviderService.getInstance();
    const aiUsageSvc = AiUsageMeterService.getInstance();
    const aiConvSvc = AiConversationService.getInstance();

    r.get('/platform/ai/settings', requireCapability(Cap.INBOX_AI_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        res.json(await aiSettingsSvc.getFullPayload(auth.clientId));
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/platform/ai/settings', requireCapability(Cap.INBOX_AI_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const body = req.body ?? {};
        if ((body.settings as { apiKey?: string } | undefined)?.apiKey?.trim()) {
          await writeAuditLog({
            action: 'ai.api_key.updated',
            actorUserId: auth.userId,
            details: { clientId: auth.clientId },
            ip: req.ip,
          });
        }
        res.json(await aiSettingsSvc.upsertSettings(auth.clientId, body));
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.patch('/platform/ai/settings', requireCapability(Cap.INBOX_AI_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const body = req.body ?? {};
        if ((body.settings as { apiKey?: string } | undefined)?.apiKey?.trim()) {
          await writeAuditLog({
            action: 'ai.api_key.updated',
            actorUserId: auth.userId,
            details: { clientId: auth.clientId },
            ip: req.ip,
          });
        }
        res.json(await aiSettingsSvc.upsertSettings(auth.clientId, body));
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.delete('/platform/ai/key', requireCapability(Cap.INBOX_AI_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        await writeAuditLog({
          action: 'ai.api_key.removed',
          actorUserId: auth.userId,
          details: { clientId: auth.clientId },
          ip: req.ip,
        });
        res.json(await aiSettingsSvc.removeApiKey(auth.clientId));
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/platform/ai/test', requireCapability(Cap.INBOX_AI_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { apiKey } = req.body as { apiKey?: string };
        const settings = await aiSettingsSvc.getSettingsDoc(auth.clientId);
        const result = await aiProviderSvc.testConnection(auth.clientId, settings, apiKey);
        await writeAuditLog({
          action: result.ok ? 'ai.api_key.test_ok' : 'ai.api_key.test_fail',
          actorUserId: auth.userId,
          details: { clientId: auth.clientId, provider: settings.provider, model: settings.llmModel },
          ip: req.ip,
        });
        res.json(result);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.get('/platform/ai/usage', requireCapability(Cap.INBOX_AI_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { from, to, limit } = req.query as { from?: string; to?: string; limit?: string };
        const toDate = to ? new Date(to) : new Date();
        const fromDate = from
          ? new Date(from)
          : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        const usage = await aiUsageSvc.listUsage(auth.clientId, {
          from: fromDate,
          to: toDate,
          limit: limit ? Number(limit) : 100,
        });
        const snapshot = await aiUsageSvc.getUsageSnapshot(auth.clientId);
        res.json({ ...usage, snapshot });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/conversations/:id/ai/respond', requireCapability(Cap.INBOX_AI_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { message } = req.body as { message?: string };
        if (!message?.trim()) return res.status(400).json({ error: 'message obrigatório' });
        const result = await aiConvSvc.manualRespond(
          auth.clientId,
          req.params.id,
          message.trim(),
          inboxSvc,
        );
        res.json(result);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/conversations/:id/ai/escalate', requireCapability(Cap.INBOX_AI_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { reason } = req.body as { reason?: string };
        await aiConvSvc.manualEscalate(auth.clientId, req.params.id, inboxSvc, reason);
        res.json({ ok: true });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.get('/inbox/reports', requireCapability(Cap.INBOX_REPORTS_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { from, to } = req.query as { from?: string; to?: string };
        const toDate = to ? new Date(to) : new Date();
        const fromDate = from
          ? new Date(from)
          : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        const report = await InboxReportsService.getInstance().buildReport(
          auth.clientId,
          fromDate,
          toDate,
        );
        res.json(report);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/inbox/supervisor/queue', requireCapability(Cap.INBOX_SUPERVISE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const rows = await inboxSvc.listSupervisorQueue(auth.clientId, auth.userId);
        const active = rows.filter(r => {
          const status = String((r as { status?: string }).status ?? '');
          return ['waiting_queue', 'in_progress', 'bot_triage'].includes(status);
        });
        res.json(active);
      } catch (e) {
        res.status(403).json({ error: (e as Error).message });
      }
    });

    r.post('/inbox/conversations/:id/reassign', requireCapability(Cap.INBOX_SUPERVISE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { userId, mode } = req.body as { userId?: string; mode?: 'suggest' | 'assign' };
        if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
        const conv = await inboxSvc.reassignConversation(
          auth.clientId,
          auth.userId,
          req.params.id,
          userId,
          mode === 'assign' ? 'assign' : 'suggest',
        );
        res.json(conv);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
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
        const auth = (req as DashboardRequest).auth!;
        const { name, priority, templateName, keywords, destinationIdentifiers, channelIds, isActive } = req.body;

        const rule = await Rule.findOne({
          _id: req.params.id,
          clientId: new mongoose.Types.ObjectId(auth.clientId),
        });
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
            const dest = await Destination.findOne({
              identifier,
              clientId: new mongoose.Types.ObjectId(auth.clientId),
            });
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
        const auth = (req as DashboardRequest).auth!;
        const rule = await Rule.findOne({
          _id: req.params.id,
          clientId: new mongoose.Types.ObjectId(auth.clientId),
        });
        if (!rule) return res.status(404).json({ error: 'Rule not found' });
        await rule.toggle();
        res.json({ ok: true, isActive: rule.isActive });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.delete('/rules/:id', requireCapability(Cap.SEND_RULES_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const result = await Rule.deleteOne({
          _id: req.params.id,
          clientId: new mongoose.Types.ObjectId(auth.clientId),
        });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Rule not found' });
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
        })
          .select('-profilePictureData')
          .lean();
        res.json(
          destinations.map(d => ({
            ...d,
            consentStatus:
              d.consentStatus ??
              (d.consent?.granted ? ConsentStatus.ACCEPTED : ConsentStatus.PENDING),
            hasProfilePicture: Boolean(
              d.profilePictureMime?.startsWith('image/'),
            ),
          })),
        );
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/destinations/:id/profile-picture', requireCapability(Cap.CONSENT_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const dest = await Destination.findOne({
          _id: req.params.id,
          clientId: auth.clientId,
        })
          .select('profilePictureData profilePictureMime profilePictureUpdatedAt')
          .lean();

        if (!dest) return res.status(404).end();

        const mime = dest.profilePictureMime ?? '';
        if (!mime.startsWith('image/') || !dest.profilePictureData?.length) {
          return res.status(404).end();
        }

        const body = Buffer.isBuffer(dest.profilePictureData)
          ? dest.profilePictureData
          : Buffer.from((dest.profilePictureData as { buffer: ArrayBuffer }).buffer);

        res.setHeader('Content-Type', mime);
        res.setHeader('Cache-Control', 'private, max-age=604800');
        if (dest.profilePictureUpdatedAt) {
          res.setHeader('Last-Modified', dest.profilePictureUpdatedAt.toUTCString());
        }
        res.send(body);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/destinations/sync-profile-pictures', requireCapability(Cap.CONSENT_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const body = req.body as { limit?: number; destinationIds?: string[] };
        const wa = WhatsAppService.getInstance();
        if (!wa.isClientConnected(auth.clientId)) {
          return res.status(409).json({
            error: 'WhatsApp não conectado. Conecte em Sessões e QR Code para buscar fotos.',
          });
        }
        const result = await wa.syncDestinationProfilePictures(auth.clientId, {
          limit: body.limit,
          destinationIds: body.destinationIds,
        });
        res.json({ ok: true, ...result });
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

    r.post('/contact-groups/:id/members/bulk', requireCapability(Cap.SEND_DESTINATION_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const group = await ContactGroup.findOne({ _id: req.params.id, clientId: clientOid });
        if (!group) return res.status(404).json({ error: 'Segmento não encontrado' });

        const body = req.body as {
          destinationIds?: string[];
          fromGroupId?: string;
          action?: 'add' | 'remove';
        };
        const action = body.action === 'remove' ? 'remove' : 'add';
        let destIds: mongoose.Types.ObjectId[] = [];

        if (body.fromGroupId) {
          const fromGroup = await ContactGroup.findOne({ _id: body.fromGroupId, clientId: clientOid });
          if (!fromGroup) return res.status(404).json({ error: 'Segmento de origem não encontrado' });
          const fromDests = await Destination.find({
            clientId: clientOid,
            type: 'contact',
            isActive: true,
            contactGroupIds: fromGroup._id,
          }).select('_id');
          destIds = fromDests.map(d => d._id as mongoose.Types.ObjectId);
        } else if (body.destinationIds?.length) {
          destIds = body.destinationIds.map(id => new mongoose.Types.ObjectId(id));
        } else {
          return res.status(400).json({ error: 'Informe destinationIds ou fromGroupId' });
        }

        if (action === 'add') {
          await Destination.updateMany(
            { clientId: clientOid, _id: { $in: destIds }, type: 'contact' },
            { $addToSet: { contactGroupIds: group._id } },
          );
        } else {
          await Destination.updateMany(
            { clientId: clientOid, _id: { $in: destIds } },
            { $pull: { contactGroupIds: group._id } },
          );
        }

        const memberCount = await Destination.countDocuments({
          clientId: clientOid,
          type: 'contact',
          isActive: true,
          contactGroupIds: group._id,
        });
        res.json({ ok: true, memberCount, affected: destIds.length });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/contact-groups/:id/export-csv', requireCapability(Cap.CONSENT_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const group = await ContactGroup.findOne({ _id: req.params.id, clientId: clientOid });
        if (!group) return res.status(404).json({ error: 'Segmento não encontrado' });

        const contacts = await Destination.find({
          clientId: clientOid,
          type: 'contact',
          isActive: true,
          contactGroupIds: group._id,
        }).lean();

        const header = 'nome,telefone,email,aniversario,tags\n';
        const rows = contacts.map(d => {
          const nome = (d.name ?? '').replace(/"/g, '""');
          const tel = d.identifier ?? '';
          const email = (d.email ?? '').replace(/"/g, '""');
          const bday = d.birthday ?? '';
          const tags = (d.tags ?? []).join(';');
          return `"${nome}",${tel},"${email}",${bday},"${tags}"`;
        });
        const csv = header + rows.join('\n');
        const safeName = group.name.replace(/[^a-zA-Z0-9-_]/g, '_');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="segmento-${safeName}.csv"`);
        res.send('\uFEFF' + csv);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/contact-groups/:id/members', requireCapability(Cap.CONSENT_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const group = await ContactGroup.findOne({ _id: req.params.id, clientId: clientOid });
        if (!group) return res.status(404).json({ error: 'Segmento não encontrado' });

        const contacts = await Destination.find({
          clientId: clientOid,
          type: 'contact',
          isActive: true,
          contactGroupIds: group._id,
        })
          .select('name identifier email birthday tags consentStatus')
          .sort({ name: 1 })
          .lean();

        res.json(contacts.map(c => ({
          _id: c._id,
          name: c.name,
          identifier: c.identifier,
          email: c.email,
          birthday: c.birthday,
          tags: c.tags,
          consentStatus: c.consentStatus,
        })));
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
          contactGroupIds?: string[];
          mapGruposToSegments?: boolean;
        };
        const { dryRun = false, format = 'auto', contactGroupIds, mapGruposToSegments } = body;
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
          contactGroupIds: Array.isArray(contactGroupIds) ? contactGroupIds : undefined,
          mapGruposToSegments: mapGruposToSegments === true,
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

    r.get('/tenant-backup/export', requireCapability(Cap.ACCOUNT_SETTINGS), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const body = TenantBackupService.getInstance().wrapExportPayload(
          await TenantBackupService.getInstance().exportOrganization(auth.clientId),
        );
        const filename = `radarzap-backup-${auth.clientId}-${Date.now()}.json`;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await writeAuditLog({
          action: 'tenant.backup.export',
          actorUserId: auth.userId,
          details: { organizationId: auth.clientId, encrypted: TenantBackupService.isEncryptedExport(body) },
          ip: req.ip,
        });
        res.json(body);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/tenant-backup/import', requireCapability(Cap.BILLING_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const replace = Boolean(req.body?.replace);
        const raw = req.body?.backup ?? req.body;
        const payload = TenantBackupService.parseImportPayload(raw);
        if (!payload?.data) {
          res.status(400).json({ error: 'JSON de backup inválido' });
          return;
        }
        const result = await TenantBackupService.getInstance().importOrganization(
          auth.clientId,
          payload,
          { replace },
        );
        await writeAuditLog({
          action: 'tenant.backup.import',
          actorUserId: auth.userId,
          details: { organizationId: auth.clientId, replace, imported: result.imported },
          ip: req.ip,
        });
        res.json({ ok: true, ...result });
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
        const org = await Organization.findById(auth.clientId);
        const owner = org
          ? await User.findById(org.ownerUserId)
          : await User.findById(auth.clientId);
        let vars = variables ?? {};
        const extraCtx = { mensagem: mensagem?.trim() };

        if (destinationId) {
          const dest = await Destination.findOne({
            _id: destinationId,
            clientId: clientOid,
          });
          if (!dest) {
            return res.status(404).json({ error: 'Destino não encontrado' });
          }
          vars = {
            ...buildPlatformWhatsAppVariables(dest, org, owner, extraCtx),
            ...vars,
          };
        } else {
          vars = {
            ...buildPlatformPreviewSampleVariables(org, owner, extraCtx),
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
        res.json({
          preview: text,
          variables: vars,
          sampleSource: destinationId ? 'destination' : 'tenant',
        });
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

    r.post('/destinations/bulk', requireCapability(Cap.SEND_DESTINATION_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const body = req.body as {
          action?: 'delete' | 'addToGroups' | 'removeFromGroups';
          destinationIds?: string[];
          groupIds?: string[];
        };
        const action = body.action ?? 'delete';
        const destIds = (body.destinationIds ?? [])
          .filter(Boolean)
          .map(id => new mongoose.Types.ObjectId(id));
        if (destIds.length === 0) {
          return res.status(400).json({ error: 'Informe destinationIds' });
        }

        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const canClearRefusal = auth.capabilities.includes(Cap.CONSENT_CLEAR_REFUSAL);

        if (action === 'delete') {
          const destinations = await Destination.find({
            _id: { $in: destIds },
            clientId: clientOid,
          });
          const toDelete: typeof destinations = [];
          const skipped: Array<{ id: string; name: string; reason: string }> = [];

          for (const dest of destinations) {
            if (dest.type === 'contact') {
              const st =
                dest.consentStatus ??
                (dest.consent?.granted ? ConsentStatus.ACCEPTED : ConsentStatus.PENDING);
              if (isBlockedStatus(st) && !canClearRefusal) {
                skipped.push({
                  id: dest._id.toString(),
                  name: dest.name,
                  reason: 'recusa registrada — apenas o dono pode remover',
                });
                continue;
              }
            }
            toDelete.push(dest);
          }

          if (toDelete.length > 0) {
            await Destination.deleteMany({ _id: { $in: toDelete.map(d => d._id) } });
          }

          return res.json({
            ok: true,
            deleted: toDelete.length,
            skipped: skipped.length,
            skippedDetails: skipped,
          });
        }

        if (action === 'addToGroups' || action === 'removeFromGroups') {
          const groupIds = (body.groupIds ?? [])
            .filter(Boolean)
            .map(id => new mongoose.Types.ObjectId(id));
          if (groupIds.length === 0) {
            return res.status(400).json({ error: 'Informe groupIds' });
          }

          const groups = await ContactGroup.find({
            _id: { $in: groupIds },
            clientId: clientOid,
          });
          if (groups.length !== groupIds.length) {
            return res.status(404).json({ error: 'Um ou mais grupos não encontrados' });
          }

          const filter = { clientId: clientOid, _id: { $in: destIds }, type: 'contact' as const };
          if (action === 'addToGroups') {
            await Destination.updateMany(filter, {
              $addToSet: { contactGroupIds: { $each: groupIds } },
            });
          } else {
            for (const gid of groupIds) {
              await Destination.updateMany(
                { clientId: clientOid, _id: { $in: destIds } },
                { $pull: { contactGroupIds: gid } },
              );
            }
          }

          return res.json({ ok: true, affected: destIds.length, groups: groups.length });
        }

        return res.status(400).json({ error: 'Ação inválida' });
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

    r.post('/destinations/:id/consent/block', requireCapability(Cap.CONSENT_MANUAL_BLOCK), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const dest = await Destination.findById(req.params.id);
        if (!dest) return res.status(404).json({ error: 'Contato não encontrado' });
        const relatedIds = await OrganizationService.getInstance().getRelatedClientIds(auth.clientId);
        if (!relatedIds.some(id => id.toString() === dest.clientId?.toString())) {
          return res.status(403).json({ error: 'Contato fora da sua empresa' });
        }
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
        const auth = (req as DashboardRequest).auth!;
        const result = await DiscordChannel.deleteOne({
          _id: req.params.id,
          clientId: new mongoose.Types.ObjectId(auth.clientId),
        });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Channel not found' });
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch('/channels/:id/toggle', requireCapability(Cap.DISCORD_CHANNELS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const ch = await DiscordChannel.findOne({
          _id: req.params.id,
          clientId: new mongoose.Types.ObjectId(auth.clientId),
        });
        if (!ch) return res.status(404).json({ error: 'Channel not found' });
        await ch.toggleActive();
        res.json({ ok: true, isActive: ch.isActive });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── WhatsApp Groups (from active session via queue job) ────────────────
    r.get(
      '/sessions/:id/groups',
      requireCapability(Cap.WHATSAPP_SESSION_VIEW),
      requireSelfOrStaff('id'),
      async (req, res) => {
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
    r.get('/queue', requireAnyCapability(Cap.QUEUE_VIEW, Cap.PLATFORM_REPORTS_VIEW), async (_req, res) => {
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

    r.get('/queue/tenant-campaigns', requireCapability(Cap.QUEUE_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const status = (req.query.status as string) || undefined;
        const source = (req.query.source as string) || undefined;

        const query: Record<string, unknown> = {
          clientId: clientOid,
          'content.template': { $in: ['manual-send', 'platform-send'] },
        };
        if (status) query.status = status;
        if (source === 'automation') {
          query['content.variables.source'] = 'automation';
        } else if (source === 'manual') {
          query['content.variables.source'] = { $ne: 'automation' };
        }

        const items = await MessageQueue.find(query)
          .sort({ scheduledFor: 1 })
          .limit(50)
          .lean();

        const stats = await MessageQueue.aggregate([
          { $match: { clientId: clientOid, 'content.template': { $in: ['manual-send', 'platform-send'] } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
        const byStatus = Object.fromEntries(stats.map((s: { _id: string; count: number }) => [s._id, s.count]));

        res.json({
          stats: {
            pending: byStatus.pending ?? 0,
            processing: byStatus.processing ?? 0,
            sent: byStatus.sent ?? 0,
            failed: byStatus.failed ?? 0,
          },
          items: items.map(m => ({
            _id: m._id,
            title: (m.content?.variables as { title?: string })?.title ?? 'Envio',
            status: m.status,
            scheduledFor: m.scheduledFor,
            destinations: m.destinations?.length ?? 0,
            sentCount: (m.content?.variables as { sentCount?: number })?.sentCount ?? 0,
            lastError: m.lastError,
            source: (m.content?.variables as { source?: string })?.source ?? 'manual',
            automationRuleId: (m.content?.variables as { automationRuleId?: string })?.automationRuleId,
          })),
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/queue/failed', requireCapability(Cap.QUEUE_VIEW), async (_req, res) => {
      try {
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
    r.get('/logs', requireAnyCapability(Cap.LOGS_VIEW, Cap.PLATFORM_REPORTS_VIEW), async (req, res) => {
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
          const term = escapeMongoRegex(q.trim());
          and.push({
            $or: [
              { message: { $regex: term, $options: 'i' } },
              { traceId: q.trim() },
              { 'metadata.messageId': q.trim() },
              { 'metadata.destination': { $regex: term, $options: 'i' } },
              { 'metadata.primaryLink': { $regex: term, $options: 'i' } },
              { 'metadata.pipeline': q.trim() },
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
        const members = await OrganizationService.getInstance().listMembersEnriched(
          auth.organizationId,
        );
        res.json(members);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/team/roles', requireCapability(Cap.COMPANY_MEMBERS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { presets, hasDiscordIntegration } =
          await OrganizationService.getInstance().getOrgRolePresets(auth.organizationId);
        res.json({
          presets,
          permissionGroups: permissionGroupsForOrg(hasDiscordIntegration),
          assignableCapabilities: assignableCapabilitiesForOrg(hasDiscordIntegration),
          inviteableRoles: INVITEABLE_ROLES,
          hasDiscordIntegration,
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch('/team/roles/:role', requireCapability(Cap.COMPANY_MEMBERS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const role = req.params.role as CompanyRole;
        const { capabilities } = req.body as { capabilities?: Capability[] };
        if (!Array.isArray(capabilities)) {
          return res.status(400).json({ error: 'capabilities obrigatório' });
        }
        const result = await OrganizationService.getInstance().updateOrgRolePreset(
          auth.organizationId,
          role,
          capabilities,
          auth.companyRole!,
        );
        res.json(result);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.delete('/team/roles/:role', requireCapability(Cap.COMPANY_MEMBERS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const role = req.params.role as CompanyRole;
        await OrganizationService.getInstance().resetOrgRolePreset(
          auth.organizationId,
          role,
          auth.companyRole!,
        );
        res.json({ ok: true });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/team/custom-roles', requireCapability(Cap.COMPANY_MEMBERS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { name, description, capabilities } = req.body as {
          name?: string;
          description?: string;
          capabilities?: Capability[];
        };
        const role = await OrganizationService.getInstance().createCustomRole(
          auth.organizationId,
          auth.companyRole!,
          { name: name ?? '', description, capabilities },
        );
        res.status(201).json(role);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.patch('/team/custom-roles/:id', requireCapability(Cap.COMPANY_MEMBERS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { name, description, capabilities } = req.body as {
          name?: string;
          description?: string;
          capabilities?: Capability[];
        };
        const role = await OrganizationService.getInstance().updateCustomRole(
          auth.organizationId,
          req.params.id,
          auth.companyRole!,
          { name, description, capabilities },
        );
        res.json(role);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.delete('/team/custom-roles/:id', requireCapability(Cap.COMPANY_MEMBERS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        await OrganizationService.getInstance().deleteCustomRole(
          auth.organizationId,
          req.params.id,
          auth.companyRole!,
        );
        res.json({ ok: true });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/team/members', requireCapability(Cap.COMPANY_MEMBERS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { email, role, roleKey, capabilities } = req.body as {
          email?: string;
          role?: CompanyRole;
          roleKey?: string;
          capabilities?: Capability[];
        };
        if (!email?.trim()) return res.status(400).json({ error: 'E-mail obrigatório' });
        const selectedRole = roleKey ?? role;
        if (!selectedRole) return res.status(400).json({ error: 'Papel inválido' });
        if (selectedRole === CompanyRole.ADMIN && auth.companyRole !== CompanyRole.OWNER) {
          return res.status(403).json({ error: 'Apenas o dono pode convidar administrador' });
        }
        const { member, inviteEmail } = await OrganizationService.getInstance().inviteMember(
          auth.organizationId,
          email.trim(),
          selectedRole,
          auth.userId,
        );
        res.json({ ...member.toObject(), inviteEmail });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.post('/team/members/:id/resend-invite', requireCapability(Cap.COMPANY_MEMBERS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { member, inviteEmail } = await OrganizationService.getInstance().resendMemberInvite(
          auth.organizationId,
          req.params.id,
          auth.userId,
        );
        res.json({ ...member.toObject(), inviteEmail });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.patch('/team/members/:id', requireCapability(Cap.COMPANY_MEMBERS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { role, roleKey, whatsappPhone } = req.body as {
          role?: CompanyRole;
          roleKey?: string;
          whatsappPhone?: string | null;
        };
        if (!auth.companyRole) {
          return res.status(403).json({ error: 'Sem permissão' });
        }
        const member = await OrganizationService.getInstance().updateMember(
          auth.organizationId,
          req.params.id,
          auth.companyRole,
          { roleKey: roleKey ?? role, whatsappPhone },
        );
        res.json(member);
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    r.delete('/team/members/:id', requireCapability(Cap.COMPANY_MEMBERS_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        await OrganizationService.getInstance().removeMember(
          auth.organizationId,
          req.params.id,
          {
            companyRole: auth.companyRole!,
            capabilities: auth.capabilities,
          },
        );
        res.json({ ok: true });
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
      }
    });

    // ── Billing (conta própria — USER) ───────────────────────────────────
    const billingSvc = BillingService.getInstance();

    r.get('/billing/pricing', requireCapability(Cap.BILLING_VIEW), async (_req, res) => {
      try {
        res.json(billingSvc.getPricing());
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/billing/subscription', requireCapability(Cap.BILLING_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const sub = await billingSvc.getSubscription(auth.organizationId);
        res.json(sub);
      } catch (e) {
        const err = e as BillingHttpError;
        res.status(err.status ?? 500).json({ error: err.message });
      }
    });

    r.get('/billing/me', requireCapability(Cap.BILLING_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const sub = await billingSvc.getSubscription(auth.organizationId);
        res.json({
          _id: auth.organizationId,
          organizationName: sub.organizationName,
          plan: sub.plan,
          planId: sub.planId,
          status: sub.status,
          isActive: sub.isActive,
          expiresAt: sub.expiresAt,
          expiresAtLabel: sub.expiresAtLabel,
          timeRemaining: sub.timeRemaining,
          limits: sub.limits,
          usage: sub.usage,
          companyRole: auth.companyRole,
          primaryRole: auth.primaryRole,
          features: sub.features,
          orders: sub.orders,
        });
      } catch (e) {
        const err = e as BillingHttpError;
        res.status(err.status ?? 500).json({ error: err.message });
      }
    });

    r.post('/billing/checkout', requireCapability(Cap.BILLING_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { planId } = req.body as { planId?: string };
        const result = await billingSvc.createCheckout(auth.userId, auth.organizationId, planId);
        res.json(result);
      } catch (e) {
        const err = e as BillingHttpError;
        res.status(err.status ?? 400).json({ error: err.message });
      }
    });

    r.post('/billing/confirm', requireCapability(Cap.BILLING_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { sessionId, organizationId } = req.body as {
          sessionId?: string;
          organizationId?: string;
        };
        if (!sessionId?.trim()) return res.status(400).json({ error: 'sessionId obrigatório' });
        const orgId = organizationId?.trim() || auth.organizationId;
        if (orgId !== auth.organizationId) {
          return res.status(403).json({ error: 'Organização inválida' });
        }
        const result = await billingSvc.confirmCheckout(auth.userId, orgId, sessionId.trim());
        res.json(result);
      } catch (e) {
        const err = e as BillingHttpError;
        res.status(err.status ?? 400).json({ error: err.message });
      }
    });

    r.post('/billing/dev/activate', requireCapability(Cap.BILLING_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { planId } = req.body as { planId?: string };
        if (!planId) return res.status(400).json({ error: 'planId obrigatório' });
        const result = await billingSvc.devActivateOrganization(
          auth.organizationId,
          auth.userId,
          planId,
        );
        res.json(result);
      } catch (e) {
        const err = e as BillingHttpError;
        res.status(err.status ?? 400).json({ error: err.message });
      }
    });

    r.post(
      '/billing/subscriptions/sweep',
      requireCapability(Cap.SYSTEM_PAYMENTS_VIEW),
      async (_req, res) => {
        try {
          const result = await billingSvc.runSubscriptionSweep();
          res.json(result);
        } catch (e) {
          res.status(500).json({ error: (e as Error).message });
        }
      },
    );

    r.get('/billing/admin/orders', requireCapability(Cap.SYSTEM_PAYMENTS_VIEW), async (_req, res) => {
      try {
        const orders = await billingSvc.listOrdersAdmin();
        res.json(orders);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/organization/profile', requireCapability(Cap.BILLING_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const org = await Organization.findById(auth.organizationId).lean();
        if (!org) return res.status(404).json({ error: 'Empresa não encontrada' });
        res.json({
          name: org.name,
          phone: org.phone ?? '',
          email: org.email ?? '',
          website: org.website ?? '',
          taxId: org.taxId ?? '',
          address: org.address ?? '',
          plan: org.plan,
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch('/organization/profile', requireCapability(Cap.BILLING_MANAGE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const body = req.body as {
          name?: string;
          phone?: string;
          email?: string;
          website?: string;
          taxId?: string;
          address?: string;
        };
        const org = await Organization.findById(auth.organizationId);
        if (!org) return res.status(404).json({ error: 'Empresa não encontrada' });

        if (body.name !== undefined) {
          const trimmed = body.name.trim();
          if (!trimmed) return res.status(400).json({ error: 'Nome da empresa é obrigatório' });
          org.name = trimmed.slice(0, 120);
        }
        if (body.phone !== undefined) org.phone = body.phone.trim().slice(0, 32) || undefined;
        if (body.email !== undefined) org.email = body.email.trim().slice(0, 120) || undefined;
        if (body.website !== undefined) org.website = body.website.trim().slice(0, 200) || undefined;
        if (body.taxId !== undefined) org.taxId = body.taxId.trim().slice(0, 20) || undefined;
        if (body.address !== undefined) org.address = body.address.trim().slice(0, 240) || undefined;

        await org.save();
        res.json({
          name: org.name,
          phone: org.phone ?? '',
          email: org.email ?? '',
          website: org.website ?? '',
          taxId: org.taxId ?? '',
          address: org.address ?? '',
          plan: org.plan,
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/platform/account-stats', requireCapability(Cap.BILLING_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const org = await Organization.findById(auth.organizationId).lean();
        const wa = WhatsAppService.getInstance();
        const sessionDetails = await wa.getSessionDetails(auth.clientId);

        const [campaignStats, automationRules, contactCount, groupCount] = await Promise.all([
          MessageQueue.aggregate([
            { $match: { clientId: clientOid, 'content.template': { $in: ['manual-send', 'platform-send'] } } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ]),
          BirthdayAutomationRule.countDocuments({ organizationId: clientOid, active: true }),
          Destination.countDocuments({ clientId: clientOid, type: 'contact', isActive: true }),
          ContactGroup.countDocuments({ clientId: clientOid }),
        ]);

        const byStatus = Object.fromEntries(campaignStats.map((s: { _id: string; count: number }) => [s._id, s.count]));
        const automationCampaigns = await MessageQueue.countDocuments({
          clientId: clientOid,
          'content.variables.source': 'automation',
        });

        res.json({
          organizationName: org?.name ?? auth.organizationName,
          plan: org?.plan ?? 'free',
          usage: org?.usage ?? { messagesUsed: 0, lastReset: new Date() },
          limits: org?.limits,
          whatsapp: {
            status: sessionDetails.status,
            state: sessionDetails.state,
            phoneNumber: sessionDetails.phoneNumber,
            profileName: sessionDetails.profileName,
            lastActivity: sessionDetails.lastActivity,
            waAccountType: sessionDetails.waAccountType,
          },
          campaigns: {
            pending: byStatus.pending ?? 0,
            processing: byStatus.processing ?? 0,
            sent: byStatus.sent ?? 0,
            failed: byStatus.failed ?? 0,
            automationTotal: automationCampaigns,
          },
          automations: { activeRules: automationRules },
          contacts: { total: contactCount, segments: groupCount },
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
          weekdays?: number[];
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
          weekday: body.weekdays?.length ? body.weekdays[0] : body.weekday,
          weekdays: body.weekdays?.length ? body.weekdays : undefined,
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
        if (doc.active) {
          void BirthdayAutomationService.getInstance().planSingleRule(doc).catch(() => {});
        }
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
          weekdays: (body.weekdays ?? doc.weekdays) as number[] | undefined,
          scheduledAt: (body.scheduledAt ?? doc.scheduledAt?.toISOString()) as string | undefined,
          sendTime: (body.sendTime ?? doc.sendTime) as string | undefined,
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
        if (body.weekdays !== undefined) {
          const days = (body.weekdays as number[]).filter(d => d >= 1 && d <= 7);
          doc.weekdays = days.length ? days : undefined;
          if (days.length) doc.weekday = days[0];
        }
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
        if (doc.active) {
          void BirthdayAutomationService.getInstance().planSingleRule(doc).catch(() => {});
        }
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
          total += await svc.processRule(rule, new Date(), { force: true });
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
        const source = (req.query.source as string) || undefined;

        let items = await MessageQueue.findByClientId(clientOid, status);
        if (source === 'automation') {
          items = items.filter(
            m => (m.content.variables as { source?: string })?.source === 'automation',
          );
        } else if (source === 'manual') {
          items = items.filter(
            m => (m.content.variables as { source?: string })?.source !== 'automation',
          );
        }
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
            source: (m.content.variables as { source?: string })?.source ?? 'manual',
            automationRuleId: (m.content.variables as { automationRuleId?: string })?.automationRuleId,
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

        const sendAtCheck = validateOptionalCampaignSendAt(body.sendAt ?? undefined);
        if (sendAtCheck.ok === false) {
          return res.status(400).json({ error: sendAtCheck.error });
        }
        const sendAt = sendAtCheck.date;

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

    // ── Status WhatsApp (stories) ───────────────────────────────────────────
    r.get('/status-posts/audience-preview', requireCapability(Cap.SEND_TEST), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const audience = (req.query.audience as string) || 'whatsapp';
        if (!['whatsapp', 'all_contacts', 'consented'].includes(audience)) {
          return res.status(400).json({ error: 'Audiência inválida' });
        }
        const wa = WhatsAppService.getInstance();
        if (!wa.isClientConnected(auth.clientId)) {
          return res.status(409).json({
            error: 'WhatsApp não conectado',
            count: 0,
          });
        }
        const preview = await wa.previewStatusAudience(
          auth.clientId,
          audience as 'whatsapp' | 'all_contacts' | 'consented',
        );
        res.json({
          ...preview,
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/status-posts', requireCapability(Cap.SEND_TEST), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const posts = await StatusPost.find({ clientId: clientOid })
          .sort({ scheduledFor: -1 })
          .limit(100)
          .lean();
        res.json(
          posts.map(p => {
            const { image: _img, imageData: _buf, ...rest } = p;
            return {
              ...rest,
              hasImage: Boolean(_img || (_buf && _buf.length)),
              viewCount: p.viewCount ?? p.viewEvents?.length ?? 0,
            };
          }),
        );
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/status-posts', requireCapability(Cap.SEND_TEST), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const body = req.body as {
          title?: string;
          type?: 'text' | 'image';
          text?: string;
          image?: string;
          caption?: string;
          backgroundColor?: string;
          font?: number;
          audience?: 'whatsapp' | 'all_contacts' | 'consented';
          sendAt?: string | null;
        };

        const titleCheck = validateCampaignTitle(body.title);
        if (titleCheck.ok === false) return res.status(400).json({ error: titleCheck.error });

        if (body.type !== 'text' && body.type !== 'image') {
          return res.status(400).json({ error: 'Tipo inválido — use text ou image' });
        }

        if (body.type === 'text') {
          const text = (body.text ?? '').trim();
          if (!text) return res.status(400).json({ error: 'Informe o texto do status' });
          if (text.length > 700) {
            return res.status(400).json({ error: 'Texto do status: máximo 700 caracteres' });
          }
        } else if (!body.image?.trim()) {
          return res.status(400).json({ error: 'Selecione uma imagem para o status' });
        } else {
          const imgCheck = parseAndValidateStatusImage(body.image);
          if (imgCheck.ok === false) return res.status(400).json({ error: imgCheck.error });
        }

        const wa = WhatsAppService.getInstance();
        const sendAtCheck = validateOptionalCampaignSendAt(body.sendAt ?? undefined);
        if (sendAtCheck.ok === false) return res.status(400).json({ error: sendAtCheck.error });

        const immediate = !sendAtCheck.date;
        if (immediate && !wa.isClientConnected(auth.clientId)) {
          return res.status(409).json({
            error: 'WhatsApp não conectado. Conecte em Sessões ou agende para mais tarde.',
          });
        }

        const post = await StatusDispatchService.getInstance().createStatusPost({
          clientId: auth.clientId,
          title: body.title!.trim(),
          type: body.type,
          text: body.text,
          image: body.image,
          caption: body.caption,
          backgroundColor: body.backgroundColor,
          font: body.font,
          audience: body.audience ?? 'whatsapp',
          sendAt: sendAtCheck.date,
        });

        if (immediate) {
          StatusDispatchService.getInstance().queueImmediateDispatch(String(post._id));
        }

        res.json({
          ok: true,
          _id: post._id,
          status: post.status,
          queued: immediate,
          scheduledFor: post.scheduledFor,
          statusJidCount: post.statusJidCount,
          lastError: post.lastError,
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/status-posts/:id', requireCapability(Cap.SEND_TEST), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const post = await StatusPost.findOne({
          _id: req.params.id,
          clientId: new mongoose.Types.ObjectId(auth.clientId),
        }).lean();
        if (!post) return res.status(404).json({ error: 'Publicação não encontrada' });

        const { image: _img, imageData: _buf, ...rest } = post;
        res.json({
          ...rest,
          hasImage: Boolean(_img || (_buf && _buf.length)),
          viewCount: post.viewCount ?? post.viewEvents?.length ?? 0,
          viewEvents: (post.viewEvents ?? []).map(v => ({
            ...v,
            viewedAt: v.viewedAt,
          })),
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/status-posts/:id/media', requireCapability(Cap.SEND_TEST), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const post = await StatusPost.findOne({
          _id: req.params.id,
          clientId: new mongoose.Types.ObjectId(auth.clientId),
        });
        if (!post || post.type !== 'image') {
          return res.status(404).json({ error: 'Imagem não encontrada' });
        }
        const media = StatusDispatchService.getInstance().resolvePostImageBuffer(post);
        if (!media) return res.status(404).json({ error: 'Imagem não encontrada' });
        res.setHeader('Content-Type', media.mime);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.send(media.data);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.delete('/status-posts/:id', requireCapability(Cap.SEND_TEST), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const ok = await StatusDispatchService.getInstance().cancelStatusPost(
          auth.clientId,
          req.params.id,
        );
        if (!ok) {
          return res.status(404).json({ error: 'Agendamento não encontrado ou já processado' });
        }
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    // ── Integrações (API keys, webhooks, docs) ─────────────────────────────
    r.get('/integrations/openapi', requireCapability(Cap.API_LOGS_VIEW), (_req, res) => {
      res.json(OPENAPI_DASHBOARD);
    });

    r.get('/integrations/rate-limit', requireCapability(Cap.BILLING_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const org = await Organization.findById(auth.organizationId).lean();
        if (!org) return res.status(404).json({ error: 'Organization not found' });
        res.json({
          plan: org.plan,
          limits: org.limits,
          usage: org.usage,
          api: {
            windowMs: config.RATE_LIMIT?.WINDOW_MS ?? 60_000,
            maxRequestsPerWindow: config.RATE_LIMIT?.MAX_REQUESTS ?? 100,
            header: 'X-API-Key',
          },
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/integrations/api-keys', requireCapability(Cap.API_KEY_CREATE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const keys = await ApiKey.find({
          organizationId: new mongoose.Types.ObjectId(auth.organizationId),
        })
          .sort({ createdAt: -1 })
          .lean();
        res.json(
          keys.map(k => ({
            _id: k._id,
            name: k.name,
            keyPrefix: k.keyPrefix,
            active: k.active,
            lastUsedAt: k.lastUsedAt,
            createdAt: k.createdAt,
          })),
        );
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/integrations/api-keys', requireCapability(Cap.API_KEY_CREATE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const name = String((req.body as { name?: string }).name ?? '').trim() || 'Chave API';
        const raw = generateApiKeyRaw();
        const doc = await ApiKey.create({
          organizationId: new mongoose.Types.ObjectId(auth.organizationId),
          name,
          keyPrefix: apiKeyPrefix(raw),
          keyHash: hashApiKey(raw),
          active: true,
        });
        res.status(201).json({
          _id: doc._id,
          name: doc.name,
          keyPrefix: doc.keyPrefix,
          key: raw,
          createdAt: doc.createdAt,
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.delete('/integrations/api-keys/:id', requireCapability(Cap.API_KEY_CREATE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const result = await ApiKey.deleteOne({
          _id: req.params.id,
          organizationId: new mongoose.Types.ObjectId(auth.organizationId),
        });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Chave não encontrada' });
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/integrations/webhooks', requireCapability(Cap.API_KEY_CREATE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const hooks = await WebhookEndpoint.find({
          organizationId: new mongoose.Types.ObjectId(auth.organizationId),
        })
          .sort({ createdAt: -1 })
          .lean();
        res.json(
          hooks.map(h => ({
            _id: h._id,
            url: h.url,
            events: h.events,
            active: h.active,
            description: h.description,
            lastDeliveryAt: h.lastDeliveryAt,
            lastDeliveryStatus: h.lastDeliveryStatus,
            createdAt: h.createdAt,
          })),
        );
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/integrations/webhooks', requireCapability(Cap.API_KEY_CREATE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const body = req.body as {
          url?: string;
          events?: string[];
          description?: string;
        };
        const url = body.url?.trim();
        if (!url?.startsWith('https://')) {
          return res.status(400).json({ error: 'URL deve começar com https://' });
        }
        const events = (body.events ?? ['campaign.sent', 'campaign.failed']).filter(
          (e): e is WebhookEvent => (WEBHOOK_EVENTS as readonly string[]).includes(e),
        );
        const secretPlain = generateWebhookSecret();
        const doc = await WebhookEndpoint.create({
          organizationId: new mongoose.Types.ObjectId(auth.organizationId),
          url,
          events: events.length ? events : ['campaign.sent'],
          secret: encryptField(secretPlain),
          description: body.description?.trim(),
          active: true,
        });
        res.status(201).json({
          _id: doc._id,
          url: doc.url,
          events: doc.events,
          secret: secretPlain,
          createdAt: doc.createdAt,
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch('/integrations/webhooks/:id', requireCapability(Cap.API_KEY_CREATE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const doc = await WebhookEndpoint.findOne({
          _id: req.params.id,
          organizationId: new mongoose.Types.ObjectId(auth.organizationId),
        });
        if (!doc) return res.status(404).json({ error: 'Webhook não encontrado' });
        const body = req.body as { active?: boolean; events?: string[]; description?: string };
        if (body.active !== undefined) doc.active = Boolean(body.active);
        if (body.description !== undefined) doc.description = body.description.trim();
        if (body.events?.length) {
          doc.events = body.events.filter((e): e is WebhookEvent =>
            (WEBHOOK_EVENTS as readonly string[]).includes(e),
          );
        }
        await doc.save();
        res.json({
          _id: doc._id,
          url: doc.url,
          events: doc.events,
          active: doc.active,
          description: doc.description,
          lastDeliveryAt: doc.lastDeliveryAt,
          lastDeliveryStatus: doc.lastDeliveryStatus,
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.delete('/integrations/webhooks/:id', requireCapability(Cap.API_KEY_CREATE), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const result = await WebhookEndpoint.deleteOne({
          _id: req.params.id,
          organizationId: new mongoose.Types.ObjectId(auth.organizationId),
        });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Webhook não encontrado' });
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.post('/integrations/playground', requireCapability(Cap.SEND_TEST), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const { destination, message } = req.body as { destination?: string; message?: string };
        if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
        if (!destination?.trim()) return res.status(400).json({ error: 'destination is required' });

        const clientId = auth.clientId;
        const clientOid = new mongoose.Types.ObjectId(clientId);
        const wa = WhatsAppService.getInstance();
        if (!wa.isClientConnected(clientId)) {
          return res.status(400).json({ error: 'WhatsApp não conectado' });
        }
        const destDoc = await Destination.findByIdentifier(destination.trim(), clientOid);
        if (!destDoc) return res.status(400).json({ error: 'Destino não encontrado' });
        await wa.sendTestMessageFromDashboard(clientId, destination.trim(), message.trim());
        res.json({ ok: true, destination: destDoc.name });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/integrations/audit-summary', requireCapability(Cap.PLATFORM_AUDIT_VIEW), async (req, res) => {
      try {
        const auth = (req as DashboardRequest).auth!;
        const clientOid = new mongoose.Types.ObjectId(auth.clientId);
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [sentLogs, errorLogs, campaigns, contacts] = await Promise.all([
          SystemLog.countDocuments({
            clientId: clientOid,
            timestamp: { $gte: since },
            level: { $in: ['info', 'success'] },
            'metadata.stage': 'sent',
          }),
          SystemLog.countDocuments({
            clientId: clientOid,
            timestamp: { $gte: since },
            level: 'error',
          }),
          MessageQueue.countDocuments({ clientId: clientOid, createdAt: { $gte: since } }),
          Destination.countDocuments({ clientId: clientOid, type: 'contact', isActive: true }),
        ]);
        res.json({ periodDays: 7, messagesSent: sentLogs, errors: errorLogs, campaigns, activeContacts: contacts });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/admin/monitoring', requireCapability(Cap.LOGS_GLOBAL), async (_req, res) => {
      try {
        const stats = await this.buildStats();
        const health = {
          mongodb: DatabaseManager.getInstance().isConnected(),
          redis: RedisManager.getInstance().isConnected(),
        };
        res.json({ health, stats, timestamp: new Date().toISOString() });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/admin/organizations', requireCapability(Cap.SYSTEM_MODERATION), async (_req, res) => {
      try {
        const orgs = await Organization.find({})
          .select('name plan planExpiresAt createdAt limits')
          .sort({ createdAt: -1 })
          .limit(200)
          .lean();
        res.json(orgs);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.patch(
      '/admin/organizations/:id/plan',
      requireCapability(Cap.SYSTEM_PLANS_MANAGE),
      async (req, res) => {
        try {
          const { plan } = req.body as { plan?: string };
          const allowed = ['free', 'starter', 'pro', 'enterprise'];
          if (!plan || !allowed.includes(plan)) {
            res.status(400).json({ error: 'plan inválido' });
            return;
          }
          const org = await Organization.findById(req.params.id);
          if (!org) {
            res.status(404).json({ error: 'Organização não encontrada' });
            return;
          }
          org.plan = plan as typeof org.plan;
          if (plan === 'free') {
            org.planExpiresAt = undefined;
            org.stripeSubscriptionId = undefined;
          }
          const limits = User.getPlanLimits(plan as 'free' | 'starter' | 'pro' | 'enterprise');
          org.limits.messagesPerDay = limits.messagesPerDay;
          org.limits.groupsMax = limits.groupsMax;
          org.limits.templatesMax = limits.templatesMax;
          await org.save();
          res.json({ ok: true, plan: org.plan });
        } catch (e) {
          res.status(400).json({ error: (e as Error).message });
        }
      },
    );

    r.get('/admin/integrations-overview', requireCapability(Cap.LOGS_GLOBAL), async (_req, res) => {
      try {
        const [apiKeys, webhooks, orgs, ordersPaid] = await Promise.all([
          ApiKey.countDocuments({ active: true }),
          WebhookEndpoint.countDocuments({ active: true }),
          Organization.countDocuments({}),
          BillingOrder.countDocuments({ status: 'paid' }),
        ]);
        res.json({
          apiKeysActive: apiKeys,
          webhooksActive: webhooks,
          organizations: orgs,
          billingOrdersPaid: ordersPaid,
          stripeMode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test',
        });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/admin/errors', requireCapability(Cap.LOGS_GLOBAL), async (_req, res) => {
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const logs = await SystemLog.find({ level: 'error', timestamp: { $gte: since } })
          .sort({ timestamp: -1 })
          .limit(80)
          .lean();
        res.json({ logs, failedJobs: [], since: since.toISOString() });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/admin/audit-logs', requireCapability(Cap.SYSTEM_AUDIT_VIEW), async (req, res) => {
      try {
        const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 200);
        const logs = await AuditLog.find({})
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        res.json(logs);
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    });

    r.get('/admin/servers-summary', requireCapability(Cap.SYSTEM_SERVERS_VIEW), async (_req, res) => {
      try {
        const sessions = await WhatsAppSession.find({}).lean();
        const channels = await DiscordChannel.find({ isActive: true }).lean();
        const guildIds = new Set(channels.map(c => c.guildId));
        res.json({
          whatsappSessions: sessions.length,
          connectedSessions: sessions.filter(s => s.status === 'active').length,
          discordGuilds: guildIds.size,
          activeChannels: channels.length,
        });
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
            'Arquivo muito grande. O limite é 16 MB por requisição (imagem de status ou importação CSV/VCF).',
        });
      }
      const normalized =
        err instanceof Error
          ? err
          : Object.assign(new Error(err?.message ?? 'Error'), err);
      productionSafeError(normalized, _req, res, next);
    });
  }

  // ─── Socket.IO ────────────────────────────────────────────────────────────

  private setupSocket(): void {
    setInboxSocketServer(this.io);
    setPanelSocketServer(this.io);
    const orgSvc = OrganizationService.getInstance();

    this.io.on('connection', async socket => {
      logger.debug(`Dashboard client connected: ${socket.id}`);

      const sess = (socket.request as typeof socket.request & {
        session?: { userId?: string; organizationId?: string };
      }).session;

      if (sess?.userId) {
        try {
          const clientId =
            sess.organizationId ?? (await orgSvc.resolveClientId(sess.userId)) ?? undefined;
          if (clientId) {
            await socket.join(`inbox:${clientId}`);
            await socket.join(`tenant:${clientId}`);
            socket.data.inboxClientId = clientId;
            socket.data.tenantClientId = clientId;
          }
        } catch (err) {
          logger.debug('Socket inbox room skip', { err: (err as Error).message });
        }
      }

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
    const scopeAll =
      auth.isInternalStaff && (req.query as { scope?: string }).scope === 'all';

    if (!scopeAll) {
      return [await this.buildTenantSessionEntry(auth, wa)];
    }

    const users = await User.find({ discordUserId: { $ne: 'system' } }).lean();

    const sessions = (
      await Promise.all(
        users.map(async (u) => {
          const userId = (u._id as mongoose.Types.ObjectId).toString();
          const clientId = await OrganizationService.getInstance().resolveClientId(userId);
          if (!clientId) return null;
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
        }),
      )
    ).filter((s): s is NonNullable<typeof s> => s != null);

    const deduped = new Map<string, (typeof sessions)[number]>();
    for (const s of sessions) {
      if (!deduped.has(s.clientId)) deduped.set(s.clientId, s);
    }

    return [...deduped.values()]
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

  private async buildTenantSessionEntry(
    auth: DashboardRequest['auth'],
    wa: WhatsAppService,
  ): Promise<{
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
  }> {
    const clientId = auth!.clientId;
    const details = await wa.getSessionDetails(clientId);
    const user = await User.findById(auth!.userId).lean();
    const displayName =
      auth!.organizationName ??
      (await this.resolveDiscordDisplayName(user?.discordUserId)) ??
      auth!.username;

    return {
      clientId,
      discordUserId: user?.discordUserId ?? auth!.discordUserId ?? '',
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

    const [users, activeSessions, queueStats, hourlyLogs, organizations, apiKeysActive] =
      await Promise.all([
      User.find({}, 'usage.messagesUsed').lean(),
      WhatsAppSession.countDocuments({ status: 'active' }),
      this.queueManager.getQueueStats().catch(() => ({})),
      SystemLog.aggregate([
        { $match: { message: 'Message sent successfully', timestamp: { $gte: since24h } } },
        { $group: {
          _id: { $hour: '$timestamp' },
          count: { $sum: 1 }
        }},
        { $sort: { '_id': 1 } }
      ]).catch(() => []),
      Organization.countDocuments({}),
      ApiKey.countDocuments({ active: true }),
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

    return {
      totalMessages,
      activeSessions,
      pendingJobs: pending,
      failedJobs: failed,
      organizations,
      apiKeysActive,
      messagesPerHour,
    };
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

          const tenantId = payload.clientId ? String(payload.clientId) : '';
          const tenantRoom = tenantId ? `tenant:${tenantId}` : '';

          if (payload.event === 'QRCODE_UPDATED' && tenantRoom) {
            const data = payload.data as { qrcode?: { base64?: string } };
            this.io.to(tenantRoom).emit('session:update', {
              event: 'QRCODE_UPDATED',
              clientId: payload.clientId,
              qrCode: data?.qrcode?.base64,
              status: 'qr-required',
            });
          } else if (payload.event === 'CONNECTION_UPDATE' && tenantRoom) {
            const data = payload.data as { state?: string };
            const statusMap: Record<string, string> = {
              open: 'connected',
              connecting: 'connecting',
              close: 'disconnected',
            };
            this.io.to(tenantRoom).emit('session:update', {
              event: 'CONNECTION_UPDATE',
              clientId: payload.clientId,
              status: statusMap[data?.state ?? ''] ?? 'disconnected',
            });
          } else if (tenantRoom && payload.clientId && payload.status) {
            this.io.to(tenantRoom).emit('session:update', {
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

    // Stats globais removidos do broadcast — evitava vazamento cross-tenant via Socket.IO.
    // O painel usa polling REST (/api/...) para métricas por tenant ou admin.
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
