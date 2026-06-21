/** Modo de operação da IA no tenant — legado (credencial + on/off). Ver `attendance-mode.ts` para separação conceitual Fase 1+. */
export type AiMode = 'radarzap' | 'company' | 'disabled';

/** Provedor LLM suportado */
export type AiProvider = 'openai' | 'gemini';

/** Status do ciclo de triagem IA na conversa */
export enum AiConversationStatus {
  AI_COLLECTING = 'ai_collecting',
  AI_WAITING_CLIENT = 'ai_waiting_client',
  AI_COMPLETED = 'ai_completed',
  AI_ESCALATED = 'ai_escalated',
  /** IA indisponível — conversa segue no bot padrão (menu de setores). */
  AI_FALLBACK_STANDARD = 'ai_fallback_standard',
  HUMAN_ASSIGNED = 'human_assigned',
}

export interface AiTransferRules {
  onHumanRequest: boolean;
  onAngryClient: boolean;
  onCancellation: boolean;
  onLegal: boolean;
  onLowConfidence: boolean;
  onRepeatedQuestion: boolean;
  onMinDataCollected: boolean;
  onSensitiveMessage: boolean;
  onUninterpretableMedia: boolean;
  lowConfidenceThreshold: number;
  repeatedQuestionCount: number;
}

export const DEFAULT_AI_TRANSFER_RULES: AiTransferRules = {
  onHumanRequest: true,
  onAngryClient: true,
  onCancellation: true,
  onLegal: true,
  onLowConfidence: true,
  onRepeatedQuestion: true,
  onMinDataCollected: true,
  onSensitiveMessage: true,
  onUninterpretableMedia: true,
  lowConfidenceThreshold: 0.45,
  repeatedQuestionCount: 3,
};

export const DEFAULT_AI_SYSTEM_PROMPT =
  'Você é o atendente virtual da {companyName} no WhatsApp. Seja educado, objetivo e resolva o máximo possível usando a base de conhecimento e skills da empresa. Use dados do cadastro do cliente quando disponíveis — não pergunte o que já sabemos. Colete só o que faltar antes de transferir. Não invente preços, prazos ou políticas. Transfira para humano se o cliente pedir, estiver irritado ou o caso for sensível.';

export interface AiPlanLimits {
  dailyLimit: number;
  monthlyLimit: number;
  perConversationLimit: number;
  radarzapAllowed: boolean;
}

export function getAiPlanLimits(plan: string): AiPlanLimits {
  switch (plan) {
    case 'starter':
      return { dailyLimit: 30, monthlyLimit: 400, perConversationLimit: 20, radarzapAllowed: true };
    case 'pro':
      return { dailyLimit: 120, monthlyLimit: 2500, perConversationLimit: 40, radarzapAllowed: true };
    case 'enterprise':
      return { dailyLimit: 500, monthlyLimit: 12000, perConversationLimit: 60, radarzapAllowed: true };
    default:
      return { dailyLimit: 0, monthlyLimit: 0, perConversationLimit: 0, radarzapAllowed: false };
  }
}

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/** Mínimo para JSON estruturado + mensagem em português (evita "Here" truncado). */
export const MIN_AI_MAX_TOKENS = 400;
export const DEFAULT_AI_MAX_TOKENS = 600;

/** Resposta de fallback quando o JSON da IA não pôde ser interpretado — não enviar ao cliente. */
export const AI_GENERIC_FALLBACK_REPLY = 'Olá! Como posso ajudá-lo hoje?';

export interface AiStructuredReply {
  reply: string;
  /** true quando a resposta não veio em JSON válido — usar bot padrão. */
  parseFailed?: boolean;
  collectedName?: string;
  collectedEmail?: string;
  collectedProblem?: string;
  collectedCpfCnpj?: string;
  collectedAddress?: string;
  collectedOrderNumber?: string;
  urgency?: 'low' | 'medium' | 'high';
  intent?: string;
  departmentMenuKey?: string;
  confidence: number;
  shouldEscalate: boolean;
  escalationReason?: string;
  internalSummary?: string;
  shouldCreateTicket?: boolean;
  ticketReason?: string;
  /** Ticket existente que o cliente quer complementar (ex.: TK-88CHYX). */
  targetTicketRef?: string;
  /** Gravar ticketAppendBody (ou texto do cliente) em clientReplies do ticket. */
  shouldAppendToTicket?: boolean;
  ticketAppendBody?: string;
}

/** Resposta estruturada vazia — append/status sem campos da IA. */
export function emptyAiStructuredReply(): AiStructuredReply {
  return {
    reply: '',
    confidence: 0,
    shouldEscalate: false,
  };
}
