/** Canal de origem da conversa — extensível para Cloud API */
export type InboxChannel = 'whatsapp_qr' | 'whatsapp_cloud';

/** Ciclo de vida da conversa no RadarZap Inbox */
export enum InboxConversationStatus {
  BOT_TRIAGE = 'bot_triage',
  WAITING_QUEUE = 'waiting_queue',
  IN_PROGRESS = 'in_progress',
  TRANSFERRED = 'transferred',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export type InboxMessageDirection = 'inbound' | 'outbound' | 'system';
