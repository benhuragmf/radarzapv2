/** Detecta menção @supervisor no chat interno (case-insensitive). */
const SUPERVISOR_MENTION_RE = /@supervisor\b/i;

export function mentionsSupervisor(text: string): boolean {
  return SUPERVISOR_MENTION_RE.test(text.trim());
}
