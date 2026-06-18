import type { WebChatMessageRow } from './webchat-ai-triage.util';

const CLOSE_CHAT =
  /\b(fechar|encerrar|finalizar|encerra)\b.{0,40}\b(atendimento|conversa|chat|chamado)\b|\bpode fechar\b|\bquero encerrar\b/i;

const REFUSE_HUMAN =
  /^(n[aã]o|n[aã]o quero|n[aã]o preciso|dispenso|deixa|deixa quieto|tudo bem|ok)$/i;

const ESCALATION_SYSTEM_HINT =
  /atendente humano|assumir esta conversa|fila de atendimento|encaminhamos você/i;

export function visitorWantsToCloseChat(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return CLOSE_CHAT.test(t);
}

export function visitorRefusesHumanHandoff(
  text: string,
  messages: WebChatMessageRow[],
): boolean {
  const t = text.trim();
  if (!t || !REFUSE_HUMAN.test(t)) return false;
  const recent = [...messages].reverse().slice(0, 6);
  return recent.some(
    m =>
      m.direction === 'system' &&
      ESCALATION_SYSTEM_HINT.test(m.body),
  );
}

export const WEBCHAT_CLOSE_GOODBYE =
  'Atendimento encerrado. Obrigado pelo contato! Se precisar de algo, é só abrir o chat novamente.';

export const WEBCHAT_DEESCALATE_REPLY =
  'Tudo bem! Continuo por aqui se precisar de ajuda com algo mais.';
