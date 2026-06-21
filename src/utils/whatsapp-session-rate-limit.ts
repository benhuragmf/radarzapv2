import type { WhatsAppSendPolicySnapshot } from '@/types/whatsapp-send-policy';
import { maxPerMinuteFromPolicy } from '@/services/whatsapp/whatsapp-send-policy.service';
import { isDevelopment } from '@/config/environment';

/** Origem do envio WA — buckets separados por sessão. */
export type WhatsAppSendKind = 'marketing' | 'conversation' | 'alert';

/** Defaults legados — sobrescritos por política admin/empresa quando resolvida. */
export const WA_SEND_LIMITS: Record<
  WhatsAppSendKind,
  { maxPerMinute: number; jitterMinMs: number; jitterMaxMs: number }
> = {
  marketing: { maxPerMinute: 2, jitterMinMs: 25_000, jitterMaxMs: 35_000 },
  conversation: { maxPerMinute: 10, jitterMinMs: 4_000, jitterMaxMs: 8_000 },
  alert: { maxPerMinute: 30, jitterMinMs: 0, jitterMaxMs: 0 },
};

export function resolveWhatsAppSendKind(input: {
  sendKind?: WhatsAppSendKind;
  consentOrigin?: string;
  ruleId?: string;
}): WhatsAppSendKind {
  if (input.sendKind) return input.sendKind;
  if (input.ruleId) return 'marketing';
  if (input.consentOrigin === 'campaign') return 'marketing';
  if (input.consentOrigin?.startsWith('inbox-')) return 'conversation';
  return 'conversation';
}

export function getMaxPerMinuteForKind(
  kind: WhatsAppSendKind,
  policy?: WhatsAppSendPolicySnapshot,
): number {
  if (policy) return maxPerMinuteFromPolicy(policy, kind);
  const base = WA_SEND_LIMITS[kind].maxPerMinute;
  if (!isDevelopment()) return base;
  if (kind === 'marketing') return Math.max(base, 10);
  return Math.max(base, 60);
}

/** @deprecated Prefer computeHumanTypingMs — mantido para testes legados. */
export function computeSendJitterMs(kind: WhatsAppSendKind): number {
  const cfg = WA_SEND_LIMITS[kind];
  if (cfg.jitterMaxMs <= 0) return 0;
  const span = cfg.jitterMaxMs - cfg.jitterMinMs;
  return cfg.jitterMinMs + Math.floor(Math.random() * (span + 1));
}
