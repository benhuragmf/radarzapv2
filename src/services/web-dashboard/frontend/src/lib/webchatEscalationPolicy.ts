export type WebChatAiTransferTrigger = 'triage_first' | 'immediate'

export interface WebChatAiEscalationPolicy {
  humanRequest: WebChatAiTransferTrigger
  commercialRequest: WebChatAiTransferTrigger
  supportRequest: WebChatAiTransferTrigger
  escalateAfterRepeatedRequests: number
}

export const DEFAULT_WEBCHAT_AI_ESCALATION_POLICY: WebChatAiEscalationPolicy = {
  humanRequest: 'triage_first',
  commercialRequest: 'triage_first',
  supportRequest: 'triage_first',
  escalateAfterRepeatedRequests: 2,
}

export const WEBCHAT_TRANSFER_TRIGGER_OPTIONS: Array<{
  value: WebChatAiTransferTrigger
  label: string
  hint: string
}> = [
  {
    value: 'triage_first',
    label: 'Triagem primeiro',
    hint: 'A IA tenta ajudar antes de encaminhar',
  },
  {
    value: 'immediate',
    label: 'Transferir na 1ª vez',
    hint: 'Vai direto para a fila de atendimento',
  },
]

export function normalizeEscalationPolicyForm(
  input?: Partial<WebChatAiEscalationPolicy> | null,
): WebChatAiEscalationPolicy {
  const base = DEFAULT_WEBCHAT_AI_ESCALATION_POLICY
  if (!input) return { ...base }
  const trigger = (v: unknown, fallback: WebChatAiTransferTrigger): WebChatAiTransferTrigger =>
    v === 'immediate' ? 'immediate' : fallback
  const raw = Math.round(Number(input.escalateAfterRepeatedRequests))
  return {
    humanRequest: trigger(input.humanRequest, base.humanRequest),
    commercialRequest: trigger(input.commercialRequest, base.commercialRequest),
    supportRequest: trigger(input.supportRequest, base.supportRequest),
    escalateAfterRepeatedRequests: Number.isFinite(raw)
      ? Math.min(5, Math.max(0, raw))
      : base.escalateAfterRepeatedRequests,
  }
}
