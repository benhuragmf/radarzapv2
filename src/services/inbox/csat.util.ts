/** Parse nota CSAT 1–5 a partir da mensagem do cliente. */
export function parseCsatScore(text: string): number | null {
  const t = text.trim();
  if (!/^[1-5]$/.test(t)) return null;
  return Number.parseInt(t, 10);
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
