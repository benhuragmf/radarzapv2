import type { WhatsAppSendPolicySnapshot } from '@/types/whatsapp-send-policy';
import type { WhatsAppSendKind } from '@/utils/whatsapp-session-rate-limit';

const MS_PER_CHAR: Record<WhatsAppSendKind, number> = {
  conversation: 42,
  marketing: 50,
  alert: 0,
};

const TYPING_MIN_MS: Record<WhatsAppSendKind, number> = {
  conversation: 1_500,
  marketing: 8_000,
  alert: 200,
};

const TYPING_MAX_MS: Record<WhatsAppSendKind, number> = {
  conversation: 10_000,
  marketing: 35_000,
  alert: 800,
};

/** Tempo de "digitando" antes do envio — proporcional ao texto + aleatório. */
export function computeHumanTypingMs(
  text: string,
  kind: WhatsAppSendKind,
  policy: WhatsAppSendPolicySnapshot,
): number {
  if (!policy.humanizeEnabled) return 0;
  if (kind === 'alert') {
    if (!policy.humanizeEnabled) return 0;
    return TYPING_MIN_MS.alert + Math.floor(Math.random() * (TYPING_MAX_MS.alert - TYPING_MIN_MS.alert));
  }

  const len = (text ?? '').trim().length;
  const fromChars = len * MS_PER_CHAR[kind];
  const clamped = Math.max(TYPING_MIN_MS[kind], Math.min(fromChars, TYPING_MAX_MS[kind]));
  const jitter = Math.floor(Math.random() * 900);
  return clamped + jitter;
}

export function sendKindPriority(kind: WhatsAppSendKind): number {
  if (kind === 'conversation') return 9;
  if (kind === 'alert') return 7;
  return 2;
}
