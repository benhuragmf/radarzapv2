/**
 * Limites de injeção no system prompt — compatível com Gemini e OpenAI (apenas texto no role system).
 * Inspirado no bootstrap do OpenClaw, adaptado para multi-tenant sem filesystem.
 */
export const AI_BOOTSTRAP_MAX_CHARS_PER_SECTION = 4000;
export const AI_BOOTSTRAP_MAX_CHARS_TOTAL = 24000;

const TRUNC_MARKER = '\n… (conteúdo truncado — edite no painel IA)';

export function truncateBootstrapText(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - TRUNC_MARKER.length)).trim()}${TRUNC_MARKER}`;
}

export interface BootstrapSection {
  key: string;
  title: string;
  content: string;
  maxChars?: number;
}

/** Monta blocos ## TÍTULO com truncamento por seção e limite total. */
export function buildBootstrapPrompt(sections: BootstrapSection[]): string {
  const parts: string[] = [];
  let used = 0;

  for (const sec of sections) {
    const max = sec.maxChars ?? AI_BOOTSTRAP_MAX_CHARS_PER_SECTION;
    const body = truncateBootstrapText(sec.content, max);
    if (!body) continue;
    const block = `## ${sec.title}\n${body}`;
    if (used + block.length > AI_BOOTSTRAP_MAX_CHARS_TOTAL) {
      const remaining = AI_BOOTSTRAP_MAX_CHARS_TOTAL - used - 80;
      if (remaining > 200) {
        parts.push(truncateBootstrapText(block, remaining));
      }
      break;
    }
    parts.push(block);
    used += block.length;
  }

  return parts.join('\n\n');
}

export function missingBootstrapLine(fileLabel: string): string {
  return `(${fileLabel} não configurado — edite em Inbox → IA)`;
}
