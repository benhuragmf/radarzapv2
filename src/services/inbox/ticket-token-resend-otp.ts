import crypto from 'crypto';
import { RedisManager } from '@/cache/RedisManager';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_TTL_SEC = Math.ceil(OTP_TTL_MS / 1000);
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_OTP_REQUESTS_PER_CONTACT = 3;
const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const OTP_REQUEST_WINDOW_SEC = Math.ceil(OTP_REQUEST_WINDOW_MS / 1000);

const REDIS_OTP_PREFIX = 'rz:ticket-otp:';
const REDIS_REQ_PREFIX = 'rz:ticket-otp-req:';

const DEV_PEPPER = 'radarchat-ticket-otp-dev-only';

interface OtpEntry {
  hash: string;
  expiresAt: number;
  attempts: number;
  channel: 'whatsapp' | 'email';
}

interface OtpRequestBucket {
  count: number;
  windowStart: number;
}

const otpStoreMem = new Map<string, OtpEntry>();
const otpRequestBucketsMem = new Map<string, OtpRequestBucket>();

function useMemoryOtpStore(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.TICKET_OTP_USE_MEMORY === 'true';
}

export function getTicketOtpPepper(): string {
  const pepper = process.env.TICKET_OTP_PEPPER?.trim();
  if (process.env.NODE_ENV === 'production') {
    if (!pepper || pepper === 'radarchat-ticket-otp-change-in-production') {
      throw new Error('TICKET_OTP_PEPPER must be set to a strong secret in production');
    }
    return pepper;
  }
  return pepper || DEV_PEPPER;
}

function contactNormForKey(contact: string): string {
  const trimmed = contact.trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  const digits = trimmed.replace(/\D/g, '');
  return digits.slice(-11) || digits;
}

export function otpStorageKey(clientId: string, ticketRef: string, contact: string): string {
  return `${clientId}:${ticketRef}:${contactNormForKey(contact)}`;
}

function redisOtpKey(storageKey: string): string {
  return `${REDIS_OTP_PREFIX}${storageKey}`;
}

function redisReqKey(storageKey: string): string {
  return `${REDIS_REQ_PREFIX}${storageKey}`;
}

function hashOtpCode(code: string, storageKey: string): string {
  return crypto.createHmac('sha256', getTicketOtpPepper()).update(`${storageKey}:${code}`).digest('hex');
}

export function generateTicketResendOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

async function readOtpEntry(storageKey: string): Promise<OtpEntry | null> {
  if (useMemoryOtpStore()) {
    return otpStoreMem.get(storageKey) ?? null;
  }
  const redis = RedisManager.getInstance();
  if (!redis.isConnected()) {
    throw new Error('Redis indisponível para OTP de reenvio de token');
  }
  const raw = await redis.get(redisOtpKey(storageKey));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OtpEntry;
    if (Date.now() > parsed.expiresAt) {
      await redis.deleteKey(redisOtpKey(storageKey));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeOtpEntry(storageKey: string, entry: OtpEntry): Promise<void> {
  if (useMemoryOtpStore()) {
    otpStoreMem.set(storageKey, entry);
    return;
  }
  const redis = RedisManager.getInstance();
  if (!redis.isConnected()) {
    throw new Error('Redis indisponível para OTP de reenvio de token');
  }
  await redis.setWithTTL(redisOtpKey(storageKey), JSON.stringify(entry), OTP_TTL_SEC);
}

async function deleteOtpEntry(storageKey: string): Promise<void> {
  if (useMemoryOtpStore()) {
    otpStoreMem.delete(storageKey);
    return;
  }
  await RedisManager.getInstance().deleteKey(redisOtpKey(storageKey));
}

export async function isTicketResendOtpRequestLimited(
  clientId: string,
  ticketRef: string,
  contact: string,
): Promise<boolean> {
  const key = otpStorageKey(clientId, ticketRef, contact);
  if (useMemoryOtpStore()) {
    const bucket = otpRequestBucketsMem.get(key);
    if (!bucket) return false;
    if (Date.now() - bucket.windowStart > OTP_REQUEST_WINDOW_MS) {
      otpRequestBucketsMem.delete(key);
      return false;
    }
    return bucket.count >= MAX_OTP_REQUESTS_PER_CONTACT;
  }
  const redis = RedisManager.getInstance();
  if (!redis.isConnected()) return false;
  const countRaw = await redis.get(redisReqKey(key));
  const count = countRaw ? parseInt(countRaw, 10) : 0;
  return count >= MAX_OTP_REQUESTS_PER_CONTACT;
}

export async function recordTicketResendOtpRequest(
  clientId: string,
  ticketRef: string,
  contact: string,
): Promise<void> {
  const key = otpStorageKey(clientId, ticketRef, contact);
  if (useMemoryOtpStore()) {
    const now = Date.now();
    const existing = otpRequestBucketsMem.get(key);
    if (!existing || now - existing.windowStart > OTP_REQUEST_WINDOW_MS) {
      otpRequestBucketsMem.set(key, { count: 1, windowStart: now });
      return;
    }
    existing.count += 1;
    return;
  }
  const redis = RedisManager.getInstance();
  if (!redis.isConnected()) return;
  await redis.increment(redisReqKey(key), OTP_REQUEST_WINDOW_SEC);
}

export async function storeTicketResendOtp(opts: {
  clientId: string;
  ticketRef: string;
  contact: string;
  channel: 'whatsapp' | 'email';
  code: string;
}): Promise<void> {
  const key = otpStorageKey(opts.clientId, opts.ticketRef, opts.contact);
  await writeOtpEntry(key, {
    hash: hashOtpCode(opts.code, key),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    channel: opts.channel,
  });
}

export async function verifyTicketResendOtp(opts: {
  clientId: string;
  ticketRef: string;
  contact: string;
  code: string;
  channel: 'whatsapp' | 'email';
}): Promise<boolean> {
  const key = otpStorageKey(opts.clientId, opts.ticketRef, opts.contact);
  const entry = await readOtpEntry(key);
  if (!entry) return false;
  if (entry.channel !== opts.channel) return false;
  if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
    await deleteOtpEntry(key);
    return false;
  }

  entry.attempts += 1;
  const normCode = opts.code.replace(/\D/g, '').slice(0, 6);
  if (normCode.length !== 6) {
    await writeOtpEntry(key, entry);
    return false;
  }

  const ok = entry.hash === hashOtpCode(normCode, key);
  if (ok) {
    await deleteOtpEntry(key);
  } else {
    await writeOtpEntry(key, entry);
  }
  return ok;
}

export async function clearTicketResendOtp(
  clientId: string,
  ticketRef: string,
  contact: string,
): Promise<void> {
  await deleteOtpEntry(otpStorageKey(clientId, ticketRef, contact));
}

/** Testes — limpa OTP in-memory. */
export function resetTicketTokenResendOtpStore(): void {
  otpStoreMem.clear();
  otpRequestBucketsMem.clear();
}
