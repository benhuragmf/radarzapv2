const INTERNAL_KB_LINE =
  /^\s*(regra para a ia|instru[cç][aã]o interna|nota interna|somente para a ia)\s*:/i;

const GREETING_WORD =
  /\b(oi|ola|olá|bom dia|boa tarde|boa noite|hey|hello|e ai|eae|alo|alô)\b/i;

const PURCHASE_INTENT =
  /\b(comprar|quero|gostaria de|adquirir|fazer pedido|quanto custa|tem dispon[ií]vel|voc[eê] tem|quero um|quero o)\b/i;

/** Remove linhas internas da KB antes de enviar ao cliente. */
export function sanitizeKnowledgeBaseContentForClient(body: string): string {
  return body
    .split('\n')
    .filter(line => !INTERNAL_KB_LINE.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Texto não deve ser aceito como nome do cliente. */
export function textLooksLikeGreetingOrNonName(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  const norm = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[!?.]+$/g, '')
    .trim();
  if (/^(oi|ola|bom dia|boa tarde|boa noite|sim|nao|não)$/.test(norm)) return true;
  if (GREETING_WORD.test(t)) return true;
  if (/^(meu nome nao|meu nome não|nao sou|não sou|nao e|não é)\b/i.test(t)) return true;
  return false;
}

/** Primeiro nome para saudação — corrige duplicação acidental (ex.: BenhurtBenhurt). */
export function resolveClientFirstName(name?: string): string | undefined {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  const first = trimmed.split(/\s+/)[0];
  if (!first) return undefined;
  const doubled = first.match(/^(.{2,})\1$/i);
  return doubled ? doubled[1] : first;
}

/** Intenção de compra — não usar auto-resolve estático; preferir catálogo/LLM. */
export function looksLikePurchaseInquiry(text: string, threadContext?: string): boolean {
  const combined = [threadContext, text].filter(Boolean).join(' ').trim();
  if (!combined) return false;
  return PURCHASE_INTENT.test(combined);
}
