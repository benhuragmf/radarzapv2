/** Resposta curta da FAQ para o widget (sem inventar conteúdo). */
export function buildWebChatFaqReplyBody(content: string, maxLen = 900): string {
  const trimmed = content.trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxLen) return trimmed;
  const slice = trimmed.slice(0, maxLen);
  const lastBreak = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '));
  if (lastBreak > maxLen * 0.5) return `${slice.slice(0, lastBreak).trimEnd()}…`;
  return `${slice.trimEnd()}…`;
}

export const WEBCHAT_FAQ_NO_MATCH_REPLY =
  'Não encontrei essa informação na base da empresa. Posso abrir um chamado ou encaminhar para um atendente — diga como prefere continuar.';
