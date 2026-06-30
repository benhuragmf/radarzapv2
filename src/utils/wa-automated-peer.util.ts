/** Janela para detectar eco de mensagem outbound recente. */
export const WA_PEER_ECHO_WINDOW_MS = 90_000;

/** Burst: muitas mensagens inbound seguidas no mesmo contato. */
export const WA_PEER_BURST_WINDOW_MS = 60_000;
export const WA_PEER_BURST_MAX_INBOUND = 4;

/** Lembretes CSAT após resposta inválida (não conta o prompt inicial). */
export const CSAT_MAX_INVALID_REMINDERS = 2;

export type AutomatedPeerSuppressReason = 'echo' | 'burst' | 'automated_burst';

export interface WaAutomatedPeerState {
  inboundAtMs: number[];
  outboundBodies: string[];
  outboundAtMs: number[];
}

export function emptyWaAutomatedPeerState(): WaAutomatedPeerState {
  return { inboundAtMs: [], outboundBodies: [], outboundAtMs: [] };
}

/** Normaliza texto para comparar eco entre bots. */
export function normalizePeerMessage(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ');
}

/** Frases típicas de bot/atendimento automático (WhatsApp). */
export function looksLikeAutomatedPeerMessage(text: string): boolean {
  const norm = normalizePeerMessage(text);
  if (!norm || norm.length < 12) return false;

  const patterns = [
    /responda so com um numero de 1 a 5/,
    /responda so com o numero/,
    /de 1 a 5 como foi/,
    /qual e o seu nome completo/,
    /para comecar qual e o seu nome/,
    /para registrar seu atendimento qual e o seu e-?mail/,
    /digite \d+ para/,
    /selecione uma opcao/,
    /escolha uma opcao/,
    /menu de atendimento/,
    /aguarde um atendente/,
    /voce esta na posicao \d+ da fila/,
  ];

  return patterns.some(p => p.test(norm));
}

export function isEchoOfRecentOutbound(
  inbound: string,
  state: WaAutomatedPeerState,
  nowMs: number,
  echoWindowMs: number = WA_PEER_ECHO_WINDOW_MS,
): boolean {
  const normIn = normalizePeerMessage(inbound);
  if (!normIn) return false;

  for (let i = 0; i < state.outboundBodies.length; i++) {
    const sentAt = state.outboundAtMs[i] ?? 0;
    if (nowMs - sentAt > echoWindowMs) continue;

    const normOut = normalizePeerMessage(state.outboundBodies[i] ?? '');
    if (!normOut) continue;
    if (normIn === normOut) return true;

    const minLen = Math.min(normIn.length, normOut.length);
    const maxLen = Math.max(normIn.length, normOut.length);
    if (minLen >= 20 && maxLen > 0 && minLen / maxLen >= 0.72) {
      if (normIn.includes(normOut) || normOut.includes(normIn)) return true;
    }
  }

  return false;
}

export function countInboundInBurstWindow(
  state: WaAutomatedPeerState,
  nowMs: number,
  windowMs: number = WA_PEER_BURST_WINDOW_MS,
): number {
  return state.inboundAtMs.filter(ts => nowMs - ts <= windowMs).length;
}

export function evaluateAutomatedPeerSuppression(
  inboundText: string,
  state: WaAutomatedPeerState,
  nowMs: number,
): { suppress: boolean; reason?: AutomatedPeerSuppressReason } {
  const trimmed = inboundText.trim();
  if (!trimmed) return { suppress: false };

  if (isEchoOfRecentOutbound(trimmed, state, nowMs)) {
    return { suppress: true, reason: 'echo' };
  }

  const burstCount = countInboundInBurstWindow(state, nowMs);
  if (burstCount >= WA_PEER_BURST_MAX_INBOUND) {
    return { suppress: true, reason: 'burst' };
  }

  if (looksLikeAutomatedPeerMessage(trimmed) && burstCount >= 2) {
    return { suppress: true, reason: 'automated_burst' };
  }

  return { suppress: false };
}

export function prunePeerState(
  state: WaAutomatedPeerState,
  nowMs: number,
): WaAutomatedPeerState {
  const inboundAtMs = state.inboundAtMs.filter(ts => nowMs - ts <= WA_PEER_BURST_WINDOW_MS);
  const outboundBodies: string[] = [];
  const outboundAtMs: number[] = [];
  for (let i = 0; i < state.outboundBodies.length; i++) {
    const ts = state.outboundAtMs[i] ?? 0;
    if (nowMs - ts <= WA_PEER_ECHO_WINDOW_MS) {
      outboundBodies.push(state.outboundBodies[i]!);
      outboundAtMs.push(ts);
    }
  }
  const maxOutbound = 8;
  return {
    inboundAtMs,
    outboundBodies: outboundBodies.slice(-maxOutbound),
    outboundAtMs: outboundAtMs.slice(-maxOutbound),
  };
}

export function recordPeerInbound(
  state: WaAutomatedPeerState,
  nowMs: number,
): WaAutomatedPeerState {
  const pruned = prunePeerState(state, nowMs);
  return {
    ...pruned,
    inboundAtMs: [...pruned.inboundAtMs, nowMs],
  };
}

export function recordPeerOutbound(
  state: WaAutomatedPeerState,
  text: string,
  nowMs: number,
): WaAutomatedPeerState {
  const pruned = prunePeerState(state, nowMs);
  const outboundBodies = [...pruned.outboundBodies, text];
  const outboundAtMs = [...pruned.outboundAtMs, nowMs];
  const maxOutbound = 8;
  return {
    ...pruned,
    outboundBodies: outboundBodies.slice(-maxOutbound),
    outboundAtMs: outboundAtMs.slice(-maxOutbound),
  };
}
