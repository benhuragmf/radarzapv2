/** Normaliza texto para busca por palavras-chave (KB / skills). */
export function normalizeAiSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s@._-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'para', 'com', 'uma', 'que', 'por', 'mais', 'como', 'sobre', 'meu', 'minha',
  'preciso', 'ajuda', 'quero', 'esta', 'este', 'essa', 'esse', 'dos', 'das',
]);

export function tokenizeAiSearch(text: string, minLen = 3): string[] {
  return normalizeAiSearchText(text)
    .split(' ')
    .filter(t => t.length >= minLen && !STOPWORDS.has(t));
}

/** Pontua correspondência query × título+conteúdo (maior = melhor). */
export function scoreAiTextMatch(query: string, title: string, content: string): number {
  const qNorm = normalizeAiSearchText(query);
  const hay = normalizeAiSearchText(`${title} ${content}`);
  if (!qNorm || !hay) return 0;

  let score = 0;
  const tokens = tokenizeAiSearch(query);
  for (const token of tokens) {
    if (hay.includes(token)) score += 2;
  }

  const qWords = qNorm.split(' ').filter(w => w.length >= 4);
  for (const phrase of qWords) {
    if (hay.includes(phrase)) score += 1;
  }

  const titleNorm = normalizeAiSearchText(title);
  if (titleNorm && qNorm.includes(titleNorm)) score += 3;
  if (titleNorm && titleNorm.split(' ').some(w => w.length >= 4 && qNorm.includes(w))) score += 2;

  return score;
}

export const AI_AUTO_RESOLVE_MIN_SCORE = 4;
