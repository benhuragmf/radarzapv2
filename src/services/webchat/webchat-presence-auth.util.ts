import crypto from 'crypto';
import { config } from '@/config/environment';

const TOKEN_PREFIX = 'wcpa_';
const TOKEN_TTL_MS = 5 * 60 * 1000;

function hmacPayload(payload: string): string {
  return crypto.createHmac('sha256', config.SECURITY.SESSION_SECRET).update(payload).digest('base64url');
}

/** Emite token curto para autenticar socket de presença (AH-R06). */
export function issueWebChatPresenceSocketAuth(clientId: string, presenceId: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const body = `${clientId}:${presenceId}:${exp}`;
  return `${TOKEN_PREFIX}${Buffer.from(body).toString('base64url')}.${hmacPayload(body)}`;
}

/** Valida token emitido após POST /presence. */
export function verifyWebChatPresenceSocketAuth(
  token: string | undefined,
  clientId: string,
  presenceId: string,
): boolean {
  if (!token?.startsWith(TOKEN_PREFIX)) return false;
  const rest = token.slice(TOKEN_PREFIX.length);
  const dot = rest.lastIndexOf('.');
  if (dot <= 0) return false;
  const encoded = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  let body: string;
  try {
    body = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return false;
  }
  const expected = hmacPayload(body);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const [tokClientId, tokPresenceId, expRaw] = body.split(':');
  if (tokClientId !== clientId || tokPresenceId !== presenceId) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return true;
}
