import crypto from 'crypto';

/** Caracteres legíveis — sem 0/O/1/I para reduzir erro de digitação. */
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateTicketPublicAccessToken(): string {
  const bytes = crypto.randomBytes(8);
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) part1 += TOKEN_ALPHABET[bytes[i]! % TOKEN_ALPHABET.length];
  for (let i = 4; i < 8; i++) part2 += TOKEN_ALPHABET[bytes[i]! % TOKEN_ALPHABET.length];
  return `${part1}-${part2}`;
}

export function normalizeTicketPublicAccessToken(raw: string): string {
  let norm = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (/^[A-Z2-9]{8}$/.test(norm)) {
    return `${norm.slice(0, 4)}-${norm.slice(4)}`;
  }
  return norm;
}

export function hashTicketPublicAccessToken(raw: string): string {
  const norm = normalizeTicketPublicAccessToken(raw);
  return crypto.createHash('sha256').update(norm).digest('hex');
}

export function verifyTicketPublicAccessToken(
  raw: string,
  storedHash: string | undefined | null,
): boolean {
  if (!storedHash?.trim() || !raw?.trim()) return false;
  const computed = hashTicketPublicAccessToken(raw);
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(storedHash.trim(), 'hex'));
  } catch {
    return false;
  }
}

export function publicAccessTokenHint(raw: string): string {
  const norm = normalizeTicketPublicAccessToken(raw).replace(/-/g, '');
  return norm.slice(-4);
}

/** Normaliza telefone para comparação (E.164 BR sem +). */
export function normalizePhoneForTicketMatch(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (!digits.startsWith('55') && digits.length <= 11) {
    digits = `55${digits}`;
  }
  return digits;
}

/** Compara telefones informados (tolera DDI/DDD). */
export function phonesMatchForTicket(input: string, stored: string): boolean {
  const a = normalizePhoneForTicketMatch(input);
  const b = normalizePhoneForTicketMatch(stored);
  if (!a || !b) return false;
  if (a === b) return true;
  const tail11 = (s: string) => s.slice(-11);
  const tail9 = (s: string) => s.slice(-9);
  return tail11(a) === tail11(b) || tail9(a) === tail9(b);
}

/** Normaliza referência digitada pelo cliente (TK-XXXXXX, #TK-…, etc.). */
export function normalizeTicketRefForLookup(raw: string): string {
  let ref = raw.trim().toUpperCase().replace(/^#+/, '');
  if (!ref) return '';
  if (!ref.startsWith('TK')) {
    ref = `TK-${ref.replace(/^-+/, '')}`;
  } else if (!ref.startsWith('TK-')) {
    ref = `TK-${ref.slice(2).replace(/^-+/, '')}`;
  }
  return ref.slice(0, 32);
}
