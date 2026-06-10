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
