/** Contexto do último menu enviado ao contato (WhatsApp). */
export type InboxMenuContext =
  | 'inbox_triage'
  | 'ticket_followup'
  | 'ticket_grace_expired'
  | 'ticket_pick'
  | 'consent'
  | 'none';

/** TTL padrão para interpretar 1–4 como escolha de menu inbox. */
export const INBOX_MENU_CONTEXT_TTL_MS = 30 * 60 * 1000;

export function isMenuContextActive(
  context: InboxMenuContext | undefined,
  sentAt: Date | undefined,
  expected: InboxMenuContext,
  ttlMs = INBOX_MENU_CONTEXT_TTL_MS,
  now = Date.now(),
): boolean {
  if (!context || context !== expected || !sentAt) return false;
  return now - new Date(sentAt).getTime() <= ttlMs;
}
