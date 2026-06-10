import { parseTicketStatusRequest } from '@/types/inbox-ticket';
import {
  isTicketClientDecline,
  isTicketClientClosingMessage,
  isTicketHumanRequest,
  isTicketRefOnlyMessage,
  looksLikeTicketSupplement,
} from '@/utils/ticket-ref';

/** Intenção do cliente dentro do contexto de um ticket TK-… */
export type TicketClientIntent =
  | 'status_inquiry'
  | 'decline'
  | 'exit_close'
  | 'human_request'
  | 'question'
  | 'problem_report'
  | 'append_data'
  | 'select_ref'
  | 'other';

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[!?.]+$/g, '')
    .trim();
}

/** Classifica o que o cliente quer fazer com o ticket — antes de gravar ou chamar LLM. */
export function classifyTicketClientIntent(text: string): TicketClientIntent {
  const norm = normalize(text);
  if (!norm) return 'other';

  if (isTicketClientDecline(text)) return 'decline';
  if (isTicketClientClosingMessage(text)) return 'exit_close';
  if (isTicketHumanRequest(text)) return 'human_request';
  if (isTicketRefOnlyMessage(text)) return 'select_ref';

  if (
    parseTicketStatusRequest(text) ||
    /\b(ticket|chamado|tk).{0,35}\b(aberto|andamento|status|situacao|fechad|encerrad)\b/i.test(norm) ||
    /\b(sobre|saber|consultar).{0,35}\b(ticket|chamado)\b/i.test(norm) ||
    /\b(quando|prazo|demora|quanto tempo).{0,30}(respost|retorn|equipe|analise)\b/i.test(norm)
  ) {
    return 'status_inquiry';
  }

  if (
    /\?/.test(text) ||
    /\b(como|quando|por que|porque|qual|quanto|onde|posso|devo|gostaria|queria|preciso saber)\b/i.test(
      norm,
    )
  ) {
    return 'question';
  }

  if (looksLikeTicketSupplement(text)) {
    if (
      /\b(nao funciona|nao foi resolvido|retornou|voltou|piorou|ainda tenho|problema)\b/i.test(norm)
    ) {
      return 'problem_report';
    }
    return 'append_data';
  }

  if (/\b(problema|nao funciona|nao foi resolvido|retornou|voltou|ainda|urgente)\b/i.test(norm)) {
    return 'problem_report';
  }

  return 'other';
}

/** Intenções em que a IA deve tentar responder/resolver — não gravar cegamente. */
export function ticketIntentShouldTryResolve(intent: TicketClientIntent): boolean {
  return intent === 'question' || intent === 'problem_report';
}

/** Intenções que disparam AiTicketAssistService (antes de gravar). */
export function ticketIntentNeedsAssist(intent: TicketClientIntent): boolean {
  return (
    intent === 'status_inquiry' ||
    intent === 'decline' ||
    intent === 'exit_close' ||
    ticketIntentShouldTryResolve(intent)
  );
}

/** Intenções que nunca devem virar complemento automático no ticket. */
export function ticketIntentBlocksAppend(intent: TicketClientIntent): boolean {
  return (
    intent === 'status_inquiry' ||
    intent === 'decline' ||
    intent === 'exit_close' ||
    intent === 'human_request' ||
    intent === 'question' ||
    intent === 'select_ref'
  );
}
