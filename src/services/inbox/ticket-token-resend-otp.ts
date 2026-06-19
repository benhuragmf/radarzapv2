import crypto from 'crypto';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_OTP_REQUESTS_PER_CONTACT = 3;
const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;

const OTP_PEPPER =
  process.env.TICKET_OTP_PEPPER?.trim() || 'radarzap-ticket-otp-change-in-production';

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

const otpStore = new Map<string, OtpEntry>();
const otpRequestBuckets = new Map<string, OtpRequestBucket>();

function contactNormForKey(contact: string): string {
  const trimmed = contact.trim();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  const digits = trimmed.replace(/\D/g, '');
  return digits.slice(-11) || digits;
}

export function otpStorageKey(clientId: string, ticketRef: string, contact: string): string {
  return `${clientId}:${ticketRef}:${contactNormForKey(contact)}`;
}

function hashOtpCode(code: string, storageKey: string): string {
  return crypto.createHmac('sha256', OTP_PEPPER).update(`${storageKey}:${code}`).digest('hex');
}

export function generateTicketResendOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function isTicketResendOtpRequestLimited(
  clientId: string,
  ticketRef: string,
  contact: string,
): boolean {
  const key = otpStorageKey(clientId, ticketRef, contact);
  const bucket = otpRequestBuckets.get(key);
  if (!bucket) return false;
  if (Date.now() - bucket.windowStart > OTP_REQUEST_WINDOW_MS) {
    otpRequestBuckets.delete(key);
    return false;
  }
  return bucket.count >= MAX_OTP_REQUESTS_PER_CONTACT;
}

export function recordTicketResendOtpRequest(
  clientId: string,
  ticketRef: string,
  contact: string,
): void {
  const key = otpStorageKey(clientId, ticketRef, contact);
  const now = Date.now();
  const existing = otpRequestBuckets.get(key);
  if (!existing || now - existing.windowStart > OTP_REQUEST_WINDOW_MS) {
    otpRequestBuckets.set(key, { count: 1, windowStart: now });
    return;
  }
  existing.count += 1;
}

export function storeTicketResendOtp(opts: {
  clientId: string;
  ticketRef: string;
  contact: string;
  channel: 'whatsapp' | 'email';
  code: string;
}): void {
  const key = otpStorageKey(opts.clientId, opts.ticketRef, opts.contact);
  otpStore.set(key, {
    hash: hashOtpCode(opts.code, key),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    channel: opts.channel,
  });
}

export function verifyTicketResendOtp(opts: {
  clientId: string;
  ticketRef: string;
  contact: string;
  code: string;
  channel: 'whatsapp' | 'email';
}): boolean {
  const key = otpStorageKey(opts.clientId, opts.ticketRef, opts.contact);
  const entry = otpStore.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    return false;
  }
  if (entry.channel !== opts.channel) return false;
  if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(key);
    return false;
  }

  entry.attempts += 1;
  const normCode = opts.code.replace(/\D/g, '').slice(0, 6);
  if (normCode.length !== 6) return false;

  const ok = entry.hash === hashOtpCode(normCode, key);
  if (ok) {
    otpStore.delete(key);
  }
  return ok;
}

export function clearTicketResendOtp(
  clientId: string,
  ticketRef: string,
  contact: string,
): void {
  otpStore.delete(otpStorageKey(clientId, ticketRef, contact));
}

/** Testes — limpa OTP in-memory. */
export function resetTicketTokenResendOtpStore(): void {
  otpStore.clear();
  otpRequestBuckets.clear();
}
