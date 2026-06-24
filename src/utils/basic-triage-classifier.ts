import { normalizeAiSearchText } from './ai-text-match';

/** Intenção inferida localmente (sem LLM). */
export type BasicTriageIntent =
  | 'commercial'
  | 'finance'
  | 'support'
  | 'general'
  | 'human_request'
  | 'greeting'
  | 'unknown';

export interface BasicTriageDepartmentHint {
  name: string;
  menuKey: string;
  description?: string;
}

export interface BasicTriageClassification {
  intent: BasicTriageIntent;
  /** 0–1 — acima do threshold → encaminhar setor sugerido. */
  confidence: number;
  suggestedMenuKey?: string;
  departmentName?: string;
}

/** Threshold padrão para encaminhar sem LLM. */
export const BASIC_TRIAGE_DEFAULT_CONFIDENCE_THRESHOLD = 0.65;

const GREETING_ONLY =
  /^(oi|ola|olá|hey|hello|bom dia|boa tarde|boa noite|e ai|e aí|opa|salve)[!.?\s]*$/i;

const GREETING_PREFIX = /^(oi|ola|olá|opa|opá|salve|hey|e\s*ai|e\s*aí)\b/i;
const GREETING_TAIL =
  /^(bom\s+)?(dia|diua|tarde|noite)\b|^(tudo\s+)?(bem|bom|boa)\b/i;

/** Saudação pura ou cumprimento curto (ex.: "ola bom dia", "oi tudo bem"). */
function looksLikeGreeting(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (GREETING_ONLY.test(trimmed)) return true;
  if (/^bom\s+(dia|tarde|noite)\b/i.test(trimmed)) return true;

  const prefix = trimmed.match(GREETING_PREFIX);
  if (!prefix) return false;

  const tail = trimmed.slice(prefix[0].length).trim();
  if (!tail) return true;
  if (tail.length > 40) return false;
  if (GREETING_TAIL.test(tail)) return true;

  const words = tail.split(/\s+/).filter(Boolean);
  if (
    words.length <= 2 &&
    !COMMERCIAL.test(trimmed) &&
    !SUPPORT.test(trimmed) &&
    !FINANCE.test(trimmed)
  ) {
    return true;
  }
  return false;
}

const COMMERCIAL =
  /\b(comercial|vendas?|produto|produtos|promo[cç][aã]o|promo[cç][oõ]es|pre[cç]o|valor|plano|planos|contrat|assinatura|pacote|comprar|or[cç]amento|cota[cç][aã]o|desconto|oferta|catalogo|catálogo)\b/i;

const FINANCE =
  /\b(financeiro|boleto|boletos|pagamento|pagamentos|mensalidade|fatura|faturas|cobran[cç]a|cobran[cç]as|inadimpl|devendo|2\s*via|segunda via|pix|cart[aã]o)\b/i;

const SUPPORT =
  /\b(suporte|t[eé]cnico|tecnico|problema|erro|bug|n[aã]o conecta|n[aã]o funciona|parou|offline|instala[cç][aã]o|configurar|rastreador|rastreadores|gps|aplicativo|app|sinal|equipamento|travou|lento)\b/i;

const HUMAN_REQUEST =
  /\b(falar com (?:um )?(?:atendente|humano|pessoa|consultor)|quero (?:um )?atendente|preciso (?:de )?(?:um )?atendente|atendente humano|transfer[eir]|encaminh(?:ar|e)?(?: para)?(?: a)? (?:equipe|setor))\b/i;

/** Mapeamento intent → menuKey padrão (DEFAULT_INBOX_DEPARTMENTS). */
const DEFAULT_MENU_BY_INTENT: Record<Exclude<BasicTriageIntent, 'greeting' | 'unknown'>, string> = {
  commercial: '1',
  finance: '2',
  support: '3',
  general: '4',
  human_request: '4',
};

function normalize(text: string): string {
  return normalizeAiSearchText(text);
}

