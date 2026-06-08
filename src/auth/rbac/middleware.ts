/*
 * RadarZap / RadarGamer
 * Copyright (c) 2026 Benhur Augusto Gomes Monteiro Faria
 * Todos os direitos reservados.
 * Uso, cópia, distribuição ou modificação sem autorização é proibido.
 */

import { Request, Response, NextFunction } from 'express';
import { User } from '@/models/User';
import { Capability } from './capabilities';
import { AuthContext } from './types';
import { can } from './can';
import { buildAuthContext } from './AuthContextService';

export interface DashboardRequest extends Request {
  auth?: AuthContext;
  session: Request['session'] & {
    userId?: string;
    discordId?: string;
    username?: string;
    avatar?: string | null;
    organizationId?: string;
  };
}

export async function loadAuthContext(
  req: DashboardRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sess = req.session;
    if (!sess?.userId) {
      res.status(401).json({ error: 'Unauthorized', loginUrl: '/auth/google' });
      return;
    }

    const user = await User.findById(sess.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found', loginUrl: '/auth/discord' });
      return;
    }

    req.auth = await buildAuthContext({
      user,
      userId: sess.userId,
      discordUserId: sess.discordId ?? user.discordUserId,
      username: sess.username ?? user.displayName ?? user.email ?? 'Usuário',
      avatar: sess.avatar ?? null,
      authProvider: (sess as { authProvider?: 'google' | 'discord' }).authProvider,
      email: (sess as { email?: string }).email ?? user.email,
      sessionOrganizationId: sess.organizationId,
    });

    if (req.auth.needsOrganizationChoice) {
      res.status(403).json({
        error: 'Selecione uma empresa para continuar',
        code: 'ORGANIZATION_REQUIRED',
      });
      return;
    }

    next();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}

function resolveGuildId(
  req: DashboardRequest,
  options?: { guildFromQuery?: boolean; guildFromBody?: boolean; guildFromParams?: string },
): string | undefined {
  if (options?.guildFromQuery) return req.query.guildId as string | undefined;
  if (options?.guildFromBody) return (req.body as { guildId?: string })?.guildId;
  if (options?.guildFromParams) return req.params[options.guildFromParams];
  return undefined;
}

export function requireCapability(
  permission: Capability,
  options?: { guildFromQuery?: boolean; guildFromBody?: boolean; guildFromParams?: string },
) {
  return (req: DashboardRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const guildId = resolveGuildId(req, options);

    if (!can(req.auth, permission, { guildId })) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission,
      });
      return;
    }

    next();
  };
}

export function requireAnyCapability(
  ...permissions: Capability[]
) {
  return (req: DashboardRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (permissions.some(p => can(req.auth!, p))) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Forbidden',
      code: 'INSUFFICIENT_PERMISSIONS',
      required: permissions,
    });
  };
}

export function requireSelfOrStaff(paramName = 'id') {
  return (req: DashboardRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const targetId = req.params[paramName];
    const isSelf = targetId === req.auth.clientId || targetId === req.auth.userId;
    const isStaff = req.auth.isInternalStaff;

    if (!isSelf && !isStaff) {
      res.status(403).json({ error: 'Forbidden', code: 'ACCESS_DENIED' });
      return;
    }

    next();
  };
}

export function assertOwnClient(req: DashboardRequest, clientId: string): boolean {
  if (!req.auth) return false;
  if (req.auth.isInternalStaff) return true;
  return req.auth.clientId === clientId;
}

export function getTenantFilter(req: DashboardRequest, guildId?: string): Record<string, unknown> {
  if (!req.auth) return { _id: null };

  if (req.auth.isInternalStaff && !guildId) {
    return {};
  }

  const filter: Record<string, unknown> = { clientId: req.auth.clientId };

  if (guildId) {
    filter.guildId = guildId;
  }

  return filter;
}
