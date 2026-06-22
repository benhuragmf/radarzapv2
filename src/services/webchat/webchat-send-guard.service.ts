import { RateLimiter } from '@/cache/RateLimiter';
import {
  maxPerMinuteFromPolicy,
  resolveWhatsAppSendPolicy,
} from '@/services/whatsapp/whatsapp-send-policy.service';
import type { WhatsAppSendPolicySnapshot } from '@/types/whatsapp-send-policy';
import { computeHumanTypingMs } from '@/utils/whatsapp-human-send.util';
import { delay } from '@/services/whatsapp/waSessionEvents';

export type WebChatSendRole = 'agent' | 'visitor';

export class WebChatSendRateLimitError extends Error {
  constructor(message = 'Muitas mensagens em sequência — aguarde alguns segundos.') {
    super(message);
    this.name = 'WebChatSendRateLimitError';
  }
}

/** Visitante: limite mais estrito por conversa (anti-spam). */
const VISITOR_BURST_PER_MINUTE = 12;

export async function assertWebChatSendAllowed(
  clientId: string,
  conversationId: string,
  role: WebChatSendRole,
  policy?: WhatsAppSendPolicySnapshot,
): Promise<WhatsAppSendPolicySnapshot> {
  const resolved = policy ?? (await resolveWhatsAppSendPolicy(clientId));
  const limiter = RateLimiter.getInstance();

  if (role === 'visitor') {
    const result = await limiter.checkWhatsAppSendLimit(
      `${clientId}:wc:${conversationId}:visitor`,
      'conversation',
      {
        ...resolved,
        conversation: {
          enabled: true,
          maxPerMinute: Math.min(VISITOR_BURST_PER_MINUTE, maxPerMinuteFromPolicy(resolved, 'conversation')),
        },
      },
    );
    if (!result.allowed) {
      throw new WebChatSendRateLimitError(
        'Você enviou muitas mensagens seguidas. Aguarde um momento antes de continuar.',
      );
    }
    return resolved;
  }

  const result = await limiter.checkWhatsAppSendLimit(
    `${clientId}:wc:agent`,
    'conversation',
    resolved,
  );
  if (!result.allowed) {
    throw new WebChatSendRateLimitError();
  }
  return resolved;
}

export type WebChatAgentHumanDelayMode = 'panel' | 'bridge';

/** Bridge WA→site: delay curto — atendente já digitou no WhatsApp. */
const BRIDGE_RELAY_MIN_MS = 350;
const BRIDGE_RELAY_MAX_MS = 900;
const BRIDGE_RELAY_MS_PER_CHAR = 8;
const BRIDGE_RELAY_JITTER_MS = 150;

export function computeWebChatBridgeRelayTypingMs(
  text: string,
  policy: WhatsAppSendPolicySnapshot,
): number {
  if (!policy.humanizeEnabled) return 0;
  const len = (text ?? '').trim().length;
  const fromChars = len * BRIDGE_RELAY_MS_PER_CHAR;
  const clamped = Math.max(
    BRIDGE_RELAY_MIN_MS,
    Math.min(fromChars, BRIDGE_RELAY_MAX_MS),
  );
  const jitter = Math.floor(Math.random() * BRIDGE_RELAY_JITTER_MS);
  return clamped + jitter;
}

/** Simula atendente digitando antes de entregar mensagem no widget. */
export async function applyWebChatAgentHumanDelay(
  clientId: string,
  text: string,
  onTyping: (typing: boolean) => void,
  policy?: WhatsAppSendPolicySnapshot,
  mode: WebChatAgentHumanDelayMode = 'panel',
): Promise<void> {
  const resolved = policy ?? (await resolveWhatsAppSendPolicy(clientId));
  const ms =
    mode === 'bridge'
      ? computeWebChatBridgeRelayTypingMs(text, resolved)
      : computeHumanTypingMs(text, 'conversation', resolved);
  if (ms <= 0) return;
  if (resolved.composingEnabled) onTyping(true);
  await delay(ms);
  if (resolved.composingEnabled) onTyping(false);
}
