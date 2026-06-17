/** Parse nota CSAT 1–5 a partir da mensagem do cliente. */
export function parseCsatScore(text: string): number | null {
  const t = text.trim();
  if (!/^[1-5]$/.test(t)) return null;
  return Number.parseInt(t, 10);
}

/** Cliente pediu para avaliar o atendimento (não é nota numérica). */
export function isCsatIntent(text: string): boolean {
  const norm = text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[!?.]+$/g, '');
  if (!norm) return false;
  if (/^(avaliar|avaliacao|avalia|nota|csat|pesquisa|satisfacao|feedback)$/.test(norm)) {
    return true;
  }
  return /\b(quero\s+)?avaliar(\s+o\s+atendimento)?\b/.test(norm);
}

/** Novo atendimento / humano — CSAT pendente não deve bloquear o Inbox. */
export function shouldBypassCsatForNewService(text: string): boolean {
  if (!text.trim() || isCsatIntent(text)) return false;
  const norm = text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[!?.]+$/g, '');
  if (!norm) return false;

  const greetings = [
    'oi',
    'ola',
    'bom dia',
    'boa tarde',
    'boa noite',
    'hello',
    'hi',
    'opa',
    'eai',
    'e ai',
    'novo atendimento',
    'quero atendimento',
    'preciso de ajuda',
    'atendimento',
    'pode me ajudar',
    'voce pode me ajudar',
    'me ajuda',
    'ajuda',
  ];
  if (greetings.some(g => norm === g || norm.startsWith(`${g} `) || norm.includes(g))) {
    return true;
  }
  if (/\b(falar com|quero falar|preciso falar|gostaria de)\b.*\b(atendente|humano|pessoa)\b/.test(norm)) {
    return true;
  }
  if (norm === 'novo' || norm === 'novo atendimento') return true;
  return false;
}

/** CSAT só quando não há atendimento ativo nem menu de setores em curso. */
export function shouldDeferCsatForActiveService(opts: {
  hasOpenConversation: boolean;
  inboxTriageActive: boolean;
}): boolean {
  return opts.hasOpenConversation || opts.inboxTriageActive;
}

export const DEFAULT_CSAT_PROMPT =
  'De *1* a *5*, como foi nosso atendimento?\n(1 = péssimo · 5 = excelente)\n\nResponda só com o número.';

export const DEFAULT_CSAT_THANK_YOU = 'Obrigado pela sua avaliação! 💚';
