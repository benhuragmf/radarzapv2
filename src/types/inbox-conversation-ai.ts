/** TTL do estado ai_fallback_standard na conversa (24h). */
export const AI_FALLBACK_TTL_MS = 24 * 60 * 60 * 1000;

/** Status da camada IA — separado de InboxConversation.status. */
export type ConversationAiStatus =
  | 'ai_collecting'
  | 'ai_waiting_client'
  | 'ai_completed'
  | 'ai_escalated'
  | 'ai_fallback_standard'
  | 'human_assigned';

export function isAiFallbackExpired(
  aiStatus: ConversationAiStatus | null | undefined,
  aiFallbackUntil: Date | undefined,
  now = Date.now(),
): boolean {
  if (aiStatus !== 'ai_fallback_standard') return false;
  if (!aiFallbackUntil) return true;
  return now >= new Date(aiFallbackUntil).getTime();
}
