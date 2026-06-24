const GREETING_ONLY =
  /^(oi|ola|olá|hey|hello|bom dia|boa tarde|boa noite|e ai|e aí|opa|salve|tudo bem|td bem)[!.?\s]*$/i;

const COMMERCIAL =
  /\b(comercial|vendas?|produto|produtos|promo[cç][aã]o|promo[cç][oõ]es|pre[cç]o|valor|plano|planos|contrat|assinatura|pacote|comprar|or[cç]amento|cota[cç][aã]o|desconto|oferta|catalogo|catálogo|interesse|quero saber|preciso de|demonstra[cç][aã]o)\b/i;

/** Detecta intenção comercial explícita em mensagem inbound (sem LLM). */
export function hasCommercialLeadIntent(text: string): boolean {
  const t = (text ?? '').trim();
  if (t.length < 4) return false;
  if (GREETING_ONLY.test(t)) return false;
  return COMMERCIAL.test(t);
}
