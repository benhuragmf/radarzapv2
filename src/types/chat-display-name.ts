/** Política de nome fantasia exibido ao visitante no WebChat (e Inbox unificado). */
export type ChatDisplayNamePolicy = 'owner_only' | 'self_service' | 'approval_required';

export const CHAT_DISPLAY_NAME_MAX = 40;

export const CHAT_DISPLAY_NAME_POLICY_LABELS: Record<ChatDisplayNamePolicy, string> = {
  owner_only: 'Somente dono/admin define',
  self_service: 'Atendente altera sem aprovação',
  approval_required: 'Atendente solicita · dono aprova',
};

export function normalizeChatDisplayNamePolicy(raw: unknown): ChatDisplayNamePolicy {
  if (raw === 'owner_only' || raw === 'self_service' || raw === 'approval_required') {
    return raw;
  }
  return 'self_service';
}
