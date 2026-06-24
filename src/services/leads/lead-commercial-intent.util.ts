import { classifyLocal } from '@/utils/basic-triage-classifier';

const GREETING_ONLY =
  /^(oi|ola|olá|hey|hello|bom dia|boa tarde|boa noite|e ai|e aí|opa|salve|tudo bem|td bem)[!.?\s]*$/i;

/** Sinais comerciais fortes — capturam mesmo se classificador rotular suporte/financeiro ambíguo. */
const STRONG_COMMERCIAL =
  /\b(or[cç]amento|cota[cç][aã]o|comprar|contrat|pre[cç]o|plano|planos|vendas?|promo[cç][aã]o|pacote)\b/i;

/** Frases comerciais explícitas além do classificador local. */
const EXTRA_COMMERCIAL =
  /\b(interesse|quero saber|preciso de|demonstra[cç][aã]o)\b/i;

const COMMERCIAL_CLASSIFIER_MIN_CONFIDENCE = 0.68;
const FINANCE_BLOCK_CONFIDENCE = 0.75;

/** Detecta intenção comercial em mensagem inbound (classificador local + heurísticas, sem LLM). */
export function hasCommercialLeadIntent(text: string): boolean {
  const t = (text ?? '').trim();
  if (t.length < 4) return false;
  if (GREETING_ONLY.test(t)) return false;

  const classification = classifyLocal(t);

  if (classification.intent === 'finance' && classification.confidence >= FINANCE_BLOCK_CONFIDENCE) {
    return false;
  }

  if (
    classification.intent === 'commercial' &&
    classification.confidence >= COMMERCIAL_CLASSIFIER_MIN_CONFIDENCE
  ) {
    return true;
  }

  if (STRONG_COMMERCIAL.test(t) || EXTRA_COMMERCIAL.test(t)) {
    return true;
  }

  return false;
}
