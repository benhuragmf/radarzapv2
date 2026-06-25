import type { BasicTriageClassification, BasicTriageIntent } from '@/utils/basic-triage-classifier';
import { recordAttendanceEvent } from '@/services/attendance/attendance-audit.service';

/** Intenções oficiais de produto (TOP 14). */
export type BasicTriageProductIntent =
  | 'sales'
  | 'support'
  | 'billing'
  | 'ticket_status'
  | 'human_request'
  | 'complaint'
  | 'partnership'
  | 'unknown';

export type BasicTriageAction = 'route' | 'clarify' | 'queue';

export const TRIAGE_CONFIDENCE_HIGH = 0.75;
export const TRIAGE_CONFIDENCE_LOW = 0.45;

const INTENT_TO_PRODUCT: Record<BasicTriageIntent, BasicTriageProductIntent> = {
  commercial: 'sales',
  finance: 'billing',
  support: 'support',
  general: 'unknown',
  human_request: 'human_request',
  ticket_status: 'ticket_status',
  complaint: 'complaint',
  partnership: 'partnership',
  greeting: 'unknown',
  unknown: 'unknown',
};

export function mapBasicIntentToProduct(intent: BasicTriageIntent): BasicTriageProductIntent {
  return INTENT_TO_PRODUCT[intent] ?? 'unknown';
}

export function getTriageConfidenceTier(
  confidence: number,
): 'high' | 'medium' | 'low' {
  if (confidence >= TRIAGE_CONFIDENCE_HIGH) return 'high';
  if (confidence >= TRIAGE_CONFIDENCE_LOW) return 'medium';
  return 'low';
}

export function isHighConfidenceTriage(confidence: number): boolean {
  return confidence >= TRIAGE_CONFIDENCE_HIGH;
}

export function isMediumConfidenceTriage(confidence: number): boolean {
  return confidence >= TRIAGE_CONFIDENCE_LOW && confidence < TRIAGE_CONFIDENCE_HIGH;
}

export function isLowConfidenceTriage(confidence: number): boolean {
  return confidence < TRIAGE_CONFIDENCE_LOW;
}

/** Bridge ativa — não reclassificar mensagens do pipeline visitante. */
export function shouldSkipBasicTriageForBridge(ctx: {
  whatsappBridgeActive?: boolean;
}): boolean {
  return Boolean(ctx.whatsappBridgeActive);
}

/** Comandos `!` e mensagens de equipe não passam por IA Básica (checado antes no WA). */
export function isWhatsappTeamCommandText(text: string): boolean {
  return text.trim().startsWith('!');
}

/**
 * Decide ação pós-classificação local (sem LLM).
 * - high + menuKey → route
 * - human_request → queue (fila humana)
 * - ticket_status → clarify (orientação TK, sem criar ticket)
 * - medium → clarify
 * - low / unknown → queue (fila geral)
 */
export function resolveBasicTriageAction(
  classification: BasicTriageClassification,
  opts?: { routeThreshold?: number },
): BasicTriageAction {
  const threshold = opts?.routeThreshold ?? TRIAGE_CONFIDENCE_HIGH;

  if (classification.intent === 'greeting') return 'clarify';
  if (classification.intent === 'ticket_status') return 'clarify';
  if (classification.intent === 'human_request') return 'queue';

  const tier = getTriageConfidenceTier(classification.confidence);

  if (tier === 'high' && classification.confidence >= threshold && classification.suggestedMenuKey) {
    return 'route';
  }
  if (tier === 'medium' || classification.intent !== 'unknown') {
    return 'clarify';
  }
  return 'queue';
}

export function resolveBasicTriageFallback(action: BasicTriageAction): string {
  if (action === 'route') return 'department_route';
  if (action === 'clarify') return 'clarify_reply';
  return 'human_queue';
}

/** Registra classificação sem armazenar texto do cliente. */
export async function recordBasicTriageClassificationEvent(input: {
  clientId: string;
  conversationId?: string;
  productIntent: BasicTriageProductIntent;
  confidence: number;
  action: BasicTriageAction;
  menuKey?: string;
  channel?: 'whatsapp' | 'webchat';
}): Promise<void> {
  await recordAttendanceEvent({
    clientId: input.clientId,
    kind: 'triage.classified',
    conversationId: input.conversationId,
    meta: {
      intent: input.productIntent,
      confidence: Math.round(input.confidence * 100) / 100,
      action: input.action,
      menuKey: input.menuKey ?? null,
      channel: input.channel ?? null,
      fallback: resolveBasicTriageFallback(input.action),
    },
  });
}
