const TICKET_REF_RE = /\b(TK-[A-Z0-9]{4,8})\b/i;

const TICKET_INTENT_ONLY_RE =
  /^(sim[, ]*)?(vou )?(interagir|falar|atualizar|complementar|enviar).{0,40}ticket/i;

const SHORT_ACK_RE =
  /^(sim|nao|não|s|ss|ok|positivo|isso|certo|obrigad|valeu|blz|beleza|tudo|so isso|só isso|isso e tudo|isso é tudo|era so|era só)[.!?\s]*$/i;

/** Extrai referência TK-XXXXXX do texto (primeira ocorrência). */
export function parseTicketRefFromText(text: string): string | null {
  const m = text.match(TICKET_REF_RE);
  return m ? normalizeTicketRef(m[1]) : null;
}

export function normalizeTicketRef(ref: string): string {
  return ref.trim().toUpperCase();
}

/** Mensagem contém só a referência do ticket (ex.: "TK-88CHYX"). */
export function isTicketRefOnlyMessage(text: string): boolean {
  const ref = parseTicketRefFromText(text);
  if (!ref) return false;
  const stripped = text.replace(new RegExp(ref, 'i'), '').replace(/[^\w]/g, '').trim();
  return stripped.length < 3;
}

/** Cliente está complementando ticket (não encerrar conversa nem disparar CSAT). */
export function isTicketUpdateContext(
  state: Pick<{ targetTicketRef?: string; pendingTicketChoices?: string[] }, 'targetTicketRef' | 'pendingTicketChoices'>,
  clientText: string,
  lastAssistantText?: string,
): boolean {
  if (state.pendingTicketChoices?.length) return true;
  if (state.targetTicketRef) return true;
  if (parseTicketRefFromText(clientText)) return true;
  const assistantRef = lastAssistantText ? parseTicketRefFromText(lastAssistantText) : null;
  if (assistantRef && looksLikeTicketSupplement(clientText)) return true;
  if (
    lastAssistantText &&
    /\b(qual|quais).{0,50}(informa|dado|adicionar)/i.test(lastAssistantText) &&
    looksLikeTicketSupplement(clientText)
  ) {
    return true;
  }
  return false;
}

/** Cliente informou dado complementar (telefone, texto útil) — não só escolha de ticket. */
export function looksLikeTicketSupplement(text: string): boolean {
  const norm = text.trim();
  if (!norm || norm.length < 3) return false;
  if (isTicketRefOnlyMessage(norm)) return false;
  if (SHORT_ACK_RE.test(norm)) return false;
  if (TICKET_INTENT_ONLY_RE.test(norm)) return false;
  if (/\d{4,}/.test(norm)) return true;
  if (norm.length >= 12) return true;
  return false;
}

export type AiTicketMenuItem = { ref: string; subject?: string; status: string };

/** Cliente quer listar ou interagir com ticket existente. */
export function clientWantsTicketInteraction(text: string): boolean {
  const norm = text.trim().toLowerCase();
  if (!norm) return false;
  if (parseTicketRefFromText(text) && isTicketRefOnlyMessage(text)) return false;
  return (
    /\b(inserir|interagir|atualizar|complementar|adicionar).{0,40}\b(ticket|chamado)\b/i.test(norm) ||
    /\b(ticket|chamado).{0,40}\b(inserir|interagir|atualizar|complementar|adicionar|dados|informa)/i.test(
      norm,
    ) ||
    /\b(qual|quais|listar|meus?).{0,40}\b(ticket|chamado)/i.test(norm) ||
    /\b(numero|n[uú]mero).{0,20}\b(ticket|chamado)/i.test(norm)
  );
}

export function buildAiTicketChoiceMenu(tickets: AiTicketMenuItem[]): string {
  const lines = tickets.map((t, i) => {
    const sub = t.subject ? ` — ${t.subject}` : '';
    const closed = t.status === 'closed' ? ' (encerrado)' : '';
    return `${i + 1} — *${t.ref}*${sub}${closed}`;
  });
  return (
    'Encontrei estes chamados na sua conta:\n\n' +
    lines.join('\n') +
    '\n\nResponda com o *número* ou o código *TK-…* do chamado.\n' +
    'Ou digite *novo* para iniciar um atendimento diferente.'
  );
}

/** Resolve escolha numerada ou referência TK-XXXXXX contra o menu pendente. */
export function parseAiTicketMenuChoice(text: string, choices: string[]): string | null {
  const ref = parseTicketRefFromText(text);
  if (ref) {
    const normalized = normalizeTicketRef(ref);
    if (choices.some(c => normalizeTicketRef(c) === normalized)) return normalized;
  }
  const m = text.trim().match(/^([1-9])\b/);
  if (m) {
    const idx = parseInt(m[1], 10) - 1;
    if (idx >= 0 && idx < choices.length) return normalizeTicketRef(choices[idx]);
  }
  return null;
}
