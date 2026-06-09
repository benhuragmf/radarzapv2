/** Modo de operação da IA no tenant */
export type AiMode = 'radarzap' | 'company' | 'disabled';

/** Provedor LLM suportado */
export type AiProvider = 'openai' | 'gemini';

/** Status do ciclo de triagem IA na conversa */
export enum AiConversationStatus {
  AI_COLLECTING = 'ai_collecting',
  AI_WAITING_CLIENT = 'ai_waiting_client',
  AI_COMPLETED = 'ai_completed',
  AI_ESCALATED = 'ai_escalated',
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
  'Você é um atendente virtual da empresa {companyName}. Sua função é atender clientes pelo WhatsApp de forma educada, objetiva e profissional. Você deve coletar nome, e-mail e problema do cliente antes de transferir para o atendente. Não invente informações. Não prometa prazos, preços ou soluções se isso não estiver na base de conhecimento da empresa. Se o cliente pedir humano, estiver irritado ou o assunto for sensível, transfira para um atendente.';

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
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

export interface AiStructuredReply {
  reply: string;
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
}
