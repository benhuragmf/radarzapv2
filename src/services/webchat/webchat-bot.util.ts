export const WEBCHAT_BOT_SENDER_ID = 'bot';

export const DEFAULT_AUTO_REPLY_MESSAGE =
  'Recebemos sua mensagem! Um atendente responderá em breve.';

export interface AutoReplyCheckInput {
  autoReplyEnabled: boolean;
  autoReplyMessage?: string | null;
  autoReplyUseAi?: boolean;
  queueStatus?: string | null;
  assignedUserId?: string | null;
  hasHumanOutbound: boolean;
  hasBotOutbound: boolean;
}

export function shouldSendWebChatAutoReply(input: AutoReplyCheckInput): boolean {
  if (!input.autoReplyEnabled) return false;
  if (input.assignedUserId) return false;
  if (input.hasHumanOutbound) return false;
  if (input.queueStatus === 'waiting_human' || input.queueStatus === 'with_agent') {
    return false;
  }

  if (input.autoReplyUseAi) {
    return true;
  }

  if (!input.autoReplyMessage?.trim()) return false;
  if (input.hasBotOutbound) return false;
  return true;
}
