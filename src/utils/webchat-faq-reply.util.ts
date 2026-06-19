import type { WebChatKbSuggestion } from '@/types/webchat';

/** Score mínimo para listar artigo no seletor numerado (mais permissivo que resposta direta). */
export const WEBCHAT_FAQ_PICKER_MIN_SCORE = 2;

/** Máximo de opções numeradas por pergunta. */
export const WEBCHAT_FAQ_PICKER_MAX = 5;

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

export function buildWebChatFaqPickerIntro(count: number): string {
  if (count <= 1) {
    return 'Encontrei um artigo relacionado. Escolha abaixo para ver o conteúdo aqui no chat:';
  }
  return `Encontrei ${count} artigos relacionados. Escolha um para ver o conteúdo aqui no chat:`;
}

export function formatKbSuggestionLabel(index: number, label: string): string {
  return `${index} — ${label.trim()}`;
}

export function sanitizeKbSuggestions(
  items: Array<{ id?: string; label?: string; index?: number }> | undefined,
): WebChatKbSuggestion[] {
  if (!items?.length) return [];
  const out: WebChatKbSuggestion[] = [];
  for (const raw of items) {
    const id = String(raw.id ?? '').trim();
    const label = String(raw.label ?? '').trim().slice(0, 80);
    const index = Number(raw.index);
    if (!id || !label || !Number.isFinite(index) || index < 1 || index > 9) continue;
    out.push({ id, label, index: Math.floor(index) });
  }
  return out;
}
