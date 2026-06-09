import type { AiTransferRules } from '@/types/ai-assistant';
import type { IAiConversationState } from '@/models/AiConversationState';
import type { IAiPrompt } from '@/models/AiPrompt';
import type { AiStructuredReply } from '@/types/ai-assistant';

const HUMAN_KEYWORDS = /\b(atendente|humano|pessoa|falar com algu[eé]m|operador)\b/i;
const ANGRY_KEYWORDS = /\b(raiva|irritad|p[eé]ssimo|horr[ií]vel|absurdo|vergonha|processo judicial|advogado)\b/i;
const CANCEL_KEYWORDS = /\b(cancelar|cancelamento|estorno|reembolso|desistir)\b/i;
const LEGAL_KEYWORDS = /\b(jur[ií]dico|processo|advogado|procon|justi[cç]a|lei\b|lgpd\b)\b/i;
const SENSITIVE_KEYWORDS = /\b(senha|cart[aã]o|cvv|cpf completo|dados banc[aá]rios|pix)\b/i;

export interface EscalationCheckInput {
  clientText: string;
  hasUninterpretableMedia: boolean;
  structured?: AiStructuredReply;
  state: IAiConversationState;
  prompt: IAiPrompt;
  rules: AiTransferRules;
}

export interface EscalationDecision {
  shouldEscalate: boolean;
  reason?: string;
}

export class AiEscalationService {
  private static instance: AiEscalationService;

  static getInstance(): AiEscalationService {
    if (!this.instance) this.instance = new AiEscalationService();
    return this.instance;
  }

  check(input: EscalationCheckInput): EscalationDecision {
    const { clientText, rules, structured, state, prompt, hasUninterpretableMedia } = input;
    const text = clientText.trim();

    if (rules.onUninterpretableMedia && hasUninterpretableMedia) {
      return { shouldEscalate: true, reason: 'Mídia não interpretável pela IA' };
    }
    if (rules.onHumanRequest && HUMAN_KEYWORDS.test(text)) {
      return { shouldEscalate: true, reason: 'Cliente solicitou atendente humano' };
    }
    if (rules.onAngryClient && ANGRY_KEYWORDS.test(text)) {
      return { shouldEscalate: true, reason: 'Cliente aparenta irritação' };
    }
    if (rules.onCancellation && CANCEL_KEYWORDS.test(text)) {
      return { shouldEscalate: true, reason: 'Assunto de cancelamento' };
    }
    if (rules.onLegal && LEGAL_KEYWORDS.test(text)) {
      return { shouldEscalate: true, reason: 'Assunto jurídico/sensível' };
    }
    if (rules.onSensitiveMessage && SENSITIVE_KEYWORDS.test(text)) {
      return { shouldEscalate: true, reason: 'Mensagem com dados sensíveis' };
    }
    if (
      rules.onRepeatedQuestion &&
      state.repeatedQuestionCount >= rules.repeatedQuestionCount
    ) {
      return { shouldEscalate: true, reason: 'Cliente repetiu a mesma pergunta' };
    }
    if (structured?.shouldEscalate && this.allowModelEscalation(state, text)) {
      return {
        shouldEscalate: true,
        reason: structured.escalationReason ?? 'IA indicou transferência',
      };
    }
    if (
      rules.onLowConfidence &&
      structured &&
      structured.confidence < rules.lowConfidenceThreshold &&
      state.aiTurnCount >= 2
    ) {
      return { shouldEscalate: true, reason: 'Baixa confiança da IA' };
    }
    if (
      rules.onMinDataCollected &&
      state.aiTurnCount >= 2 &&
      this.hasMinData(state, prompt, structured)
    ) {
      return { shouldEscalate: true, reason: 'Dados mínimos coletados' };
    }
    return { shouldEscalate: false };
  }

  hasMinData(
    state: IAiConversationState,
    prompt: IAiPrompt,
    structured?: AiStructuredReply,
  ): boolean {
    const name = structured?.collectedName || state.collectedName;
    const email = structured?.collectedEmail || state.collectedEmail;
    const problem = structured?.collectedProblem || state.collectedProblem;
    const required: boolean[] = [];
    if (prompt.collectName) required.push(Boolean(name?.trim()));
    if (prompt.collectEmail) required.push(Boolean(email?.trim()));
    if (prompt.collectProblem) required.push(Boolean(problem?.trim()));
    if (!required.length) return false;
    return required.every(Boolean);
  }

  /** Evita transferência na primeira resposta da IA (saudação / coleta inicial). */
  private allowModelEscalation(state: IAiConversationState, clientText: string): boolean {
    if (state.aiTurnCount >= 2) return true;
    return HUMAN_KEYWORDS.test(clientText);
  }

  normalizeForRepeatCheck(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
  }
}
