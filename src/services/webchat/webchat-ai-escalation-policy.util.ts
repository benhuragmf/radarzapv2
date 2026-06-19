import {
  DEFAULT_WEBCHAT_AI_ESCALATION_POLICY,
  type WebChatAiEscalationPolicy,
  type WebChatAiTransferTrigger,
} from '../../types/webchat';

export function normalizeEscalationPolicy(
  input?: Partial<WebChatAiEscalationPolicy> | null,
): WebChatAiEscalationPolicy {
  const base = DEFAULT_WEBCHAT_AI_ESCALATION_POLICY;
  if (!input) return { ...base };

  const trigger = (v: unknown, fallback: WebChatAiTransferTrigger): WebChatAiTransferTrigger =>
    v === 'immediate' ? 'immediate' : fallback;

  const rawRepeat = Math.round(Number(input.escalateAfterRepeatedRequests));
  const escalateAfterRepeatedRequests = Number.isFinite(rawRepeat)
    ? Math.min(5, Math.max(0, rawRepeat))
    : base.escalateAfterRepeatedRequests;

  return {
    humanRequest: trigger(input.humanRequest, base.humanRequest),
    commercialRequest: trigger(input.commercialRequest, base.commercialRequest),
    supportRequest: trigger(input.supportRequest, base.supportRequest),
    escalateAfterRepeatedRequests,
  };
}

export function policyTriggerForIntent(
  policy: WebChatAiEscalationPolicy,
  intent: 'human' | 'commercial' | 'support',
): WebChatAiTransferTrigger {
  if (intent === 'commercial') return policy.commercialRequest;
  if (intent === 'support') return policy.supportRequest;
  return policy.humanRequest;
}

export function policyAllowsImmediateTransfer(
  policy: WebChatAiEscalationPolicy,
  intent: 'human' | 'commercial' | 'support',
): boolean {
  return policyTriggerForIntent(policy, intent) === 'immediate';
}
