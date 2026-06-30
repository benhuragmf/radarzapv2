/** Canal de origem da conversa — extensível para Cloud API e WebChat */
export type InboxChannel = 'whatsapp_qr' | 'whatsapp_cloud' | 'webchat_site';

/** Ciclo de vida da conversa no Radar Chat Inbox */
export enum InboxConversationStatus {
  BOT_TRIAGE = 'bot_triage',
  WAITING_QUEUE = 'waiting_queue',
  IN_PROGRESS = 'in_progress',
  TRANSFERRED = 'transferred',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export type InboxMessageDirection = 'inbound' | 'outbound' | 'system' | 'internal';

export type InboxMessageMediaType = 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location';