function matchDepartmentByName(
  text: string,
  departments: BasicTriageDepartmentHint[],
): BasicTriageClassification | null {
  const norm = normalize(text);
  if (!norm) return null;

  for (const dept of departments) {
    const name = normalize(dept.name);
    if (!name) continue;
    if (norm === name || norm.includes(name) || name.includes(norm)) {
      return {
        intent: inferIntentFromDepartmentName(dept.name),
        confidence: 0.88,
        suggestedMenuKey: dept.menuKey,
        departmentName: dept.name,
      };
    }
    if (dept.description) {
      const desc = normalize(dept.description);
      if (desc && norm.includes(desc)) {
        return {
          intent: inferIntentFromDepartmentName(dept.name),
          confidence: 0.82,
          suggestedMenuKey: dept.menuKey,
          departmentName: dept.name,
        };
      }
    }
  }
  return null;
}

function inferIntentFromDepartmentName(name: string): BasicTriageIntent {
  const n = normalize(name);
  if (/comercial|vendas/.test(n)) return 'commercial';
  if (/financeiro|cobran|pagamento/.test(n)) return 'finance';
  if (/suporte|tecnico|t[eé]cnico/.test(n)) return 'support';
  return 'general';
}

/**
 * Classifica intenção do cliente sem LLM — heurísticas + nomes de setores.
 */
export function classifyLocal(
  text: string,
  departments?: BasicTriageDepartmentHint[],
): BasicTriageClassification {
  const trimmed = text.trim();
  if (!trimmed) {
    return { intent: 'unknown', confidence: 0 };
  }

  if (looksLikeGreeting(trimmed)) {
    return { intent: 'greeting', confidence: 0.95 };
  }

  if (departments?.length) {
    const byDept = matchDepartmentByName(trimmed, departments);
    if (byDept) return byDept;
  }

  if (HUMAN_REQUEST.test(trimmed)) {
    return {
      intent: 'human_request',
      confidence: 0.78,
      suggestedMenuKey: DEFAULT_MENU_BY_INTENT.human_request,
    };
  }

  if (FINANCE.test(trimmed) && !SUPPORT.test(trimmed)) {
    return {
      intent: 'finance',
      confidence: 0.8,
      suggestedMenuKey: DEFAULT_MENU_BY_INTENT.finance,
    };
  }

  if (COMMERCIAL.test(trimmed) && !SUPPORT.test(trimmed) && !FINANCE.test(trimmed)) {
    return {
      intent: 'commercial',
      confidence: 0.76,
      suggestedMenuKey: DEFAULT_MENU_BY_INTENT.commercial,
    };
  }

  if (SUPPORT.test(trimmed)) {
    return {
      intent: 'support',
      confidence: 0.74,
      suggestedMenuKey: DEFAULT_MENU_BY_INTENT.support,
    };
  }

  if (COMMERCIAL.test(trimmed)) {
    return {
      intent: 'commercial',
      confidence: 0.68,
      suggestedMenuKey: DEFAULT_MENU_BY_INTENT.commercial,
    };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 6 && trimmed.length >= 28) {
    return {
      intent: 'general',
      confidence: 0.55,
      suggestedMenuKey: DEFAULT_MENU_BY_INTENT.general,
    };
  }

  return { intent: 'unknown', confidence: 0.2 };
}

export function shouldRouteByClassification(
  classification: BasicTriageClassification,
  threshold = BASIC_TRIAGE_DEFAULT_CONFIDENCE_THRESHOLD,
): boolean {
  if (classification.intent === 'greeting' || classification.intent === 'unknown') {
    return false;
  }
  return classification.confidence >= threshold && Boolean(classification.suggestedMenuKey);
}

export function buildBasicTriageClarifyReply(intent: BasicTriageIntent): string {
  switch (intent) {
    case 'commercial':
      return 'Entendi que pode ser algo comercial. Pode me dizer qual produto ou serviço você tem interesse? Assim encaminho para o setor certo.';
    case 'finance':
      return 'Parece ser uma questão financeira. Pode informar se é sobre boleto, pagamento ou fatura?';
    case 'support':
      return 'Parece ser suporte técnico. Pode descrever o problema com um pouco mais de detalhe?';
    case 'human_request':
      return 'Claro! Pode me adiantar sobre o que você gostaria de tratar? Assim direciono para a equipe certa.';
    default:
      return 'Pode me contar um pouco mais sobre o que você precisa? Assim consigo direcionar seu atendimento.';
  }
}
