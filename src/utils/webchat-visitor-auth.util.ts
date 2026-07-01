import type { Request } from 'express';
import { config } from '@/config/environment';

export type WebChatVisitorTokenResolveOptions = {
  /** Só dev/legado — em produção mídia usa header `X-WebChat-Visitor`. */
  allowQueryToken?: boolean;
};

export type WebChatVisitorTokenResolveResult =
  | { ok: true; token: string }
  | { ok: false; code: 'MISSING' | 'QUERY_TOKEN_FORBIDDEN' };

/** Resolve token do visitante WebChat (header preferido; query `?v=` bloqueada em produção). */
export function resolveWebChatVisitorTokenFromRequest(
  req: Request,
  options: WebChatVisitorTokenResolveOptions = {},
): WebChatVisitorTokenResolveResult {
  const header = req.headers['x-webchat-visitor'];
  if (typeof header === 'string' && header.trim()) {
    return { ok: true, token: header.trim() };
  }

  const queryToken = req.query.v;
  if (typeof queryToken === 'string' && queryToken.trim()) {
    if (config.NODE_ENV === 'production' && !options.allowQueryToken) {
      return { ok: false, code: 'QUERY_TOKEN_FORBIDDEN' };
    }
    return { ok: true, token: queryToken.trim() };
  }

  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const bearer = auth.slice(7).trim();
    if (bearer) return { ok: true, token: bearer };
  }

  return { ok: false, code: 'MISSING' };
}
