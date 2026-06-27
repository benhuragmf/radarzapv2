/** Detecção de respostas de encerramento natural após pergunta final (/mais). */

const CLOSING_PATTERNS: RegExp[] = [
  /^n[aã]o[!.?\s]*$/i,
  /^n[aã]o[,.\s]+obrigad/i,
  /^n[aã]o\s+preciso/i,
  /^n[aã]o\s+quero/i,
  /\bobrigad[oa]s?\b/i,
  /\bvaleu\b/i,
  /\bs[oó]\s+isso\b/i,
  /\bé\s+isso\b/i,
  /\bera\s+isso\b/i,
  /\bpode\s+encerr/i,
  /\bpode\s+fech/i,
  /\bpode\s+finaliz/i,
  /\btudo\s+certo\b/i,
  /\btudo\s+ok\b/i,
  /\btudo\s+bem\b/i,
  /\bresolvido\b/i,
  /\bsem\s+mais\b/i,
  /\bnada\s+mais\b/i,
  /\baté\s+mais\b/i,
  /\baté\s+logo\b/i,
];

export function isGracefulCloseAcknowledgment(text: string): boolean {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t || t.length > 200) return false;
  return CLOSING_PATTERNS.some(rx => rx.test(t));
}

export type CloseGateSource = 'inactivity' | 'graceful';

export interface CloseGateTimestamps {
  lastInboundAt?: Date | null;
  lastOutboundAt?: Date | null;
  inactivityWarnedAt?: Date | null;
  gracefulClosePromptAt?: Date | null;
  gracefulCloseAckAt?: Date | null;
  closeGateSource?: CloseGateSource | null;
}

export function applyInboundCloseGate(
  conv: CloseGateTimestamps,
  inboundBody: string,
  detectPhrases: boolean,
): void {
  const now = new Date();
  const hasGracefulPrompt =
    conv.gracefulClosePromptAt &&
    conv.lastOutboundAt &&
    conv.gracefulClosePromptAt.getTime() >= conv.lastOutboundAt.getTime() - 2000;

  if (hasGracefulPrompt) {
    if (detectPhrases && isGracefulCloseAcknowledgment(inboundBody)) {
      conv.gracefulCloseAckAt = now;
      conv.closeGateSource = 'graceful';
      conv.inactivityWarnedAt = undefined;
      return;
    }
    conv.gracefulClosePromptAt = undefined;
    conv.gracefulCloseAckAt = undefined;
    if (conv.closeGateSource === 'graceful') conv.closeGateSource = undefined;
  }

  conv.inactivityWarnedAt = undefined;
}

export function applyOutboundCloseGate(
  conv: CloseGateTimestamps,
  quickCode: string | null,
  settings: {
    inactivityWarningQuickCode?: string | null;
    inactivityCloseQuickCode?: string | null;
    gracefulCloseQuickCode?: string | null;
  },
  warnCode: string,
  closeCode: string,
  maisCode: string,
  encOkCode: string,
): void {
  if (quickCode === warnCode) {
    conv.inactivityWarnedAt = new Date();
    conv.gracefulClosePromptAt = undefined;
    conv.gracefulCloseAckAt = undefined;
    conv.closeGateSource = 'inactivity';
    return;
  }
  if (quickCode === maisCode) {
    conv.gracefulClosePromptAt = new Date();
    conv.gracefulCloseAckAt = undefined;
    conv.inactivityWarnedAt = undefined;
    conv.closeGateSource = 'graceful';
    return;
  }
  if (quickCode === closeCode) return;
  if (quickCode === encOkCode) {
    conv.closeGateSource = 'graceful';
    return;
  }
  conv.inactivityWarnedAt = undefined;
  conv.gracefulClosePromptAt = undefined;
  conv.gracefulCloseAckAt = undefined;
  conv.closeGateSource = undefined;
}

export function clearCloseGateFields(conv: CloseGateTimestamps): void {
  conv.inactivityWarnedAt = undefined;
  conv.gracefulClosePromptAt = undefined;
  conv.gracefulCloseAckAt = undefined;
  conv.closeGateSource = undefined;
}
