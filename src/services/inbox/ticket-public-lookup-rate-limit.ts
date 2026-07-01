import { RedisManager } from '@/cache/RedisManager';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

type Bucket = { failures: number; windowStart: number };

const lookupBuckets = new Map<string, Bucket>();

function bucketKey(clientId: string, ip: string): string {
  return `${clientId}:${ip || 'unknown'}`;
}

function redisLookupKey(clientId: string, ip: string): string {
  return `radarchat:ticket:lookup:fail:${bucketKey(clientId, ip)}`;
}

async function redisFailureCount(key: string): Promise<number | null> {
  const redis = RedisManager.getInstance();
  if (!redis.isConnected()) return null;
  const raw = await redis.get(key);
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

async function redisRecordFailure(key: string, windowMs: number): Promise<number> {
  const redis = RedisManager.getInstance();
  const ttlSec = Math.ceil(windowMs / 1000);
  const count = await redis.increment(key, ttlSec);
  return count;
}

async function redisClear(key: string): Promise<void> {
  const redis = RedisManager.getInstance();
  if (!redis.isConnected()) return;
  await redis.del(key);
}

export async function isTicketLookupRateLimited(
  clientId: string,
  ip: string | undefined,
): Promise<boolean> {
  const key = bucketKey(clientId, ip ?? '');
  const redisKey = redisLookupKey(clientId, ip ?? '');
  const redisCount = await redisFailureCount(redisKey);
  if (redisCount !== null) {
    return redisCount >= MAX_FAILURES;
  }

  const bucket = lookupBuckets.get(key);
  if (!bucket) return false;
  if (Date.now() - bucket.windowStart > WINDOW_MS) {
    lookupBuckets.delete(key);
    return false;
  }
  return bucket.failures >= MAX_FAILURES;
}

export async function recordTicketLookupFailure(
  clientId: string,
  ip: string | undefined,
): Promise<void> {
  const key = bucketKey(clientId, ip ?? '');
  const redisKey = redisLookupKey(clientId, ip ?? '');
  const redis = RedisManager.getInstance();
  if (redis.isConnected()) {
    await redisRecordFailure(redisKey, WINDOW_MS);
    return;
  }

  const now = Date.now();
  const existing = lookupBuckets.get(key);
  if (!existing || now - existing.windowStart > WINDOW_MS) {
    lookupBuckets.set(key, { failures: 1, windowStart: now });
    return;
  }
  existing.failures += 1;
}

export async function clearTicketLookupFailures(
  clientId: string,
  ip: string | undefined,
): Promise<void> {
  lookupBuckets.delete(bucketKey(clientId, ip ?? ''));
  await redisClear(redisLookupKey(clientId, ip ?? ''));
}

/** Testes — limpa estado in-memory. */
export function resetTicketLookupRateLimits(): void {
  lookupBuckets.clear();
}

const RESEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_RESENDS_PER_IP = 5;
const RESEND_COOLDOWN_MS = 2 * 60 * 1000;

const resendIpBuckets = new Map<string, Bucket>();
const resendTicketCooldown = new Map<string, number>();

function resendTicketContactKey(clientId: string, ticketRef: string, contact: string): string {
  const trimmed = contact.trim();
  const norm = trimmed.includes('@')
    ? trimmed.toLowerCase()
    : trimmed.replace(/\D/g, '').slice(-11);
  return `${clientId}:${ticketRef}:${norm}`;
}

function redisResendKey(clientId: string, ip: string): string {
  return `radarchat:ticket:resend:ip:${bucketKey(clientId, ip)}`;
}

export async function isTicketTokenResendRateLimited(
  clientId: string,
  ip: string | undefined,
): Promise<boolean> {
  const redisKey = redisResendKey(clientId, ip ?? '');
  const redisCount = await redisFailureCount(redisKey);
  if (redisCount !== null) {
    return redisCount >= MAX_RESENDS_PER_IP;
  }

  const key = bucketKey(clientId, ip ?? '');
  const bucket = resendIpBuckets.get(key);
  if (!bucket) return false;
  if (Date.now() - bucket.windowStart > RESEND_WINDOW_MS) {
    resendIpBuckets.delete(key);
    return false;
  }
  return bucket.failures >= MAX_RESENDS_PER_IP;
}

export async function recordTicketTokenResendAttempt(
  clientId: string,
  ip: string | undefined,
): Promise<void> {
  const redisKey = redisResendKey(clientId, ip ?? '');
  const redis = RedisManager.getInstance();
  if (redis.isConnected()) {
    await redisRecordFailure(redisKey, RESEND_WINDOW_MS);
    return;
  }

  const key = bucketKey(clientId, ip ?? '');
  const now = Date.now();
  const existing = resendIpBuckets.get(key);
  if (!existing || now - existing.windowStart > RESEND_WINDOW_MS) {
    resendIpBuckets.set(key, { failures: 1, windowStart: now });
    return;
  }
  existing.failures += 1;
}

export function isTicketTokenResendOnCooldown(
  clientId: string,
  ticketRef: string,
  contact: string,
): boolean {
  const key = resendTicketContactKey(clientId, ticketRef, contact);
  const until = resendTicketCooldown.get(key);
  if (!until) return false;
  if (Date.now() > until) {
    resendTicketCooldown.delete(key);
    return false;
  }
  return true;
}

export function markTicketTokenResendSent(
  clientId: string,
  ticketRef: string,
  contact: string,
): void {
  resendTicketCooldown.set(
    resendTicketContactKey(clientId, ticketRef, contact),
    Date.now() + RESEND_COOLDOWN_MS,
  );
}

export function resetTicketTokenResendLimits(): void {
  resendIpBuckets.clear();
  resendTicketCooldown.clear();
}
