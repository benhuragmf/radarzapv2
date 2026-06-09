import type { AiTransferRules } from '@/types/ai-assistant';
import type { IAiConversationState } from '@/models/AiConversationState';
import type { IAiPrompt } from '@/models/AiPrompt';
import type { AiStructuredReply } from '@/types/ai-assistant';

const HUMAN_KEYWORDS =
  /\b(atendente|humano|pessoa|operador|suporte|representante|especialista)\b/i;
const HUMAN_REQUEST_PHRASES =
  /\b(falar com (?:algu[eé]m|suporte|atendente|uma pessoa)|quero (?:suporte|atendente|humano)|preciso de (?:suporte|atendente)|me transfere|transferir|encaminh(ar|e))\b/i;
const WAITING_HANDOFF =
  /^(aguardando|esperando|to esperando|estou esperando|cad[eê]|e a[ií]|demora)\b/i;
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
    if (rules.onHumanRequest && this.clientRequestsHuman(text)) {
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
    const collectionOnly = this.isCollectionOnlyTurn(text);

    if (
      !collectionOnly &&
      structured?.shouldEscalate &&
      this.allowModelEscalation(state, text, prompt)
    ) {
      return {
        shouldEscalate: true,
        reason: structured.escalationReason ?? 'IA indicou transferência',
      };
    }
    if (
      rules.onLowConfidence &&
      structured &&
      structured.confidence < rules.lowConfidenceThreshold &&
      state.aiTurnCount >= 2 &&
      !collectionOnly
    ) {
      return { shouldEscalate: true, reason: 'Baixa confiança da IA' };
    }
    if (
      !collectionOnly &&
      rules.onMinDataCollected &&
      state.aiTurnCount >= 2 &&
      this.hasMinData(state, prompt)
    ) {
      return { shouldEscalate: true, reason: 'Dados mínimos coletados' };
    }
    return { shouldEscalate: false };
  }

  hasMinData(state: IAiConversationState, prompt: IAiPrompt): boolean {
    const name = state.collectedName?.trim();
    const email = state.collectedEmail?.trim();
    const problem = state.collectedProblem?.trim();
    const checks: boolean[] = [];

    if (prompt.collectName) {
      checks.push(Boolean(name && name.length >= 2));
    }
    if (prompt.collectEmail) {
      checks.push(Boolean(email && email.includes('@') && email.length >= 5));
    }
    if (prompt.collectProblem) {
      checks.push(
        Boolean(
          problem &&
            problem.length >= 8 &&
            (!name || problem.toLowerCase() !== name.toLowerCase()),
        ),
      );
    }

    if (!checks.length) return false;
    return checks.every(Boolean);
  }

  /**
   * shouldEscalate do modelo só vale com pedido explícito de humano
   * ou após coleta mínima real (evita transferência só com o nome).
   */
  clientRequestsHuman(text: string): boolean {
    const t = text.trim();
    if (!t) return false;
    if (HUMAN_KEYWORDS.test(t)) return true;
    if (HUMAN_REQUEST_PHRASES.test(t)) return true;
    return false;
  }

  /** Cliente aguardando após a IA prometer transferência. */
  isWaitingForPromisedHandoff(
    clientText: string,
    lastAssistantReply?: string,
  ): boolean {
    const t = clientText.trim();
    if (!WAITING_HANDOFF.test(t) || !lastAssistantReply) return false;
    return /\b(vou te transferir|encaminhar|transferir para|setor de)\b/i.test(
      lastAssistantReply,
    );
  }

  aiReplyPromisesTransfer(reply: string): boolean {
    return /\b(vou te transferir|encaminhar|transferir para o|setor de suporte)\b/i.test(
      reply.trim(),
    );
  }

  private allowModelEscalation(
    state: IAiConversationState,
    clientText: string,
    prompt: IAiPrompt,
  ): boolean {
    if (this.clientRequestsHuman(clientText)) return true;
    if (state.aiTurnCount < 2) return false;
    return this.hasMinData(state, prompt);
  }

  /** Cliente mandou só identificação curta (ex.: nome) — não escalar automaticamente. */
  isCollectionOnlyTurn(text: string): boolean {
    const t = text.trim();
    if (!t || t.includes('@')) return false;
    if (this.clientRequestsHuman(t)) return false;
    if (/^(oi|ola|olá|bom dia|boa tarde|boa noite|hey|hello)\b/i.test(t)) return false;
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length <= 2 && t.length <= 28) return true;
    return false;
  }

  normalizeForRepeatCheck(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
  }
}
